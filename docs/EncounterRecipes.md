# Encounter Recipes (`encounters.html`)

Shared encounter card library for reusable fights, hazards, phases, and rewards.

## Card Fields

- Name
- Tier (`Routine`, `Standard`, `Elite`, `Boss`)
- Battlefield
- Objective
- Opposition
- Hazards
- Beats / phases
- Rewards
- Notes

## Workflow

1. Click `+ New Recipe`.
2. Fill core fields and save.
3. Search/filter by text and tier.
4. Update card fields inline as prep evolves.

## Integrations

- `Run Tracker` opens `gm.html` with selected encounter context.
- Board context menu can draft an encounter payload into this page.
- Data saves in shared `RTF_STORE` (`campaign.encounters`).

## Tips

- Keep opposition and hazards in short, scannable lines for at-table use.
- Reserve `Notes` for scaling rules and fail-forward outcomes.
- Export the shared store before major chapters to archive successful encounter sets.
