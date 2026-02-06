# Ravnica Task Force Tools

A suite of lightweight, offline-first HTML tools for 5th Edition tabletop roleplaying games. Zero dependencies—just open the files in your browser.

Campaign management apps (Tools Hub, Campaign Hub, Case Board, Player Dashboard, NPC Roster, Locations DB, Requisition Vault, Mission Timeline, Encounter Recipes, HQ Foundry) share a unified Local Storage object (`RTF_STORE`). Import/export once from the Tools Hub and those pages stay in lockstep. Other utilities—Player Sheet, Session Tracker, Narrative Engine, Clue Generator, and Tournament Bracket—use their own lightweight storage or rely on inline data.

## Components

Each tool runs offline. The campaign stack (Hub, Board, Dashboard, Roster, Locations, Requisitions, Timeline, Encounters, HQ) shares the `RTF_STORE` object, while utilities like the Player Sheet or Session Tracker keep their own saves.

| Tool | File | Description |
|------|------|-------------|
| **[Tools Hub](docs/ToolsHub.md)** | `tools.html` | Launchpad with import/export controls, palette settings, and (optionally hidden) DM utilities. |
| **[Player Sheet](docs/PlayerSheet.md)** | `index.html` | Command-console sheet with automation, roller, creator, and Discord/webhook hooks. |
| **[Player Dashboard](docs/PlayerDashboard.md)** | `player-dashboard.html` | Grid of agent AC/HP/passives for table displays or DM quick reference. |
| **[Campaign Hub](docs/CampaignHub.md)** | `hub.html` | Heat, guild reputation, case prep, and downtime roster tracking. |
| **[NPC Roster](docs/NPCRoster.md)** | `roster.html` | Contact database with guild filters, leverage fields, and inline editing. |
| **[Locations Database](docs/LocationsDatabase.md)** | `locations.html` | Safehouse/district log with filters, notes, and guild tagging. |
| **[Requisition Vault](docs/RequisitionVault.md)** | `requisitions.html` | Gear request queue with status, priority, and tagging. |
| **[Mission Timeline](docs/MissionTimeline.md)** | `timeline.html` | Beat log with heat deltas, fallout notes, and filters. |
| **[Session Tracker](docs/SessionTracker.md)** | `gm.html` | Multi-tab GM console (initiative, roller, reference, loot). |
| **[Encounter Recipes](docs/EncounterRecipes.md)** | `encounters.html` | Reusable encounter cards with tier tags and searchable notes. |
| **[Narrative Engine](docs/NarrativeEngine.md)** | `dm-screen.html` | Procedural prompts, NPC hooks, and hazard/debrief generators. |
| **[Case Board](docs/CaseBoard.md)** | `board.html` | Physics-based investigation board with pop-up data sources. |
| **[Clue Generator](docs/ClueGenerator.md)** | `clue.html` | Signal vs Noise intersection generator for mysteries. |
| **[HQ Layout Foundry](docs/HQLayoutFoundry.md)** | `hq.html` | Multi-floor HQ designer with downtime slots and screenshot/export tools. |
| **[Tournament Bracket](docs/TournamentBracket.md)** | `tourney.html` | Double-elimination bracket with SVG connections and score modal. |

## Usage
Open any `.html` file in a modern browser (Edge, Chrome, Firefox). Data writes to Local Storage automatically. Import/export JSON via the Tools Hub (or each page’s local buttons) to migrate between machines or share with your table.

For a comprehensive guide on using the player tools, see **[Player Guide](player.md)**.

## License
The Unlicense (Public Domain).
