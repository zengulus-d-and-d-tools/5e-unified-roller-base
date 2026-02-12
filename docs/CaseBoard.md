# Case Board (`board.html`)

Drag-and-connect investigation board with shared-data popups and per-case board state.

## Core Workflow

- **Create Nodes**: drag Person, Location, Clue, or Note onto the canvas.
- **Use Data Popups**: spawn nodes directly from Groups, NPCs, Locations, Events, or Requisitions.
- **Connect Nodes**: drag between node edges/ports to create labeled relationships.
- **Edit In Place**: edit node title/body directly; use context menu for image URL, optimize, or delete.

## Header Actions

- `Portal`
- `Pan` toggle
- `Save`
- `Clear`
- Accent / Background controls

## Case Scoping

Board data is scoped to the active case in `RTF_STORE`.

There is no case switcher on this page. Set active case from Tools Hub (`tools.html`) in the **Active Case Context** panel.

## Integrations

- Deep links from NPC/Location/Requisition/Timeline pages can open targeted board context.
- `Draft Encounter` in node context menu sends a draft payload to `encounters.html`.
- Board-generated timeline events are tagged and written to the active case timeline.
