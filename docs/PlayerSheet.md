# Unified 5e Player Sheet (`index.html`)

Command-console sheet for players and DMs. Everything lives in Local Storage, so you can run it offline and jump between devices with the JSON import/export buttons.

## Layout
- **Command Console** – Hero header exposes the Portal link, accent picker, BG cycler, and global advantage/secret toggles. The misc bonus field feeds every roll beneath it.
- **Vitals & Rest** – `card-vitals`, `card-ac`, and `card-rest` cover HP/Temp HP, death saves, exhaustion, armor formulae (standard vs custom), and one-tap Short/Long Rests that reset tracked resources.
- **Combat Stack** – `card-combat` manages initiative, speed, spell DC, senses, proficiencies, and the class resource grid for Rage/Ki/etc.
- **Attributes & Effects** – `card-attr`, `card-buffs`, and `card-settings` keep ability scores, passive skills, concentration/effect toggles, sheet theme, Discord webhook, and luck bias in one place.
- **Attacks & Features** – `card-atk`, `card-feats`, and `card-spells` let you build reusable attacks/spells with hit/damage formulas, store feats or custom abilities, and track slot usage.
- **Skills & Roller** – `card-skills` shows every skill with editable mods, while `card-roller` exposes the inline dice roller, history log, and quick buttons for staples like Initiative, Saves, or Skill checks.
- **Data & Creator** – `card-io` handles import/export/reset plus Discord toggles. The creator overlay walks you through race/class ability assignments, auto-fills skill proficiencies, and seeds the base sheet.

## Automation & Sync
- **Standalone Sheet Store** – Character data is stored in the sheet’s own local bundle (`unifiedSheetData.json`) and supports multiple character profiles. It does not auto-sync into `RTF_STORE`.
- **Portability** – Use the sheet’s import/export controls when moving characters between browsers/devices.
- **Discord Hooks** – Provide any webhook URL to push rolls using spoiler tags (Secret option piggybacks on the command console's 👁 toggle).
- **Theme Controls** – Every sheet honors the global accent picker and background cycler so you can keep the table on-brand.

## Table Tips
- Lock in core stats, then duplicate the JSON file before major level-ups so you can roll back.
- Use the Misc Bonus field for Bless, Bardic dice, or homebrew situational modifiers; it auto-resets after each roll.
- Keep resource trackers simple: "Rage" can be reused for Channel Divinity or Superiority Dice—rename and set max to whatever you need.

## Related Project
For a less setting-specific version of this toolset, see [5e-unified-roller-base](https://github.com/zengulus-d-and-d-tools/5e-unified-roller-base).
