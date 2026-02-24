const DEFAULT_GM_DATA = {
    combatants: [],
    bestiary: [], // [{name, init, dex, hp, count}]
    combatLog: [],
    processedInitRollIds: [],
    round: 1,
    activeIdx: 0,
    webhook: '',
    discordActive: false,
    turnPingActive: false,
    turnPingMention: '',
    scratchpad: '',
    rollLevel: 1
};
let gmData = JSON.parse(JSON.stringify(DEFAULT_GM_DATA));
const ENCOUNTER_LAUNCH_STORAGE_PREFIX = 'rtf_gm_launch_';
const TRACKER_INITIATIVE_QUEUE_KEY = 'rtf_tracker_initiative_queue';

const delegatedHandlerEvents = ['click', 'change', 'input'];
const delegatedHandlerCache = new Map();
let delegatedHandlersBound = false;

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

// ... existing vars ...

function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeString(value, fallback = '', maxLen = 4000) {
    return (typeof value === 'string' ? value : fallback).slice(0, maxLen);
}

function sanitizeNumber(value, fallback = 0, min = -Infinity, max = Infinity) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function sanitizeGMData(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const sanitized = JSON.parse(JSON.stringify(DEFAULT_GM_DATA));

    sanitized.combatants = Array.isArray(source.combatants) ? source.combatants.slice(0, 300).map((entry, idx) => {
        const row = entry && typeof entry === 'object' ? entry : {};
        const hasHp = row.hp !== null && row.hp !== undefined && row.hp !== '';
        const hp = hasHp ? sanitizeNumber(row.hp, 0, 0, 999999) : null;
        const maxHp = hasHp ? sanitizeNumber(row.maxHp, hp, 0, 999999) : null;
        const hasAc = row.ac !== null && row.ac !== undefined && row.ac !== '';
        const ac = hasAc ? Math.round(sanitizeNumber(row.ac, 10, 0, 99)) : null;
        const conditions = Array.isArray(row.conditions) ? row.conditions.slice(0, 20).map((condition) => {
            const cond = condition && typeof condition === 'object' ? condition : {};
            const name = sanitizeString(cond.name || '', '', 80).trim();
            if (!name) return null;
            const hasDuration = cond.duration !== null && cond.duration !== undefined && cond.duration !== '';
            const duration = hasDuration ? Math.round(sanitizeNumber(cond.duration, 1, 1, 99)) : null;
            return { name, duration };
        }).filter(Boolean) : [];
        return {
            id: sanitizeString(String(row.id ?? `combat_${idx}`), `combat_${idx}`, 80),
            name: sanitizeString(row.name || 'Enemy', 'Enemy', 160),
            total: sanitizeNumber(row.total, 0, -999, 999),
            tie: sanitizeNumber(row.tie, 10, 1, 30),
            ac,
            hp,
            maxHp,
            tags: Array.isArray(row.tags) ? row.tags.slice(0, 20).map((tag) => sanitizeString(tag, '', 120)).filter(Boolean) : [],
            conditions,
            reactionUsed: !!row.reactionUsed,
            concentrating: !!row.concentrating,
            legendaryMax: Math.round(sanitizeNumber(row.legendaryMax, 0, 0, 9)),
            legendaryUsed: Math.round(sanitizeNumber(row.legendaryUsed, 0, 0, 9)),
            sourceType: sanitizeString(row.sourceType || '', '', 30),
            sourceId: sanitizeString(row.sourceId || '', '', 120)
        };
    }) : [];

    sanitized.bestiary = Array.isArray(source.bestiary) ? source.bestiary.slice(0, 400).map((entry) => {
        const row = entry && typeof entry === 'object' ? entry : {};
        return {
            name: sanitizeString(row.name || '', '', 160),
            baseName: sanitizeString(row.baseName || '', '', 160),
            count: sanitizeNumber(row.count, 1, 1, 99),
            initMod: sanitizeNumber(row.initMod, 0, -20, 20),
            dex: sanitizeNumber(row.dex, 10, 1, 30),
            hp: sanitizeNumber(row.hp, 0, 0, 999999)
        };
    }) : [];
    sanitized.combatLog = Array.isArray(source.combatLog) ? source.combatLog.slice(-400).map((entry) => {
        const row = entry && typeof entry === 'object' ? entry : {};
        return {
            ts: Math.round(sanitizeNumber(row.ts, Date.now(), 0, 9999999999999)),
            round: Math.round(sanitizeNumber(row.round, 1, 1, 100000)),
            text: sanitizeString(row.text || '', '', 240)
        };
    }).filter((entry) => !!entry.text) : [];
    sanitized.processedInitRollIds = Array.isArray(source.processedInitRollIds)
        ? source.processedInitRollIds
            .slice(-500)
            .map((id) => sanitizeString(String(id || ''), '', 120))
            .filter(Boolean)
        : [];

    sanitized.round = Math.round(sanitizeNumber(source.round, 1, 1, 100000));
    sanitized.activeIdx = Math.round(sanitizeNumber(source.activeIdx, 0, 0, Math.max(0, sanitized.combatants.length - 1)));
    sanitized.webhook = sanitizeString(source.webhook || '', '', 2000);
    sanitized.discordActive = !!source.discordActive;
    sanitized.turnPingActive = !!source.turnPingActive;
    sanitized.turnPingMention = sanitizeString(source.turnPingMention || '', '', 160);
    sanitized.scratchpad = sanitizeString(source.scratchpad || '', '', 100000);
    sanitized.rollLevel = Math.round(sanitizeNumber(source.rollLevel, 1, 1, 30));

    sanitized.combatants.forEach((combatant) => {
        if (combatant.legendaryUsed > combatant.legendaryMax) {
            combatant.legendaryUsed = combatant.legendaryMax;
        }
    });

    return sanitized;
}

const MAX_UNDO_ENTRIES = 80;
const MAX_COMBAT_LOG_ENTRIES = 400;
let undoStack = [];

function syncGMInputsFromData() {
    const webhookEl = document.getElementById('webhookUrl');
    if (webhookEl) webhookEl.value = gmData.webhook || '';
    const discordActiveEl = document.getElementById('discordActive');
    if (discordActiveEl) discordActiveEl.checked = gmData.discordActive || false;
    const turnPingToggle = document.getElementById('discordTurnPing');
    if (turnPingToggle) turnPingToggle.checked = gmData.turnPingActive || false;
    const turnPingMention = document.getElementById('discordTurnMention');
    if (turnPingMention) turnPingMention.value = gmData.turnPingMention || '';
    const scratchpadEl = document.getElementById('scratchpad');
    if (scratchpadEl) scratchpadEl.value = gmData.scratchpad || '';
    const rollLevelEl = document.getElementById('rollLevel');
    if (rollLevelEl) rollLevelEl.value = gmData.rollLevel || 1;
}

function persistGMData() {
    gmData = sanitizeGMData(gmData);
    localStorage.setItem('gmDashboardData', JSON.stringify(gmData));
}

function updateUndoButton() {
    const btn = document.getElementById('undoBtn');
    if (!btn) return;
    const canUndo = undoStack.length > 0;
    btn.disabled = !canUndo;
    btn.title = canUndo ? `Undo: ${undoStack[undoStack.length - 1].label}` : 'Nothing to undo';
}

