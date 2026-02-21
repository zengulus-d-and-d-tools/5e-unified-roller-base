# Prep & Procedure Clocks

`prep-procedure.html` provides two configurable progress clocks plus a prep token bubble tracker.

## Features
- `PREP` and `PROCEDURE` segmented clocks with per-clock controls: `+1`, `-1`, `Reset`, and total segment input.
- Prep token bubbles up to configurable `maxPrepTokens` (default `6`) with click-to-set and `+/-` controls.
- `Log Prep to Timeline` uses three fields before writing a snapshot event to the active case timeline: `Who` (party roster), `Category` (`Intel` / `Access` / `Cover` / `Tools`), and `Description`.
- `Activate Heat Shield` clears only the `PROCEDURE` clock fill (`procedure.filled = 0`) and logs this timeline action: `Thanks to good procedure, the Task Force's reputation was preserved.`
- Example table with `Type`, `Category`, and `Example Name`.
- Example rows now include `category` using the same controlled set: `Intel`, `Access`, `Cover`, `Tools`.
- Double-clicking an example row prefills the log form (`Category` + `Description`) so the remaining manual step is selecting `Who`.
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
    { "id": "prep-1", "type": "prep", "category": "Intel", "name": "..." }
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
