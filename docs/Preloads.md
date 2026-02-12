# Preload Guide (`js/data-*.js`)

Preloads are optional starter data loaded before `RTF_STORE` initializes.

## Basic Rule

- Leave preload arrays empty for sparse generic defaults.
- Add entries when you want custom campaign starter data.

## Fastest Path: Group Loader Wizard (No Code)

1. Open `tools.html`.
2. Press `Alt+Shift+L`.
3. Enter group names (one per line or comma-separated).
4. Review and choose `Replace` or `Merge`.
5. Click **Load Into Store**.

This updates `campaign.rep`, which feeds Hub, Board, Narrative, Clue, and form filters in roster/locations/requisitions.

If Supabase sync is connected, the update is included in next push.

## File-Based Preloads

Edit these files:
- `js/data-guilds.js`
- `js/data-npcs.js`
- `js/data-locations.js`
- `js/data-setting.js`
- `js/data-clue.js` (optional clue-only overrides)
- `js/data.js` (optional compatibility namespace placeholder)

## Group-Specific Flavor (Clues, Beats, Hazards, Snags)

Put group flavor in `js/data-setting.js` under `RTF_DATA.groupFlavor`.

`clue.js` and `dm-screen.js` now both read this map.

### Exact Shape

```js
(function (global) {
    if (!global.RTF_DATA || typeof global.RTF_DATA !== 'object') global.RTF_DATA = {};

    global.RTF_DATA.groupFlavor = {
        "City Watch": {
            icon: "W",

            clues: {
                phys: [
                    { core: "a watch sergeants wax seal", surf: "pressed into rain-soft clay" }
                ],
                soc: [
                    { core: "matching testimony from gate sentries", surf: "all using the same odd phrase" }
                ],
                arc: [
                    { core: "a ward-token keyed to the barracks", surf: "still warm from recent use" }
                ],
                signatures: {
                    phys: "Standard issue seals, boot patterns, confiscation tags",
                    social: "Chain-of-command language and rehearsed witness wording",
                    arcane: "Watch-key wards and lawful binding glyph residue"
                }
            },

            beats: [
                "running a midnight checkpoint on bridge traffic",
                "locking down a side street after a reported disturbance"
            ],

            hazards: [
                { roll: 5, name: "Watch Barricade", eff: "A chokepoint forces movement through one guarded lane." },
                { name: "Alarm Horn", eff: "Nearby patrols converge in 1d4 rounds." }
            ],

            snags: [
                { roll: 23, n: "Jurisdiction Dispute", e: "Authority conflict delays action until credentials are proven." },
                { n: "Paperwork Hold", e: "A missing writ halts legal access to the scene." }
            ],

            coverage: {
                jurisdiction: "Streets, gates, and public order within city bounds",
                perk: "Rapid muster of uniformed patrol support"
            }
        },

        "Druids of the Barrow": {
            clues: {
                phys: [{ core: "grave-soil pressed into a ritual knot", surf: "mixed with night-bloom pollen" }],
                soc: [{ core: "a vow spoken in old druidic cadence", surf: "repeated by unrelated witnesses" }],
                arc: [{ core: "a root-bound sigil ring", surf: "thrumming near barrow stones" }]
            },
            beats: [
                "marking a boundary circle at moonrise",
                "questioning trespassers at a standing-stone path"
            ],
            hazards: [
                { roll: 8, name: "Spore Surge", eff: "DC 12 Con save or poisoned until end of next turn." }
            ],
            snags: [
                { roll: 30, n: "Sacred Boundary", e: "Crossing the line without rite triggers local hostility." }
            ]
        }
    };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
```

## What Uses What

- **Clue Generator (`clue.html`)**
  - Uses `groupFlavor[GROUP].clues.phys/soc/arc` per active group.
  - Uses `groupFlavor[GROUP].icon` when provided.
  - If no per-group clue entries exist, it falls back to built-in generic clue combinatorics.

- **Narrative Engine (`dm-screen.html`)**
  - Uses `groupFlavor[GROUP].beats` for group-specific scene activity lines.
  - Uses `groupFlavor[GROUP].hazards` during hazard generation.
  - Uses `groupFlavor[GROUP].snags` during snag generation.
  - Uses `groupFlavor[GROUP].clues.signatures` in the Clue Signatures reference table.
  - Uses `groupFlavor[GROUP].coverage` in the Group Coverage reference table.

## Hazard/Snag Roll Rules (Fallback Behavior)

- Hazard roll is still `2d6`.
- Snag roll is still `2d20`.
- For group flavor entries:
  - If `roll` matches, that entry is eligible.
  - If `roll` is omitted, that entry is eligible on any roll.
- If no group-flavor entry is eligible, generator falls back to built-in generic hazard/snag tables.

## Optional Clue-Only Overrides (`js/data-clue.js`)

Use this if you only want to change friction/cost language (or clue-group flavor without touching `RTF_DATA`).

```js
(function (global) {
    global.CLUEDATA = {
        frictions: ["Barred", "Defaced", "Guarded by oathbound sentries"],
        costs: ["Lose Time", "Spend Coin", "Owe a Favor"],
        groupFlavor: {
            "City Watch": {
                clues: {
                    phys: [{ core: "a confiscation docket", surf: "stamped with the watch quartermasters seal" }]
                }
            }
        }
    };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
```

## Core Data Preloads (Guilds/NPCs/Locations)

### `js/data-guilds.js`

```js
(function (global) {
    global.PRELOADED_GUILDS = [
        "General",
        "City Watch",
        "Druids of the Barrow",
        { name: "Order of the Lantern" }
    ];
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
```

Notes:
- Supports strings and `{ name: "..." }` objects.
- Names are trimmed and deduplicated case-insensitively.

### `js/data-npcs.js`

```js
(function (global) {
    global.PRELOADED_NPCS = [
        {
            id: "npc_lia",
            name: "Lia Thornkeep",
            guild: "City Watch",
            wants: "Keep panic out of the streets",
            leverage: "A witness saw her meeting a smuggler",
            imageUrl: "",
            notes: "Night watch captain at South Gate"
        }
    ];
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
```

### `js/data-locations.js`

```js
(function (global) {
    global.PRELOADED_LOCATIONS = [
        {
            id: "loc_south_gate",
            name: "South Gate Barracks",
            district: "City Watch",
            desc: "Stone gatehouse with barracks and holding cells",
            imageUrl: "",
            notes: "Captain keeps private ledgers in the upper office"
        }
    ];
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
```

## When Changes Apply

- Group names (`PRELOADED_GUILDS`) are read on load and merged into reputation map.
- Group flavor (`RTF_DATA.groupFlavor`) is read at runtime by clue/narrative tools.
- NPC/location preloads seed default/fresh store state.

If local campaign data already exists, existing `campaign.npcs` / `campaign.locations` remain.

To reseed from preloads, clear local site storage (or import a fresh empty store), then reload.
