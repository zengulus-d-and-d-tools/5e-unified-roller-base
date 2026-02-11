# Requisition Vault (`requisitions.html`)

Shared pipeline for requisitions, approvals, and aftermath notes. Built for the same Local Storage store as the rest of the suite.

## Layout
- **Hero Actions** – Jump back to the Portal, fire the accent/BG controls, or open the inline form via `+ New Request`.
- **Request Form** – Capture item, requester, guild/source, priority (Routine → Emergency), status (Pending → Delivered/Denied), estimated value, purpose, notes, and tags. The form stays hidden until needed so the list remains compact.
- **Filter Bar** – Live search (names, notes, tags) plus dropdowns for status, guild, and priority. Use it to zero in on emergency pulls or a specific faction’s queue.
- **Request Cards** – Inline editable fields for every attribute, timestamp badges, and delete buttons. Priority and status selectors use color-coded pills for quick scanning.

## Workflow
1. **Capture Immediately** – Enter the request as soon as players pitch it so the backlog reflects reality.
2. **Tag & Sort** – Use priority to float emergencies; the renderer sorts Routine < Tactical < Emergency automatically.
3. **Update in Place** – As approvals land or sourcing changes, edit fields directly on the card. Everything persists instantly.
4. **Close the Loop** – Delete fulfilled/denied cards or leave them tagged for audit trails before exporting to archive.

## Tips
- Tags make the search bar extremely powerful—label chemical, legal, or magical pulls differently.
- Use the Value field for GP cost or fictional favors owed; either way it reminds you of the debt when negotiating later.
- Export from the Tools Hub before a downtime phase so you can review what gear was promised versus delivered.

## Cross-Links
- [Case Board](CaseBoard.md) (`board.html`) – Drag requisitions into the case graph to connect gear requests directly to suspects, locations, and clue threads.
- [Mission Timeline](MissionTimeline.md) (`timeline.html`) – Use matching tags/titles so requisition intake and delivery milestones read as a clean operation timeline.
