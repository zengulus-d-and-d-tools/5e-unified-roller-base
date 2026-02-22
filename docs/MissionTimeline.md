# Mission Timeline (`timeline.html`)

Session chronicle for beats, fallout, and rolling heat. Designed for quick capture mid-play—no doc editor required.

## Layout
- **Event Form** – Toggle the log form to add operation title, focus/district, heat delta, tags, optional image URL, highlights, fallout, and follow-up notes. Events save directly into the active case timeline.
- **Filter Bar** – Live search, focus filter, sort order (Newest, Oldest, Heat), and toggles for `Heat / Fallout only`, `Auto-sync Heat`, and `Hide Resolved`.
- **Filter Actions** – One-click jump to `leads.html` plus `Export Recap`, which downloads a filtered markdown summary (`mission-timeline-recap-YYYY-MM-DD.md`) and attempts clipboard copy.
- **Timeline List** – Cards support inline edits and status toggles. Per-event actions include `Lead Queue`, `Board`, and soft delete with undo timing.
- **Procedure Shield Action** – Positive-heat events show `Shield -1` (or `Shield -1 (Free)` when available) to reduce event heat using Prep/Procedure resources.

## Usage Flow
1. **Prep** – Before session start, skim the previous beats via the Heat-only filter to remind the table what’s still hot.
2. **Live Logging** – Add events as they happen; tagging by guild or location makes the filter bar priceless later.
3. **Triage** – Promote high-value beats into Lead Queue and jump selected events to Board for visual linking.
4. **Debrief** – Mark resolved items, annotate fallout/follow-up, then export a recap of the filtered view for session notes.

## Case Context
- **Active Case Source** – Timeline reads the currently active case from Tools Hub (`tools.html` -> `Active Case Context` panel).
- **Case CRUD Location** – Create, rename, switch, and delete cases in Tools Hub. Timeline then reads/writes event logs for that active case only.

## Integrations
- **Lead Queue** – `Lead Queue` on an event creates/focuses an event lead and opens `leads.html?leadId=<id>`.
- **Case Board** – `Board` opens `board.html?linkType=timeline-event&id=<event_id>`. Board focuses an existing linked node or spawns one from store data.
- **Prep & Procedure Clocks** – `Shield -1` reads `rtf_prep_procedure_state_v1`. If prep is full, one free shield is available per active case/session. Otherwise it spends 1 Procedure segment, updates Heat, and logs a shield event.
- **Deep-Link Filters** – URL query params (`search`, `focus`, or `id`) prefill timeline filters and are then removed from the address bar.

## Tips
- **Auto-sync Heat** is enabled by default; disable it if your table wants manual Campaign Hub heat control.
- Use tags like `fallout`, `intel`, or `debt` so searching weeks later is trivial.
- Use `Lead Queue` for unresolved threads instead of overloading follow-up text with open questions.
- Pair entries with Requisition or Encounter cards via consistent naming to reconstruct operations quickly.
- Hide resolved entries during prep to keep the timeline focused on active leads.

## Cross-Links
- [Case Board](CaseBoard.md) (`board.html`) – Pull timeline events into event nodes so beats, fallout, and Heat-driving moments stay tied to the active investigation graph.
- [Lead Queue](Leads.md) (`leads.html`) – Prioritize open questions with status + voting, then jump back into Board or Timeline context.
- [Prep & Procedure Clocks](PrepProcedureClocks.md) (`prep-procedure.html`) – Feeds shield resources used by timeline `Shield -1` actions.

## Related Project
For a less setting-specific version of this toolset, see [5e-unified-roller-base](https://github.com/zengulus-d-and-d-tools/5e-unified-roller-base).
