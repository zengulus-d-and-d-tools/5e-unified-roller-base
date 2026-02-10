# Inline CSS/JS Migration Audit

Date: 2026-02-10
Scope: Active app files only (`*.html`, `js/*.js`), excluding `_backup_legacy/**` and `js/pdf.min.js`.

Legacy snapshot (not modified in this pass):
- `_backup_legacy/*.html` still contains `7` inline `<style>` blocks.
- `_backup_legacy/*.html` still contains `8` inline non-`src` `<script>` blocks.
- `_backup_legacy/*.html` contains `221` `style=""` attributes and `194` inline handler attributes.

## What was externalized in this pass

### Inline `<style>` blocks moved to CSS files
- `hub.html` -> `css/hub-page.css`
- `tools.html` -> `css/tools-page.css`
- `encounters.html` -> `css/encounters.css`
- `requisitions.html` -> `css/requisitions.css`
- `timeline.html` -> `css/timeline.css`
- `locations.html` -> `css/locations.css`
- `roster.html` -> `css/roster.css`
- `player-dashboard.html` -> `css/player-dashboard.css`

### Inline `<script>` blocks moved to JS files
- `tools.html` -> `js/tools.js`
- `player-dashboard.html` -> `js/player-dashboard.js`

### Phase 1 follow-up (`index.html` + `js/index.js`)
- Converted `index.html` inline handler attributes (`on*`) to `data-on*`.
- Added delegated data-handler runtime in `js/index.js` to execute `data-on*` handlers.
- Converted all `index.html` inline `style="..."` attributes to generated classes in `css/index.css`.
- Reduced `js/index.js` template inline `style=` usage from `17` to `0`.
- Reduced `js/index.js` template inline handler attributes (` on*=`) from `38` to `0`.

### Phase 2 (`gm.html` + `js/gm.js`)
- Converted all `gm.html` inline handler attributes (`on*`) to `data-on*`.
- Added delegated data-handler runtime in `js/gm.js` to execute `data-on*` handlers.
- Converted all `gm.html` inline `style="..."` attributes to class-based rules in `css/gm.css`.
- Reduced `js/gm.js` template inline `style=` usage from `7` to `0`.
- Reduced `js/gm.js` template inline handler attributes (` on*=`) from `7` to `0`.

### Phase 3 (`timeline.html` + `js/timeline.js`)
- Converted all `timeline.html` inline handler attributes (`on*`) to `data-on*`.
- Added delegated data-handler runtime in `js/timeline.js` to execute `data-on*` handlers.
- Converted all `timeline.html` inline `style="..."` attributes to class-based rules in `css/timeline.css`.
- Reduced `js/timeline.js` template inline `style=` usage from `3` to `0`.
- Reduced `js/timeline.js` template inline handler attributes (` on*=`) from `9` to `0`.

### Phase 4 (`hub.html` + `js/hub.js`)
- Converted all `hub.html` inline handler attributes (`on*`) to `data-on*`.
- Added delegated data-handler runtime in `js/hub.js` to execute `data-on*` handlers.
- Converted all `hub.html` inline `style="..."` attributes to class-based rules in `css/hub-page.css`.
- Reduced `js/hub.js` template inline `style=` usage from `15` to `0`.
- Reduced `js/hub.js` template inline handler attributes (` on*=`) from `10` to `0`.

### Phase 5 (`roster.html` + `js/roster.js`)
- Converted all `roster.html` inline handler attributes (`on*`) to `data-on*`.
- Added delegated data-handler runtime in `js/roster.js` to execute `data-on*` handlers.
- Converted all `roster.html` inline `style="..."` attributes to class-based rules in `css/roster.css`.
- Reduced `js/roster.js` template inline `style=` usage from `11` to `0`.
- Reduced `js/roster.js` template inline handler attributes (` on*=`) from `2` to `0`.

### Phase 6 (`locations.html` + `js/locations.js`)
- Converted all `locations.html` inline handler attributes (`on*`) to `data-on*`.
- Added delegated data-handler runtime in `js/locations.js` to execute `data-on*` handlers.
- Converted all `locations.html` inline `style="..."` attributes to class-based rules in `css/locations.css`.
- Reduced `js/locations.js` template inline `style=` usage from `7` to `0`.
- Reduced `js/locations.js` template inline handler attributes (` on*=`) from `1` to `0`.

### Phase 7 (`requisitions.html` + `js/requisitions.js`)
- Converted all `requisitions.html` inline handler attributes (`on*`) to `data-on*`.
- Added delegated data-handler runtime in `js/requisitions.js` to execute `data-on*` handlers.
- Converted all `requisitions.html` inline `style="..."` attributes to class-based rules in `css/requisitions.css`.
- Replaced JS form visibility inline style toggles with class-based toggles.
- Reduced `js/requisitions.js` template inline `style=` usage from `1` to `0`.
- Reduced `js/requisitions.js` template inline handler attributes (` on*=`) from `10` to `0`.

### Phase 8 (`encounters.html` + `js/encounters.js`)
- Converted all `encounters.html` inline handler attributes (`on*`) to `data-on*`.
- Added delegated data-handler runtime in `js/encounters.js` to execute `data-on*` handlers.
- Converted all `encounters.html` inline `style="..."` attributes to class-based rules in `css/encounters.css`.
- Replaced JS form visibility inline style toggles with class-based toggles.
- Replaced dynamic tier border inline styles with tier-class mapping in CSS.
- Reduced `js/encounters.js` template inline `style=` usage from `6` to `0`.
- Reduced `js/encounters.js` template inline handler attributes (` on*=`) from `10` to `0`.

