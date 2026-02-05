# Session Tracker (`gm.html`)

A tactical dashboard for Game Masters to manage combat encounters and session flow.

## Features

### Initiative Tracker
- **Roll Initiative**: One-click rolling for all tracked entities.
- **Mob Generation**: Quickly spawn groups of generic enemies (e.g., "Goblin 1-4") with auto-rolled HP and Init.
- **Sorting**: Automatically sorts the turn order.

### Session Management
- **Discord Webhook**: Connects to the same channel as players for unified logging.
- **Notes**: Scratchpad for quick session notes.
- **Timer**: Simple stopwatch for tracking duration.

### Usage
1. Open `gm.html`.
2. Add players manually or have them roll initiative (if using a connected backend/sync implementation, otherwise manual entry).
3. Use "Add Mob" to populate encounters.
4. Click "Next Turn" to cycle through the active actor.
