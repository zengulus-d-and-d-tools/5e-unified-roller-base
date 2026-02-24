# Session Tracker (`gm.html`)

GM control deck for combat, ad-hoc rolling, and loot/reference pulls. Data lives in its own Local Storage key (`gmDashboardData`), so exports/imports here only affect the GM deck (it doesn’t hook into `RTF_STORE`).
The Tracker tab is intentionally optimized for widescreen/tabletop displays rather than mobile layouts.

## Tabs & Panels
- **Tracker Tab** – Add single combatants with init/dex/HP, roll whole mobs with auto-numbering, and maintain an ordered list of actors. Track per-entity conditions (with round durations), reaction/concentration/legendary state, and use Undo + Combat Log to recover from mistakes.
- **Roller Tab** – Inline log shows the latest result, name/reason, and modifiers. Configure advantage state, custom bonuses, "secret" spoiler rolls, and luck bias. Tier buttons roll preset difficulty bands (Crap → Master) and a manual panel handles arbitrary bonuses or DC estimation sliders.
- **Ref & Loot Tab** – Save/load Mob presets, fire off quick loot tables (pocket lint vs trinket) with optional multipliers, manage data export/import, keep a scratchpad, and browse an auto-populated Conditions reference list.

## Utilities
- **Discord Integration** – Provide a webhook URL, enable Active, and optionally toggle **Tracker Turn Pings** so `Next Turn` posts a simple `{EntityName}'s Turn!` message to Discord. Keep spoiler mode on for hidden roller output.
- **Condition Expiry Ping** – When a timed condition drops to 0 on turn advance, the tracker logs and pings Discord with `{EntityName}'s {ConditionName} condition has expired!` (uses the same Tracker Turn Ping webhook/toggle path).
- **Sheet Initiative Sync** – Initiative rolled from the Character Sheet is queued into the Tracker automatically (same browser/profile); matching sheet-linked combatants update in place (including AC) and each roll is written to Combat Log.
- **Data Portability** – Use the built-in export/import to move the GM deck; the Tools Hub export handles the rest of the `RTF_STORE` campaign data.
- **Accent & BG Controls** – The hero header exposes the 🎨 picker and 🌌 cycler so even the DM console matches the current vibe.

## Suggested Flow
1. (Optional) Export/import the GM deck if you want to shuttle presets or scratchpad notes between browsers.
2. Add PCs plus mobs to the tracker and hit `Next Turn` to step through combat, tweaking HP or initiative in-line.
3. Use condition chips for timed effects (for example `Stunned 2`); durations tick down when that combatant's turn comes up.
4. Mark reaction/concentration/legendary usage directly on each row and use Undo/Combat Log if you need to rewind.
5. Flip to the Roller tab whenever you need opposition rolls, DC calls, or Discord-ready results.
6. Use the Ref & Loot tab between fights for treasure drops, jotting quick notes or referencing conditions without leaving the page.

## Related Project
For a less setting-specific version of this toolset, see [5e-unified-roller-base](https://github.com/zengulus-d-and-d-tools/5e-unified-roller-base).
