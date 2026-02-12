# Player Dashboard (`player-dashboard.html`)

Quick-reference stat board for active players.

## Layout

- **Header Actions**: portal link, hub link, add player, accent/background controls.
- **Player Cards**: name, AC, Passive Perception, Save DC, HP.
- **Empty State**: shown when no players exist.

## Behavior

- Reads/writes shared `RTF_STORE` player entries (`campaign.players`).
- HP supports freeform text (for example `38/52`, `27 + 5 temp`).
- Low HP values are visually highlighted.

## Tips

- Keep this open on a second display during combat.
- Use names that match initiative tracker labels to reduce confusion.