function pushUndoSnapshot(label = 'Change') {
    undoStack.push({
        label: sanitizeString(label, 'Change', 80),
        snapshot: sanitizeGMData(gmData)
    });
    if (undoStack.length > MAX_UNDO_ENTRIES) undoStack.splice(0, undoStack.length - MAX_UNDO_ENTRIES);
    updateUndoButton();
}

function addCombatLog(text) {
    const msg = sanitizeString(text, '', 240).trim();
    if (!msg) return;
    if (!Array.isArray(gmData.combatLog)) gmData.combatLog = [];
    gmData.combatLog.push({
        ts: Date.now(),
        round: gmData.round,
        text: msg
    });
    if (gmData.combatLog.length > MAX_COMBAT_LOG_ENTRIES) {
        gmData.combatLog.splice(0, gmData.combatLog.length - MAX_COMBAT_LOG_ENTRIES);
    }
}

function renderCombatLog() {
    const list = document.getElementById('combatLogList');
    if (!list) return;
    const entries = Array.isArray(gmData.combatLog) ? gmData.combatLog.slice(-60).reverse() : [];
    if (!entries.length) {
        list.innerHTML = '<div class="gm-combat-log-empty">No log entries yet.</div>';
        return;
    }

    list.innerHTML = entries.map((entry) => {
        const stamp = new Date(entry.ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const roundLabel = Number.isFinite(Number(entry.round)) ? `R${Number(entry.round)}` : 'R?';
        return `
            <div class="gm-combat-log-item">
                <span class="gm-combat-log-meta">${escapeHtml(roundLabel)} · ${escapeHtml(stamp)}</span>
                <span class="gm-combat-log-text">${escapeHtml(entry.text || '')}</span>
            </div>
        `;
    }).join('');
}

function getCombatantNameByIndex(idx) {
    const combatant = gmData.combatants[idx];
    if (!combatant || typeof combatant !== 'object') return 'Combatant';
    return sanitizeString(combatant.name || 'Combatant', 'Combatant', 160) || 'Combatant';
}

let trackerInitiativeQueueBound = false;

function hasProcessedInitRoll(rollId) {
    const token = sanitizeString(rollId || '', '', 120).trim();
    if (!token) return false;
    return Array.isArray(gmData.processedInitRollIds) && gmData.processedInitRollIds.includes(token);
}

function markProcessedInitRoll(rollId) {
    const token = sanitizeString(rollId || '', '', 120).trim();
    if (!token) return;
    if (!Array.isArray(gmData.processedInitRollIds)) gmData.processedInitRollIds = [];
    gmData.processedInitRollIds.push(token);
    if (gmData.processedInitRollIds.length > 500) {
        gmData.processedInitRollIds.splice(0, gmData.processedInitRollIds.length - 500);
    }
}

function sanitizeInitiativeQueueEntry(raw) {
    const source = raw && typeof raw === 'object' ? raw : null;
    if (!source) return null;
    const name = sanitizeString(source.name || '', '', 160).trim() || 'Unnamed PC';
    const total = Math.round(sanitizeNumber(source.total, 0, -999, 999));
    const tie = Math.round(sanitizeNumber(source.tie, 10, 1, 30));
    const hasAc = source.ac !== null && source.ac !== undefined && source.ac !== '';
    const ac = hasAc ? Math.round(sanitizeNumber(source.ac, 10, 0, 99)) : null;
    const hasHp = source.hp !== null && source.hp !== undefined && source.hp !== '';
    const hp = hasHp ? Math.round(sanitizeNumber(source.hp, 0, 0, 999999)) : null;
    const hasMaxHp = source.maxHp !== null && source.maxHp !== undefined && source.maxHp !== '';
    const maxHp = hasMaxHp ? Math.round(sanitizeNumber(source.maxHp, hp === null ? 0 : hp, 0, 999999)) : hp;
    const sourceId = sanitizeString(source.sourceId || '', '', 120).trim() || `sheet_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}`;
    const rollId = sanitizeString(source.rollId || '', '', 120).trim()
        || `init_${sourceId}_${Math.round(sanitizeNumber(source.ts, Date.now(), 0, 9999999999999))}_${total}_${tie}`;
    const detail = sanitizeString(source.detail || '', '', 240).trim();
    const finalScore = sanitizeString(source.finalScore || '', '', 40).trim();
    return {
        name,
        total,
        tie,
        ac,
        hp,
        maxHp,
        sourceType: 'sheet',
        sourceId,
        rollId,
        detail,
        finalScore
    };
}

function findCombatantForSheetEntry(entry) {
    const sourceId = sanitizeString(entry.sourceId || '', '', 120).trim();
    if (sourceId) {
        const bySource = gmData.combatants.findIndex((combatant) =>
            sanitizeString(combatant && combatant.sourceType ? combatant.sourceType : '', '', 30) === 'sheet'
            && sanitizeString(combatant && combatant.sourceId ? combatant.sourceId : '', '', 120) === sourceId);
        if (bySource >= 0) return bySource;
    }
    const byName = gmData.combatants.findIndex((combatant) =>
        sanitizeString(combatant && combatant.name ? combatant.name : '', '', 160).toLowerCase() === entry.name.toLowerCase());
    return byName;
}

function processInitiativeQueueEntries(entries) {
    if (!Array.isArray(entries) || !entries.length) return 0;
    const activeId = gmData.combatants[gmData.activeIdx] ? String(gmData.combatants[gmData.activeIdx].id) : null;
    let applied = 0;
    let pushedUndo = false;

    entries.forEach((rawEntry) => {
        const entry = sanitizeInitiativeQueueEntry(rawEntry);
        if (!entry) return;
        if (hasProcessedInitRoll(entry.rollId)) return;
        if (!pushedUndo) {
            pushUndoSnapshot('Import sheet initiative');
            pushedUndo = true;
        }

        const idx = findCombatantForSheetEntry(entry);
        if (idx >= 0) {
            const combatant = gmData.combatants[idx];
            combatant.name = entry.name;
            combatant.total = entry.total;
            combatant.tie = entry.tie;
            if (entry.ac !== null) combatant.ac = entry.ac;
            if (entry.hp !== null) {
                combatant.hp = entry.hp;
                combatant.maxHp = entry.maxHp;
            }
            combatant.sourceType = 'sheet';
            combatant.sourceId = entry.sourceId;
            addCombatLog(`${entry.name} rolled initiative ${entry.finalScore || `${entry.total}.${entry.tie}`} (updated)${entry.detail ? ` - ${entry.detail}` : ''}`);
        } else {
            gmData.combatants.push({
                id: `sheet_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
                name: entry.name,
                total: entry.total,
                tie: entry.tie,
                ac: entry.ac,
                hp: entry.hp,
                maxHp: entry.maxHp,
                tags: ['pc', 'sheet'],
                conditions: [],
                reactionUsed: false,
                concentrating: false,
                legendaryMax: 0,
                legendaryUsed: 0,
                sourceType: 'sheet',
                sourceId: entry.sourceId
            });
            addCombatLog(`${entry.name} rolled initiative ${entry.finalScore || `${entry.total}.${entry.tie}`} (added)${entry.detail ? ` - ${entry.detail}` : ''}`);
        }
        markProcessedInitRoll(entry.rollId);
        applied += 1;
    });

    if (!applied) return 0;
    sortCombat();
    if (activeId) {
        const activeIdx = gmData.combatants.findIndex((combatant) => String(combatant && combatant.id ? combatant.id : '') === activeId);
        if (activeIdx >= 0) gmData.activeIdx = activeIdx;
        else gmData.activeIdx = Math.max(0, Math.min(gmData.activeIdx, gmData.combatants.length - 1));
    } else {
        gmData.activeIdx = Math.max(0, Math.min(gmData.activeIdx, gmData.combatants.length - 1));
    }
    commitTrackerState();
    return applied;
}

function consumeTrackerInitiativeQueue() {
    let queue = [];
    let hasKey = false;
    try {
        const raw = localStorage.getItem(TRACKER_INITIATIVE_QUEUE_KEY);
        if (raw === null) return 0;
        hasKey = true;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) queue = parsed;
    } catch (err) {
        queue = [];
    }
    if (!hasKey) return 0;

    const applied = processInitiativeQueueEntries(queue);
    try {
        localStorage.removeItem(TRACKER_INITIATIVE_QUEUE_KEY);
    } catch (err) {
        // no-op
    }
    return applied;
}

function bindTrackerInitiativeQueueSync() {
    if (trackerInitiativeQueueBound) return;
    trackerInitiativeQueueBound = true;
    window.addEventListener('storage', (event) => {
        if (!event || event.key !== TRACKER_INITIATIVE_QUEUE_KEY) return;
        if (event.newValue === null) return;
        consumeTrackerInitiativeQueue();
    });
}

function clearLaunchParamsFromUrl() {
    if (!window.history || typeof window.history.replaceState !== 'function') return;
    const url = new URL(window.location.href);
    let changed = false;
    ['encLaunch', 'source'].forEach((key) => {
        if (!url.searchParams.has(key)) return;
        url.searchParams.delete(key);
        changed = true;
    });
    if (changed) window.history.replaceState({}, document.title, url.toString());
}

function consumeEncounterLaunchPayload() {
    const params = new URLSearchParams(window.location.search);
    const token = String(params.get('encLaunch') || '').trim();
    if (!token) return null;

    const storageKey = ENCOUNTER_LAUNCH_STORAGE_PREFIX + token;
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

    clearLaunchParamsFromUrl();
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.combatants)) return null;
    return parsed;
}

function formatEncounterLaunchNote(payload) {
    if (!payload || typeof payload !== 'object') return '';
    const lines = [];
    lines.push(`[Encounter Launch] ${payload.title || 'Encounter'} (${payload.tier || 'Routine'})`);
    if (payload.location) lines.push(`Location: ${payload.location}`);
    if (payload.objective) lines.push(`Objective: ${payload.objective}`);
    if (payload.hazards) lines.push(`Hazards: ${payload.hazards}`);
    if (payload.beats) lines.push(`Beats: ${payload.beats}`);
    if (payload.rewards) lines.push(`Rewards/Fallout: ${payload.rewards}`);
    if (payload.notes) lines.push(`Notes: ${payload.notes}`);
    return lines.join('\n');
}

function applyEncounterLaunchPayload() {
    const payload = consumeEncounterLaunchPayload();
    if (!payload) return;
    const hasIncoming = Array.isArray(payload.combatants) && payload.combatants.length > 0;
    if (!hasIncoming) {
        alert('Encounter launch received, but no opposition lines were detected.');
        return;
    }

    if (Array.isArray(gmData.combatants) && gmData.combatants.length) {
        const ok = confirm('Load launched encounter into Tracker? This will replace current initiative order.');
        if (!ok) return;
        pushUndoSnapshot('Load launched encounter');
    }

    gmData.combatants = payload.combatants.map((entry, idx) => ({
        id: String(entry && entry.id ? entry.id : `launch_${idx}`),
        name: sanitizeString(entry && entry.name ? entry.name : `Enemy ${idx + 1}`, `Enemy ${idx + 1}`, 160),
        total: sanitizeNumber(entry && entry.total, 0, -999, 999),
        tie: sanitizeNumber(entry && entry.tie, 10, 1, 30),
        ac: (entry && entry.ac !== null && entry.ac !== undefined && entry.ac !== '') ? Math.round(sanitizeNumber(entry.ac, 10, 0, 99)) : null,
        hp: (entry && entry.hp !== null && entry.hp !== undefined && entry.hp !== '') ? sanitizeNumber(entry.hp, 0, 0, 999999) : null,
        maxHp: (entry && entry.maxHp !== null && entry.maxHp !== undefined && entry.maxHp !== '') ? sanitizeNumber(entry.maxHp, entry.hp, 0, 999999) : null,
        tags: Array.isArray(entry && entry.tags) ? entry.tags.slice(0, 20).map((tag) => sanitizeString(tag, '', 120)).filter(Boolean) : [],
        conditions: [],
        reactionUsed: false,
        concentrating: false,
        legendaryMax: 0,
        legendaryUsed: 0
    }));

    sortCombat();
    gmData.round = 1;
    gmData.activeIdx = 0;

    const launchNote = formatEncounterLaunchNote(payload);
    if (launchNote) {
        const existing = String(gmData.scratchpad || '').trim();
        gmData.scratchpad = existing ? `${existing}\n\n${launchNote}` : launchNote;
        const scratchpadEl = document.getElementById('scratchpad');
        if (scratchpadEl) scratchpadEl.value = gmData.scratchpad;
    }
    addCombatLog(`Loaded encounter: ${payload.title || 'Encounter'}`);

    saveGM();
    renderCombat();
    renderCombatLog();
    const trackerTab = document.querySelector('.nav-item[data-tab="tracker"]');
    switchTab('tracker', trackerTab ? { currentTarget: trackerTab } : null);
    alert(`Tracker loaded: ${payload.title || 'Encounter'}`);
}

// --- BESTIARY LOGIC ---
function saveMobPreset() {
    const name = document.getElementById('mobSaveName').value.trim();
    if (!name) return alert("Enter a name");

    const preset = {
        name: name,
        baseName: document.getElementById('mobName').value,
        count: document.getElementById('mobCount').value,
        initMod: document.getElementById('mobInitMod').value,
        dex: document.getElementById('mobDexScore').value,
        hp: document.getElementById('mobHP').value
    };

    gmData.bestiary.push(preset);
    document.getElementById('mobSaveName').value = '';
    saveGM(); renderBestiary();
}

function loadMobPreset(idx) {
    const p = gmData.bestiary[idx];
    document.getElementById('mobName').value = p.baseName || '';
    document.getElementById('mobCount').value = p.count || 1;
    document.getElementById('mobInitMod').value = p.initMod || '';
    document.getElementById('mobDexScore').value = p.dex || '';
    document.getElementById('mobHP').value = p.hp || '';
    alert("Loaded: " + p.name);
}

function delMobPreset(idx) {
    if (confirm("Delete preset?")) {
        gmData.bestiary.splice(idx, 1);
        saveGM(); renderBestiary();
    }
}

function renderBestiary() {
    const list = document.getElementById('bestiaryList');
    if (!list || !gmData.bestiary) return;

    if (gmData.bestiary.length === 0) {
        list.innerHTML = '<div class="gm-bestiary-empty">No presets saved.</div>';
        return;
    }

    list.innerHTML = gmData.bestiary.map((b, i) => `
                <div class="gm-bestiary-item">
                    <span class="gm-bestiary-item-name">${escapeHtml(b.name || 'Preset')}</span>
                    <div class="gm-bestiary-item-actions">
                        <button class="btn-sec btn-sm" data-onclick="loadMobPreset(${i})">Load</button>
                        <button class="btn-danger btn-sm" data-onclick="delMobPreset(${i})">&times;</button>
                    </div>
                </div>
            `).join('');
}

function commitTrackerState() {
    saveGM();
    renderCombat();
    renderCombatLog();
}

function parseConditionInput(raw = '') {
    const text = sanitizeString(raw, '', 120).trim();
    if (!text) return null;
    const match = text.match(/^(.*?)(?:\s*\((\d{1,2})\)|\s+(\d{1,2}))?$/);
    if (!match) return null;
    const name = sanitizeString(match[1] || '', '', 80).trim();
    if (!name) return null;
    const durationRaw = match[2] || match[3] || '';
    const duration = durationRaw ? Math.max(1, Math.min(99, parseInt(durationRaw, 10) || 1)) : null;
    return { name, duration };
}

function addCondition(idx) {
    const combatant = gmData.combatants[idx];
    if (!combatant) return;
    const raw = prompt("Condition (examples: Prone, Stunned 2, Restrained (3)):");
    const parsed = parseConditionInput(raw);
    if (!parsed) return;

    pushUndoSnapshot('Add condition');
    if (!Array.isArray(combatant.conditions)) combatant.conditions = [];
    combatant.conditions.push(parsed);
    addCombatLog(`${getCombatantNameByIndex(idx)} gains ${parsed.name}${parsed.duration ? ` (${parsed.duration})` : ''}`);
    commitTrackerState();
}

function removeCondition(cIdx, condIdx) {
    const combatant = gmData.combatants[cIdx];
    if (!combatant || !Array.isArray(combatant.conditions) || !combatant.conditions[condIdx]) return;
    const removed = combatant.conditions[condIdx];
    pushUndoSnapshot('Remove condition');
    combatant.conditions.splice(condIdx, 1);
    addCombatLog(`${getCombatantNameByIndex(cIdx)} loses ${removed.name}`);
    commitTrackerState();
}

function setConditionDuration(cIdx, condIdx) {
    const combatant = gmData.combatants[cIdx];
    if (!combatant || !Array.isArray(combatant.conditions) || !combatant.conditions[condIdx]) return;
    const current = combatant.conditions[condIdx];
    const val = prompt(`Set ${current.name} duration (blank = ongoing):`, current.duration === null ? '' : String(current.duration));
    if (val === null) return;

    pushUndoSnapshot('Update condition duration');
    const trimmed = String(val).trim();
    if (!trimmed) current.duration = null;
    else current.duration = Math.max(1, Math.min(99, parseInt(trimmed, 10) || 1));
    addCombatLog(`${getCombatantNameByIndex(cIdx)} ${current.name} duration set to ${current.duration === null ? 'ongoing' : current.duration}`);
    commitTrackerState();
}

function toggleReaction(idx) {
    const combatant = gmData.combatants[idx];
    if (!combatant) return;
    pushUndoSnapshot('Toggle reaction');
    combatant.reactionUsed = !combatant.reactionUsed;
    addCombatLog(`${getCombatantNameByIndex(idx)} reaction ${combatant.reactionUsed ? 'used' : 'ready'}`);
    commitTrackerState();
}

function toggleConcentration(idx) {
    const combatant = gmData.combatants[idx];
    if (!combatant) return;
    pushUndoSnapshot('Toggle concentration');
    combatant.concentrating = !combatant.concentrating;
    addCombatLog(`${getCombatantNameByIndex(idx)} concentration ${combatant.concentrating ? 'on' : 'off'}`);
    commitTrackerState();
}

function setLegendaryMax(idx) {
    const combatant = gmData.combatants[idx];
    if (!combatant) return;
    const current = Number.isFinite(Number(combatant.legendaryMax)) ? Number(combatant.legendaryMax) : 0;
    const val = prompt("Legendary Actions per round (0-9):", String(current));
    if (val === null) return;
    const parsed = Math.max(0, Math.min(9, parseInt(String(val).trim(), 10) || 0));
    pushUndoSnapshot('Set legendary actions');
    combatant.legendaryMax = parsed;
    combatant.legendaryUsed = Math.min(combatant.legendaryUsed || 0, parsed);
    addCombatLog(`${getCombatantNameByIndex(idx)} legendary actions set to ${parsed}`);
    commitTrackerState();
}

function useLegendary(idx) {
    const combatant = gmData.combatants[idx];
    if (!combatant) return;
    const max = Math.max(0, Math.min(9, parseInt(combatant.legendaryMax, 10) || 0));
    if (max <= 0) {
        setLegendaryMax(idx);
        return;
    }
    const used = Math.max(0, Math.min(max, parseInt(combatant.legendaryUsed, 10) || 0));
    if (used >= max) return;
    pushUndoSnapshot('Use legendary action');
    combatant.legendaryUsed = used + 1;
    addCombatLog(`${getCombatantNameByIndex(idx)} uses a legendary action (${combatant.legendaryUsed}/${max})`);
    commitTrackerState();
}

function restoreLegendary(idx) {
    const combatant = gmData.combatants[idx];
    if (!combatant) return;
    const max = Math.max(0, Math.min(9, parseInt(combatant.legendaryMax, 10) || 0));
    if (max <= 0) return;
    const used = Math.max(0, Math.min(max, parseInt(combatant.legendaryUsed, 10) || 0));
    if (used <= 0) return;
    pushUndoSnapshot('Restore legendary action');
    combatant.legendaryUsed = used - 1;
    addCombatLog(`${getCombatantNameByIndex(idx)} restores a legendary action (${combatant.legendaryUsed}/${max})`);
    commitTrackerState();
}

function refreshTurnState(idx) {
    const combatant = gmData.combatants[idx];
    if (!combatant) return;

    const name = getCombatantNameByIndex(idx);
    if (combatant.reactionUsed) {
        combatant.reactionUsed = false;
        addCombatLog(`${name} reaction refreshed`);
    }

    const max = Math.max(0, Math.min(9, parseInt(combatant.legendaryMax, 10) || 0));
    if (max > 0 && (parseInt(combatant.legendaryUsed, 10) || 0) > 0) {
        combatant.legendaryUsed = 0;
        addCombatLog(`${name} legendary actions refreshed (${max})`);
    }

    if (!Array.isArray(combatant.conditions) || combatant.conditions.length === 0) return;
    const kept = [];
    combatant.conditions.forEach((condition) => {
        const cond = condition && typeof condition === 'object' ? condition : null;
        if (!cond || !cond.name) return;
        if (cond.duration === null || cond.duration === undefined || cond.duration === '') {
            kept.push({ name: sanitizeString(cond.name, '', 80), duration: null });
            return;
        }
        const nextDuration = Math.max(0, (parseInt(cond.duration, 10) || 0) - 1);
        if (nextDuration <= 0) {
            const expiredMessage = `${name}'s ${sanitizeString(cond.name, 'Condition', 80)} condition has expired!`;
            addCombatLog(expiredMessage);
            sendDiscordPingMessage(expiredMessage, true);
            return;
        }
        kept.push({ name: sanitizeString(cond.name, '', 80), duration: nextDuration });
    });
    combatant.conditions = kept;
}

function clearCombatLog() {
    if (!Array.isArray(gmData.combatLog) || gmData.combatLog.length === 0) return;
    if (!confirm('Clear combat log?')) return;
    pushUndoSnapshot('Clear combat log');
    gmData.combatLog = [];
    commitTrackerState();
}

function undoLast() {
    if (!undoStack.length) return;
    const previous = undoStack.pop();
    gmData = sanitizeGMData(previous.snapshot);
    syncGMInputsFromData();
    persistGMData();
    updateBonuses();
    renderCombat();
    renderCombatLog();
    renderBestiary();
    updateUndoButton();
}

let rollMode = 'norm'; // norm, adv, dis
let luckMode = 0; // -1, 0, 1

// --- CONDITIONS & LOOT DATA ---
const conditions = {
    "Blinded": "Auto-fail sight checks. Attacks against you have Adv. Your attacks have Disadv.",
    "Charmed": "Can't attack charmer. Charmer has Adv on social checks vs you.",
    "Deafened": "Auto-fail hearing checks.",
    "Frightened": "Disadv on checks/attacks while source is visible. Can't move closer.",
    "Grappled": "Speed 0. Ends if grappler incapacitated or moved away.",
    "Incapacitated": "No Actions or Reactions.",
    "Invisible": "Heavily Obscured. Attacks against you have Disadv. Your attacks have Adv.",
    "Paralyzed": "Incapacitated. Can't move/speak. Auto-fail Str/Dex saves. Attacks against have Adv. Critical hit if attacker is within 5ft.",
    "Petrified": "Weight x10. Incapacitated. Unaware. Resist all dmg. Immune Poison/Disease.",
    "Poisoned": "Disadv on Atk and Checks.",
    "Prone": "Crawl (half speed). Disadv on your Atks. Melee atks against you have Adv. Ranged atks against you have Disadv.",
    "Restrained": "Speed 0. Disadv on Dex saves. Attacks against you have Adv. Your attacks have Disadv.",
    "Stunned": "Incapacitated. Can't move. Auto-fail Str/Dex saves. Attacks against you have Adv.",
    "Unconscious": "Incapacitated. Drop items. Prone. Auto-fail Str/Dex saves. Attacks against have Adv. Crit if within 5ft."
};

const lootTables = {
    pocket: [
        { adjs: ["Rusty", "Bent", "Scratched", "Dull", "Twisted", "Tarnished"], nouns: ["Iron Nail", "Copper Coin (Fake)", "Tin Spoon", "Belt Buckle", "Skeleton Key", "Needle", "Brass Button"] },
        { adjs: ["Soggy", "Crumpled", "Torn", "Stained", "Moldy", "Greasy", "Faded"], nouns: ["Grocery List", "Handkerchief", "Playing Card", "Map Scrap", "Love Letter", "Ticket Stub", "Rag"] },
        { adjs: ["Rotten", "Dried", "Half-eaten", "Withered", "Stinky", "Petrified"], nouns: ["Apple Core", "Rat Tail", "Flower", "Root", "Crust of Bread", "Fish Bone", "Beetle Shell"] },
        { adjs: ["Tangled", "Knotted", "Frayed", "Short", "Braided", "Sticky"], nouns: ["Ball of String", "Length of Twine", "Copper Wire", "Shoelace", "Ribbon", "Wick", "Lock of Hair"] }
    ],
    trinket: {
        nouns: ["Ring", "Animal Figurine", "Bead", "Button", "Comb", "Whistle", "Locket", "Thimble", "Brooch", "Cameo", "Coin", "Pendant", "Earring", "Bangle"],
        suffixes: ["engraved with a name", "that feels warm", "missing a piece", "stained with ink", "smelling of sulfur", "wrapped in twine", "depicting a skull", "from a foreign land", "with a hidden compartment", "covered in runes"],
        cheap: { materials: ["Wooden", "Clay", "Pewter", "Bone", "Rusted Iron", "Chipped Ceramic", "Soapstone", "Leather", "Rough Copper", "Tin", "Carved Stone"], values: ["1 cp", "5 cp", "8 cp", "2 sp", "5 sp"] },
        fancy: { materials: ["Silver-inlaid", "Carved Ivory", "Polished Jade", "Gilded", "Crystal", "Obsidian", "Clockwork", "Alabaster", "Ancient Bronze", "Mahogany", "Electrum"], values: ["1 gp", "2 gp", "3 gp", "5 gp"] }
    }
};

// --- INITIALIZATION ---
function init() {
    const saved = localStorage.getItem('gmDashboardData');
    if (saved) {
        try {
            gmData = sanitizeGMData(JSON.parse(saved));
        } catch (err) {
            console.error('Failed to parse gmDashboardData; using defaults.', err);
            gmData = sanitizeGMData(DEFAULT_GM_DATA);
        }
    } else {
        gmData = sanitizeGMData(gmData);
    }
    syncGMInputsFromData();
    updateUndoButton();

    updateBonuses();
    renderCombat();
    renderCombatLog();
    renderConditions();
    if (!gmData.bestiary) gmData.bestiary = [];
    renderBestiary();
    applyEncounterLaunchPayload();
    consumeTrackerInitiativeQueue();
    bindTrackerInitiativeQueueSync();
}

function exportGM() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gmData));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "gm_dashboard_" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
}

