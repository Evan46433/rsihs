create table if not exists public.baraza_discussions (
  id uuid primary key default extensions.gen_random_uuid(),
  baraza_id integer not null references public.baraza_leader_accounts (baraza_id) on delete cascade,
  title text not null,
  topic text not null default '',
  scheduled_at timestamptz,
  chairperson text not null default '',
  configuration jsonb not null,
  status text not null default 'Draft'
    check (status in ('Draft', 'Ready', 'In Progress', 'Completed')),
  timer_state jsonb,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists baraza_discussions_baraza_updated_idx
  on public.baraza_discussions (baraza_id, updated_at desc);

alter table public.baraza_discussions enable row level security;
revoke all on public.baraza_discussions from public, anon, authenticated;
grant all on public.baraza_discussions to service_role;
