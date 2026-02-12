# Campaign Hub (`hub.html`)

Between-sessions control room for heat, guild standing, and downtime logistics. It pulls from the same unified store as the campaign-facing tools (Case Board, Player Dashboard, Roster, Locations, Requisitions, Timeline, Encounters, HQ) so NPC/Guild metadata stays aligned.

## Layout
- **Case Prep Template** – The top card is a quick brief: title/logline, guilds in conflict, antagonist goal, legal & physical obstacles, and a set-piece outline. Use it as a one-page primer before the next mission.
- **Global Status** – Grid of all configured guilds/factions (including optional independents like Guildless); click to cycle rep values from hostile to favored. A Heat meter with +/- buttons, a glowing fill, and warning copy keeps consequences front and center.
- **Player Roster** – Mirrors the Task Force Dashboard but focuses on downtime: each player row tracks DP, project clocks, project names, and project rewards. Buttons at the bottom grant the standard +2 DP for closing a case or reset the unified campaign store.

## Controls & Sync
- **Portal/Dashboard Links** – Jump back to the Tools Hub or straight into the Player Dashboard to edit frontline stats.
- **Import / Export** – Hub buttons call the same unified `RTF_STORE` import/export flow used by Tools Hub (full campaign snapshot).
- **Accent/BG** – Hero controls ensure the strategic view matches whatever palette your table picked.

## Tips
- Log guild standing immediately after a scene; the Heat warning text will remind you when fallout scenes are due.
- If Timeline auto-sync is enabled, heat deltas from mission events will update this meter automatically (0–6 clamp), so confirm the setting before manual adjustments.
- Use the Case Prep card for NPC clocks or looming threats so everyone knows what success/failure looks like before the next session.
- The `Reset Hub` action clears the unified campaign store, not just this page; export first if you might need a rollback.
- When a player spends DP in the Roster card, jot the activity directly in their row so it travels into the HQ designer or downtime scenes later.

## Related Project
For a less setting-specific version of this toolset, see [5e-unified-roller-base](https://github.com/zengulus-d-and-d-tools/5e-unified-roller-base).
