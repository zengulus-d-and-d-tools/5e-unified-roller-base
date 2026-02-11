(function () {
    const SOFT_DELETE_MS = 12000;
    const GM_LAUNCH_STORAGE_PREFIX = 'rtf_gm_launch_';
    const BOARD_DRAFT_STORAGE_PREFIX = 'rtf_encounter_draft_';
    const BOARD_DRAFT_MAX_AGE_MS = 30 * 60 * 1000;
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
    let deleteManager = null;

    const getStore = () => window.RTF_STORE;
    const getDeleteManager = () => {
        if (deleteManager) return deleteManager;
        const api = window.RTF_SOFT_DELETE;
        if (!api || typeof api.createSoftDeleteManager !== 'function') return null;
        deleteManager = api.createSoftDeleteManager({
            undoMs: SOFT_DELETE_MS,
            host: document.body,
            onStateChange: () => renderEncounters()
        });
        return deleteManager;
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

    function clearEncounterLinkParamsFromUrl() {
        if (!window.history || typeof window.history.replaceState !== 'function') return;
        const url = new URL(window.location.href);
        let changed = false;
        ['draft', 'source'].forEach((key) => {
            if (!url.searchParams.has(key)) return;
            url.searchParams.delete(key);
            changed = true;
        });
        if (changed) window.history.replaceState({}, document.title, url.toString());
    }

    function consumeBoardDraftFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const token = String(params.get('draft') || '').trim();
        if (!token) return null;

        const storageKey = BOARD_DRAFT_STORAGE_PREFIX + token;
        let parsed = null;
        try {
            const raw = sessionStorage.getItem(storageKey);
            if (raw) parsed = JSON.parse(raw);
        } catch (err) {
            parsed = null;
        } finally {
            try {
                sessionStorage.removeItem(storageKey);
            } catch (err) {
                // no-op
            }
        }

        clearEncounterLinkParamsFromUrl();
        if (!parsed || typeof parsed !== 'object') return null;
        if (!parsed.createdAt || (Date.now() - Number(parsed.createdAt)) > BOARD_DRAFT_MAX_AGE_MS) return null;
        const draft = parsed.draft;
        return draft && typeof draft === 'object' ? draft : null;
    }

    function normalizeDraftTier(tier) {
        const clean = String(tier || '').trim();
        return TIERS.some((entry) => entry.value === clean) ? clean : 'Standard';
    }

    function ensureEncounterFormVisible() {
        const form = document.getElementById('encForm');
        if (!form) return;
        if (form.classList.contains('enc-hidden')) form.classList.remove('enc-hidden');
    }

    function applyBoardDraftToForm() {
        const draft = consumeBoardDraftFromUrl();
        if (!draft) return;
        populateTierSelects();
        ensureEncounterFormVisible();

        const setValue = (id, value, fallback = '') => {
            const el = document.getElementById(id);
            if (!el) return;
            el.value = String(value || fallback);
        };

        setValue('encTitle', draft.title, 'Board Draft Encounter');
        setValue('encTier', normalizeDraftTier(draft.tier), 'Standard');
        setValue('encLocation', draft.location, '');
        setValue('encObjective', draft.objective, '');
        setValue('encOpposition', draft.opposition, '');
        setValue('encHazards', draft.hazards, '');
        setValue('encBeats', draft.beats, '');
        setValue('encRewards', draft.rewards, '');
        setValue('encNotes', draft.notes, '');
        renderEncounters();
    }

    function parseOppositionCount(line = '') {
        const text = String(line || '').trim();
        if (!text) return { count: 1, cleaned: '' };

        const prefix = text.match(/^(\d{1,2})(?:\s*[x×]\s*|\s+)/i);
        if (prefix) {
            return {
                count: Math.max(1, Math.min(20, parseInt(prefix[1], 10) || 1)),
                cleaned: text.slice(prefix[0].length).trim()
            };
        }

        const suffix = text.match(/\s*[x×]\s*(\d{1,2})$/i);
        if (suffix) {
            return {
                count: Math.max(1, Math.min(20, parseInt(suffix[1], 10) || 1)),
                cleaned: text.slice(0, text.length - suffix[0].length).trim()
            };
        }

        return { count: 1, cleaned: text };
    }

    function parseOppositionHP(line = '') {
        const text = String(line || '');
        const hpMatch = text.match(/\b(?:hp|health)\s*[:=]?\s*(\d{1,6})\b/i);
        if (!hpMatch) return { hp: null, cleaned: text.trim() };
        const hp = Math.max(1, Math.min(999999, parseInt(hpMatch[1], 10) || 1));
        return {
            hp,
            cleaned: text.replace(hpMatch[0], '').replace(/\s{2,}/g, ' ').trim()
        };
    }

    function parseOppositionToCombatants(opposition = '') {
        const lines = String(opposition || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        const combatants = [];
        lines.forEach((line, lineIdx) => {
            const { count, cleaned: countCleaned } = parseOppositionCount(line);
            const { hp, cleaned: hpCleaned } = parseOppositionHP(countCleaned);
            const nameBase = hpCleaned || `Enemy ${lineIdx + 1}`;

            for (let i = 0; i < count; i += 1) {
                const suffix = count > 1 ? ` ${i + 1}` : '';
                combatants.push({
                    id: `enc_${Date.now().toString(36)}_${lineIdx}_${i}_${Math.random().toString(36).slice(2, 6)}`,
                    name: `${nameBase}${suffix}`,
                    total: 0,
                    tie: 10,
                    hp,
                    maxHp: hp,
                    tags: ['encounter']
                });
            }
        });

        return combatants;
    }

    function buildTrackerLaunchPayload(enc) {
        const source = enc && typeof enc === 'object' ? enc : {};
        const title = String(source.title || 'Encounter').trim() || 'Encounter';
        const tier = String(source.tier || 'Routine').trim() || 'Routine';
        const location = String(source.location || '').trim();
        const objective = String(source.objective || '').trim();
        const opposition = String(source.opposition || '').trim();
        const hazards = String(source.hazards || '').trim();
        const beats = String(source.beats || '').trim();
        const rewards = String(source.rewards || '').trim();
        const notes = String(source.notes || '').trim();

        return {
            type: 'encounter-launch',
            createdAt: Date.now(),
            title,
            tier,
            location,
            objective,
            opposition,
            hazards,
            beats,
            rewards,
            notes,
            combatants: parseOppositionToCombatants(opposition)
        };
    }

    function openEncounterInTracker(id) {
        const cleanId = String(id || '').trim();
        if (!cleanId) return;
        const store = getStore();
        if (!store || typeof store.getEncounters !== 'function') return;
        const encounter = (store.getEncounters() || []).find((entry) => String(entry && entry.id || '') === cleanId);
        if (!encounter) return;

        const token = `enc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const storageKey = GM_LAUNCH_STORAGE_PREFIX + token;
        const payload = buildTrackerLaunchPayload(encounter);

        try {
            sessionStorage.setItem(storageKey, JSON.stringify(payload));
        } catch (err) {
            alert('Could not prep encounter launch for Session Tracker.');
            return;
        }

        const url = new URL('gm.html', window.location.href);
        url.searchParams.set('encLaunch', token);
        url.searchParams.set('source', 'encounter');
        window.location.assign(url.toString());
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
        const store = getStore();
        if (!store) return;
        const list = store.getEncounters ? store.getEncounters() : [];
        const target = list.find((enc) => enc && enc.id === id);
        if (!target) return;

        const manager = getDeleteManager();
        if (!manager) {
            if (!confirm('Delete this encounter recipe?')) return;
            store.deleteEncounter(id);
            renderEncounters();
            return;
        }

        manager.schedule({
            id,
            label: `Encounter removed: ${target.title || 'Untitled Encounter'}`,
            onFinalize: () => {
                store.deleteEncounter(id);
                renderEncounters();
            },
            onUndo: () => {
                renderEncounters();
            }
        });
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
                <button class="btn" data-onclick="openEncounterInTracker('${encId}')">Run Tracker</button>
                <button class="btn btn-danger" data-onclick="deleteEncounter('${encId}')">Delete</button>
            </div>
        </div>`;
    }

    function renderEncounters() {
        const store = getStore();
        const manager = getDeleteManager();
        const container = document.getElementById('encounterList');
        if (!store || !container) return;
        populateTierSelects();
        const search = (document.getElementById('encSearch').value || '').toLowerCase();
        const tierFilter = document.getElementById('encTierFilter').value;

        const list = (store.getEncounters() || []).slice();
        const filtered = list.filter(enc => {
            if (manager && manager.isPending(enc.id)) return false;
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
            getDeleteManager();
            renderEncounters();
            applyBoardDraftToForm();
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
    window.openEncounterInTracker = openEncounterInTracker;

    window.addEventListener('load', waitForStore);
    window.addEventListener('beforeunload', () => {
        const manager = getDeleteManager();
        if (manager && typeof manager.flush === 'function') manager.flush();
    });
})();
