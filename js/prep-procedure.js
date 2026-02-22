(function (global) {
    const DEFAULT_MAX_PREP_TOKENS = 6;
    const DEFAULT_TOTAL = 4;
    const MIN_TOTAL = 1;
    const MAX_TOTAL = 99;
    const DEFAULT_FILTER = 'all';
    const VALID_FILTERS = new Set(['all', 'prep', 'procedure']);
    const VALID_TYPES = new Set(['prep', 'procedure']);
    const PREP_CATEGORIES = ['Intel', 'Access', 'Cover', 'Tools'];
    const STORAGE_KEY = 'rtf_prep_procedure_state_v1';
    const FLASHBACK_PRESETS = {
        minor: {
            tier: 'minor',
            label: 'Minor Flashback',
            cost: 1
        },
        major: {
            tier: 'major',
            label: 'Major Flashback',
            cost: 2
        }
    };

    const DEFAULT_EXAMPLES = [
        {
            id: 'prep-1',
            type: 'prep',
            category: 'Tools',
            name: 'Case File Kit Packed'
        },
        {
            id: 'prep-2',
            type: 'prep',
            category: 'Access',
            name: 'Watch-Captain Access Letter Secured'
        },
        {
            id: 'prep-3',
            type: 'prep',
            category: 'Intel',
            name: 'Witness List and Interview Order Drafted'
        },
        {
            id: 'prep-4',
            type: 'prep',
            category: 'Cover',
            name: 'Street Clothes and Cover Story Prepared'
        },
        {
            id: 'prep-5',
            type: 'prep',
            category: 'Tools',
            name: 'Evidence Bags and Label Stock Prepared'
        },
        {
            id: 'prep-6',
            type: 'prep',
            category: 'Intel',
            name: 'Divination Consult Held in Reserve if Leads Stall'
        },
        {
            id: 'procedure-1',
            type: 'procedure',
            category: 'Tools',
            name: 'Chain of Custody Transfer Logged'
        },
        {
            id: 'procedure-2',
            type: 'procedure',
            category: 'Intel',
            name: 'Witness Statements Cross-Checked to Timeline'
        },
        {
            id: 'procedure-3',
            type: 'procedure',
            category: 'Cover',
            name: 'Scene Perimeter Maintained and Bystanders Cleared'
        },
        {
            id: 'procedure-4',
            type: 'procedure',
            category: 'Access',
            name: 'Evidence Vault Sign-off Recorded'
        },
        {
            id: 'procedure-5',
            type: 'procedure',
            category: 'Cover',
            name: 'Rights of Accord Recited and Witnessed'
        },
        {
            id: 'procedure-6',
            type: 'procedure',
            category: 'Tools',
            name: 'Field Sketches Matched to Evidence Tag IDs'
        }
    ];

    function toObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function toInt(value, fallback) {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function cloneExample(row) {
        return {
            id: row.id,
            type: row.type,
            category: row.category,
            name: row.name
        };
    }

    function cloneState(state) {
        return {
            prep: { ...state.prep },
            procedure: { ...state.procedure },
            tokens: { ...state.tokens },
            examples: state.examples.map(cloneExample),
            ui: { ...state.ui }
        };
    }

    function normalizeType(value, fallback) {
        const clean = String(value || '').trim().toLowerCase();
        return VALID_TYPES.has(clean) ? clean : fallback;
    }

    function normalizeCategory(value, fallback) {
        const clean = String(value || '').trim().toLowerCase();
        const matched = PREP_CATEGORIES.find((entry) => entry.toLowerCase() === clean);
        return matched || fallback;
    }

    function normalizeFilter(value, fallback) {
        const clean = String(value || '').trim().toLowerCase();
        return VALID_FILTERS.has(clean) ? clean : fallback;
    }

    function normalizeExamples(rows, fallbackRows) {
        const source = Array.isArray(rows) && rows.length ? rows : fallbackRows;
        const seen = new Set();
        const out = [];

        source.forEach((entry, idx) => {
            const raw = toObject(entry);
            const type = normalizeType(raw.type, idx % 2 ? 'procedure' : 'prep');
            const fallbackCategory = PREP_CATEGORIES[idx % PREP_CATEGORIES.length];
            const baseId = String(raw.id || '').trim() || `${type}-${idx + 1}`;
            let id = baseId;
            let suffix = 1;
            while (seen.has(id)) {
                suffix += 1;
                id = `${baseId}-${suffix}`;
            }
            seen.add(id);
            out.push({
                id,
                type,
                category: normalizeCategory(raw.category, fallbackCategory),
                name: String(raw.name || '').trim() || `Example ${idx + 1}`
            });
        });

        return out.length ? out : fallbackRows.map(cloneExample);
    }

    function normalizeClock(rawClock, fallbackClock) {
        const source = toObject(rawClock);
        const total = clamp(toInt(source.total, fallbackClock.total), MIN_TOTAL, MAX_TOTAL);
        const filled = clamp(toInt(source.filled, fallbackClock.filled), 0, total);
        return { total, filled };
    }

    function normalizeUi(rawUi, fallbackUi) {
        const source = toObject(rawUi);
        return {
            filter: normalizeFilter(source.filter, fallbackUi.filter),
            search: String(source.search == null ? fallbackUi.search : source.search)
        };
    }

    function normalizeState(input, fallbackState, maxPrepTokens) {
        const source = toObject(input);
        const tokensSource = toObject(source.tokens);

        const prep = normalizeClock(source.prep, fallbackState.prep);
        const procedure = normalizeClock(source.procedure, fallbackState.procedure);
        const count = clamp(toInt(tokensSource.count, fallbackState.tokens.count), 0, maxPrepTokens);

        return {
            prep,
            procedure,
            tokens: {
                count,
                max: maxPrepTokens
            },
            examples: normalizeExamples(source.examples, fallbackState.examples),
            ui: normalizeUi(source.ui, fallbackState.ui)
        };
    }

    function createDefaultState(maxPrepTokens) {
        return {
            prep: {
                total: DEFAULT_TOTAL,
                filled: 0
            },
            procedure: {
                total: DEFAULT_TOTAL,
                filled: 0
            },
            tokens: {
                count: 0,
                max: maxPrepTokens
            },
            examples: DEFAULT_EXAMPLES.map(cloneExample),
            ui: {
                filter: DEFAULT_FILTER,
                search: ''
            }
        };
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function statesEqual(a, b) {
        return JSON.stringify(a) === JSON.stringify(b);
    }

    function loadPersistedState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (err) {
            return null;
        }
    }

    function persistState(nextState) {
        if (!nextState || typeof nextState !== 'object') return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
        } catch (err) {
            // Ignore quota/storage errors in offline mode.
        }
    }

    function getConfiguredMaxPrepTokens(root, config) {
        const cfg = toObject(config);
        const fromConfig = toInt(cfg.maxPrepTokens, NaN);
        const fromDataAttr = toInt(root.getAttribute('data-max-prep-tokens'), DEFAULT_MAX_PREP_TOKENS);
        const base = Number.isFinite(fromConfig) ? fromConfig : fromDataAttr;
        return clamp(base, 1, 24);
    }

    const root = document.getElementById('prep-procedure-widget');
    if (!root) return;

    const pageConfig = toObject(global.PREP_PROCEDURE_CONFIG);
    const maxPrepTokens = getConfiguredMaxPrepTokens(root, pageConfig);
    const defaultState = createDefaultState(maxPrepTokens);
    const persistedState = loadPersistedState();
    const seededState = persistedState || pageConfig.initialState;
    let state = normalizeState(seededState, defaultState, maxPrepTokens);

    const refs = {
        clocks: {
            prep: {
                filled: document.getElementById('prep-filled'),
                total: document.getElementById('prep-total'),
                pie: document.getElementById('prep-pie'),
                plus: document.getElementById('prep-plus'),
                minus: document.getElementById('prep-minus'),
                reset: document.getElementById('prep-reset'),
                totalInput: document.getElementById('prep-total-input')
            },
            procedure: {
                filled: document.getElementById('procedure-filled'),
                total: document.getElementById('procedure-total'),
                pie: document.getElementById('procedure-pie'),
                plus: document.getElementById('procedure-plus'),
                minus: document.getElementById('procedure-minus'),
                reset: document.getElementById('procedure-reset'),
                totalInput: document.getElementById('procedure-total-input')
            }
        },
        resetAll: document.getElementById('reset-all-btn'),
        logCustomPrep: document.getElementById('log-custom-prep-btn'),
        logCustomProcedure: document.getElementById('log-custom-procedure-btn'),
        flashbackMinor: document.getElementById('flashback-minor-btn'),
        flashbackMajor: document.getElementById('flashback-major-btn'),
        tokensMinus: document.getElementById('tokens-minus'),
        tokensPlus: document.getElementById('tokens-plus'),
        tokensReadout: document.getElementById('tokens-readout'),
        tokenBubbles: document.getElementById('token-bubbles'),
        examplesFilter: document.getElementById('examples-filter'),
        examplesSearch: document.getElementById('examples-search'),
        examplesBody: document.getElementById('examples-body'),
        examplesEmpty: document.getElementById('examples-empty'),
        status: document.getElementById('prep-procedure-status'),
        popoverBackdrop: document.getElementById('prep-log-popover-backdrop'),
        popoverTitle: document.getElementById('prep-log-popover-title'),
        popoverBody: document.getElementById('prep-log-popover-body'),
        popoverPlayerWrap: document.getElementById('prep-log-popover-player-wrap'),
        popoverPlayerLabel: document.getElementById('prep-log-popover-player-label'),
        popoverPlayer: document.getElementById('prep-log-popover-player'),
        popoverCategoryWrap: document.getElementById('prep-log-popover-category-wrap'),
        popoverCategoryLabel: document.getElementById('prep-log-popover-category-label'),
        popoverCategory: document.getElementById('prep-log-popover-category'),
        popoverNoteWrap: document.getElementById('prep-log-popover-note-wrap'),
        popoverNoteLabel: document.getElementById('prep-log-popover-note-label'),
        popoverNote: document.getElementById('prep-log-popover-note'),
        popoverCancel: document.getElementById('prep-log-popover-cancel'),
        popoverConfirm: document.getElementById('prep-log-popover-confirm')
    };

    const listeners = new Set();
    let pendingPopoverContext = null;

    function pluralizeToken(cost) {
        return cost === 1 ? 'token' : 'tokens';
    }

    function getFlashbackPreset(tier) {
        return FLASHBACK_PRESETS[tier] || FLASHBACK_PRESETS.minor;
    }

    function normalizePlayerName(value) {
        return String(value || '').trim().slice(0, 80);
    }

    function getRosterPlayerNames() {
        const store = getStore();
        if (!store || typeof store.getPlayers !== 'function') return [];
        const players = store.getPlayers();
        if (!Array.isArray(players)) return [];
        const seen = new Set();
        const names = [];
        players.forEach((player, idx) => {
            const fallback = `Player ${idx + 1}`;
            const rawName = player && typeof player === 'object' ? player.name : '';
            const name = normalizePlayerName(rawName || fallback);
            if (!name) return;
            const key = name.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            names.push(name);
        });
        return names;
    }

    function buildCategoryOptions() {
        if (!refs.popoverCategory) return;
        refs.popoverCategory.innerHTML = PREP_CATEGORIES.map((category) =>
            `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
        ).join('');
    }

    function populatePlayerOptions(preferred = '') {
        if (!refs.popoverPlayer) return;
        const preferredName = normalizePlayerName(preferred);
        const names = getRosterPlayerNames();
        if (!names.length) {
            refs.popoverPlayer.innerHTML = '<option value="">No roster players found</option>';
            refs.popoverPlayer.disabled = true;
            return;
        }

        refs.popoverPlayer.disabled = false;
        refs.popoverPlayer.innerHTML = names.map((name) =>
            `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`
        ).join('');
        const hasPreferred = preferredName && names.includes(preferredName);
        refs.popoverPlayer.value = hasPreferred ? preferredName : names[0];
    }

    function getState() {
        return cloneState(state);
    }

    function emitChange() {
        const snapshot = getState();
        listeners.forEach((listener) => {
            try {
                listener(snapshot);
            } catch (err) {
                console.error('PrepProcedureClocks listener failed:', err);
            }
        });

        if (typeof pageConfig.onChange === 'function') {
            try {
                pageConfig.onChange(snapshot);
            } catch (err) {
                console.error('PREP_PROCEDURE_CONFIG.onChange failed:', err);
            }
        }

        global.dispatchEvent(new CustomEvent('prep-procedure-change', { detail: snapshot }));
    }

    function setStatus(message, tone) {
        if (!refs.status) return;
        refs.status.textContent = String(message || '');
        refs.status.classList.toggle('is-success', tone === 'success');
        refs.status.classList.toggle('is-error', tone === 'error');
    }

    function onChange(listener) {
        if (typeof listener !== 'function') {
            return function noop() { };
        }
        listeners.add(listener);
        return function unsubscribe() {
            listeners.delete(listener);
        };
    }

    function renderClock(clockKey) {
        const clockState = state[clockKey];
        const clockRefs = refs.clocks[clockKey];
        if (!clockRefs) return;

        clockRefs.filled.textContent = String(clockState.filled);
        clockRefs.total.textContent = String(clockState.total);
        clockRefs.totalInput.value = String(clockState.total);
        const ratio = clockState.total > 0 ? (clockState.filled / clockState.total) : 0;
        clockRefs.pie.style.setProperty('--clock-total', String(clockState.total));
        clockRefs.pie.style.setProperty('--clock-fill-ratio', String(ratio));
    }

    function renderTokens() {
        refs.tokensReadout.textContent = `${state.tokens.count}/${state.tokens.max}`;
        refs.tokenBubbles.innerHTML = '';

        for (let i = 1; i <= state.tokens.max; i += 1) {
            const bubble = document.createElement('button');
            bubble.type = 'button';
            bubble.className = `token-bubble${i <= state.tokens.count ? ' is-filled' : ''}`;
            bubble.textContent = String(i);
            bubble.setAttribute('aria-label', `Set prep tokens to ${i}`);
            bubble.addEventListener('click', () => {
                setState({ tokens: { count: i } });
            });
            refs.tokenBubbles.appendChild(bubble);
        }

        if (refs.flashbackMinor) refs.flashbackMinor.disabled = state.tokens.count < FLASHBACK_PRESETS.minor.cost;
        if (refs.flashbackMajor) refs.flashbackMajor.disabled = state.tokens.count < FLASHBACK_PRESETS.major.cost;
    }

    function getFilteredExamples() {
        const filter = state.ui.filter;
        const term = state.ui.search.trim().toLowerCase();

        return state.examples.filter((row) => {
            if (filter !== 'all' && row.type !== filter) return false;
            if (!term) return true;
            const haystack = `${row.type} ${row.category} ${row.name}`.toLowerCase();
            return haystack.includes(term);
        });
    }

    function renderExamples() {
        const rows = getFilteredExamples();
        refs.examplesBody.innerHTML = rows.map((row) => {
            const typeClass = row.type === 'procedure' ? 'type-procedure' : 'type-prep';
            const typeLabel = row.type === 'procedure' ? 'Procedure' : 'Prep';
            const category = normalizeCategory(row.category, PREP_CATEGORIES[0]);
            return `<tr data-id="${escapeHtml(row.id)}">
                <td><span class="example-type-pill ${typeClass}">${escapeHtml(typeLabel)}</span></td>
                <td><span class="example-category-pill">${escapeHtml(category)}</span></td>
                <td>${escapeHtml(row.name)}</td>
            </tr>`;
        }).join('');

        refs.examplesEmpty.classList.toggle('is-hidden', rows.length > 0);
        refs.examplesFilter.value = state.ui.filter;
        refs.examplesSearch.value = state.ui.search;
    }

    function getExampleById(id) {
        const needle = String(id || '').trim();
        if (!needle) return null;
        return state.examples.find((row) => row && row.id === needle) || null;
    }

    function render() {
        renderClock('prep');
        renderClock('procedure');
        renderTokens();
        renderExamples();
    }

    function setState(nextState) {
        const normalized = normalizeState(nextState, state, maxPrepTokens);
        const changed = !statesEqual(normalized, state);
        state = normalized;
        persistState(state);
        render();
        if (changed) emitChange();
        return getState();
    }

    function getStore() {
        return global.RTF_STORE || null;
    }

    function getSnapshotLine(snapshot) {
        return `Prep ${snapshot.prep.filled}/${snapshot.prep.total} | Procedure ${snapshot.procedure.filled}/${snapshot.procedure.total} | Tokens ${snapshot.tokens.count}/${snapshot.tokens.max}`;
    }

    function getPopoverNoteValue() {
        if (!refs.popoverNote) return '';
        return String(refs.popoverNote.value || '').trim().slice(0, 600);
    }

    function getPopoverPlayerValue() {
        if (!refs.popoverPlayer || refs.popoverPlayer.disabled) return '';
        return normalizePlayerName(refs.popoverPlayer.value);
    }

    function getPopoverCategoryValue() {
        if (!refs.popoverCategory || refs.popoverCategory.disabled) return '';
        const value = String(refs.popoverCategory.value || '').trim();
        return normalizeCategory(value, PREP_CATEGORIES[0]);
    }

    function openLogPopover(context) {
        const ctx = context && typeof context === 'object' ? context : { source: 'button' };
        pendingPopoverContext = ctx;
        const snapshot = getState();
        const isExample = ctx.source === 'example' && ctx.example;
        const isFlashback = ctx.source === 'flashback';
        const isCustomPrep = ctx.source === 'custom-prep';
        const isCustomProcedure = ctx.source === 'custom-procedure';

        refs.popoverConfirm.textContent = 'Log to Timeline';
        refs.popoverConfirm.disabled = false;
        if (refs.popoverPlayerWrap) refs.popoverPlayerWrap.classList.add('is-hidden');
        if (refs.popoverCategoryWrap) refs.popoverCategoryWrap.classList.add('is-hidden');
        if (refs.popoverNoteWrap) refs.popoverNoteWrap.classList.add('is-hidden');
        if (refs.popoverPlayerLabel) refs.popoverPlayerLabel.textContent = 'Player';
        if (refs.popoverCategoryLabel) refs.popoverCategoryLabel.textContent = 'Category';
        if (refs.popoverNoteLabel) refs.popoverNoteLabel.textContent = 'Details (optional)';
        if (refs.popoverNote) refs.popoverNote.value = '';
        if (refs.popoverNote) refs.popoverNote.placeholder = 'Add details for the timeline log.';
        if (refs.popoverCategory) refs.popoverCategory.value = PREP_CATEGORIES[0];
        if (refs.popoverPlayer) refs.popoverPlayer.value = '';

        if (isFlashback) {
            const preset = getFlashbackPreset(ctx.tier);
            const remaining = Math.max(0, snapshot.tokens.count - preset.cost);
            refs.popoverTitle.textContent = `${preset.label} Spend`;
            refs.popoverBody.textContent = `Spend ${preset.cost} Prep ${pluralizeToken(preset.cost)} to trigger a ${preset.label.toLowerCase()}.\nRemaining after spend: ${remaining}/${snapshot.tokens.max}\nSnapshot: ${getSnapshotLine(snapshot)}`;
            refs.popoverConfirm.textContent = `Spend ${preset.cost} & Log`;
            if (refs.popoverPlayerWrap) refs.popoverPlayerWrap.classList.remove('is-hidden');
            if (refs.popoverPlayerLabel) refs.popoverPlayerLabel.textContent = `${preset.label} Player`;
            populatePlayerOptions(ctx.playerName);
            if (refs.popoverNoteWrap) refs.popoverNoteWrap.classList.remove('is-hidden');
            if (refs.popoverNoteLabel) refs.popoverNoteLabel.textContent = `${preset.label} Details (optional)`;
            if (refs.popoverNote) refs.popoverNote.placeholder = 'What prep was already handled off-screen?';
        } else if (isCustomPrep || isCustomProcedure) {
            const typeLabel = isCustomProcedure ? 'Procedure' : 'Prep';
            refs.popoverTitle.textContent = `Log Custom ${typeLabel}`;
            refs.popoverBody.textContent = `Choose player and category, then add any optional detail for timeline context.\nSnapshot: ${getSnapshotLine(snapshot)}`;
            refs.popoverConfirm.textContent = `Log Custom ${typeLabel}`;
            if (refs.popoverPlayerWrap) refs.popoverPlayerWrap.classList.remove('is-hidden');
            if (refs.popoverCategoryWrap) refs.popoverCategoryWrap.classList.remove('is-hidden');
            if (refs.popoverPlayerLabel) refs.popoverPlayerLabel.textContent = `${typeLabel} Player`;
            if (refs.popoverCategoryLabel) refs.popoverCategoryLabel.textContent = `${typeLabel} Category`;
            populatePlayerOptions(ctx.playerName);
            if (refs.popoverCategory) refs.popoverCategory.value = normalizeCategory(ctx.category, PREP_CATEGORIES[0]);
            if (refs.popoverNoteWrap) refs.popoverNoteWrap.classList.remove('is-hidden');
            if (refs.popoverNoteLabel) refs.popoverNoteLabel.textContent = `${typeLabel} Details (optional)`;
            if (refs.popoverNote) refs.popoverNote.placeholder = `What custom ${typeLabel.toLowerCase()} was handled?`;
        } else if (isExample) {
            refs.popoverTitle.textContent = 'Log Example to Timeline';
            const typeLabel = ctx.example.type === 'procedure' ? 'Procedure' : 'Prep';
            refs.popoverBody.textContent = `${typeLabel} • ${ctx.example.category} • ${ctx.example.name}\nSnapshot: ${getSnapshotLine(snapshot)}`;
        } else {
            refs.popoverTitle.textContent = 'Log Prep Snapshot';
            refs.popoverBody.textContent = `Snapshot: ${getSnapshotLine(snapshot)}`;
        }

        refs.popoverBackdrop.classList.remove('is-hidden');
        refs.popoverBackdrop.setAttribute('aria-hidden', 'false');
        document.body.classList.add('prep-popover-open');
        if ((isFlashback || isCustomPrep || isCustomProcedure) && refs.popoverPlayer && !refs.popoverPlayer.disabled) {
            refs.popoverPlayer.focus();
            return;
        }
        refs.popoverConfirm.focus();
    }

    function closeLogPopover() {
        refs.popoverBackdrop.classList.add('is-hidden');
        refs.popoverBackdrop.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('prep-popover-open');
        refs.popoverConfirm.textContent = 'Log to Timeline';
        refs.popoverConfirm.disabled = false;
        if (refs.popoverPlayerWrap) refs.popoverPlayerWrap.classList.add('is-hidden');
        if (refs.popoverCategoryWrap) refs.popoverCategoryWrap.classList.add('is-hidden');
        if (refs.popoverPlayerLabel) refs.popoverPlayerLabel.textContent = 'Player';
        if (refs.popoverCategoryLabel) refs.popoverCategoryLabel.textContent = 'Category';
        if (refs.popoverNoteWrap) refs.popoverNoteWrap.classList.add('is-hidden');
        if (refs.popoverNoteLabel) refs.popoverNoteLabel.textContent = 'Details (optional)';
        if (refs.popoverNote) refs.popoverNote.value = '';
        if (refs.popoverNote) refs.popoverNote.placeholder = 'Add details for the timeline log.';
        if (refs.popoverPlayer) refs.popoverPlayer.value = '';
        if (refs.popoverCategory) refs.popoverCategory.value = PREP_CATEGORIES[0];
        pendingPopoverContext = null;
    }

    function buildTimelineEntryFromState(snapshot) {
        const prep = snapshot.prep;
        const procedure = snapshot.procedure;
        const tokens = snapshot.tokens;
        const stamp = new Date().toLocaleString();

        return {
            id: `event_prep_${Date.now()}`,
            title: `Prep Log ${prep.filled}/${prep.total}`,
            focus: 'Prep & Procedure Clocks',
            heatDelta: '',
            tags: 'prep, procedure, clocks, timeline',
            highlights: `Snapshot: Prep ${prep.filled}/${prep.total} | Procedure ${procedure.filled}/${procedure.total} | Tokens ${tokens.count}/${tokens.max}`,
            fallout: '',
            followUp: `Snapshot recorded at ${stamp}.`,
            source: 'prep-procedure',
            kind: 'prep-log',
            resolved: false,
            created: new Date().toISOString()
        };
    }

    function buildExampleTimelineEntry(snapshot, example) {
        const typeLabel = example.type === 'procedure' ? 'Procedure' : 'Prep';
        const stamp = new Date().toLocaleString();
        return {
            id: `event_example_${Date.now()}`,
            title: `${typeLabel}: ${example.name}`,
            focus: 'Prep & Procedure Clocks',
            heatDelta: '',
            tags: `example, ${example.type}, ${String(example.category || '').toLowerCase()}, procedure, clocks`,
            highlights: `Example: ${example.name} | Category: ${example.category}\nSnapshot: ${getSnapshotLine(snapshot)}`,
            fallout: '',
            followUp: `Example logged at ${stamp}.`,
            source: 'prep-procedure',
            kind: 'prep-example-log',
            resolved: false,
            created: new Date().toISOString()
        };
    }

    function buildFlashbackTimelineEntry(snapshot, preset, note, remainingTokens, playerName) {
        const stamp = new Date().toLocaleString();
        const safeNote = String(note || '').trim();
        const safePlayer = normalizePlayerName(playerName || '');
        const noteLine = safeNote ? `Flashback note: ${safeNote}` : 'Flashback note: (none)';
        const playerLine = safePlayer ? `Player: ${safePlayer}` : 'Player: (unassigned)';
        const tokenLine = `Prep tokens: ${snapshot.tokens.count} -> ${remainingTokens}`;

        return {
            id: `event_flashback_${Date.now()}`,
            title: `${preset.label} Activated`,
            focus: 'Prep & Procedure Clocks',
            heatDelta: '',
            tags: `flashback, prep-token, ${preset.tier}, prep, procedure`,
            highlights: `${preset.label} used by spending ${preset.cost} Prep ${pluralizeToken(preset.cost)}.\n${playerLine}\n${tokenLine}\nSnapshot: ${getSnapshotLine(snapshot)}`,
            fallout: '',
            followUp: `${noteLine}\nLogged at ${stamp}.`,
            source: 'prep-procedure',
            kind: 'prep-flashback',
            resolved: false,
            created: new Date().toISOString()
        };
    }

    function spendFlashbackToTimeline(context) {
        const ctx = context && typeof context === 'object' ? context : { source: 'flashback', tier: 'minor' };
        const preset = getFlashbackPreset(ctx.tier);
        const playerName = normalizePlayerName(ctx.playerName);
        if (!playerName) {
            setStatus(`Select a player before spending ${preset.label.toLowerCase()}.`, 'error');
            return false;
        }
        const tokenCount = Number(state.tokens.count) || 0;
        if (tokenCount < preset.cost) {
            setStatus(`Not enough Prep tokens for ${preset.label.toLowerCase()} (need ${preset.cost}).`, 'error');
            return false;
        }

        const store = getStore();
        if (!store || typeof store.addEvent !== 'function') {
            setStatus('Flashback failed: store is unavailable on this page.', 'error');
            return false;
        }

        const snapshot = getState();
        const remainingTokens = tokenCount - preset.cost;
        const eventPayload = buildFlashbackTimelineEntry(snapshot, preset, ctx.note, remainingTokens, playerName);
        const eventId = store.addEvent(eventPayload);
        if (!eventId) {
            setStatus('Flashback failed: event could not be saved.', 'error');
            return false;
        }

        setState({ tokens: { count: remainingTokens } });
        const activeCase = typeof store.getActiveCase === 'function' ? store.getActiveCase() : null;
        const caseLabel = activeCase && activeCase.name ? activeCase.name : 'active case';
        setStatus(`${preset.label} logged (${caseLabel}). Spent ${preset.cost} Prep ${pluralizeToken(preset.cost)}.`, 'success');
        return true;
    }

    function buildCustomTimelineEntry(snapshot, type, playerName, category, note) {
        const safeType = type === 'procedure' ? 'procedure' : 'prep';
        const typeLabel = safeType === 'procedure' ? 'Procedure' : 'Prep';
        const safePlayer = normalizePlayerName(playerName);
        const safeCategory = normalizeCategory(category, PREP_CATEGORIES[0]);
        const safeNote = String(note || '').trim();
        const stamp = new Date().toLocaleString();

        return {
            id: `event_custom_${safeType}_${Date.now()}`,
            title: `Custom ${typeLabel}: ${safeCategory}`,
            focus: 'Prep & Procedure Clocks',
            heatDelta: '',
            tags: `custom, ${safeType}, ${String(safeCategory).toLowerCase()}, prep-procedure`,
            highlights: `Player: ${safePlayer}\nCategory: ${safeCategory}\nSnapshot: ${getSnapshotLine(snapshot)}`,
            fallout: '',
            followUp: `${safeNote ? safeNote : 'No additional details.'}\nLogged at ${stamp}.`,
            source: 'prep-procedure',
            kind: `custom-${safeType}-log`,
            resolved: false,
            created: new Date().toISOString()
        };
    }

    function logCustomToTimeline(context) {
        const ctx = context && typeof context === 'object' ? context : { source: 'custom-prep' };
        const type = ctx.source === 'custom-procedure' ? 'procedure' : 'prep';
        const typeLabel = type === 'procedure' ? 'Procedure' : 'Prep';
        const playerName = normalizePlayerName(ctx.playerName);
        const category = normalizeCategory(ctx.category, PREP_CATEGORIES[0]);
        if (!playerName) {
            setStatus(`Select a ${typeLabel.toLowerCase()} player before logging.`, 'error');
            return false;
        }
        if (!category) {
            setStatus(`Select a ${typeLabel.toLowerCase()} category before logging.`, 'error');
            return false;
        }

        const store = getStore();
        if (!store || typeof store.addEvent !== 'function') {
            setStatus('Timeline log failed: store is unavailable on this page.', 'error');
            return false;
        }

        const snapshot = getState();
        const payload = buildCustomTimelineEntry(snapshot, type, playerName, category, ctx.note);
        const eventId = store.addEvent(payload);
        if (!eventId) {
            setStatus('Timeline log failed: custom event could not be saved.', 'error');
            return false;
        }

        const activeCase = typeof store.getActiveCase === 'function' ? store.getActiveCase() : null;
        const caseLabel = activeCase && activeCase.name ? activeCase.name : 'active case';
        const beforeFill = Number(state[type].filled) || 0;
        setState({ [type]: { filled: beforeFill + 1 } });
        const afterFill = Number(state[type].filled) || 0;
        const ticked = afterFill > beforeFill;
        setStatus(
            `Custom ${typeLabel.toLowerCase()} logged to timeline (${caseLabel}). ${typeLabel} clock ${ticked ? 'advanced by 1.' : 'already full.'}`,
            'success'
        );
        return true;
    }

    function logPrepToTimeline(context) {
        const store = getStore();
        if (!store || typeof store.addEvent !== 'function') {
            setStatus('Timeline log failed: store is unavailable on this page.', 'error');
            return;
        }

        const snapshot = getState();
        const ctx = context && typeof context === 'object' ? context : { source: 'button' };
        const eventPayload = (ctx.source === 'example' && ctx.example)
            ? buildExampleTimelineEntry(snapshot, ctx.example)
            : buildTimelineEntryFromState(snapshot);
        const eventId = store.addEvent(eventPayload);
        if (!eventId) {
            setStatus('Timeline log failed: event could not be saved.', 'error');
            return;
        }

        const activeCase = typeof store.getActiveCase === 'function' ? store.getActiveCase() : null;
        const caseLabel = activeCase && activeCase.name ? activeCase.name : 'active case';
        if (ctx.source === 'example' && ctx.example) {
            setStatus(`Example logged to timeline (${caseLabel}).`, 'success');
            return;
        }
        setStatus(`Prep snapshot logged to timeline (${caseLabel}).`, 'success');
    }

    function confirmPopoverAction() {
        if (!pendingPopoverContext) return;
        const context = { ...pendingPopoverContext };
        if (context.source === 'flashback') {
            context.playerName = getPopoverPlayerValue();
            context.note = getPopoverNoteValue();
            const spent = spendFlashbackToTimeline(context);
            if (!spent) return;
            closeLogPopover();
            return;
        }

        if (context.source === 'custom-prep' || context.source === 'custom-procedure') {
            context.playerName = getPopoverPlayerValue();
            context.category = getPopoverCategoryValue();
            context.note = getPopoverNoteValue();
            const logged = logCustomToTimeline(context);
            if (!logged) return;
            closeLogPopover();
            return;
        }

        logPrepToTimeline(context);
        closeLogPopover();
    }

    function updateClock(clockKey, update) {
        setState({ [clockKey]: update });
    }

    function bindClockControls(clockKey) {
        const clockRefs = refs.clocks[clockKey];
        if (!clockRefs) return;

        clockRefs.plus.addEventListener('click', () => {
            updateClock(clockKey, { filled: state[clockKey].filled + 1 });
        });
        clockRefs.minus.addEventListener('click', () => {
            updateClock(clockKey, { filled: state[clockKey].filled - 1 });
        });
        clockRefs.reset.addEventListener('click', () => {
            updateClock(clockKey, { filled: 0 });
        });
        clockRefs.totalInput.addEventListener('input', (event) => {
            const value = event.target && 'value' in event.target ? event.target.value : '';
            if (value === '') return;
            updateClock(clockKey, { total: value });
        });
        clockRefs.totalInput.addEventListener('blur', () => {
            updateClock(clockKey, { total: clockRefs.totalInput.value });
        });
    }

    refs.tokensPlus.addEventListener('click', () => {
        setState({ tokens: { count: state.tokens.count + 1 } });
    });
    refs.tokensMinus.addEventListener('click', () => {
        setState({ tokens: { count: state.tokens.count - 1 } });
    });
    refs.examplesFilter.addEventListener('change', (event) => {
        setState({ ui: { filter: event.target.value } });
    });
    refs.examplesSearch.addEventListener('input', (event) => {
        setState({ ui: { search: event.target.value } });
    });
    refs.examplesBody.addEventListener('dblclick', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const row = target ? target.closest('tr[data-id]') : null;
        if (!row) return;
        const example = getExampleById(row.getAttribute('data-id'));
        if (!example) return;
        openLogPopover({ source: 'example', example });
    });
    refs.resetAll.addEventListener('click', () => {
        const nextDefaults = createDefaultState(maxPrepTokens);
        state = nextDefaults;
        persistState(state);
        render();
        emitChange();
        setStatus('All prep/procedure values reset to defaults.', 'success');
    });
    refs.logCustomPrep.addEventListener('click', () => {
        openLogPopover({ source: 'custom-prep', category: PREP_CATEGORIES[0] });
    });
    refs.logCustomProcedure.addEventListener('click', () => {
        openLogPopover({ source: 'custom-procedure', category: PREP_CATEGORIES[0] });
    });
    refs.flashbackMinor.addEventListener('click', () => {
        openLogPopover({ source: 'flashback', tier: 'minor' });
    });
    refs.flashbackMajor.addEventListener('click', () => {
        openLogPopover({ source: 'flashback', tier: 'major' });
    });
    refs.popoverCancel.addEventListener('click', closeLogPopover);
    refs.popoverConfirm.addEventListener('click', confirmPopoverAction);
    refs.popoverBackdrop.addEventListener('click', (event) => {
        if (event.target !== refs.popoverBackdrop) return;
        closeLogPopover();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (refs.popoverBackdrop.classList.contains('is-hidden')) return;
        closeLogPopover();
    });

    bindClockControls('prep');
    bindClockControls('procedure');
    buildCategoryOptions();

    persistState(state);
    render();
    setStatus('');

    const api = {
        getState,
        setState,
        onChange
    };

    global.PrepProcedureClocks = api;
    global.PREP_PROCEDURE_STATE_KEY = STORAGE_KEY;
    if (typeof global.getState !== 'function') global.getState = getState;
    if (typeof global.setState !== 'function') global.setState = setState;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
