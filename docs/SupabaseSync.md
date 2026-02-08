# Supabase Sync (`RTF_STORE`)

Optional cloud sync for the shared campaign stack (`hub`, `board`, `roster`, `locations`, `requisitions`, `timeline`, `encounters`, `hq`, `player-dashboard`).

The Character Sheet (`index.html`) is intentionally separate and remains local per browser by default.

## 1. Create Table

Run this in Supabase SQL Editor:

```sql
create table if not exists public.rtf_campaign_state (
  campaign_id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by text,
  updated_by_user uuid references auth.users(id) on delete set null,
  updated_by_name text
);

alter table public.rtf_campaign_state enable row level security;
```

## 2. Add Baseline Policy

For fast setup (trusted table/users), allow any authenticated user:

```sql
drop policy if exists "rtf_campaign_state_auth_rw" on public.rtf_campaign_state;

create policy "rtf_campaign_state_auth_rw"
on public.rtf_campaign_state
for all
to authenticated
using (true)
with check (true);
```

If you need stricter campaign membership policies, add those after initial validation.

## 3. Enable Realtime

In Supabase dashboard:

1. Go to `Database` -> `Replication`.
2. Enable replication for table `public.rtf_campaign_state`.
3. Ensure `INSERT`, `UPDATE`, `DELETE` are included.

## 4. Enable Anonymous Auth (Recommended)

This app auto-signs in anonymously for shared tablet/URL use:

1. Go to `Authentication` -> `Providers`.
2. Enable `Anonymous` provider.

If you do not want anonymous auth, use email magic links and custom policies.

## 5. Configure In Tools Hub

Open `tools.html` and fill the Cloud Sync panel:

- `Project URL`: `https://<project-ref>.supabase.co`
- `Anon Key`: Supabase anon/public key
- `Campaign ID`: shared slug like `ravnica-main`
- `Profile Name`: optional display label

Then click:

- `Save Config`
- `Connect`

Use `Pull Latest` and `Push Now` for manual control; normal edits auto-sync with a short debounce.

## Notes

- Sync is offline-first: local state always saves immediately.
- Remote updates are pushed/pulled with last-write-wins behavior.
- Campaign tools share one cloud row per `campaign_id`.
- Character sheets are not part of this sync path unless you add a separate sheet sync layer.
