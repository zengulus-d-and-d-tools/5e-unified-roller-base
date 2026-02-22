# Case Board (`board.html`)

Modular clue board with physics nodes, quick-reference popups, and case-scoped layouts/events.

## Core Concepts
- **Case File Meta** – The hero header exposes an editable case name that renders across exports and sessions. Portal, save, and clear buttons live in the same action bar along with pan-mode and background/accent controls.
- **Shared Data** – The board pulls guilds, NPCs, locations, timeline events, and requisitions from `RTF_STORE`, so popups always reflect the latest campaign state without retyping.
- **Save Behavior** – Most node/connection edits save immediately, and the hero `💾 Save` button is always available before major layout changes.

## Building the Web
- **Toolbar** – Drag People, Locations, Clues, Notes, and other custom node types straight onto the board. Additional tool groups open popovers stocked with guild details, NPC dossiers, locations, events, or requisition data that can be dragged in as fully formatted nodes.
- **Editing Nodes** – Click the node body to edit text inline. Use the context menu (right-click) for actions like edit text, delete, or "Center & Optimize" to zoom to the highlighted node cluster.
- **Connections** – Drag from a node edge/port to another node to create a link, then use the connection label controls to set text, toggle arrowheads, or remove the link.

## Navigation
- **Pan vs Edit** – The hero `🖐️ Pan` button toggles camera panning mode so you can reposition the view without dragging nodes.
- **Zoom & Focus** – Scroll to zoom anywhere on the infinite canvas. Double-click a node to temporarily isolate its direct connections and reduce visual noise during briefings.

## Case Context
- **Active Case Source** – Board reads the currently active case from Tools Hub (`tools.html` -> `Active Case Context` panel).
- **Case CRUD Location** – Create, rename, switch, and delete cases from Tools Hub. Board then loads/saves against that active case’s board/events scope.

## Cross-Link Entry Points
- **Direct Node Focus** – Opening `board.html?nodeId=<node_id>` centers and flashes an existing node.
- **Store-Backed Links** – Opening `board.html?linkType=<npc|location|timeline-event|requisition>&id=<entity_id>` focuses an existing linked node or spawns one from campaign data.
- **Lead Queue + Timeline Bridge** – Lead cards and timeline event actions use those URL params, so board jumps stay deterministic and case-scoped.
- **URL Hygiene** – After resolving a cross-link request, Board clears `nodeId` / `linkType` / `id` from the URL.

## Tips
- Use guild popups to seed consistent iconography/colors that match your campaign; it keeps silhouettes recognizable when the web gets dense.
- Save often (hero action) before trying aggressive experimentation with physics or mass deletes.
- Pair the board with the Clue Generator: the generated Signal/Noise pairs make great node text, and you can color-code the nodes to match those results.

## Related Project
For a less setting-specific version of this toolset, see [5e-unified-roller-base](https://github.com/zengulus-d-and-d-tools/5e-unified-roller-base).