function importGM() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = e => {
        const target = e && e.target ? e.target : null;
        const file = target && target.files && target.files[0] ? target.files[0] : null;
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const payload = event && event.target ? event.target.result : '';
                if (typeof payload !== 'string') {
                    alert("Error loading JSON");
                    return;
                }
                const loaded = JSON.parse(payload);
                if (!loaded || typeof loaded !== 'object') {
                    alert("Error loading JSON");
                    return;
                }
                if (confirm("Overwrite data?")) {
                    gmData = sanitizeGMData(loaded);
                    saveGM();
                    location.reload();
                }
            } catch (e) { alert("Error loading JSON"); }
        };
        reader.onerror = () => alert("Error loading JSON");
        reader.readAsText(file);
    };
    input.click();
}

function saveGM() {
    const webhookEl = document.getElementById('webhookUrl');
    gmData.webhook = webhookEl ? webhookEl.value : gmData.webhook;
    const discordActiveEl = document.getElementById('discordActive');
    gmData.discordActive = !!(discordActiveEl && discordActiveEl.checked);
    const turnPingToggle = document.getElementById('discordTurnPing');
    gmData.turnPingActive = !!(turnPingToggle && turnPingToggle.checked);
    const turnPingMention = document.getElementById('discordTurnMention');
    gmData.turnPingMention = turnPingMention ? turnPingMention.value : '';
    const scratchpadEl = document.getElementById('scratchpad');
    gmData.scratchpad = scratchpadEl ? scratchpadEl.value : gmData.scratchpad;
    const rollLevelEl = document.getElementById('rollLevel');
    gmData.rollLevel = parseInt(rollLevelEl ? rollLevelEl.value : gmData.rollLevel, 10) || 1;
    persistGMData();
}

