(function (global) {
    const DEFAULT_MAX_PREP_TOKENS = 6;
    const DEFAULT_TOTAL = 4;
    const MIN_TOTAL = 1;
    const MAX_TOTAL = 99;
    const DEFAULT_FILTER = 'all';
    const VALID_FILTERS = new Set(['all', 'prep', 'procedure']);
    const VALID_TYPES = new Set(['prep', 'procedure']);
    const PREP_CATEGORIES = ['Intel', 'Access', 'Cover', 'Tools'];

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
    let state = normalizeState(pageConfig.initialState, defaultState, maxPrepTokens);

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
        logPrepTimeline: document.getElementById('log-prep-timeline-btn'),
        heatShield: document.getElementById('heat-shield-btn'),
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
        popoverCancel: document.getElementById('prep-log-popover-cancel'),
        popoverConfirm: document.getElementById('prep-log-popover-confirm')
    };

    const listeners = new Set();
    let pendingPopoverContext = null;

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

    function openLogPopover(context) {
        const ctx = context && typeof context === 'object' ? context : { source: 'button' };
        pendingPopoverContext = ctx;
        const snapshot = getState();
        const isExample = ctx.source === 'example' && ctx.example;

        refs.popoverTitle.textContent = isExample ? 'Log Example to Timeline' : 'Log Prep Snapshot';
        if (isExample) {
            const typeLabel = ctx.example.type === 'procedure' ? 'Procedure' : 'Prep';
            refs.popoverBody.textContent = `${typeLabel} • ${ctx.example.category} • ${ctx.example.name}\nSnapshot: ${getSnapshotLine(snapshot)}`;
        } else {
            refs.popoverBody.textContent = `Snapshot: ${getSnapshotLine(snapshot)}`;
        }

        refs.popoverBackdrop.classList.remove('is-hidden');
        refs.popoverBackdrop.setAttribute('aria-hidden', 'false');
        document.body.classList.add('prep-popover-open');
        refs.popoverConfirm.focus();
    }

    function closeLogPopover() {
        refs.popoverBackdrop.classList.add('is-hidden');
        refs.popoverBackdrop.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('prep-popover-open');
        pendingPopoverContext = null;
    }

    function clearProcedureClockForHeatShield() {
        setState({ procedure: { filled: 0 } });
        const store = getStore();
        let logged = false;
        if (store && typeof store.addEvent === 'function') {
            const eventId = store.addEvent({
                id: `event_heat_shield_${Date.now()}`,
                title: 'Heat Shield Activated',
                focus: 'Procedure',
                heatDelta: '',
                tags: 'procedure, heat-shield',
                highlights: "Thanks to good procedure, the Task Force's reputation was preserved.",
                fallout: '',
                followUp: '',
                source: 'prep-procedure',
                kind: 'heat-shield',
                resolved: false,
                created: new Date().toISOString()
            });
            logged = !!eventId;
        }

        if (logged) {
            setStatus('Heat Shield activated. Procedure clock emptied and timeline action logged.', 'success');
            return;
        }
        setStatus('Heat Shield activated. Procedure clock emptied.', 'success');
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
        render();
        emitChange();
        setStatus('All prep/procedure values reset to defaults.', 'success');
    });
    refs.logPrepTimeline.addEventListener('click', () => {
        openLogPopover({ source: 'button' });
    });
    refs.heatShield.addEventListener('click', clearProcedureClockForHeatShield);
    refs.popoverCancel.addEventListener('click', closeLogPopover);
    refs.popoverConfirm.addEventListener('click', () => {
        if (pendingPopoverContext) logPrepToTimeline(pendingPopoverContext);
        closeLogPopover();
    });
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

    render();
    setStatus('');

    const api = {
        getState,
        setState,
        onChange
    };

    global.PrepProcedureClocks = api;
    if (typeof global.getState !== 'function') global.getState = getState;
    if (typeof global.setState !== 'function') global.setState = setState;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
