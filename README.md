# Ravnica Task Force Tools

A suite of lightweight, offline-first HTML tools designed for 5th Edition tabletop roleplaying games. These tools are built to run entirely in the browser without external dependencies, making them portable and robust for both in-person and digital play.

While the default data is tailored to the Ravnica setting, the code is designed to be easily modified for any campaign world.

## Tools Included

### Player Tool
* **index.html (Unified 5e Sheet)**: A comprehensive, single-page character sheet.
    * **Features**: Auto-calculating modifiers, drag-and-drop interface layout, spell slot tracking, and complex dice macros.
    * **Persistence**: Character state is saved automatically to the browser's Local Storage.
    * **Export**: Includes a compression-based export/import system to move character data between devices.

### GM Tools
* **dm-screen.html (Narrative Engine)**: A procedural generation tool for improvising urban sessions.
    * **Features**: Generates "moment-to-moment" street scenes, sensory details (texture/infrastructure), NPC motivations, and environmental hazards.
    * **Logic**: Uses a combinatoric system to prevent repetitive descriptions.

* **gm.html (Session Tracker)**: A dashboard for managing combat and session flow.
    * **Features**: Initiative tracker with mob generation, HP management, condition reference, and loot tables.
    * **Integration**: Can send roll results to a Discord channel via Webhooks.

* **clue.html (Investigation Generator)**: A logic tool for mystery scenarios.
    * **Features**: Generates clues by separating the "Signal" (the core evidence) from the "Noise" (contextual details) based on selected factions.

## Usage

These files are static HTML. You can use them in two ways:

1.  **Online**: Host this repository on GitHub Pages. The `index.html` will serve as the entry point for players.
2.  **Offline**: Download the `.html` files to your device and open them directly in any modern web browser (Chrome, Firefox, Safari, Edge).

## Customization

These tools are built to be "hackable." To adapt them to your own setting (e.g., changing Guilds to Factions, or altering loot tables), simply open the HTML file in a text editor.

Look for the `<script>` tag near the bottom of the file. You will find data arrays clearly labeled, such as `const guilds` or `const lootTables`. Editing these text values will immediately update the tool.

## License

This project is released under The Unlicense. The code is dedicated to the public domain. You are free to fork, modify, distribute, host, or sell this software without permission or attribution.
