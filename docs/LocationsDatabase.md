# Locations Database (`locations.html`)

Shared place registry for districts, landmarks, lairs, and mission sites.

## Layout

- **Add Form**: name, area/group, description, image URL, notes.
- **Filter Bar**: text search + district filter.
- **Location Cards**: inline-editable details with board/link/delete actions.

## Behavior

- Area/group options come from shared `campaign.rep` names.
- Location rows save to shared `RTF_STORE` (`campaign.locations`).
- Deep links (`?locationId=...`) can highlight a specific location row.

## Tips

- Use consistent area labels so timeline and requisition focus filters line up.
- Put tactical details (entry points, watch cycles, hazards) in notes.
- Add image URLs for handout-ready context during play.
