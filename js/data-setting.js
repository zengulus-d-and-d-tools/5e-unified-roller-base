(function (global) {
    // Optional namespace for advanced preload overrides.
    if (!global.RTF_DATA || typeof global.RTF_DATA !== 'object') {
        global.RTF_DATA = {};
    }
    // Group-specific flavor hooks read by clue.js and dm-screen.js.
    // Shape:
    // RTF_DATA.groupFlavor = {
    //   "Group Name": {
    //     icon: "🛡️",
    //     clues: {
    //       phys: [{ core: "...", surf: "..." }],
    //       soc: [{ core: "...", surf: "..." }],
    //       arc: [{ core: "...", surf: "..." }],
    //       signatures: { phys: "...", social: "...", arcane: "..." }
    //     },
    //     beats: ["..."],
    //     hazards: [{ roll: 7, name: "...", eff: "..." }],
    //     snags: [{ roll: 23, n: "...", e: "..." }],
    //     coverage: { jurisdiction: "...", perk: "..." }
    //   }
    // };
    if (!global.RTF_DATA.groupFlavor || typeof global.RTF_DATA.groupFlavor !== 'object') {
        global.RTF_DATA.groupFlavor = {};
    }
    if (!global.RTF_DATA.dm || typeof global.RTF_DATA.dm !== 'object') {
        global.RTF_DATA.dm = {};
    }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
