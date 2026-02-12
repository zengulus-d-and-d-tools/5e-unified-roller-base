# Unified 5e Player Sheet (`index.html`)

Standalone character sheet with command-console roller, automation, and JSON portability.

## Layout

- **Roller Header**: portal link, accent/background controls, flip-sheet toggle.
- **Vitals/Combat**: HP, temp HP, death saves, AC formula, initiative, movement, saves, resources.
- **Skills/Checks**: editable modifiers with quick-roll support.
- **Attacks/Spells/Features**: reusable combat and class entries.
- **Inventory**: containers and item tracking.
- **Creator Overlay**: guided character bootstrap flow.
- **Data Controls**: copy save / load save / reset.

## Storage

This page does **not** use `RTF_STORE`.

It stores character data in its own Local Storage keys and moves data via the sheet's own save/load controls.

## Integrations

- Optional Discord webhook roll posting.
- Theme controls align with other pages visually, but data remains sheet-local.
