# Prep & Procedure Clocks

`prep-procedure.html` provides two configurable progress clocks plus a prep token bubble tracker.

## Features
- `PREP` and `PROCEDURE` pie clocks with per-clock controls: `+1`, `-1`, `Reset`, and total segment input.
- Prep token bubbles are positioned between the two clocks and support click-to-set plus `+/-`.
- `Log Prep to Timeline` is a single action button that opens a confirmation popover before writing a snapshot event for the active case.
- `Activate Heat Shield` clears only the `PROCEDURE` clock fill (`procedure.filled = 0`) and logs this timeline action: `Thanks to good procedure, the Task Force's reputation was preserved.`
- Example table with `Type`, `Category`, and `Example Name`.
- Example rows are procedure-focused (evidence handling, chain of custody, report/lab flow) and include `category` from the controlled set: `Intel`, `Access`, `Cover`, `Tools`.
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
