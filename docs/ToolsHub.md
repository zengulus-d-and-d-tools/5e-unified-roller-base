# Tools Hub (`tools.html`)

Primary control page for the suite. Open this first before jumping into other tools.

## Layout

- **Hero Header**: import/export, accent picker, background cycler.
- **Active Case Context**: switch/create/rename/delete cases. Board and Timeline follow this active case.
- **Group Loader Wizard**: pop-over wizard for loading group/faction names into `campaign.rep`.
- **Cloud Connect**: player-facing `connect.json` import and bundled default connect.
- **Cloud Sync (Secret Mode)**: manual Supabase config and admin push/pull/conflict controls.
- **Card Grid**: links to all tools. DM-only links appear in secret mode.

## Shortcuts

- `Alt+Shift+Click` title: toggle secret mode.
- `Alt+Shift+L`: open Group Loader Wizard pop-over.
- `Esc`: close Group Loader Wizard.

## Notes

- Import/export here covers the full shared `RTF_STORE` campaign stack.
- Character Sheet, Session Tracker, and Tournament Bracket still use their own local storage.
- Narrative Engine and Clue Generator read current groups from shared store reputation data.
- For file-based preload customization (`js/data-*.js`), see **[Preload Guide](Preloads.md)**.
