# Supabase Sync (`RTF_STORE`)

Optional cloud sync for shared campaign tools:
- `hub.html`
- `board.html`
- `player-dashboard.html`
- `roster.html`
- `locations.html`
- `requisitions.html`
- `timeline.html`
- `encounters.html`
- `hq.html`

Not included in this sync path:
- Character Sheet (`index.html`)
- Session Tracker (`gm.html`)
- Tournament Bracket (`tourney.html`)

## 1. Create Table

Run in Supabase SQL Editor:

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

Trusted-table quick start:

```sql
drop policy if exists "rtf_campaign_state_auth_rw" on public.rtf_campaign_state;

create policy "rtf_campaign_state_auth_rw"
on public.rtf_campaign_state
for all
to authenticated
using (true)
with check (true);
```

## 3. Enable Realtime Postgres Changes

```sql
alter publication supabase_realtime
add table public.rtf_campaign_state;
```

If already present, duplicate-entry warnings are safe to ignore.

## 4. Enable Anonymous Auth (Recommended)

1. Supabase Dashboard -> `Authentication` -> `Providers`
2. Enable `Anonymous`

## 5. Configure in Tools Hub

1. Open `tools.html`
2. Enter secret mode (`Alt+Shift+Click` page title)
3. Fill Cloud Sync fields:
   - `Project URL`
   - `Anon Key`
   - `Campaign ID`
   - `Profile Name` (optional)
4. Click `Save Config` then `Connect`

Manual controls:
- `Pull Latest`
- `Push Now`
- conflict resolution (`Accept Remote` / `Keep Local + Merge Push`)

## 6. `connect.json` Onboarding

DM flow:
1. Configure sync in Tools Hub.
2. Click `Export connect.json`.
3. Share file with players.

Player flow:
1. Open `tools.html`.
2. Click `Import connect.json`.
3. Select provided file.

Optional bundled default:
- Place `connect.json` next to `tools.html`.
- It auto-applies on first run when no local sync config exists.

Example:

```json
{
  "supabaseUrl": "https://your-project-ref.supabase.co",
  "anonKey": "your-anon-public-key",
  "campaignId": "unified-main",
  "profileName": ""
}
```

Accepted aliases:
- `projectUrl` or `url` -> `supabaseUrl`
- `key` or `publicKey` -> `anonKey`
- `slug` or `campaign` -> `campaignId`

## Sync Notes

- Local saves happen first (offline-first).
- First connect force-pulls remote state as baseline.
- Revisions and scope-based conflict checks are built in.
- Overlapping edits enter conflict mode and require explicit resolution.
- Board node `x/y` layout stays local per client; node content/links sync.
