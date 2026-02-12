(function (global) {
    // Optional preload list. Keep empty to use generic defaults.
    global.PRELOADED_LOCATIONS = Array.isArray(global.PRELOADED_LOCATIONS)
        ? global.PRELOADED_LOCATIONS
        : [];
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
