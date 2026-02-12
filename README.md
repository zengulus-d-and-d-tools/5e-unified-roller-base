# Campaign Tools

A suite of lightweight, offline-first HTML tools for 5e play. No build step or dependencies required.

## Data Model

Most campaign apps share one Local Storage object: `RTF_STORE`.

Shared stack:
- Tools Hub
- Campaign Hub
- Case Board
- Player Dashboard
- NPC Roster
- Locations Database
- Requisition Vault
- Mission Timeline
- Encounter Recipes
- HQ Layout Foundry

Standalone/local apps:
- Character Sheet (`index.html`)
- Session Tracker (`gm.html`)
- Tournament Bracket (`tourney.html`)

Hybrid behavior:
- Narrative Engine (`dm-screen.html`) and Clue Generator (`clue.html`) read group names from shared `RTF_STORE` reputation data, but do not maintain their own persistent campaign objects.

Optional cloud sync for `RTF_STORE` is available with Supabase. See **[Supabase Sync Setup](docs/SupabaseSync.md)**.

For custom starter datasets, see **[Preload Guide](docs/Preloads.md)**.

## Components

| Tool | File | Description |
|------|------|-------------|
| **[Tools Hub](docs/ToolsHub.md)** | `tools.html` | Entry point for import/export, case context, group loader wizard, and cloud sync controls. |
| **[Player Sheet](docs/PlayerSheet.md)** | `index.html` | Command-console character sheet with roller, automation, and JSON save/load. |
| **[Player Dashboard](docs/PlayerDashboard.md)** | `player-dashboard.html` | At-a-glance AC/PP/DC/HP grid for active players. |
| **[Campaign Hub](docs/CampaignHub.md)** | `hub.html` | Case prep, reputation/heat tracking, and downtime project clocks. |
| **[NPC Roster](docs/NPCRoster.md)** | `roster.html` | Searchable NPC list with wants, leverage, notes, and link-to-board actions. |
| **[Locations Database](docs/LocationsDatabase.md)** | `locations.html` | Place registry with area/group filtering and inline editing. |
| **[Requisition Vault](docs/RequisitionVault.md)** | `requisitions.html` | Shared request queue with status/priority workflow and quick filters. |
| **[Mission Timeline](docs/MissionTimeline.md)** | `timeline.html` | Event chronicle with fallout, heat deltas, and recap export. |
| **[Session Tracker](docs/SessionTracker.md)** | `gm.html` | GM combat/roller/loot console with its own local save. |
| **[Encounter Recipes](docs/EncounterRecipes.md)** | `encounters.html` | Reusable encounter cards with tier filtering and tracker handoff. |
| **[Narrative Engine](docs/NarrativeEngine.md)** | `dm-screen.html` | Improvisation prompts for scene beats, texture, hazards, and aftermath. |
| **[Case Board](docs/CaseBoard.md)** | `board.html` | Freeform investigation board with connected nodes and data popups. |
| **[Clue Generator](docs/ClueGenerator.md)** | `clue.html` | True-clue vs false-lead pair generator keyed to current groups. |
| **[HQ Layout Foundry](docs/HQLayoutFoundry.md)** | `hq.html` | Multi-floor HQ planner with downtime slots and resource bays. |
| **[Tournament Bracket](docs/TournamentBracket.md)** | `tourney.html` | Double-elimination bracket builder with score reporting. |

## Usage

1. Open `tools.html`.
2. Import a campaign snapshot (if you have one).
3. Set active case context and optional group list in Tools Hub.
4. Open the other tools as needed.

To sync across devices:
- Follow **[Supabase Sync Setup](docs/SupabaseSync.md)**.
- Use `connect.json` onboarding for players.

For preload starter data:
- Follow **[Preload Guide](docs/Preloads.md)**.

For player-facing walkthroughs, see **[Player Guide](player.md)**.

## License

The Unlicense (Public Domain).

## Legal

This repository ships setting-neutral tooling and starter data. Any campaign-specific content should be added by the table using it.

Third-party library:
- [pdf.js](https://github.com/mozilla/pdf.js) ([Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0))
