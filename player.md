# Player Guide: Campaign Tools

This guide covers what each page does and how data is saved.

## Start Here

Open `tools.html` first.

Use it to:
- import/export shared campaign data
- switch active case context
- optionally load group names with the Group Loader Wizard (`Alt+Shift+L`)

## Core Player Pages

## Character Sheet (`index.html`)
- Personal character sheet with roller, rests, spells, inventory, and feature tracking.
- Saves to its own Local Storage keys.
- Use the sheet's own JSON save/load controls to move data between devices.

## Campaign Dashboard (`player-dashboard.html`)
- Quick AC, Passive Perception, Save DC, and HP overview for active players.
- Uses shared `RTF_STORE` data.

## NPC Roster (`roster.html`)
- Contact list with group tag, wants, leverage, notes, and optional image URL.
- Includes copy-link and open-on-board actions per NPC.

## Locations Database (`locations.html`)
- Place log with area/group filtering, description, notes, and optional image URL.
- Includes copy-link and open-on-board actions per location.

## Case Board (`board.html`)
- Drag-and-connect investigation board for people, places, clues, events, and requisitions.
- Active case is determined by Tools Hub case context.

## Other Shared Campaign Pages

- `hub.html` (Campaign Hub): case brief, reputation/heat, downtime clocks.
- `timeline.html` (Mission Timeline): session events, fallout, heat deltas, recap export.
- `requisitions.html` (Requisition Vault): request queue and approvals.
- `encounters.html` (Encounter Recipes): reusable encounter cards.
- `hq.html` (HQ Layout Foundry): headquarters floor planning.

## DM-Facing Utility Pages

- `dm-screen.html` (Narrative Engine): scene beats, texture, hazard/snag, NPC prompts.
- `clue.html` (Clue Generator): true-clue vs false-lead generation.
- `gm.html` (Session Tracker): initiative/roller/loot tools with separate local storage.
- `tourney.html` (Tournament Bracket): double-elimination bracket manager with separate local storage.

## Data and Sync

Shared data (`RTF_STORE`):
- tools, hub, board, dashboard, roster, locations, requisitions, timeline, encounters, hq

Standalone/local data:
- character sheet, session tracker, tournament bracket

Narrative/clue behavior:
- read current group names from shared store reputation map
- do not store campaign entities of their own

Optional multi-device sync for shared data is available via Supabase:
- see `docs/SupabaseSync.md`