// --- ROLLER LOGIC ---
function getPB(level) {
    return Math.ceil(1 + (level / 4));
}

function updateBonuses() {
    const lvl = parseInt(document.getElementById('rollLevel').value) || 1;
    const pb = getPB(lvl);

    document.getElementById('pbDisplay').innerText = `PB: +${pb}`;

    // Calculate with Luck included!
    const calc = (base) => {
        const val = base + luckMode;
        return (val >= 0 ? '+' : '') + val;
    };

    document.getElementById('bonus-inc').innerText = calc(-1);
    document.getElementById('bonus-comp').innerText = calc(pb);
    document.getElementById('bonus-tal').innerText = calc(pb + 2);
    document.getElementById('bonus-exp').innerText = calc((pb * 2) + 2);
    document.getElementById('bonus-mas').innerText = calc((pb * 2) + 5);

    saveGM();
}

function setMode(mode) {
    rollMode = mode;
    document.querySelectorAll('.toggle-btn[data-mode]').forEach(b => b.classList.remove('active'));
    document.querySelector(`.toggle-btn[data-mode="${mode}"]`).classList.add('active');
}

function setLuck(luckStr) {
    if (luckStr === 'bad') luckMode = -1;
    else if (luckStr === 'good') luckMode = 1;
    else luckMode = 0;

    document.querySelectorAll('.toggle-btn[data-luck]').forEach(b => b.classList.remove('active'));
    document.querySelector(`.toggle-btn[data-luck="${luckStr}"]`).classList.add('active');

    updateBonuses();
}

