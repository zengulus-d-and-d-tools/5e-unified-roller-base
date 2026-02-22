# Ravnica Task Force Tools

A suite of lightweight, offline-first HTML tools for 5th Edition tabletop roleplaying games. Zero dependencies—just open the files in your browser.

Campaign management apps (Tools Hub, Campaign Hub, Case Board, Player Dashboard, NPC Roster, Locations DB, Requisition Vault, Mission Timeline, Encounter Recipes, HQ Foundry) share a unified Local Storage object (`RTF_STORE`). Import/export once from the Tools Hub and those pages stay in lockstep. Lead Queue and both clock pages use dedicated local-storage keys; Lead Queue and Prep/Procedure still integrate with case context and timeline/board links.

Optional Supabase cloud sync is available for the shared `RTF_STORE` stack. See **[Supabase Sync Setup](docs/SupabaseSync.md)**.

## Components

Each tool runs offline. The campaign stack (Hub, Board, Dashboard, Roster, Locations, Requisitions, Timeline, Encounters, HQ) shares the `RTF_STORE` object. Lead Queue, Prep/Procedure, and Clocks keep page-owned state keys; Lead Queue and Prep/Procedure cross-link into the campaign stack while Clocks remains standalone.

| Tool | File | Description |
|------|------|-------------|
| **[Tools Hub](docs/ToolsHub.md)** | `tools.html` | Launchpad with import/export controls, active case switching (Board/Timeline scope), palette settings, and hidden DM utilities (cloud admin + fork seed-file generators for guilds/NPCs/locations). |
| **[Player Sheet](docs/PlayerSheet.md)** | `index.html` | Command-console sheet with automation, roller, creator, and Discord/webhook hooks. |
| **[Player Dashboard](docs/PlayerDashboard.md)** | `player-dashboard.html` | Grid of agent AC/HP/passives for table displays or DM quick reference. |
| **[Campaign Hub](docs/CampaignHub.md)** | `hub.html` | Heat, guild reputation, case prep, and downtime roster tracking. |
| **[NPC Roster](docs/NPCRoster.md)** | `roster.html` | Contact database with guild filters, leverage fields, and inline editing. |
| **[Locations Database](docs/LocationsDatabase.md)** | `locations.html` | Safehouse/district log with filters, notes, and guild tagging. |
| **[Requisition Vault](docs/RequisitionVault.md)** | `requisitions.html` | Gear request queue with status, priority, and tagging. |
| **[Mission Timeline](docs/MissionTimeline.md)** | `timeline.html` | Beat log with heat deltas, fallout notes, and filters. |
| **[Lead Queue](docs/Leads.md)** | `leads.html` | Case-scoped investigation threads with voting and jump-to-board/timeline actions. |
| **[Prep & Procedure Clocks](docs/PrepProcedureClocks.md)** | `prep-procedure.html` | Dual progress clocks with prep token bubbles and searchable prompt examples. |
| **[Clocks](docs/Clocks.md)** | `clocks.html` | Generic progress/danger clocks with per-clock controls and PNG exports. |
| **[Session Tracker](docs/SessionTracker.md)** | `gm.html` | Multi-tab GM console (initiative, roller, reference, loot). |
| **[Encounter Recipes](docs/EncounterRecipes.md)** | `encounters.html` | Reusable encounter cards with tier tags and searchable notes. |
| **[Narrative Engine](docs/NarrativeEngine.md)** | `dm-screen.html` | Procedural prompts, NPC hooks, and hazard/debrief generators. |
| **[Case Board](docs/CaseBoard.md)** | `board.html` | Physics-based investigation board with pop-up data sources. |
| **[Clue Generator](docs/ClueGenerator.md)** | `clue.html` | Signal vs Noise intersection generator for mysteries. |
| **[HQ Layout Foundry](docs/HQLayoutFoundry.md)** | `hq.html` | Multi-floor HQ designer with downtime slots and screenshot/export tools. |
| **[Tournament Bracket](docs/TournamentBracket.md)** | `tourney.html` | Double-elimination bracket with SVG connections and score modal. |

## Usage
Open any `.html` file in a modern browser (Edge, Chrome, Firefox). Data writes to Local Storage automatically. Import/export JSON via Tools Hub for the shared campaign stack, and use page-specific import/export controls where available (for example Character Sheet, Session Tracker, HQ Foundry, Campaign Hub).

To enable multi-device player/DM sync on GitHub Pages deployments, configure Supabase from the Tools Hub panel after following **[Supabase Sync Setup](docs/SupabaseSync.md)**.
For simpler player onboarding, share/import a `connect.json` profile (also documented in **[Supabase Sync Setup](docs/SupabaseSync.md)**).

For a comprehensive guide on using the player tools, see **[Player Guide](player.md)**.

## License
The Unlicense (Public Domain).

## Legal
This project is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.

**Specific IP Used:**
* Setting: Ravnica, Guild names, and associated flavor are property of Wizards of the Coast.
* Spell rules content in `js/srd-5.2-spells.json` is derived from the *System Reference Document 5.2 (SRD 5.2)* by Wizards of the Coast LLC.

**SRD 5.2 License + Attribution (for included spell data):**
* License: [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
* Source: [D&D SRD 5.2](https://www.dndbeyond.com/srd)
* Attribution: This work includes material from the *System Reference Document 5.2 (SRD 5.2)* by Wizards of the Coast LLC, available under the [CC BY 4.0 license](https://creativecommons.org/licenses/by/4.0/).

**Third-Party Libraries:**
* [pdf.js](https://github.com/mozilla/pdf.js) - [Apache-2.0 License](https://www.apache.org/licenses/LICENSE-2.0)



## Related Project
For a less setting-specific version of this toolset, see [5e-unified-roller-base](https://github.com/zengulus-d-and-d-tools/5e-unified-roller-base).
