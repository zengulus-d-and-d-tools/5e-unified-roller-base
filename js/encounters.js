(function () {
    const TIERS = [
        { value: 'Routine', cardClass: 'enc-card-tier-routine' },
        { value: 'Standard', cardClass: 'enc-card-tier-standard' },
        { value: 'Elite', cardClass: 'enc-card-tier-elite' },
        { value: 'Boss', cardClass: 'enc-card-tier-boss' }
    ];

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

    const getStore = () => window.RTF_STORE;

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

    function populateTierSelects() {
        const tierSelect = document.getElementById('encTier');
        if (tierSelect && tierSelect.options.length === 0) {
            tierSelect.innerHTML = TIERS.map((t) => {
                const safe = escapeHtml(t.value);
                return `<option value="${safe}">${safe}</option>`;
            }).join('');
        }
        const tierFilter = document.getElementById('encTierFilter');
        if (tierFilter && tierFilter.options.length === 1) {
            TIERS.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.value;
                opt.textContent = t.value;
                tierFilter.appendChild(opt);
            });
        }
    }

    function toggleEncForm() {
        const form = document.getElementById('encForm');
        if (!form) return;
        populateTierSelects();
        const willOpen = form.classList.contains('enc-hidden');
        if (willOpen) {
            form.classList.remove('enc-hidden');
            document.getElementById('encTitle').focus();
        } else {
            form.classList.add('enc-hidden');
        }
    }

    function resetForm() {
        ['encTitle', 'encLocation', 'encObjective', 'encOpposition', 'encHazards', 'encBeats', 'encRewards', 'encNotes'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const tierSelect = document.getElementById('encTier');
        if (tierSelect) tierSelect.value = 'Routine';
    }

    function addEncounter() {
        const store = getStore();
        if (!store) return;
        const title = document.getElementById('encTitle').value.trim();
        if (!title) {
            alert('Encounter name required.');
            return;
        }
        const enc = {
            id: 'enc_' + Date.now(),
            title,
            tier: document.getElementById('encTier').value,
            location: document.getElementById('encLocation').value,
            objective: document.getElementById('encObjective').value,
            opposition: document.getElementById('encOpposition').value,
            hazards: document.getElementById('encHazards').value,
            beats: document.getElementById('encBeats').value,
            rewards: document.getElementById('encRewards').value,
            notes: document.getElementById('encNotes').value,
            created: new Date().toISOString()
        };
        store.addEncounter(enc);
        resetForm();
        toggleEncForm();
        renderEncounters();
    }

    function updateEncField(id, field, value) {
        const store = getStore();
        if (!store) return;
        store.updateEncounter(id, { [field]: value });
        renderEncounters();
    }

    function deleteEncounter(id) {
        if (!confirm('Delete this encounter recipe?')) return;
        const store = getStore();
        if (!store) return;
        store.deleteEncounter(id);
        renderEncounters();
    }

    function buildTierOptions(selected) {
        const selectedRaw = String(selected || 'Routine');
        return TIERS.map((t) => {
            const raw = String(t.value || '');
            const safe = escapeHtml(raw);
            return `<option value="${safe}" ${raw === selectedRaw ? 'selected' : ''}>${safe}</option>`;
        }).join('');
    }

    function buildCard(enc) {
        const encId = escapeJsString(enc.id || '');
        const tierMeta = TIERS.find(t => t.value === enc.tier) || TIERS[0];
        return `
        <div class="enc-card ${tierMeta.cardClass}">
            <h3>
                <input type="text" value="${escapeHtml(enc.title || '')}" placeholder="Encounter"
                    data-onchange="updateEncField('${encId}', 'title', this.value)">
                <select class="tier-pill" data-onchange="updateEncField('${encId}', 'tier', this.value)">
                    ${buildTierOptions(enc.tier)}
                </select>
            </h3>
            <div class="enc-grid enc-grid-card-meta">
                <div>
                    <label class="enc-field-label">Battlefield</label>
                    <input type="text" value="${escapeHtml(enc.location || '')}" placeholder="Arena"
                        data-onchange="updateEncField('${encId}', 'location', this.value)">
                </div>
                <div>
                    <label class="enc-field-label">Objective</label>
                    <input type="text" value="${escapeHtml(enc.objective || '')}" placeholder="Goal"
                        data-onchange="updateEncField('${encId}', 'objective', this.value)">
                </div>
            </div>
            <textarea placeholder="Opposition" data-onchange="updateEncField('${encId}', 'opposition', this.value)">${escapeHtml(enc.opposition || '')}</textarea>
            <textarea placeholder="Hazards" data-onchange="updateEncField('${encId}', 'hazards', this.value)">${escapeHtml(enc.hazards || '')}</textarea>
            <textarea placeholder="Beats / Phases" data-onchange="updateEncField('${encId}', 'beats', this.value)">${escapeHtml(enc.beats || '')}</textarea>
            <textarea placeholder="Rewards" data-onchange="updateEncField('${encId}', 'rewards', this.value)">${escapeHtml(enc.rewards || '')}</textarea>
            <textarea placeholder="Notes" data-onchange="updateEncField('${encId}', 'notes', this.value)">${escapeHtml(enc.notes || '')}</textarea>
            <div class="enc-actions">
                <small class="enc-log-meta">Logged ${enc.created ? new Date(enc.created).toLocaleString() : '—'}</small>
                <button class="btn btn-danger" data-onclick="deleteEncounter('${encId}')">Delete</button>
            </div>
        </div>`;
    }

    function renderEncounters() {
        const store = getStore();
        const container = document.getElementById('encounterList');
        if (!store || !container) return;
        populateTierSelects();
        const search = (document.getElementById('encSearch').value || '').toLowerCase();
        const tierFilter = document.getElementById('encTierFilter').value;

        const list = (store.getEncounters() || []).slice();
        const filtered = list.filter(enc => {
            const text = `${enc.title || ''} ${enc.location || ''} ${enc.objective || ''} ${enc.opposition || ''} ${enc.hazards || ''} ${enc.beats || ''} ${enc.rewards || ''} ${enc.notes || ''}`.toLowerCase();
            const matchesSearch = search ? text.includes(search) : true;
            const matchesTier = tierFilter ? enc.tier === tierFilter : true;
            return matchesSearch && matchesTier;
        });

        filtered.sort((a, b) => (b.created || '').localeCompare(a.created || ''));

        container.innerHTML = filtered.length
            ? filtered.map(buildCard).join('')
            : '<div class="empty-state">No encounter recipes yet.</div>';
    }

    function waitForStore() {
        if (getStore()) {
            renderEncounters();
        } else {
            setTimeout(waitForStore, 100);
        }
    }

    bindDelegatedDataHandlers();

    window.toggleEncForm = toggleEncForm;
    window.addEncounter = addEncounter;
    window.renderEncounters = renderEncounters;
    window.updateEncField = updateEncField;
    window.deleteEncounter = deleteEncounter;

    window.addEventListener('load', waitForStore);
})();
