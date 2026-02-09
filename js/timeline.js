(function () {
    const escapeHtml = (str = '') => String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const getStore = () => window.RTF_STORE;

    function toggleEventForm() {
        const form = document.getElementById('eventForm');
        if (!form) return;
        form.style.display = form.style.display === 'block' ? 'none' : 'block';
        if (form.style.display === 'block') {
            document.getElementById('eventTitle').focus();
        }
    }

    function resetForm() {
        ['eventTitle', 'eventFocus', 'eventTags', 'eventHighlights', 'eventFallout', 'eventFollow'].forEach(id => {
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
        const data = {
            id: 'event_' + Date.now(),
            title,
            focus: document.getElementById('eventFocus').value,
            heatDelta: document.getElementById('eventHeat').value,
            tags: document.getElementById('eventTags').value,
            highlights: document.getElementById('eventHighlights').value,
            fallout: document.getElementById('eventFallout').value,
            followUp: document.getElementById('eventFollow').value,
            resolved: false,
            created: new Date().toISOString()
        };
        store.addEvent(data);
        resetForm();
        toggleEventForm();
        renderTimeline();
    }

    function updateEventField(id, field, value) {
        const store = getStore();
        if (!store) return;
        store.updateEvent(id, { [field]: value });
        renderTimeline();
    }

    function deleteTimelineEvent(id) {
        if (!confirm('Delete this logged event?')) return;
        const store = getStore();
        if (!store) return;
        store.deleteEvent(id);
        renderTimeline();
    }

    function renderTagPills(tags) {
        if (!tags) return '';
        return tags.split(',').map(t => t.trim()).filter(Boolean)
            .map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`)
            .join('');
    }

    function buildEventCard(evt) {
        const heat = parseInt(evt.heatDelta, 10);
        const heatText = !isNaN(heat) && heat !== 0
            ? `<span class="tag-pill" style="border-color:${heat > 0 ? 'var(--danger)' : 'var(--accent-secondary)'}; color:${heat > 0 ? 'var(--danger)' : 'var(--accent-secondary)'}">Heat ${heat > 0 ? '+' : ''}${heat}</span>`
            : '';
        const focusDisplay = evt.focus ? `<span class="tag-pill">${escapeHtml(evt.focus)}</span>` : '';
        const resolved = Boolean(evt.resolved);
        const statusPill = `<span class="status-pill ${resolved ? 'resolved' : 'pending'}">${resolved ? 'Resolved' : 'Pending'}</span>`;

        return `
        <div class="event-card">
            <div class="event-head">
                <h3><input type="text" value="${escapeHtml(evt.title || '')}" placeholder="Title"
                    onchange="updateEventField('${evt.id}', 'title', this.value)"></h3>
                <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem;">
                    <input type="checkbox" ${resolved ? 'checked' : ''} onchange="updateEventField('${evt.id}', 'resolved', this.checked)">
                    ${statusPill}
                </label>
            </div>
            <div class="event-meta">
                <div>
                    <label>Focus</label>
                    <input type="text" value="${escapeHtml(evt.focus || '')}" placeholder="District / Guild"
                        onchange="updateEventField('${evt.id}', 'focus', this.value)">
                </div>
                <div>
                    <label>Heat Δ</label>
                    <input type="number" value="${escapeHtml(evt.heatDelta || '')}" placeholder="0"
                        onchange="updateEventField('${evt.id}', 'heatDelta', this.value)">
                </div>
                <div>
                    <label>Tags</label>
                    <input type="text" value="${escapeHtml(evt.tags || '')}" placeholder="tags"
                        onchange="updateEventField('${evt.id}', 'tags', this.value)">
                </div>
            </div>
            <div style="margin-top:10px;">${heatText} ${focusDisplay} ${renderTagPills(evt.tags)}</div>
            <div class="event-body">
                <textarea placeholder="Highlights" onchange="updateEventField('${evt.id}', 'highlights', this.value)">${escapeHtml(evt.highlights || '')}</textarea>
                <textarea placeholder="Fallout" onchange="updateEventField('${evt.id}', 'fallout', this.value)">${escapeHtml(evt.fallout || '')}</textarea>
                <textarea placeholder="Follow Ups" onchange="updateEventField('${evt.id}', 'followUp', this.value)">${escapeHtml(evt.followUp || '')}</textarea>
            </div>
            <div class="event-actions">
                <small style="color:#666; flex:1;">Logged ${evt.created ? new Date(evt.created).toLocaleString() : '—'}</small>
                <button class="btn btn-danger" onclick="deleteTimelineEvent('${evt.id}')">Delete</button>
            </div>
        </div>`;
    }

    function populateFocusFilter(events) {
        const filter = document.getElementById('eventFocusFilter');
        if (!filter) return;
        const preserved = filter.value;
        const focusValues = Array.from(new Set(events.map(e => e.focus).filter(Boolean))).sort();
        filter.innerHTML = '<option value="">All Focuses</option>' + focusValues.map(focus => `<option value="${escapeHtml(focus)}">${escapeHtml(focus)}</option>`).join('');
        if (focusValues.includes(preserved)) {
            filter.value = preserved;
        }
    }

    function renderTimeline() {
        const store = getStore();
        const container = document.getElementById('timelineList');
        if (!store || !container) return;
        const events = (store.getEvents() || []).slice();
        populateFocusFilter(events);

        const search = (document.getElementById('eventSearch').value || '').toLowerCase();
        const focusFilter = document.getElementById('eventFocusFilter').value;
        const sort = document.getElementById('eventSort').value;
        const impactOnly = document.getElementById('eventImpactOnly').checked;
        const hideResolved = document.getElementById('eventHideResolved').checked;

        const filtered = events.filter(evt => {
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

        container.innerHTML = filtered.length
            ? filtered.map(buildEventCard).join('')
            : '<div class="empty-state">No events logged yet.</div>';
    }

    function init() {
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

    window.addEventListener('load', waitForStore);
})();
