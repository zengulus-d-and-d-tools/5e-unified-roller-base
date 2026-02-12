(function (global) {
    // Optional preload list. Keep empty to use generic defaults.
    global.PRELOADED_GUILDS = Array.isArray(global.PRELOADED_GUILDS)
        ? global.PRELOADED_GUILDS
        : [];
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
