create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.baraza_leader_accounts (
  baraza_id integer primary key check (baraza_id between 1 and 17),
  head_leader text not null,
  access_code_hash text not null check (access_code_hash ~ '^\$2[aby]\$12\$'),
  enabled boolean not null default true
);

create table if not exists public.baraza_login_rate_limits (
  client_ip inet primary key,
  window_started_at timestamptz not null default now(),
  attempt_count smallint not null default 0,
  blocked_until timestamptz
);

create index if not exists baraza_login_rate_limits_window_idx
  on public.baraza_login_rate_limits (window_started_at);

alter table public.baraza_leader_accounts enable row level security;
alter table public.baraza_login_rate_limits enable row level security;

revoke all on public.baraza_leader_accounts from public, anon, authenticated;
revoke all on public.baraza_login_rate_limits from public, anon, authenticated;
grant all on public.baraza_leader_accounts to service_role;
grant all on public.baraza_login_rate_limits to service_role;

insert into public.baraza_leader_accounts (baraza_id, head_leader, access_code_hash) values
  (1, 'Bhavya Sharma 10G', '$2a$12$4LQDS17KwEH1yrHTxfSg..UYVBnDFcdV4pAQTBWZ4O0AuijEmjcPi'),
  (2, 'Priyal Tyagi 11 SCI C', '$2a$12$8oKpucguevrlhpvDlshQgeySSAPVdquz/xJVY6PgyAtIigdCVuia2'),
  (3, 'Mayukha Preman 12 SCI A', '$2a$12$45ut6lm0AALHRoywNabjluN5N53SDZKkoQEE.QRVz4ctfiqusCms6'),
  (4, 'Yogit Myneni 10', '$2a$12$eBrtsja6GwlwH3SAIk1F0eS/t2houd8QXUFY9RSncMIEcDhph4rsS'),
  (5, 'Kashish Wadhwani 12 COM C', '$2a$12$EK9wtkhgKUYROOzBV5KB7eswOB340YSUy1wb164.HbeOi4Vge5Xom'),
  (6, 'Vedanth Oolath', '$2a$12$pY5raXsHPZgSz1nYdo0ohelgyLHMk2ke4DKZ5Gmt.n1OC/E7tGTUS'),
  (7, 'Mahadevan Surya 10M', '$2a$12$ItYXcEDQgkF6z64dzDim/u7hN44P8phAzlEwiuStmx1SyGYo5Pkdi'),
  (8, 'Khadeeja Sheza 12 COM A', '$2a$12$XNyYCEvn.3jg5NmaSIv4Yu8iaOQjUUGDvdKSpKB3Z9w6c/xhU.V8e'),
  (9, 'Arnav Burade 11 SCI I', '$2a$12$h1wmOHsWlQjGQ5NHIimeMuD/KTneSjVOR.pVwFCjeh29Rcrh9zpAO'),
  (10, 'Ishanshi Vegad 11 SCI A', '$2a$12$CkApAFS86mdS8DrefiCYGefon6EvDiSXdr1dbRHGrli8MBu13FE5S'),
  (11, 'Hyfa Maryam 10C', '$2a$12$1WhDgCLAixrKN8yHmNxXue6cOZC6MB1drq11wPg5ocO.SYC8/e73S'),
  (12, 'Ayaan Mustafa Ali 12 SCI K', '$2a$12$Rb7T3lpmK.79ob4vqizSve/Ot7J.Vh/ZQSIILiiikoohZz7JXIC4i'),
  (13, 'Vaishnavi Vinod 12 COM C', '$2a$12$yUt3vqO3wdP8aNd9vrfqbezfiCvBi1cCW1vHX3bxcHcyRvpyWz1kK'),
  (14, 'Arnav Payyaram 12 COM B', '$2a$12$XwE.oesHB9pGBPv2wBScqO.DpT8b5r0aWK5qa0i2X0ZaVHBM77cDS'),
  (15, 'Vamika Handa 10B', '$2a$12$btptyzPHkKSRGh81Yr1Hi.uKapFkcCKTPEV6PndEwf9rUNXZ1EUYW'),
  (16, 'Ram Prasad 12 COM F', '$2a$12$nIJWyhbvs/kqArYLHHnvdOgQhIv2/9ltCoz4WmbhOVBUTtur8dPXe'),
  (17, 'Tiana Paul 10C', '$2a$12$eE7.as1Bw2I1WTpYh2UBbONW5kn7F82KdA7ikdoLCiuKRlbpCmyoe')
on conflict (baraza_id) do update
set head_leader = excluded.head_leader,
    access_code_hash = excluded.access_code_hash;

create or replace function public.authenticate_baraza_leader(
  p_full_name text,
  p_access_code text,
  p_client_ip inet
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_baraza_id integer;
  v_attempt_count smallint;
  v_blocked_until timestamptz;
  v_window_started_at timestamptz;
begin
  if p_client_ip is null then
    raise exception 'A client IP is required for Baraza login rate limiting';
  end if;

  delete from public.baraza_login_rate_limits
  where window_started_at < now() - interval '1 day';

  insert into public.baraza_login_rate_limits (client_ip)
  values (p_client_ip)
  on conflict (client_ip) do nothing;

  select attempt_count, blocked_until, window_started_at
  into v_attempt_count, v_blocked_until, v_window_started_at
  from public.baraza_login_rate_limits
  where client_ip = p_client_ip
  for update;

  if v_window_started_at < now() - interval '15 minutes' then
    update public.baraza_login_rate_limits
    set window_started_at = now(), attempt_count = 0, blocked_until = null
    where client_ip = p_client_ip;
    v_attempt_count := 0;
    v_blocked_until := null;
  end if;

  if v_blocked_until > now() then
    return null;
  end if;

  select account.baraza_id
  into v_baraza_id
  from public.baraza_leader_accounts as account
  where account.enabled
    and lower(btrim(p_full_name)) = 'rsbaraza'
    and p_access_code ~ '^[0-9]{5}$'
    and extensions.crypt(p_access_code, account.access_code_hash) = account.access_code_hash;

  if v_baraza_id is null then
    v_attempt_count := least(v_attempt_count + 1, 10);
    update public.baraza_login_rate_limits
    set attempt_count = v_attempt_count,
        blocked_until = case
          when v_attempt_count >= 10 then now() + interval '15 minutes'
          else null
        end
    where client_ip = p_client_ip;
  end if;

  return v_baraza_id;
end;
$$;

revoke all on function public.authenticate_baraza_leader(text, text, inet) from public, anon, authenticated;
grant execute on function public.authenticate_baraza_leader(text, text, inet) to service_role;
