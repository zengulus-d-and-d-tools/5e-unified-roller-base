(function (global) {
    const RECENT_KEYS = new Map();

    const cleanText = (value) => {
        if (value === undefined || value === null) return '';
        return String(value).trim();
    };

    const normalizeTags = (tags) => {
        const asArray = Array.isArray(tags) ? tags : cleanText(tags).split(',');
        const list = asArray
            .map((tag) => cleanText(tag))
            .filter(Boolean);
        return Array.from(new Set(list)).join(', ');
    };

    const shouldSkipDuplicate = (key, windowMs) => {
        if (!key) return false;
        const now = Date.now();
        const lastSeen = RECENT_KEYS.get(key) || 0;
        RECENT_KEYS.set(key, now);

        // Keep map compact over long sessions.
        if (RECENT_KEYS.size > 600) {
            for (const [entryKey, ts] of RECENT_KEYS.entries()) {
                if (now - ts > 10 * 60 * 1000) RECENT_KEYS.delete(entryKey);
            }
        }

        return now - lastSeen < windowMs;
    };

    const toHeatDelta = (value) => {
        if (value === undefined || value === null || value === '') return '';
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return '';
        return String(parsed);
    };

    const buildStoreEvent = (payload) => {
        const source = payload && typeof payload === 'object' ? payload : {};
        return {
            id: cleanText(source.id) || ('event_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)),
            title: cleanText(source.title) || 'Session Event',
            focus: cleanText(source.focus),
            heatDelta: toHeatDelta(source.heatDelta),
            tags: normalizeTags(source.tags),
            highlights: cleanText(source.highlights),
            fallout: cleanText(source.fallout),
            followUp: cleanText(source.followUp),
            created: cleanText(source.created) || new Date().toISOString(),
            source: cleanText(source.source),
            kind: cleanText(source.kind)
        };
    };

    function logMajorEvent(payload, options = {}) {
        const store = global.RTF_STORE;
        if (!store || typeof store.addEvent !== 'function') {
            return { ok: false, reason: 'store-unavailable' };
        }

        const opts = options && typeof options === 'object' ? options : {};
        const dedupeWindowMs = Number.isFinite(Number(opts.dedupeWindowMs))
            ? Number(opts.dedupeWindowMs)
            : 1800;

        const eventData = buildStoreEvent(payload);
        const dedupeKey = cleanText(opts.dedupeKey || payload && payload.dedupeKey);

        if (!opts.disableDedupe && shouldSkipDuplicate(dedupeKey, dedupeWindowMs)) {
            return { ok: false, reason: 'deduped' };
        }

        store.addEvent(eventData);
        return { ok: true, id: eventData.id };
    }

    global.RTF_SESSION_LOG = {
        logMajorEvent
    };
})(window);