// SHARED ROLL FUNCTION
function performRoll(bonus, reasonText) {
    const name = document.getElementById('adhocName').value || "GM";

    let rolls = [];
    let rawResult = 0;
    let formula = "";
    const r1 = Math.floor(Math.random() * 20) + 1;

    if (rollMode === 'norm') {
        rolls = [r1];
        rawResult = r1;
        formula = `[${r1}]`;
    } else {
        const r2 = Math.floor(Math.random() * 20) + 1;
        rolls = [r1, r2];
        if (rollMode === 'adv') {
            rawResult = Math.max(r1, r2);
            formula = `[${r1}, ${r2}] (ADV)`;
        } else {
            rawResult = Math.min(r1, r2);
            formula = `[${r1}, ${r2}] (DIS)`;
        }
    }

    const total = rawResult + bonus;
    if (bonus !== 0) formula += ` ${bonus >= 0 ? '+' : ''}${bonus}`;

    // UI Update
    document.getElementById('rollLabel').innerText = `${name} - ${reasonText}`;
    document.getElementById('rollVal').innerText = total;
    document.getElementById('rollFormula').innerText = formula;

    // Discord
    if (gmData.discordActive && gmData.webhook) {
        const isSecret = document.getElementById('secretRoll').checked;
        let content = `**${total}**\n${formula}`;
        if (isSecret) content = `||${content}||`;

        let color = 16777215; // White
        if (total >= 20) color = 3066993; // Green
        else if (total <= 5) color = 15158332; // Red

        sendDiscord(name, reasonText, content, isSecret ? 3447003 : color);
    }
}

