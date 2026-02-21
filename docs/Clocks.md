# Clocks

`clocks.html` provides a generic clock tracker for scene, mission, or campaign pacing.

## Features
- Add unlimited named clocks with configurable type and total segments.
- Two clock types:
  - `Progress` (green)
  - `Danger` (red)
- Type colors are fixed and do not use the page accent palette.
- Per-clock controls: `+1`, `-1`, `Reset`, `Remove`.
- Inline editing for clock `Name`, `Type`, and `Total`.
- Fill value is always clamped to `0..total`.
- Local persistence via `localStorage` key: `rtf_clocks_page_v1`.

## Default Clocks
- `Operation Progress` (Progress, 6 segments)
- `Complication Risk` (Danger, 6 segments)
