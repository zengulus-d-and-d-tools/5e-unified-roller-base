(function () {
    const SOFT_DELETE_MS = 12000;
    const escapeHtml = (str = '') => String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const escapeJsString = (str = '') => String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    const delegatedHandlerEvents = ['click', 'change', 'input'];
    const delegatedHandlerCache = new Map();
    let delegatedHandlersBound = false;
    let deleteManager = null;
    let pendingDeepLinkFocus = '';
    const sanitizeImageUrl = (url = '') => {
        const candidate = String(url || '').trim();
        if (!candidate) return '';

        if (/^data:image\/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=]+$/i.test(candidate)) {
            return candidate;
        }

        try {
            const parsed = new URL(candidate, window.location.href);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'file:' || parsed.protocol === 'blob:') {
                return parsed.href;
            }
        } catch (err) {
            return '';
        }

        return '';
    };

    function getDelegatedHandlerFn(code) {
        if (!delegatedHandlerCache.has(code)) {
            delegatedHandlerCache.set(code, window.RTF_DELEGATED_HANDLER.compile(code));
        }
        return delegatedHandlerCache.get(code);
    }

    function runDelegatedHandler(el, attrName, event) {
        const code = el.getAttribute(attrName);
        if (!code) return;

        try {
            const result = getDelegatedHandlerFn(code).call(el, event);
            if (result === false) {
                event.preventDefault();
                event.stopPropagation();
            }
        }
        catch (err) {
            console.error(`Delegated handler failed for ${attrName}:`, code, err);
        }
    }

    function handleDelegatedDataEvent(event) {
        const attrName = `data-on${event.type}`;
        let node = event.target instanceof Element ? event.target : null;

        while (node) {
            if (node.hasAttribute(attrName)) {
                runDelegatedHandler(node, attrName, event);
                if (event.cancelBubble) break;
            }
            node = node.parentElement;
        }
    }

    function bindDelegatedDataHandlers() {
        if (delegatedHandlersBound) return;
        delegatedHandlersBound = true;
        delegatedHandlerEvents.forEach((eventName) => {
            document.addEventListener(eventName, handleDelegatedDataEvent);
        });
    }

    bindDelegatedDataHandlers();

    const getStore = () => window.RTF_STORE;
    const getDeleteManager = () => {
        if (deleteManager) return deleteManager;
        const api = window.RTF_SOFT_DELETE;
        if (!api || typeof api.createSoftDeleteManager !== 'function') return null;
        deleteManager = api.createSoftDeleteManager({
            undoMs: SOFT_DELETE_MS,
            host: document.body,
            onStateChange: () => renderTimeline()
        });
        return deleteManager;
    };
    const HEAT_SYNC_KEY = 'rtf_timeline_auto_heat';
    const HEAT_MIN = 0;
    const HEAT_MAX = 6;

    const parseHeatDelta = (value) => {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const clampHeat = (value) => Math.max(HEAT_MIN, Math.min(HEAT_MAX, value));

    const isHeatAutoSyncEnabled = () => {
        const stored = localStorage.getItem(HEAT_SYNC_KEY);
        if (stored === null) return true;
        return stored === 'true';
    };

    const setHeatAutoSync = (enabled) => {
        localStorage.setItem(HEAT_SYNC_KEY, String(Boolean(enabled)));
    };

    const applyHeatDelta = (delta, store) => {
        if (!delta || !store || !store.state || !store.state.campaign) return;
        if (!isHeatAutoSyncEnabled()) return;
        const current = Number(store.state.campaign.heat) || 0;
        store.state.campaign.heat = clampHeat(current + delta);
        if (typeof store.save === 'function') store.save({ scope: 'campaign' });
    };

    function clearTimelineLinkParamsFromUrl() {
        if (!window.history || typeof window.history.replaceState !== 'function') return;
        const url = new URL(window.location.href);
        const keys = ['search', 'focus', 'source', 'id'];
        let changed = false;
        keys.forEach((key) => {
            if (!url.searchParams.has(key)) return;
            url.searchParams.delete(key);
            changed = true;
        });
        if (changed) window.history.replaceState({}, document.title, url.toString());
    }

    function applyTimelineLinkFiltersFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const search = String(params.get('search') || '').trim();
        const focus = String(params.get('focus') || '').trim();
        if (!search && !focus) return;

        const searchInput = document.getElementById('eventSearch');
        if (searchInput && search) searchInput.value = search;
        pendingDeepLinkFocus = focus;
        clearTimelineLinkParamsFromUrl();
    }

    function buildBoardLinkForEvent(id) {
        const url = new URL('board.html', window.location.href);
        url.searchParams.set('linkType', 'timeline-event');
        url.searchParams.set('id', String(id || '').trim());
        return url.toString();
    }

    function openTimelineEventInBoard(id) {
        const cleanId = String(id || '').trim();
        if (!cleanId) return;
        window.location.assign(buildBoardLinkForEvent(cleanId));
    }

    function toggleEventForm() {
        const form = document.getElementById('eventForm');
        if (!form) return;
        form.style.display = form.style.display === 'block' ? 'none' : 'block';
        if (form.style.display === 'block') {
            document.getElementById('eventTitle').focus();
        }
    }

    function resetForm() {
        ['eventTitle', 'eventFocus', 'eventTags', 'eventImageUrl', 'eventHighlights', 'eventFallout', 'eventFollow'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const heat = document.getElementById('eventHeat');
        if (heat) heat.value = '';
    }

    function addTimelineEvent() {
        const store = getStore();
        if (!store) return;
        const title = document.getElementById('eventTitle').value.trim();
        if (!title) {
            alert('Event name required.');
            return;
        }
        const imageRaw = document.getElementById('eventImageUrl').value.trim();
        const imageUrl = sanitizeImageUrl(imageRaw);
        if (imageRaw && !imageUrl) {
            alert('Please provide a valid image URL.');
            return;
        }
        const data = {
            id: 'event_' + Date.now(),
            title,
            focus: document.getElementById('eventFocus').value,
            heatDelta: document.getElementById('eventHeat').value,
            tags: document.getElementById('eventTags').value,
            imageUrl,
            highlights: document.getElementById('eventHighlights').value,
            fallout: document.getElementById('eventFallout').value,
            followUp: document.getElementById('eventFollow').value,
            resolved: false,
            created: new Date().toISOString()
        };
        store.addEvent(data);
        applyHeatDelta(parseHeatDelta(data.heatDelta), store);
        resetForm();
        toggleEventForm();
        renderTimeline();
    }

    function updateEventField(id, field, value) {
        const store = getStore();
        if (!store) return;
        let nextValue = value;
        if (field === 'imageUrl') {
            const raw = String(value || '').trim();
            const clean = sanitizeImageUrl(raw);
            if (raw && !clean) {
                alert('Please provide a valid image URL.');
                renderTimeline();
                return;
            }
            nextValue = clean;
        }
        const existing = (store.getEvents ? store.getEvents() : []).find(evt => evt.id === id);
        const previousHeat = existing ? parseHeatDelta(existing.heatDelta) : 0;
        store.updateEvent(id, { [field]: nextValue });
        if (field === 'heatDelta') {
            const nextHeat = parseHeatDelta(nextValue);
            applyHeatDelta(nextHeat - previousHeat, store);
        }
        renderTimeline();
    }

    function deleteTimelineEvent(id) {
        const store = getStore();
        if (!store) return;
        const existing = (store.getEvents ? store.getEvents() : []).find(evt => evt.id === id);
        if (!existing) return;
        const previousHeat = existing ? parseHeatDelta(existing.heatDelta) : 0;

        const manager = getDeleteManager();
        if (!manager) {
            if (!confirm('Delete this logged event?')) return;
            store.deleteEvent(id);
            applyHeatDelta(-previousHeat, store);
            renderTimeline();
            return;
        }

        manager.schedule({
            id,
            label: `Event removed: ${existing.title || 'Untitled Event'}`,
            onFinalize: () => {
                store.deleteEvent(id);
                applyHeatDelta(-previousHeat, store);
                renderTimeline();
            },
            onUndo: () => {
                renderTimeline();
            }
        });
        renderTimeline();
    }

    function renderTagPills(tags) {
        if (!tags) return '';
        return tags.split(',').map(t => t.trim()).filter(Boolean)
            .map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`)
            .join('');
    }

    function normalizeRecapText(value) {
        if (!value) return '—';
        const cleaned = String(value).trim();
        if (!cleaned) return '—';
        return cleaned.replace(/\s*\n+\s*/g, ' ');
    }

    function buildEventCard(evt) {
        const evtId = escapeJsString(evt.id || '');
        const heat = parseInt(evt.heatDelta, 10);
        const heatClass = heat > 0 ? 'tag-pill-heat-up' : 'tag-pill-heat-down';
        const heatText = !isNaN(heat) && heat !== 0
            ? `<span class="tag-pill ${heatClass}">Heat ${heat > 0 ? '+' : ''}${heat}</span>`
            : '';
        const focusDisplay = evt.focus ? `<span class="tag-pill">${escapeHtml(evt.focus)}</span>` : '';
        const resolved = Boolean(evt.resolved);
        const statusClass = resolved ? 'resolved' : 'pending';
        const statusLabel = resolved ? 'Resolved' : 'Pending';
        const imageUrl = sanitizeImageUrl(evt.imageUrl || '');
        const imageMarkup = imageUrl
            ? `<div class="event-image-block"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(evt.title || 'Event')} image"></div>`
            : '';

        return `
        <div class="event-card${imageMarkup ? ' has-image' : ''}">
            <div class="event-card-content">
                <div class="event-head">
                    <h3><input type="text" value="${escapeHtml(evt.title || '')}" placeholder="Title"
                        data-onchange="updateEventField('${evtId}', 'title', this.value)"></h3>
                    <button class="toggle-btn status-toggle status-pill ${statusClass} ${resolved ? 'active' : ''}" type="button"
                        aria-pressed="${resolved ? 'true' : 'false'}"
                        data-onclick="toggleResolved('${evtId}', this)">${statusLabel}</button>
                </div>
                <div class="event-meta">
                    <div>
                        <label>Focus</label>
                        <input type="text" value="${escapeHtml(evt.focus || '')}" placeholder="District / Guild"
                            data-onchange="updateEventField('${evtId}', 'focus', this.value)">
                    </div>
                    <div>
                        <label>Heat Δ</label>
                        <input type="number" value="${escapeHtml(evt.heatDelta || '')}" placeholder="0"
                            data-onchange="updateEventField('${evtId}', 'heatDelta', this.value)">
                    </div>
                    <div>
                        <label>Tags</label>
                        <input type="text" value="${escapeHtml(evt.tags || '')}" placeholder="tags"
                            data-onchange="updateEventField('${evtId}', 'tags', this.value)">
                    </div>
                    <div>
                        <label>Image URL</label>
                        <input type="url" value="${escapeHtml(evt.imageUrl || '')}" placeholder="https://..."
                            data-onchange="updateEventField('${evtId}', 'imageUrl', this.value)">
                    </div>
                </div>
                <div class="event-pill-row">${heatText} ${focusDisplay} ${renderTagPills(evt.tags)}</div>
                <div class="event-body">
                    <textarea placeholder="Highlights" data-onchange="updateEventField('${evtId}', 'highlights', this.value)">${escapeHtml(evt.highlights || '')}</textarea>
                    <textarea placeholder="Fallout" data-onchange="updateEventField('${evtId}', 'fallout', this.value)">${escapeHtml(evt.fallout || '')}</textarea>
                    <textarea placeholder="Follow Ups" data-onchange="updateEventField('${evtId}', 'followUp', this.value)">${escapeHtml(evt.followUp || '')}</textarea>
                </div>
                <div class="event-actions">
                    <small class="event-log-meta">Logged ${evt.created ? new Date(evt.created).toLocaleString() : '—'}</small>
                    <button class="btn" data-onclick="openTimelineEventInBoard('${evtId}')">Board</button>
                    <button class="btn btn-danger" data-onclick="deleteTimelineEvent('${evtId}')">Delete</button>
                </div>
            </div>
            ${imageMarkup}
        </div>`;
    }

    function populateFocusFilter(events) {
        const filter = document.getElementById('eventFocusFilter');
        if (!filter) return;
        const preserved = filter.value;
        const focusValues = Array.from(new Set(events.map(e => e.focus).filter(Boolean))).sort();
        filter.innerHTML = '<option value="">All Focuses</option>' + focusValues.map(focus => `<option value="${escapeHtml(focus)}">${escapeHtml(focus)}</option>`).join('');
        if (pendingDeepLinkFocus && focusValues.includes(pendingDeepLinkFocus)) {
            filter.value = pendingDeepLinkFocus;
            pendingDeepLinkFocus = '';
            return;
        }
        if (focusValues.includes(preserved)) {
            filter.value = preserved;
        }
    }

    function getFilteredEvents() {
        const store = getStore();
        const manager = getDeleteManager();
        if (!store) {
            return { filtered: [], filters: null };
        }
        const events = (store.getEvents() || []).slice();
        populateFocusFilter(events);

        const search = (document.getElementById('eventSearch').value || '').toLowerCase();
        const focusFilter = document.getElementById('eventFocusFilter').value;
        const sort = document.getElementById('eventSort').value;
        const impactOnly = isButtonPressed('eventImpactOnly');
        const hideResolved = isButtonPressed('eventHideResolved');

        const filtered = events.filter(evt => {
            if (manager && manager.isPending(evt.id)) return false;
            const text = `${evt.title || ''} ${evt.focus || ''} ${evt.highlights || ''} ${evt.fallout || ''} ${evt.followUp || ''} ${evt.tags || ''}`.toLowerCase();
            const matchesSearch = search ? text.includes(search) : true;
            const matchesFocus = focusFilter ? evt.focus === focusFilter : true;
            const heat = parseInt(evt.heatDelta, 10);
            const matchesImpact = impactOnly ? (!isNaN(heat) && heat !== 0) || (evt.fallout && evt.fallout.trim()) : true;
            const matchesResolved = hideResolved ? !evt.resolved : true;
            return matchesSearch && matchesFocus && matchesImpact && matchesResolved;
        });

        filtered.sort((a, b) => {
            if (sort === 'heat') {
                const aHeat = Math.abs(parseInt(a.heatDelta || '0', 10));
                const bHeat = Math.abs(parseInt(b.heatDelta || '0', 10));
                return bHeat - aHeat;
            }
            const aTime = a.created || '';
            const bTime = b.created || '';
            if (sort === 'oldest') {
                return aTime.localeCompare(bTime);
            }
            return bTime.localeCompare(aTime);
        });

        return {
            filtered,
            filters: {
                search,
                focusFilter,
                sort,
                impactOnly
            }
        };
    }

    function buildExportRecap(events, filters) {
        const lines = [];
        lines.push('# Mission Timeline Recap');
        lines.push(`Generated: ${new Date().toLocaleString()}`);
        lines.push('');
        lines.push('## Active Filters');
        lines.push(`- Search: ${filters.search ? `"${filters.search}"` : 'None'}`);
        lines.push(`- Focus: ${filters.focusFilter || 'All'}`);
        lines.push(`- Sort: ${filters.sort}`);
        lines.push(`- Impact only: ${filters.impactOnly ? 'Yes' : 'No'}`);
        lines.push('');

        events.forEach(evt => {
            const title = normalizeRecapText(evt.title);
            const focus = normalizeRecapText(evt.focus);
            const heat = parseInt(evt.heatDelta, 10);
            const heatDisplay = Number.isNaN(heat) ? '—' : `${heat > 0 ? '+' : ''}${heat}`;
            lines.push(`### ${title}`);
            lines.push(`- Focus: ${focus}`);
            lines.push(`- Heat Δ: ${heatDisplay}`);
            lines.push(`- Image: ${normalizeRecapText(evt.imageUrl)}`);
            lines.push(`- Highlights: ${normalizeRecapText(evt.highlights)}`);
            lines.push(`- Fallout: ${normalizeRecapText(evt.fallout)}`);
            lines.push(`- Follow-up: ${normalizeRecapText(evt.followUp)}`);
            lines.push('');
        });

        return lines.join('\n').trim() + '\n';
    }

    function triggerRecapDownload(text) {
        const dateStamp = new Date().toISOString().slice(0, 10);
        const blob = new Blob([text], { type: 'text/markdown' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `mission-timeline-recap-${dateStamp}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 500);
    }

    function exportTimelineRecap() {
        const { filtered, filters } = getFilteredEvents();
        if (!filters) return;
        if (!filtered.length) {
            alert('No matching events to export.');
            return;
        }
        const recapText = buildExportRecap(filtered, filters);
        triggerRecapDownload(recapText);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(recapText).catch(() => {
                // Clipboard may be blocked; download already started.
            });
        }
    }

    function renderTimeline() {
        const container = document.getElementById('timelineList');
        if (!container) return;
        const { filtered } = getFilteredEvents();

        container.innerHTML = filtered.length
            ? filtered.map(buildEventCard).join('')
            : '<div class="empty-state">No events logged yet.</div>';
    }

    function init() {
        getDeleteManager();
        const autoHeatToggle = document.getElementById('eventAutoHeat');
        if (autoHeatToggle) {
            setButtonPressed(autoHeatToggle, isHeatAutoSyncEnabled());
        }
        applyTimelineLinkFiltersFromUrl();
        renderTimeline();
    }

    function waitForStore() {
        if (getStore()) {
            init();
        } else {
            setTimeout(waitForStore, 100);
        }
    }

    window.toggleEventForm = toggleEventForm;
    window.addTimelineEvent = addTimelineEvent;
    window.renderTimeline = renderTimeline;
    window.updateEventField = updateEventField;
    window.deleteTimelineEvent = deleteTimelineEvent;
    window.setHeatAutoSync = setHeatAutoSync;
    window.exportTimelineRecap = exportTimelineRecap;
    window.openTimelineEventInBoard = openTimelineEventInBoard;
    window.toggleFilterButton = toggleFilterButton;
    window.toggleAutoHeat = toggleAutoHeat;
    window.toggleResolved = toggleResolved;

    window.addEventListener('load', waitForStore);
    window.addEventListener('beforeunload', () => {
        const manager = getDeleteManager();
        if (manager && typeof manager.flush === 'function') manager.flush();
    });

    function setButtonPressed(button, pressed) {
        if (!button) return;
        const isPressed = Boolean(pressed);
        button.setAttribute('aria-pressed', String(isPressed));
        button.classList.toggle('active', isPressed);
    }

    function isButtonPressed(id) {
        const button = document.getElementById(id);
        return button ? button.getAttribute('aria-pressed') === 'true' : false;
    }

    function toggleFilterButton(button, callback) {
        if (!button) return;
        const next = button.getAttribute('aria-pressed') !== 'true';
        setButtonPressed(button, next);
        if (typeof callback === 'function') callback();
    }

    function toggleAutoHeat(button) {
        if (!button) return;
        const next = button.getAttribute('aria-pressed') !== 'true';
        setButtonPressed(button, next);
        setHeatAutoSync(next);
    }

    function toggleResolved(id, button) {
        if (!button) return;
        const next = button.getAttribute('aria-pressed') !== 'true';
        setButtonPressed(button, next);
        updateEventField(id, 'resolved', next);
    }
})();
