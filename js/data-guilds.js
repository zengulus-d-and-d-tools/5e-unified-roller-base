(function (global) {
    const DEFAULT_GUILDS = [
        "Azorius",
        "Boros",
        "Dimir",
        "Golgari",
        "Gruul",
        "Izzet",
        "Orzhov",
        "Rakdos",
        "Selesnya",
        "Simic",
        "Guildless"
    ];

    function normalizeGuildName(raw) {
        return String(raw || '').trim();
    }

    function sanitizeGuildList(source) {
        const seen = new Set();
        const out = [];
        const list = Array.isArray(source) ? source : [];
        list.forEach((entry) => {
            const name = normalizeGuildName(entry);
            if (!name) return;
            const key = name.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            out.push(name);
        });
        return out;
    }

    function buildActiveGuilds() {
        const seeded = Array.isArray(global.PRELOADED_GUILDS) ? global.PRELOADED_GUILDS : [];
        const fromData = global.RTF_DATA && Array.isArray(global.RTF_DATA.guilds) ? global.RTF_DATA.guilds : [];
        const resolved = seeded.length ? seeded : (fromData.length ? fromData : DEFAULT_GUILDS);
        const normalized = sanitizeGuildList(resolved);
        return normalized.length ? normalized : DEFAULT_GUILDS.slice();
    }

    global.getRTFGuilds = function getRTFGuilds(options = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        const includeGuildless = opts.includeGuildless !== false;
        const active = buildActiveGuilds();
        if (includeGuildless) return active;
        return active.filter((name) => name.toLowerCase() !== 'guildless');
    };

    global.PRELOADED_GUILDS = buildActiveGuilds();
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
