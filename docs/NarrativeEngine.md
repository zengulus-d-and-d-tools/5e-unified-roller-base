# Narrative Engine (`dm-screen.html`)

Improvisation console for quick scene generation during play.

## Panels

- **The Scene**: one-click beat generator.
- **Scene Texture**: structure, infrastructure, debris, atmosphere combinatorics.
- **NPC Improvisation**: wants/leverage prompt generation.
- **Clue Signatures**: quick reference rows by group.
- **Friction & Hazards**: hazard (2d6) and snag (2d20) escalation tools.
- **Aftermath**: rumor/headline style wrap-up prompt.
- **Group Coverage**: quick jurisdiction/perk reference table.

## Data Notes

- Group list is read from shared store `campaign.rep`.
- If no groups exist yet, it falls back to `General`.
- Outputs are generated on demand and are not stored as separate campaign entities.

## Usage Tips

- Use this side-by-side with Timeline to log consequences immediately.
- Use generated clues/hazards to seed Encounter Recipes or Board nodes.
