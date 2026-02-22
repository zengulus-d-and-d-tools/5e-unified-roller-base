# Lead Queue (`leads.html`)

Case-scoped investigation queue for unresolved questions and next actions. It separates tactical lead triage from the raw timeline log.

## Layout
- **Lead Form** – Create leads with type, title, optional target ID, question, next step, and voter name.
- **Lead Summary** – Shows lead count, open/blocked totals, and current voter identity.
- **Lead List** – Sorts leads by status, then vote score, then most recently updated.
- **Lead Cards** – Inline editing for question/next step/status/target ID plus vote buttons, timeline jump, board jump, and delete.

## Lead Model
- **Types** – `event`, `npc`, `location`, `clue`, `requisition`, `theory`, `other`.
- **Statuses** – `open`, `blocked`, `resolved`, `dead-end`.
- **Voting** – Per-voter single-choice score model:
  - `Hot` = `+2`
  - `Cold` = `0`
  - `Dead End` = `-2`
- **Required Inputs on Create** – Title, question, and next step.

## Storage And Case Scope
- Leads persist in `localStorage` key `rtf_lead_queue_v1`.
- Data is stored per active case ID from Tools Hub (`case_primary` fallback).
- Voter identity persists in `localStorage` key `rtf_lead_voter_name_v1`.
- Page listens for `storage` and remote store update events to rerender queue state.

## Navigation And Interop
- **From Timeline** – Event card `Lead Queue` creates/focuses an event lead and opens `leads.html?leadId=<id>`.
- **URL Highlighting** – `leadId` deep link scrolls and highlights that card, then removes the query param from URL.
- **Board Jump Rules**:
  - `targetId` shaped like `node_...` opens `board.html?nodeId=<targetId>`.
  - Lead type `npc`, `location`, `event`, or `requisition` maps to board cross-link query params (`linkType` + `id`) for deterministic node focus/spawn.
- **Timeline Jump Rules** – Uses lead title/question/target ID as timeline `search` query and adds `id` when available.

## Tips
- Treat each lead as a decision card: one clear question plus one executable next step.
- Reserve `blocked` for dependencies that can be cleared by another scene or team member.
- Reuse IDs from source records (timeline event IDs, npc IDs, location IDs, requisition IDs, or board node IDs) so board/timeline jumps stay reliable.
- Use voter names consistently across devices so vote summaries remain readable.

## Cross-Links
- [Mission Timeline](MissionTimeline.md) (`timeline.html`) – Creates and revisits leads from event cards.
- [Case Board](CaseBoard.md) (`board.html`) – Resolves `nodeId` and `linkType` deep links for lead context jumps.

## Related Project
For a less setting-specific version of this toolset, see [5e-unified-roller-base](https://github.com/zengulus-d-and-d-tools/5e-unified-roller-base).
