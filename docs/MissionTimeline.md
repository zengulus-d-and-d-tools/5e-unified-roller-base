# Mission Timeline (`timeline.html`)

Event log for session beats, fallout, and heat deltas.

## Layout

- **Event Form**: title, focus, heat delta, tags, image URL, highlights, fallout, follow-up.
- **Filters**: search, focus dropdown, sort (`Newest`, `Oldest`, `Heat`).
- **Toggles**: `Heat/Fallout only`, `Auto-sync Heat`, `Hide Resolved`.
- **Actions**: `Export Recap` for filtered timeline summaries.

## Behavior

- Events save to shared `RTF_STORE`.
- Heat auto-sync (when enabled) applies event heat deltas to campaign heat (`0` to `6`).
- Deletion uses soft-delete with undo timeout when available.

## Case Scoping

Timeline entries are case-scoped in `RTF_STORE`.

This page does not include case create/switch controls. Set the active case from Tools Hub (`tools.html`).

## Tips

- Use consistent focus labels so filtering stays useful over long campaigns.
- Put consequences in `Fallout` and next steps in `Follow Up` to speed debrief prep.
- Use recap export at session end as your campaign log artifact.