### Phase 9 (`tools.html` + `js/tools.js`)
- Converted all `tools.html` inline handler attributes (`on*`) to `data-on*`.
- Added delegated data-handler runtime in `js/tools.js` to execute `data-on*` handlers.
- Converted all `tools.html` inline `style="..."` attributes to class-based rules in `css/tools-page.css`.
- Replaced secret-mode and sync panel visibility inline style writes with class toggles.
- Removed `.customize-panel` default display override from `css/tools.css` and standardized hidden state via `.tools-hidden`.

### Phase 10 (`board.html` + `js/board.js`)
- Converted all `board.html` inline handler attributes (`on*`) to `data-on*`.
- Added delegated data-handler runtime in `js/board.js` to execute `data-on*` handlers (including `dragstart` for static tool drags).
- Converted all `board.html` inline `style="..."` attributes to class-based rules in `css/board.css`.
- Converted popup template inline styles in `js/board.js` to class-based rendering (`board-popup-empty`, heat badges, sub-meta rows).
- Reduced `js/board.js` template inline `style=` usage from `8` to `0`.
- Reduced `js/board.js` template inline handler attributes (` on*=`) from `8` to `0`.

### Phase 11 (`dm-screen.html` + `js/dm-screen.js`)
- Converted all `dm-screen.html` inline handler attributes (`on*`) to `data-on*`.
- Added delegated data-handler runtime in `js/dm-screen.js` to execute `data-on*` handlers.
- Converted all `dm-screen.html` inline `style="..."` attributes to class-based rules in `css/dm-screen.css`.
- Converted `js/dm-screen.js` output template inline styles to class-based rendering.
- Reduced `js/dm-screen.js` template inline `style=` usage from `7` to `0`.

### Phase 12 (`tourney.html` + `js/tourney.js`)
- Converted all `tourney.html` inline handler attributes (`on*`) to `data-on*`.
- Added delegated data-handler runtime in `js/tourney.js` to execute `data-on*` handlers.
- Converted all `tourney.html` inline `style="..."` attributes to class-based rules in `css/tourney.css`.
- Converted `js/tourney.js` bracket title template inline styles to class-based rendering.
- Reduced `js/tourney.js` template inline `style=` usage from `3` to `0`.

### Phase 13 (`clue.html` + `js/clue.js`)
- Converted all `clue.html` inline handler attributes (`on*`) to `data-on*`.
- Added delegated data-handler runtime in `js/clue.js` to execute `data-on*` handlers.
- Converted all `clue.html` inline `style="..."` attributes to class-based rules in `css/clue.css`.

### Phase 14 (`hq.html` + `js/hq.js`)
- Converted all `hq.html` inline handler attributes (`on*`) to `data-on*`.
- Added delegated data-handler runtime in `js/hq.js` to execute `data-on*` handlers.
- Converted all `hq.html` inline `style="..."` attributes to class-based rules in `css/hq.css`.
- Converted `js/hq.js` template inline styles (clock pie + junior slot info) to class-based rendering.
- Reduced `js/hq.js` template inline `style=` usage from `2` to `0`.

### Phase 15 (`player-dashboard.html` + `js/player-dashboard.js`)
- Converted all `player-dashboard.html` inline handler attributes (`on*`) to `data-on*`.
- Added delegated data-handler runtime in `js/player-dashboard.js` to execute `data-on*` handlers.
- Converted all `player-dashboard.html` inline `style="..."` attributes to class-based rules in `css/player-dashboard.css`.
- Converted `js/player-dashboard.js` card template inline styles/handlers to class-based + delegated rendering.
- Reduced `js/player-dashboard.js` template inline `style=` usage from `3` to `0`.
- Reduced `js/player-dashboard.js` template inline handler attributes (` on*=`) from `6` to `0`.

### Phase 16 (`js/index.js` residual)
- Replaced the final resource bar template inline `style=` width with attribute + post-render width application.
- Reduced `js/index.js` template inline `style=` usage from `1` to `0`.

Verification after extraction:
- Inline `<style>` blocks remaining in active HTML: `0`
- Inline non-`src` `<script>` blocks remaining in active HTML: `0`

## Remaining inline usage (by count)

### HTML `style="..."` attributes
- `0` remaining

### HTML inline handler attributes (`onclick`, `onchange`, etc.)
- `0` remaining

### JS-generated inline styles (`style=` in template HTML)
- `0` remaining

### JS-generated inline handlers (` on*=` in template HTML)
- `0` remaining

## Detailed inventories

- `docs/inline-style-html.txt`
- `docs/inline-events-html.txt`
- `docs/inline-style-js.txt`
- `docs/inline-events-js.txt`

## Recommended next migration order

1. Inline migration complete for active scope.

## Suggested conversion pattern

- For `style="..."` in HTML: replace with semantic utility classes in page CSS files.
- For `on*=` handlers in HTML: use delegated listeners in page JS (single listener per region where possible).
- For JS template strings containing `style=`: move dynamic values to CSS variables (`style.setProperty('--x', ...)`) and class toggles.
- For JS template strings containing `on*=`: render `data-action` attributes and dispatch with delegated listeners.
