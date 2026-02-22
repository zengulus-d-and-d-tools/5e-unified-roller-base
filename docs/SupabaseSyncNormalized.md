# Supabase Sync: Hybrid Normalized Model

This is an optional high-concurrency schema for teams that want better simultaneous editing than the current single-row `rtf_campaign_state` model.

## Why this model

- `rtf_campaign_state` is simple, but any write touches a very large document.
- Conflict probability rises when multiple people edit different things at the same time.
- The best concurrency gain comes from smaller write boundaries (row-per-entity), not from deep relational 3NF alone.

## Proposed table split

Use one row per independently edited object:

- `rtf_campaign_core`: one row per campaign (rep, heat, case template/meta).
- `rtf_campaign_hq`: one row per campaign (HQ payload).
- `rtf_case_state`: one row per case (name/order/active flag).
- `rtf_case_boards`: one row per case board.
- `rtf_case_events`: one row per timeline event.
- `rtf_campaign_players`: one row per player.
- `rtf_campaign_npcs`: one row per NPC.
- `rtf_campaign_locations`: one row per location.
- `rtf_campaign_requisitions`: one row per requisition.
- `rtf_campaign_encounters`: one row per encounter.

Each row keeps:

- `payload jsonb` for low-friction app migration.
- `revision bigint` for optimistic concurrency checks.
- `updated_at`, `updated_by`, `updated_by_user`, `updated_by_name`.

## Scope-to-table mapping

- `campaign.heat`, `campaign.rep`, `campaign.case` -> `rtf_campaign_core`
- `campaign.players` -> `rtf_campaign_players`
- `campaign.npcs` -> `rtf_campaign_npcs`
- `campaign.locations` -> `rtf_campaign_locations`
- `campaign.requisitions` -> `rtf_campaign_requisitions`
- `campaign.encounters` -> `rtf_campaign_encounters`
- `cases.meta` -> `rtf_case_state`
- `cases.<id>.board` -> `rtf_case_boards`
- `cases.<id>.events` -> `rtf_case_events`
- `hq` -> `rtf_campaign_hq`

## Optimistic write contract

On write:

1. Read row with current `revision`.
2. `update ... where revision = :base_revision`.
3. Set `revision = revision + 1` when update succeeds.
4. If zero rows updated, fetch latest and merge/retry or surface conflict.

This mirrors your current conflict model in `js/store.js`, but at narrower row boundaries.

## Rollout plan (recommended)

1. Create normalized tables and RLS policies.
2. Backfill from `rtf_campaign_state` once.
3. Deploy app version with dual-write (legacy + normalized), read from legacy.
4. Validate parity for 1-2 sessions.
5. Switch reads to normalized tables (keep legacy fallback).
6. After soak period, disable legacy writes.
7. Archive then drop `rtf_campaign_state` when confident.

## SQL

Run `docs/SupabaseSyncNormalized.sql` in Supabase SQL Editor.

## Client Config (`RTF_STORE`)

`js/store.js` now supports sync backend modes:

- `legacy` (default): existing single-row `rtf_campaign_state` flow.
- `legacy_mirror`: reads/writes legacy row, then mirrors writes to normalized tables.
- `normalized`: reads/writes normalized tables directly.

You can set this via `RTF_SYNC_BOOTSTRAP`, `setSyncConfig(...)`, or `connect.json`:

```json
{
  "backendMode": "normalized",
  "normalizedCoreTable": "rtf_campaign_core",
  "normalizedHQTable": "rtf_campaign_hq",
  "normalizedCaseStateTable": "rtf_case_state",
  "normalizedCaseBoardsTable": "rtf_case_boards",
  "normalizedCaseEventsTable": "rtf_case_events",
  "normalizedPlayersTable": "rtf_campaign_players",
  "normalizedNPCsTable": "rtf_campaign_npcs",
  "normalizedLocationsTable": "rtf_campaign_locations",
  "normalizedRequisitionsTable": "rtf_campaign_requisitions",
  "normalizedEncountersTable": "rtf_campaign_encounters"
}
```
