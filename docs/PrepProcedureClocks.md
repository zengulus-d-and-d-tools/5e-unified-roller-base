# Prep & Procedure Clocks

`prep-procedure.html` provides two configurable progress clocks plus a prep token bubble tracker.

## Features
- `PREP` and `PROCEDURE` pie clocks with per-clock controls: `+1`, `-1`, `Reset`, and total segment input.
- Manual `+1/-1` clock buttons are hidden by default and can be toggled via `Alt+Shift+Click` on the page title.
- Prep token bubbles are positioned between the two clocks and support click-to-set plus `+/-`.
- Custom logging actions are in the first action row:
  - `Log Custom Prep` posts a prep timeline event with player + category metadata and increments the `PREP` clock by 1 (clamped at total).
  - `Log Custom Procedure` posts a procedure timeline event with player + category metadata and increments the `PROCEDURE` clock by 1 (clamped at total).
  - Both custom logs use popover inputs for player (from roster dropdown), category, and optional detail text.
- Flashback spend actions are in a second row beneath custom logging:
  - `Minor Flashback (-1 Prep)` spends 1 prep token and logs the flashback to timeline.
  - `Major Flashback (-2 Prep)` spends 2 prep tokens and logs the flashback to timeline.
  - Flashback popover includes required player selection (from roster dropdown) and optional detail text.
- Example table with `Type`, `Category`, and `Example Name`.
- Example rows are D&D procedure-focused and mundane-first (chain of custody, witness handling, scene control, vault sign-off), with magic only as escalation/fallback when mundane methods are insufficient. Rows include `category` from the controlled set: `Intel`, `Access`, `Cover`, `Tools`.
- Double-clicking an example row opens the same popover and logs that example context to timeline on confirmation.
- Example controls: filter (`All`, `Prep`, `Procedure`) and free-text search.

## Integration API
The page exports:
- `window.PrepProcedureClocks.getState()`
- `window.PrepProcedureClocks.setState(state)`
- `window.PrepProcedureClocks.onChange(listener)`

Convenience aliases are also exposed when not already present:
- `window.getState()`
- `window.setState(state)`

The widget emits a `prep-procedure-change` `CustomEvent` on `window` whenever state changes.

## State Shape
```json
{
  "prep": { "total": 4, "filled": 0 },
  "procedure": { "total": 4, "filled": 0 },
  "tokens": { "count": 0, "max": 6 },
  "examples": [
    { "id": "prep-1", "type": "prep", "category": "Tools", "name": "..." }
  ],
  "ui": { "filter": "all", "search": "" }
}
```

## Page Config
Set page-level config before loading `js/prep-procedure.js`:

```html
<script>
  window.PREP_PROCEDURE_CONFIG = {
    maxPrepTokens: 6,
    initialState: {},
    onChange(state) {
      console.log(state);
    }
  };
</script>
```
