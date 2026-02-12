# Clue Generator (`clue.html`)

Build a paired clue result: one true clue and one false lead.

## Workflow

1. Mark groups in the grid:
   - 1 click = false lead (orange)
   - 2 clicks = true clue (green)
2. Choose mode: `Physical`, `Social`, or `Arcane`.
3. Click **Generate Clue Pair**.

## Data Source

- Group names come from shared store `campaign.rep`.
- If no groups are configured, fallback is `General`.
- Optional `CLUEDATA` preload overrides friction/cost wording.

## Output

- True clue block (object/evidence).
- False lead block (context/coating).
- Friction and fail-cost prompts.

## Tips

- Mark multiple orange groups and one green group for stronger red-herring spread.
- Drop generated output into Case Board nodes for quick investigation scaffolding.
