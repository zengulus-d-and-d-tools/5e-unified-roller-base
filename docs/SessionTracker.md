# Session Tracker (`gm.html`)

GM control deck for combat, ad-hoc rolling, and loot/reference pulls. All tabs share the unified data store so NPC presets, discord hooks, and accent settings stay in sync.

## Tabs & Panels
- **Tracker Tab** – Add single combatants with init/dex/HP, roll whole mobs with auto-numbering, and maintain an ordered list of actors. Buttons for Round tracking, previous/next turn, and encounter clearing keep initiative honest.
- **Roller Tab** – Inline log shows the latest result, name/reason, and modifiers. Configure advantage state, custom bonuses, "secret" spoiler rolls, and luck bias. Tier buttons roll preset difficulty bands (Crap → Master) and a manual panel handles arbitrary bonuses or DC estimation sliders.
- **Ref & Loot Tab** – Save/load Mob presets, fire off quick loot tables (pocket lint vs trinket) with optional multipliers, manage data export/import, keep a scratchpad, and browse an auto-populated Conditions reference list.

## Utilities
- **Discord Integration** – Provide a webhook URL plus toggles for spoiler mode; every roll can optionally ping the channel players use.
- **Data Portability** – Export/import JSON from the GM deck alone or lean on the global Tools Hub import/export for whole-campaign snapshots.
- **Accent & BG Controls** – The hero header exposes the 🎨 picker and 🌌 cycler so even the DM console matches the current vibe.

## Suggested Flow
1. Use the Tools Hub to import the campaign store, then open `gm.html` so all rosters/presets are present.
2. Add PCs plus mobs to the tracker and hit `Next Turn` to step through combat, tweaking HP or initiative in-line.
3. Flip to the Roller tab whenever you need opposition rolls, DC calls, or Discord-ready results.
4. Use the Ref & Loot tab between fights for treasure drops, jotting quick notes or referencing conditions without leaving the page.
