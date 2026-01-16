# Ravnica Task Force Tools

A suite of lightweight, offline-first HTML tools designed for 5th Edition tabletop roleplaying games. These tools are built to run entirely in the browser without external dependencies, making them portable and robust for both in-person and digital play.

While the default data is tailored to the Ravnica setting, the code is designed to be easily modified for any campaign world.

## Tools Included

### Player Tool
* **index.html (Unified 5e Sheet)**: A comprehensive, single-page character sheet featuring auto-calculating modifiers, spell slot tracking, and complex dice macros. Character state is saved automatically to the browser's Local Storage.

### GM & Campaign Tools
* **hub.html (The Precinct Hub)**: A campaign-level dashboard for managing the political and mechanical state of the Task Force.
    * **Reputation & Heat**: Tracks unit standing with all ten guilds (-2 to +2) and overall Heat (0-6). [cite_start]Includes automatic warnings for Complication Scenes and Hard Constraints[cite: 3].
    * **Downtime Management**: Tracks individual player Downtime Points (DP). [cite_start]Standard gaps provide 2 DP, with a maximum bank of 4[cite: 5].
    * [cite_start]**Project Clocks**: Handles 4-segment Personal Projects and 2-segment Professional Development for new languages or tool proficiencies[cite: 5].

* [cite_start]**dm-screen.html (Narrative Engine)**: A procedural generation tool for improvising urban sessions, including street incidents, sensory textures, and environmental hazards.

* **gm.html (Session Tracker)**: A dashboard for managing combat and session flow, featuring an initiative tracker with mob generation and Discord integration.

* [cite_start]**clue.html (Intersection Gen)**: A logic tool for mystery scenarios that generates clues by separating core "Signal" from contextual "Noise" based on guild involvement[cite: 4].

## Core Systems Implementation

The suite is designed around specific Ravnica-themed mechanics:
* [cite_start]**Heat System**: High Heat triggers scrutiny (Audits, rival teams, or internal affairs)[cite: 3].
* **Downtime**: 1 week = 1 DP. [cite_start]Actions include "Laying Low" to reduce Heat or "Repairing Optics" for joint Heat reduction and Reputation gain[cite: 5].
* [cite_start]**Set Pieces**: Tools support structured incidents like Rooftop Chases, Lab Meltdowns, and Courtroom skill challenges[cite: 1].

## Usage & Customization

These are static HTML files. Open them in any modern browser. To customize data (such as Guild names or loot tables), open the HTML file in a text editor and modify the labeled constants in the `<script>` section.

## License

This project is released under The Unlicense. The code is dedicated to the public domain.
