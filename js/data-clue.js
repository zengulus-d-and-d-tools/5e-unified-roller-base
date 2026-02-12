(function (global) {
    // Optional clue preload payload. Keep null to use built-in generic clue data.
    // Supported keys:
    // - frictions: string[]
    // - costs: string[]
    // - groupFlavor: { "Group Name": { clues: { phys/soc/arc }, icon } }
    if (typeof global.CLUEDATA === 'undefined') {
        global.CLUEDATA = null;
    }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
