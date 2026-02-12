# NPC Roster (`roster.html`)

Shared contact registry for allies, rivals, witnesses, and patrons.

## Layout

- **Add/Edit Form**: name, group, wants, leverage, image URL, notes.
- **Filter Bar**: text search + group filter.
- **NPC Cards**: inline data display with edit/delete plus board/link actions.

## Behavior

- Group options come from shared `campaign.rep` names.
- NPC rows save to shared `RTF_STORE` (`campaign.npcs`).
- Deep links (`?npcId=...`) can highlight a specific NPC row when opening the page.

## Tips

- Keep `Wants` actionable and present tense.
- Keep `Leverage` specific and verifiable.
- Use notes for timeline-style updates (`Session 5: switched allegiance`).
