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

## 3. Enable Realtime Postgres Changes (Free-Tier Friendly)

Do this in SQL Editor (not the separate Database Replication/ETL feature):

```sql
alter publication supabase_realtime
add table public.rtf_campaign_state;
```

If the table is already in the publication, Supabase may return a harmless duplicate-entry style message.

This project uses Realtime Postgres Changes. It does **not** require the paid/alpha Database Replication pipeline.

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

### Where To Find These

- `Project URL`:
  - Supabase dashboard -> `Settings` -> `API` -> `Project URL`
- `Anon Key`:
  - Supabase dashboard -> `Settings` -> `API` -> `Project API keys` -> `anon` / `public`
- `Campaign ID` (shared slug):
  - You choose this value. Everyone joining the same campaign must use the exact same string.
  - Recommended format: lowercase with dashes, e.g. `ravnica-main`, `table-alpha-2026`.
  - Avoid spaces/special characters to prevent typo mismatches.
- `Profile Name`:
  - Any label you want shown in sync metadata, e.g. `DM-Laptop`, `Player-Tablet-1`.

Then click:

- `Save Config`
- `Connect`

Use `Pull Latest` and `Push Now` for manual control; normal edits auto-sync with a short debounce.

## 6. `connect.json` Workflow (Recommended For Players)

This project supports a simple `connect.json` profile so players do not need to manually enter Supabase details.

### DM Flow

1. Open `tools.html`.
2. Enter cloud settings in secret mode (`Alt+Shift+Click` title).
3. Click `Export connect.json`.
4. Share that file with players.

### Player Flow

1. Open `tools.html`.
2. Click `Import connect.json`.
3. Select DM-provided file.
4. Sync connects automatically.

### Bundled Default (Optional)

If you place a `connect.json` file at the site root (same level as `tools.html`), Tools Hub will auto-apply it on first run when no sync config is already saved locally.

### `connect.json` Format

```json
{
  "supabaseUrl": "https://your-project-ref.supabase.co",
  "anonKey": "your-anon-public-key",
  "campaignId": "ravnica-main",
  "profileName": ""
}
```

Accepted aliases are also supported:
- `projectUrl` or `url` for `supabaseUrl`
- `key` or `publicKey` for `anonKey`
- `slug` or `campaign` for `campaignId`

## Notes

- Sync is offline-first: local state always saves immediately.
- First cloud connect in a browser session force-pulls remote state; remote is treated as source-of-truth at initial load.
- Remote sync now uses optimistic conflict checks with per-state `meta.syncRevision`.
- If remote changes overlap local edits, sync enters `conflict` mode and must be resolved from `tools.html` (`Accept Remote` or `Keep Local + Merge Push`).
- Non-overlapping conflicts auto-merge by scope (for example board vs requisitions).
- Reconciliation pulls run on an interval while connected to reduce drift during longer sessions.
- Realtime presence advertises active peers and soft-lock scopes to reduce accidental overwrite collisions.
- Campaign tools share one cloud row per `campaign_id`.
- Case Board node layout (`x/y` position) is local-only per client. Node content and links still sync.
- Character sheets are not part of this sync path unless you add a separate sheet sync layer.
