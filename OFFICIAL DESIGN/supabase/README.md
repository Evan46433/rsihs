# Baraza leader authentication deployment

The leader sign-in and Baraza discussion planner are served by the `baraza-leader-auth` Edge Function. Database migrations store bcrypt hashes of the 17 access codes, enable login rate limiting, and keep both leader accounts and saved discussions accessible only to the backend service role.

Deploy from the repository root after confirming the Supabase project reference:

```sh
supabase link --project-ref hvhpqvoizqsslbqwdymw
supabase secrets set BARAZA_SESSION_SECRET="$(openssl rand -hex 32)"
supabase db push
supabase functions deploy baraza-leader-auth
```

When deploying the Discussion Planner update, run `supabase db push` to apply `20261014010000_baraza_discussions.sql`, then redeploy `baraza-leader-auth` so the function supports discussion storage, timer updates, and deleting archived discussions.

The Supabase Edge Function runtime provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Do not expose the service-role key or `BARAZA_SESSION_SECRET` in website files. The public sign-in page only uses the existing publishable key.

The shared leader sign-in name is `rsbaraza`; the five-digit code determines the assigned Baraza. The backend compares the name and code together and returns the same invalid-credentials response for every failed attempt.
