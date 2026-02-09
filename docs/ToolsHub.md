# Tools Hub (`tools.html`)

Landing grid for the entire suite. Open it first to import/export the unified data store, tweak the accent palette, or hand players a jumping-off point.

## Layout
- **Hero Header** – Import/Export buttons live up top along with the accent picker and background cycler. Alt+Shift+Click the title to expose DM-only cards (Hub, GM deck, Clue tools, etc.).
- **Cloud Connect Panel** – Player-facing import for `connect.json` plus a bundled-default shortcut so clients can join without manual key entry.
- **Cloud Sync Panel (Secret Mode)** – Manual Supabase URL/key/campaign controls, export of `connect.json`, and admin pull/push actions. This panel is intentionally behind Alt+Shift secret mode.
- **Customise Seed Panel (Secret Mode)** – Hidden fork helper that loads default/store guild + NPC + location data and exports fork-ready `data-guilds*.js`, `data-npcs*.js`, and `data-locations*.js` files.
- **Card Grid** – Responsive cards link to every HTML tool (player sheet, dashboards, HQ, timeline, etc.). Icons and short blurbs help the table pick the right door quickly.
- **Secret Panel** – DM-only cards are tagged with 🔒-red borders; once the secret mode is active they fade in with a light animation.

## Tips
- Always import campaign data here first—the Hub, Board, Dashboard, Roster, Locations, Requisitions, Timeline, Encounters, and HQ pages all read from the same store, so one import primes the entire campaign stack.
- For multiplayer web deployments, set up Supabase once and use the Cloud Sync panel for realtime-ish shared campaign updates.
- If you’re forking this repo, use the secret Customise panel to export fresh preload scripts for guilds/NPCs/locations, then drop them into `js/data-guilds.js`, `js/data-npcs.js`, and `js/data-locations.js`.
- Use the accent picker before a session so all other pages inherit the same neon colorway.
- Hide DM cards during open-table play so players only see approved utilities.
- Import/export here touches the unified `RTF_STORE` stack (Hub, Board, Dashboard, Roster, Locations, Requisitions, Timeline, Encounters, HQ). Standalone utilities like the Character Sheet, Session Tracker, Narrative Engine, and Tournament Bracket keep their own local saves.
