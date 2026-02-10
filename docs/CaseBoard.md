# Case Board (`board.html`)

Modular clue board with physics nodes, quick-reference popups, and a shared case name that syncs with the rest of the suite.

## Core Concepts
- **Case File Meta** – The hero header exposes an editable case name that renders across exports and sessions. Portal, save, and clear buttons live in the same action bar along with pan-mode and background/accent controls.
- **Shared Data** – The board pulls guilds, NPCs, locations, and requisitions from `RTF_STORE`, so popups always reflect the latest roster without retyping anything.
- **Autosave** – Every node, connection, and position writes back to Local Storage so you can close the tab mid-investigation without losing work.

## Building the Web
- **Toolbar** – Drag People, Locations, Clues, Notes, and other custom node types straight onto the board. Additional tool groups open popovers stocked with guild details, NPC dossiers, locations, events, or requisition data that can be dragged in as fully formatted nodes.
- **Editing Nodes** – Click the node body to edit text inline. Use the context menu (right-click) for actions like edit text, delete, or "Center & Optimize" to zoom to the highlighted node cluster.
- **Connections** – Hover edges to reveal connection handles. Drag from one handle to another to link nodes, then click the connection to label it or toggle arrowheads for directionality.

## Navigation
- **Pan vs Select** – The hero button toggles between drag-to-pan and drag-to-select modes so you can rearrange clusters without accidentally moving the canvas.
- **Zoom & Focus** – Scroll to zoom anywhere on the infinite canvas. Double-click a node to temporarily isolate its direct connections and reduce visual noise during briefings.

## Multi-Case Workflow
- **Switch Cases** – Use the case selector in the header to jump between investigations. Each case keeps its own board layout, nodes, and connections.
- **Create & Rename** – The header controls let you spin up new cases or rename the active one without leaving the board.
- **Delete with Care** – Deleting a case removes its board data and event log; make sure you no longer need it before confirming.

## Tips
- Use guild popups to seed consistent iconography/colors that match your campaign; it keeps silhouettes recognizable when the web gets dense.
- Save often (hero action) before trying aggressive experimentation with physics or mass deletes.
- Pair the board with the Clue Generator: the generated Signal/Noise pairs make great node text, and you can color-code the nodes to match those results.