function rollTier(tier) {
    const reasonInput = document.getElementById('adhocReason').value;
    const lvl = parseInt(document.getElementById('rollLevel').value) || 1;
    const pb = getPB(lvl);

    let baseBonus = 0;
    let tierLabel = "";

    switch (tier) {
        case 'crap': baseBonus = -1; tierLabel = "Crap"; break;
        case 'competent': baseBonus = pb; tierLabel = "Competent"; break;
        case 'talented': baseBonus = pb + 2; tierLabel = "Talented"; break;
        case 'expert': baseBonus = (pb * 2) + 2; tierLabel = "Expert"; break;
        case 'master': baseBonus = (pb * 2) + 5; tierLabel = "Master"; break;
    }

    // Apply Luck here mathematically
    const finalBonus = baseBonus + luckMode;

    // Clean Log Logic: Use input if available, else fallback to Tier Name
    const reason = reasonInput || tierLabel;

    performRoll(finalBonus, reason);
}

function rollManual() {
    const val = document.getElementById('manualBonus').value;
    const bonus = parseInt(val) || 0;
    const reasonInput = document.getElementById('adhocReason').value;
    const reason = reasonInput || "Manual Roll";

    performRoll(bonus, reason);
}

function sendDiscord(name, title, desc, color) {
    const payload = {
        embeds: [{
            author: { name: name },
            title: title,
            description: desc,
            color: color
        }]
    };
    postDiscordWebhook(payload).catch(console.error);
}

function postDiscordWebhook(payload) {
    const webhook = String(gmData.webhook || '').trim();
    if (!webhook) return Promise.reject(new Error('Discord webhook URL is missing.'));
    return fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then((response) => {
        if (!response.ok) {
            throw new Error(`Discord webhook failed (${response.status})`);
        }
        return response;
    });
}

function sendDiscordPingMessage(messageText, requireTurnPingToggle = true) {
    const text = sanitizeString(messageText, '', 240).trim();
    if (!text) return;
    if (!gmData.discordActive) return;
    if (requireTurnPingToggle && !gmData.turnPingActive) return;
    if (!String(gmData.webhook || '').trim()) return;

    const mention = sanitizeString(gmData.turnPingMention || '', '', 160).trim();
    const payload = {
        content: mention ? `${mention} ${text}` : text
    };
    postDiscordWebhook(payload).catch(console.error);
}

function getCurrentCombatant() {
    if (!Array.isArray(gmData.combatants) || gmData.combatants.length === 0) return null;
    const idx = Math.max(0, Math.min(gmData.activeIdx, gmData.combatants.length - 1));
    return gmData.combatants[idx] || null;
}

function sendTurnPing(isTest = false) {
    if (!gmData.discordActive) {
        if (isTest) alert('Enable Discord integration first.');
        return;
    }
    if (!isTest && !gmData.turnPingActive) return;
    if (!String(gmData.webhook || '').trim()) {
        if (isTest) alert('Paste a Discord webhook URL first.');
        return;
    }

    const combatant = getCurrentCombatant();
    if (!combatant && !isTest) return;

    const safeName = combatant ? sanitizeString(combatant.name || 'Combatant', 'Combatant', 160) : 'Combatant';
    const turnText = isTest ? 'Initiative Ping Test' : `${safeName}'s Turn!`;
    if (isTest) {
        const mention = sanitizeString(gmData.turnPingMention || '', '', 160).trim();
        const payload = { content: mention ? `${mention} ${turnText}` : turnText };
        postDiscordWebhook(payload)
            .then(() => {
                alert('Turn ping sent.');
            })
            .catch((err) => {
                console.error(err);
                alert('Could not send ping. Check the webhook URL and browser console.');
            });
        return;
    }
    sendDiscordPingMessage(turnText, true);
}

