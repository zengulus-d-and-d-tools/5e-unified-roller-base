# Case Board (`board.html`)

A virtual whiteboard for tracking clues, managing investigations, and visualizing connections.

## Features

### Node System
- **Drag & Drop**: Create nodes by dragging icons from the toolbar (Persons, Locations, Clues, Guild Sigils).
- **Editing**: Double-click or use the context menu to edit titles and body text.
- **Physics**: Nodes have gentle physics interactions to organize the board organically.

### Connections
- **Connect**: Drag from one node's port (dots on the edges) to another to create a link.
- **Labels**: Add text labels to connections to describe the relationship.
- **Directionality**: Click connection endpoints to toggle arrows (None -> Left -> Right).

### Navigation
- **Pan & Zoom**: Infinite canvas with scroll-to-zoom and drag-to-pan.
- **Focus Mode**: Double-click a node to obscure unconnected elements, highlighting specifically related clues.

## Usage
- Ideal for mystery scenarios or tracking complex faction politics.
- Autosaves to `invBoardData` in Local Storage.
