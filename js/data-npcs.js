(function (global) {
    // Optional preload list. Keep empty to use generic defaults.
    global.PRELOADED_NPCS = Array.isArray(global.PRELOADED_NPCS)
        ? global.PRELOADED_NPCS
        : [];
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
