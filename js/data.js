(function (global) {
    // Compatibility preload entrypoint. Extend this object for custom datasets.
    if (!global.RTF_DATA || typeof global.RTF_DATA !== 'object') {
        global.RTF_DATA = {};
    }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