function updateDC(val) {
    const diffs = { 5: "Very Easy", 10: "Easy", 15: "Medium", 20: "Hard", 25: "Very Hard", 30: "Nearly Impossible" };
    document.getElementById('dcDisplay').innerText = "DC " + val;
    document.getElementById('dcDesc').innerText = diffs[val] || "Custom";
}

// --- COMBAT FUNCTIONS ---
function sortCombat() {
    gmData.combatants.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return b.tie - a.tie;
    });
}

function addSingle() {
    const name = document.getElementById('addName').value || "Enemy";
    const initVal = parseFloat(document.getElementById('addInit').value) || 0;
    const dexScore = parseInt(document.getElementById('addDex').value) || 10;
    const hp = document.getElementById('addHP').value;
    const safeName = sanitizeString(name, 'Enemy', 160).trim() || 'Enemy';
    const hpVal = hp ? Math.max(0, parseInt(hp, 10) || 0) : null;

    pushUndoSnapshot('Add combatant');
    gmData.combatants.push({
        id: Date.now(),
        name: safeName,
        total: initVal,
        tie: dexScore,
        ac: null,
        hp: hpVal,
        maxHp: hpVal,
        conditions: [],
        reactionUsed: false,
        concentrating: false,
        legendaryMax: 0,
        legendaryUsed: 0
    });
    addCombatLog(`${safeName} added to initiative`);

    document.getElementById('addName').value = "";
    document.getElementById('addInit').value = "";

    sortCombat();
    commitTrackerState();
}

function genMobs() {
    const baseName = document.getElementById('mobName').value || "Mob";
    const count = parseInt(document.getElementById('mobCount').value) || 1;
    const mod = parseInt(document.getElementById('mobInitMod').value) || 0;
    const score = parseInt(document.getElementById('mobDexScore').value) || 10;
    const hp = parseInt(document.getElementById('mobHP').value) || 0;

    pushUndoSnapshot('Generate mob group');
    for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * 20) + 1;
        const total = roll + mod;
        const name = count > 1 ? `${baseName} ${i + 1}` : baseName;

        gmData.combatants.push({
            id: Date.now() + i,
            name: name,
            total: total,
            tie: score,
            ac: null,
            hp: hp > 0 ? hp : null,
            maxHp: hp > 0 ? hp : null,
            conditions: [],
            reactionUsed: false,
            concentrating: false,
            legendaryMax: 0,
            legendaryUsed: 0
        });
    }
    addCombatLog(`Generated ${count} ${baseName}${count === 1 ? '' : 's'}`);

    sortCombat();
    commitTrackerState();
    const mobBody = document.getElementById('mobBody');
    if (mobBody) mobBody.classList.remove('open');
}

function toggleMobBody() {
    const mobBody = document.getElementById('mobBody');
    if (!mobBody) return;
    mobBody.classList.toggle('open');
}

function renderCombat() {
    const list = document.getElementById('combatList');
    if (!list) return;
    document.getElementById('roundVal').innerText = gmData.round;
    updateUndoButton();

    list.innerHTML = gmData.combatants.map((c, i) => {
        const activeClass = (i === gmData.activeIdx) ? 'active' : '';
        const safeTotal = Number.isFinite(Number(c.total)) ? Number(c.total) : 0;
        const safeTie = Number.isFinite(Number(c.tie)) ? Number(c.tie) : 0;
        const safeName = escapeHtml(c.name || 'Combatant');
        const conditions = Array.isArray(c.conditions) ? c.conditions : [];
        const conditionHtml = conditions.map((condition, condIdx) => {
            const condName = escapeHtml(condition && condition.name ? condition.name : 'Condition');
            const condDuration = condition && condition.duration !== null && condition.duration !== undefined
                ? ` (${escapeHtml(String(condition.duration))})`
                : '';
            return `
                <span class="combat-cond-chip">
                    <button class="combat-cond-main" data-onclick="setConditionDuration(${i}, ${condIdx})">${condName}${condDuration}</button>
                    <button class="combat-cond-del" data-onclick="removeCondition(${i}, ${condIdx})">&times;</button>
                </span>
            `;
        }).join('');

        const reactionUsed = !!c.reactionUsed;
        const concentrating = !!c.concentrating;
        const legendaryMax = Math.max(0, Math.min(9, parseInt(c.legendaryMax, 10) || 0));
        const legendaryUsed = Math.max(0, Math.min(legendaryMax, parseInt(c.legendaryUsed, 10) || 0));
        const legendaryLeft = Math.max(0, legendaryMax - legendaryUsed);
        const safeAc = Number.isFinite(Number(c.ac)) ? Math.max(0, Math.min(99, Math.round(Number(c.ac)))) : null;
        let hpHtml = '';
        if (c.hp !== null) {
            const safeHp = Number.isFinite(Number(c.hp)) ? Number(c.hp) : 0;
            const safeMaxHp = Number.isFinite(Number(c.maxHp)) ? Number(c.maxHp) : 0;
            const bloodiedClass = (safeMaxHp > 0 && safeHp <= safeMaxHp / 2) ? 'hp-bloodied' : 'hp-healthy';
            hpHtml = `
                    <div class="hp-controls">
                        <button class="btn-dmg-qs" data-onclick="modHP(${i}, +1)">+1</button>
                        <button class="btn-dmg-qs" data-onclick="modHP(${i}, +5)">+5</button>
                        <button class="btn-dmg-qs" data-onclick="modHP(${i}, -1)">-1</button>
                        <button class="btn-dmg-qs" data-onclick="modHP(${i}, -5)">-5</button>
                        <div class="hp-display ${bloodiedClass}" data-onclick="setHP(${i})">${safeHp}</div>
                    </div>
                `;
        }

        return `
            <div class="combat-item ${activeClass}">
                <div class="init-box">
                    <div class="init-val">${safeTotal}</div>
                    <div class="init-tie">.${safeTie}</div>
                </div>
                <div class="name-box">
                    <div class="name-main">${safeName}</div>
                    ${activeClass ? '<div class="name-meta name-meta-active">Taking Turn...</div>' : ''}
                    <div class="combat-state-row">
                        <button class="combat-state-chip ${safeAc !== null ? 'is-on' : 'is-off'}" data-onclick="setAC(${i})">AC ${safeAc !== null ? safeAc : '--'}</button>
                        <button class="combat-state-chip ${reactionUsed ? 'is-off' : 'is-on'}" data-onclick="toggleReaction(${i})">Reaction ${reactionUsed ? 'Used' : 'Ready'}</button>
                        <button class="combat-state-chip ${concentrating ? 'is-on' : 'is-off'}" data-onclick="toggleConcentration(${i})">Concentration ${concentrating ? 'On' : 'Off'}</button>
                        <button class="combat-state-chip ${legendaryMax > 0 ? 'is-on' : 'is-off'}" data-onclick="setLegendaryMax(${i})">LA ${legendaryLeft}/${legendaryMax}</button>
                        ${legendaryMax > 0 ? `<button class="combat-state-chip combat-state-chip-sm" data-onclick="useLegendary(${i})">Use LA</button>` : ''}
                        ${legendaryMax > 0 ? `<button class="combat-state-chip combat-state-chip-sm" data-onclick="restoreLegendary(${i})">Restore LA</button>` : ''}
                    </div>
                    <div class="combat-cond-row">
                        ${conditionHtml || '<span class="combat-cond-empty">No conditions</span>'}
                        <button class="combat-cond-add" data-onclick="addCondition(${i})">+ Cond</button>
                    </div>
                </div>
                <div class="combat-actions">
                    ${hpHtml}
                    <button class="btn-del" data-onclick="delCombatant(${i})">&times;</button>
                </div>
            </div>
            `;
    }).join('');
}

function nextTurn() {
    if (gmData.combatants.length === 0) return;
    pushUndoSnapshot('Next turn');
    gmData.activeIdx++;
    let wrapped = false;
    if (gmData.activeIdx >= gmData.combatants.length) {
        gmData.activeIdx = 0;
        gmData.round++;
        wrapped = true;
    }
    if (wrapped) {
        addCombatLog(`Round ${gmData.round} begins`);
    }
    refreshTurnState(gmData.activeIdx);
    addCombatLog(`${getCombatantNameByIndex(gmData.activeIdx)}'s turn`);
    commitTrackerState();
    sendTurnPing();
    setTimeout(() => {
        const activeEl = document.querySelector('.combat-item.active');
        if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

function prevTurn() {
    if (gmData.combatants.length === 0) return;
    pushUndoSnapshot('Previous turn');
    gmData.activeIdx--;
    if (gmData.activeIdx < 0) {
        gmData.activeIdx = gmData.combatants.length - 1;
        gmData.round = Math.max(1, gmData.round - 1);
    }
    addCombatLog(`Rewound to ${getCombatantNameByIndex(gmData.activeIdx)}'s turn`);
    commitTrackerState();
}

function clearCombat() {
    if (confirm("Clear Tracker?")) {
        pushUndoSnapshot('Clear encounter');
        gmData.combatants = [];
        gmData.round = 1;
        gmData.activeIdx = 0;
        addCombatLog('Encounter cleared');
        commitTrackerState();
    }
}

function delCombatant(i) {
    if (!gmData.combatants[i]) return;
    pushUndoSnapshot('Remove combatant');
    const removed = gmData.combatants.splice(i, 1)[0];
    if (gmData.combatants.length === 0) {
        gmData.activeIdx = 0;
        gmData.round = 1;
    } else if (i < gmData.activeIdx) {
        gmData.activeIdx -= 1;
    } else if (gmData.activeIdx >= gmData.combatants.length) {
        gmData.activeIdx = 0;
    }
    addCombatLog(`${sanitizeString(removed && removed.name || 'Combatant', 'Combatant', 160)} removed from initiative`);
    commitTrackerState();
}

function modHP(i, delta) {
    const combatant = gmData.combatants[i];
    if (!combatant || combatant.hp === null) return;
    pushUndoSnapshot('Modify HP');
    const oldHp = parseInt(combatant.hp, 10) || 0;
    combatant.hp = Math.max(0, oldHp + delta);
    addCombatLog(`${getCombatantNameByIndex(i)} HP ${oldHp} -> ${combatant.hp}`);
    commitTrackerState();
}

function setHP(i) {
    if (!gmData.combatants[i]) return;
    const val = prompt("Set HP:", gmData.combatants[i].hp);
    if (val !== null) {
        const parsed = Math.max(0, parseInt(val, 10) || 0);
        pushUndoSnapshot('Set HP');
        gmData.combatants[i].hp = parsed;
        addCombatLog(`${getCombatantNameByIndex(i)} HP set to ${parsed}`);
        commitTrackerState();
    }
}

function setAC(i) {
    if (!gmData.combatants[i]) return;
    const current = gmData.combatants[i].ac;
    const val = prompt("Set AC (blank to clear):", current === null || current === undefined ? '' : String(current));
    if (val === null) return;
    pushUndoSnapshot('Set AC');
    const trimmed = String(val).trim();
    if (!trimmed) {
        gmData.combatants[i].ac = null;
        addCombatLog(`${getCombatantNameByIndex(i)} AC cleared`);
    } else {
        const parsed = Math.max(0, Math.min(99, parseInt(trimmed, 10) || 0));
        gmData.combatants[i].ac = parsed;
        addCombatLog(`${getCombatantNameByIndex(i)} AC set to ${parsed}`);
    }
    commitTrackerState();
}

// --- REFERENCE & LOOT ---
function renderConditions() {
    const div = document.getElementById('conditionsList');
    div.innerHTML = Object.keys(conditions).map(k => `
            <div>
                <button class="accordion-btn" data-onclick="toggleConditionBody(this)">${k}</button>
                <div class="accordion-body">
                    <span class="cond-tag">${k.toUpperCase()}</span> ${conditions[k]}
                </div>
            </div>
        `).join('');
}

function toggleConditionBody(buttonEl) {
    const bodyEl = buttonEl ? buttonEl.nextElementSibling : null;
    if (bodyEl) bodyEl.classList.toggle('show');
}

function genLoot(type) {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const qtyInput = document.getElementById('lootQty');
    const qtyCount = qtyInput ? parseInt(qtyInput.value) : 1;
    const qty = Math.min(10, Math.max(1, qtyCount || 1));
    const multCheck = document.getElementById('valueMultiplier');
    const multiplier = multCheck ? multCheck.checked : false;
    let results = [];

    for (let i = 0; i < qty; i++) {
        let item = "";
        if (type === 'pocket') {
            const category = pick(lootTables.pocket);
            const adj = pick(category.adjs);
            const noun = pick(category.nouns);
            item = `${adj} ${noun} (Worthless)`;
        }
        else if (type === 'trinket') {
            const noun = pick(lootTables.trinket.nouns);
            const suffix = Math.random() > 0.5 ? " " + pick(lootTables.trinket.suffixes) : "";

            let material, value;
            if (multiplier) {
                const matType = pick(["Jade", "Silver", "Gold", "Platinum"]);
                material = `Masterwork ${matType}`;
                value = "50 gp";
            } else {
                const isFancy = Math.random() < 0.4;
                const tier = isFancy ? lootTables.trinket.fancy : lootTables.trinket.cheap;
                material = pick(tier.materials);
                value = pick(tier.values);
            }
            item = `${material} ${noun}${suffix} (${value})`;
        }
        results.push(item);
    }

    // Always show numbering if more than 1 item
    let resultText = "";
    if (results.length > 1) {
        resultText = results.map((res, idx) => `${idx + 1}. ${res}`).join('\n');
    } else if (results.length === 1) {
        resultText = results[0];
    } else {
        resultText = "No items generated.";
    }

    const el = document.getElementById('lootResult');
    if (el) {
        el.style.opacity = 0;
        setTimeout(() => {
            el.innerText = resultText;
            el.style.opacity = 1;
        }, 100);
    }
}

function switchTab(id, triggerEvent) {
    document.querySelectorAll('.container').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const clicked = triggerEvent && triggerEvent.currentTarget ? triggerEvent.currentTarget : null;
    const fallback = document.querySelector(`.nav-item[data-tab="${id}"]`);
    const target = clicked || fallback;
    if (target) target.classList.add('active');
}

init();
