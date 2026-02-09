// --- CONFIGURATION ---
const CONFIG = {
    PHYSICS_STEPS: 2,
    GRAVITY: 0.6,
    SEGMENT_LENGTH: 24,
    POINTS_COUNT: 7,
    SLEEP_THRESHOLD: 0.1,
    MAX_CONNECTIONS: 2000,
    VIEW_SCALE_MIN: 0.2,
    VIEW_SCALE_MAX: 3,
    BASE_THICKNESS: 3.5,
    SHADOW_THICKNESS: 6,
    MAX_STRETCH: 15,
};

// --- GLOBAL STATE ---
const container = document.getElementById('board-container');
const labelContainer = document.getElementById('string-label-container');
const canvas = document.getElementById('connection-layer');
const ctx = canvas.getContext('2d'); // Transparent background

const contextMenu = document.getElementById('context-menu');

// Data Models
let nodes = [];
let connections = [];

// Physics Buffer: [x, y, oldx, oldy, STRESS]
const STRIDE = 5;
const BYTES_PER_CONN = CONFIG.POINTS_COUNT * STRIDE;
const physicsBuffer = new Float32Array(CONFIG.MAX_CONNECTIONS * CONFIG.POINTS_COUNT * STRIDE);
const sleepState = new Uint8Array(CONFIG.MAX_CONNECTIONS);

// Fast Lookups
const connToIndex = new Map();
const nodeGraph = new Map();
let allocatedCount = 0;

// View & Interaction
let view = { x: 0, y: 0, scale: 1 };
let nodeCache = new Map();
let draggedNode = null;
let dragStart = { x: 0, y: 0, nodeX: 0, nodeY: 0 };
let isConnecting = false;
let connectStart = { id: null, port: null, x: 0, y: 0 };
let focusMode = false;
let panMode = false;
let isPanning = false;
let panStart = { x: 0, y: 0 };
let isHydratingBoard = false;
let lastSavedCaseName = 'UNNAMED CASE';
let lastOptimizeSnapshot = null;

const sanitizeText = (text = '') => String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const sanitizeMultiline = (text = '') => sanitizeText(text).replace(/\n/g, '<br>');
const LEGACY_BOARD_KEY = 'invBoardData';
const NODE_TYPE_LABELS = {
    person: 'Person',
    location: 'Location',
    clue: 'Clue',
    note: 'Note',
    event: 'Event',
    requisition: 'Requisition'
};
const NODE_TYPE_ICONS = {
    person: '👤',
    location: '📍',
    clue: '🔍',
    note: '📝',
    event: '🕰️',
    requisition: '📦',
    azorius: '⚖️',
    boros: '⚔️',
    dimir: '👁️',
    golgari: '🍄',
    gruul: '🔥',
    izzet: '⚡',
    orzhov: '💰',
    rakdos: '🎪',
    selesnya: '🌳',
    simic: '🧬'
};
const CONNECTION_COLOR_PALETTE = [
    { name: 'Neutral', hex: '#f5f7fb' },
    { name: 'Red', hex: '#ff5e57' },
    { name: 'Blue', hex: '#4ea3ff' },
    { name: 'Green', hex: '#53d37c' },
    { name: 'Amber', hex: '#f3c34f' },
    { name: 'Violet', hex: '#b691ff' }
];
const IMAGE_EDITABLE_NODE_TYPES = new Set(['person', 'location', 'clue']);

function normalizeCaseName(name) {
    const cleaned = String(name || '').replace(/\s+/g, ' ').trim();
    return cleaned || 'UNNAMED CASE';
}

function sanitizeImageUrl(url = '') {
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
}

function clampConnectionColorIndex(index) {
    const parsed = Number(index);
    if (!Number.isInteger(parsed) || parsed < 0) return 0;
    if (parsed >= CONNECTION_COLOR_PALETTE.length) return 0;
    return parsed;
}

function getConnectionColorConfig(conn) {
    const index = clampConnectionColorIndex(conn && conn.colorIndex);
    return CONNECTION_COLOR_PALETTE[index];
}

function hexToRgba(hex, alpha = 1) {
    const clean = String(hex || '').replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return `rgba(255,255,255,${alpha})`;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function getCaseName() {
    const el = document.getElementById('caseName');
    return normalizeCaseName(el ? el.innerText : 'UNNAMED CASE');
}

function sanitizeNodeMeta(meta) {
    if (!meta || typeof meta !== 'object') return null;
    const clean = {};
    Object.keys(meta).forEach((key) => {
        const value = meta[key];
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            clean[key] = value;
        }
    });
    return Object.keys(clean).length ? clean : null;
}

function setNodeMeta(el, meta) {
    if (!el) return;
    const clean = sanitizeNodeMeta(meta);
    if (!clean) {
        delete el.dataset.meta;
        return;
    }
    el.dataset.meta = JSON.stringify(clean);
}

function getNodeMeta(el) {
    if (!el || !el.dataset || !el.dataset.meta) return null;
    try {
        return sanitizeNodeMeta(JSON.parse(el.dataset.meta));
    } catch (err) {
        return null;
    }
}

function getNodeTypeFromEl(el) {
    if (!el || !el.classList) return '';
    const cls = Array.from(el.classList).find(c => c.startsWith('type-')) || '';
    return cls.replace('type-', '');
}

function getNodeSummary(nodeId) {
    const el = document.getElementById(nodeId);
    if (!el) return null;
    const type = getNodeTypeFromEl(el);
    const titleEl = el.querySelector('.node-title');
    const bodyEl = el.querySelector('.node-body');
    return {
        id: nodeId,
        type,
        title: (titleEl ? titleEl.innerText : type.toUpperCase()).trim() || type.toUpperCase(),
        bodyText: (bodyEl ? bodyEl.innerText : '').trim(),
        meta: getNodeMeta(el)
    };
}

function getNodeLinkCount(nodeId) {
    let count = 0;
    for (let i = 0; i < connections.length; i++) {
        const conn = connections[i];
        if (conn.from === nodeId || conn.to === nodeId) count++;
    }
    return count;
}

function getNodeTypeLabel(type) {
    return NODE_TYPE_LABELS[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Node');
}

function connectionExistsBetween(nodeAId, nodeBId) {
    return connections.some((c) =>
        (c.from === nodeAId && c.to === nodeBId) ||
        (c.from === nodeBId && c.to === nodeAId)
    );
}

function createConnectionBetweenNodes(fromNodeId, toNodeId, fromPort = null, toPort = null) {
    if (!fromNodeId || !toNodeId) return false;
    if (fromNodeId === toNodeId) return false;
    if (connectionExistsBetween(fromNodeId, toNodeId)) return false;

    const fromLinksBefore = getNodeLinkCount(fromNodeId);
    const toLinksBefore = getNodeLinkCount(toNodeId);

    const newConn = {
        id: 'conn_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
        from: fromNodeId,
        to: toNodeId,
        fromPort: fromPort || 'auto',
        toPort: toPort || 'auto',
        label: '',
        arrowLeft: 0,
        arrowRight: 0,
        relationshipLogged: false,
        colorIndex: 0
    };

    connections.push(newConn);
    registerConnection(newConn);

    const fromSummary = getNodeSummary(fromNodeId);
    const toSummary = getNodeSummary(toNodeId);
    if (fromLinksBefore === 0) logNodeConnectedToCase(fromSummary, toSummary);
    if (toLinksBefore === 0) logNodeConnectedToCase(toSummary, fromSummary);

    saveBoard();
    return true;
}

function getHeatDeltaFromNode(summary) {
    if (!summary) return null;
    const metaHeat = summary.meta && summary.meta.heatDelta;
    const parsedMeta = Number(metaHeat);
    if (Number.isFinite(parsedMeta)) return parsedMeta;

    const match = (summary.bodyText || '').match(/\bHeat\s*:?\s*([+-]?\d+)/i);
    if (!match) return null;
    const parsedBody = Number(match[1]);
    return Number.isFinite(parsedBody) ? parsedBody : null;
}

function logBoardTimeline(entry, options = {}) {
    const logger = window.RTF_SESSION_LOG;
    if (!logger || typeof logger.logMajorEvent !== 'function') return;
    const details = entry && typeof entry === 'object' ? entry : {};
    const tags = Array.isArray(details.tags) ? details.tags : [];

    logger.logMajorEvent({
        title: details.title || 'Case Board Event',
        focus: getCaseName(),
        heatDelta: details.heatDelta,
        tags: ['auto', 'case-board', ...tags],
        highlights: details.highlights || '',
        fallout: details.fallout || '',
        followUp: details.followUp || '',
        source: 'board',
        kind: details.kind || 'board'
    }, options);
}

function getSourceDescriptor(meta) {
    if (!meta || !meta.sourceType) return '';
    const type = String(meta.sourceType);
    if (type === 'npc') return ' from NPC roster';
    if (type === 'location') return ' from locations database';
    if (type === 'timeline-event') return ' from mission timeline';
    if (type === 'requisition') return ' from requisitions';
    if (type === 'guild') return ' from guild reference';
    return '';
}

function logNodeAddedToBoard(summary) {
    if (!summary) return;
    const typeLabel = getNodeTypeLabel(summary.type);
    const sourceSuffix = getSourceDescriptor(summary.meta);
    const sourceTag = summary.meta && summary.meta.sourceType ? [String(summary.meta.sourceType)] : [];
    logBoardTimeline({
        title: `${typeLabel} Added to Case Board`,
        kind: 'node-added',
        tags: ['node-add', summary.type, ...sourceTag],
        highlights: `${summary.title}${sourceSuffix}.`
    }, { dedupeKey: `board:add:${summary.id}` });
}

function logNodeConnectedToCase(summary, otherSummary) {
    if (!summary) return;
    const typeLabel = getNodeTypeLabel(summary.type);
    const otherTitle = otherSummary ? otherSummary.title : 'another node';
    logBoardTimeline({
        title: `${typeLabel} Connected to Case`,
        kind: 'node-linked',
        tags: ['node-link', summary.type],
        highlights: `${summary.title} linked with ${otherTitle}.`
    }, { dedupeKey: `board:first-link:${summary.id}` });

    if (summary.type !== 'event') return;

    logBoardTimeline({
        title: 'Timeline Event Linked to Case',
        kind: 'timeline-event-linked',
        tags: ['event-link'],
        highlights: `${summary.title} linked to the active case graph.`
    }, { dedupeKey: `board:event-link:${summary.id}` });

    const heat = getHeatDeltaFromNode(summary);
    if (heat === null || heat === 0) return;

    logBoardTimeline({
        title: 'Heat-Impact Event Linked to Case',
        kind: 'heat-event-linked',
        tags: ['event-link', 'heat-impact'],
        heatDelta: heat,
        highlights: `${summary.title} carries Heat ${heat > 0 ? '+' : ''}${heat} and is now connected.`
    }, { dedupeKey: `board:event-heat-link:${summary.id}` });
}

function initCaseNameTracking() {
    const caseNameEl = document.getElementById('caseName');
    if (!caseNameEl) return;
    caseNameEl.addEventListener('blur', () => saveBoard());
    caseNameEl.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        caseNameEl.blur();
    });
}

function sanitizeRichText(html = '') {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    const allowed = new Set(['BR', 'STRONG', 'B', 'EM', 'I', 'U', 'DIV', 'P', 'SPAN']);

    const cleanNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            return document.createTextNode(node.textContent || '');
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return document.createTextNode('');
        }

        const tag = node.tagName.toUpperCase();
        if (!allowed.has(tag)) {
            const fragment = document.createDocumentFragment();
            Array.from(node.childNodes).forEach(child => fragment.appendChild(cleanNode(child)));
            return fragment;
        }

        const clean = document.createElement(tag.toLowerCase());
        Array.from(node.childNodes).forEach(child => clean.appendChild(cleanNode(child)));
        return clean;
    };

    const wrapper = document.createElement('div');
    Array.from(template.content.childNodes).forEach(node => wrapper.appendChild(cleanNode(node)));
    return wrapper.innerHTML;
}

function sanitizeBoardPayload(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    return {
        name: typeof source.name === 'string' && source.name ? source.name : 'UNNAMED CASE',
        nodes: Array.isArray(source.nodes) ? source.nodes : [],
        connections: Array.isArray(source.connections) ? source.connections : []
    };
}

function readStoreBoardPayload() {
    if (!window.RTF_STORE) return null;
    if (typeof window.RTF_STORE.getBoard === 'function') {
        return sanitizeBoardPayload(window.RTF_STORE.getBoard());
    }
    if (window.RTF_STORE.state && window.RTF_STORE.state.board) {
        return sanitizeBoardPayload(window.RTF_STORE.state.board);
    }
    return null;
}

function writeStoreBoardPayload(payload) {
    if (!window.RTF_STORE) return false;
    const clean = sanitizeBoardPayload(payload);
    if (typeof window.RTF_STORE.updateBoard === 'function') {
        window.RTF_STORE.updateBoard(clean);
        return true;
    }
    if (window.RTF_STORE.state) {
        window.RTF_STORE.state.board = clean;
        if (typeof window.RTF_STORE.save === 'function') window.RTF_STORE.save();
        return true;
    }
    return false;
}

function readLegacyBoardPayload() {
    const raw = localStorage.getItem(LEGACY_BOARD_KEY);
    if (!raw) return null;
    try {
        return sanitizeBoardPayload(JSON.parse(raw));
    } catch (err) {
        console.warn('Legacy board data is corrupted', err);
        return null;
    }
}

function hasBoardContent(payload) {
    if (!payload) return false;
    if ((payload.nodes && payload.nodes.length) || (payload.connections && payload.connections.length)) return true;
    return payload.name && payload.name !== 'UNNAMED CASE' && payload.name !== 'UNNAMED';
}

function getPreferredBoardPayload() {
    const storePayload = readStoreBoardPayload();
    if (hasBoardContent(storePayload)) return storePayload;

    const legacyPayload = readLegacyBoardPayload();
    if (legacyPayload) {
        writeStoreBoardPayload(legacyPayload);
        localStorage.removeItem(LEGACY_BOARD_KEY);
        return legacyPayload;
    }

    return storePayload;
}

const REQUISITION_STATUSES = ["Pending", "Approved", "In Transit", "Delivered", "Denied"];
const REQUISITION_PRIORITIES = ["Routine", "Tactical", "Emergency"];
const REQUISITION_PRIORITY_WEIGHT = REQUISITION_PRIORITIES.reduce((acc, val, idx) => {
    acc[val] = idx;
    return acc;
}, {});

// --- INITIALIZATION ---
window.onload = () => {
    resizeCanvas();
    initToolbars();
    loadBoard();
    updateViewCSS();
    initCaseNameTracking();
    window.addEventListener('rtf-store-updated', handleRemoteStoreUpdate);
    requestAnimationFrame(loop);
};

window.onresize = () => resizeCanvas();

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function handleRemoteStoreUpdate(event) {
    if (!event || !event.detail || event.detail.source !== 'remote') return;
    loadBoard();
    updateViewCSS();
}

function initToolbars() {
    initGuildToolbar();
    initNPCToolbar();
    initLocationToolbar();
    initEventToolbar();
    initRequisitionToolbar();
    initFormattingToolbar();
}

function initFormattingToolbar() {
    if (document.getElementById('formatting-toolbar')) return;
    const tb = document.createElement('div');
    tb.id = 'formatting-toolbar';
    tb.className = 'formatting-toolbar';

    ['bold', 'italic', 'underline'].forEach(cmd => {
        const btn = document.createElement('div');
        btn.className = 'formatting-btn';
        btn.dataset.cmd = cmd;
        // Icons: B, I, U
        btn.innerHTML = cmd === 'bold' ? 'B' : cmd === 'italic' ? 'I' : 'U';
        btn.style.fontStyle = cmd === 'italic' ? 'italic' : 'normal';
        btn.style.textDecoration = cmd === 'underline' ? 'underline' : 'none';

        btn.onmousedown = (e) => {
            e.preventDefault(); // Prevent losing focus
            document.execCommand(cmd, false, null);
            saveBoard();
        };
        tb.appendChild(btn);
    });

    document.body.appendChild(tb);
}

function getBoardGuildNames() {
    if (typeof window.getRTFGuilds === 'function') {
        const list = window.getRTFGuilds({ includeGuildless: true });
        if (Array.isArray(list) && list.length) return list;
    }
    if (window.RTF_DATA && Array.isArray(window.RTF_DATA.guilds) && window.RTF_DATA.guilds.length) {
        return window.RTF_DATA.guilds;
    }
    return [];
}

function getBoardGuildEntries() {
    const names = getBoardGuildNames();
    const clueGuilds = (window.RTF_DATA && window.RTF_DATA.clue && Array.isArray(window.RTF_DATA.clue.guilds))
        ? window.RTF_DATA.clue.guilds
        : [];

    const clueByName = new Map();
    clueGuilds.forEach((entry) => {
        if (!entry || !entry.name) return;
        clueByName.set(String(entry.name).trim().toLowerCase(), entry);
    });

    const seenIds = new Set();
    const out = [];
    names.forEach((name, idx) => {
        const cleanName = String(name || '').trim();
        if (!cleanName) return;
        const clue = clueByName.get(cleanName.toLowerCase());
        let id = clue && clue.id ? String(clue.id).trim() : '';
        if (!id) id = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (!id) id = `guild-${idx + 1}`;
        if (seenIds.has(id)) id = `${id}-${idx + 1}`;
        seenIds.add(id);

        out.push({
            id,
            name: cleanName,
            icon: clue && clue.icon ? clue.icon : '🏷️'
        });
    });

    return out;
}

function initGuildToolbar() {
    const guildContainer = document.getElementById('guild-popup');
    if (!guildContainer) return;

    guildContainer.innerHTML = '<div id="guild-list-content"></div>';
    const list = document.getElementById('guild-list-content');
    const entries = getBoardGuildEntries();

    if (!entries.length) {
        list.innerHTML = '<div style="padding:10px; color:#666; font-size:0.8rem;">No guild entries available.</div>';
        return;
    }

    entries.forEach(g => {
        const el = document.createElement('div');
        el.className = `tool-item g-${g.id}`;
        el.draggable = true;
        el.ondragstart = (e) => startDragNew(e, g.id, {
            title: g.name,
            body: 'Guild',
            meta: {
                sourceType: 'guild',
                guild: g.name,
                guildId: g.id
            }
        });
        el.innerHTML = `<div class="icon">${g.icon}</div><div class="label">${g.name}</div>`;
        list.appendChild(el);
    });
}

function initNPCToolbar() {
    const container = document.getElementById('npc-popup');
    if (!container || !window.RTF_STORE) return;

    // Create Filter UI
    container.innerHTML = `
        <div class="filter-bar">
            <input type="text" id="npc-search" class="filter-input" placeholder="Search NPCs..." oninput="renderNPCs()">
            <select id="npc-guild-filter" class="filter-select" onchange="renderNPCs()">
                <option value="">All Guilds</option>
                ${getBoardGuildNames().map(g => `<option value="${g}">${g}</option>`).join('')}
            </select>
        </div>
        <div id="npc-list-content"></div>
    `;

    renderNPCs();
}

function renderNPCs() {
    const listContainer = document.getElementById('npc-list-content');
    if (!listContainer) return;

    const searchTerm = (document.getElementById('npc-search').value || '').toLowerCase();
    const guildFilter = document.getElementById('npc-guild-filter').value;

    const npcs = window.RTF_STORE.state.campaign.npcs || [];
    listContainer.innerHTML = '';

    const filtered = npcs.filter(npc => {
        const text = `${npc.name} ${npc.wants || ''} ${npc.leverage || ''} ${npc.notes || ''} ${npc.guild || ''}`.toLowerCase();
        const matchesSearch = text.includes(searchTerm);
        const matchesGuild = !guildFilter || (npc.guild && npc.guild.includes(guildFilter));
        return matchesSearch && matchesGuild;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '<div style="padding:10px; color:#666; font-size:0.8rem;">No NPCs found.</div>';
        return;
    }

    filtered.forEach(npc => {
        const el = document.createElement('div');
        el.className = 'tool-item';
        el.draggable = true;
        // Map NPC data to Node content
        let body = `${sanitizeText(npc.guild || 'Unassigned')}`;
        if (npc.wants) body += `<br><strong>Wants:</strong> ${sanitizeMultiline(npc.wants)}`;
        if (npc.leverage) body += `<br><strong>Lev:</strong> ${sanitizeMultiline(npc.leverage)}`;
        if (npc.notes) body += `<br><strong>Note:</strong> ${sanitizeMultiline(npc.notes)}`;

        const nodeData = {
            title: npc.name || 'Unknown NPC',
            body: body,
            meta: {
                sourceType: 'npc',
                npcName: npc.name || 'Unknown NPC',
                guild: npc.guild || ''
            }
        };
        el.ondragstart = (e) => startDragNew(e, 'person', nodeData);
        el.innerHTML = `<div class="icon">👤</div><div class="label">${sanitizeText(npc.name)}</div>`;
        listContainer.appendChild(el);
    });
}

function initLocationToolbar() {
    const container = document.getElementById('location-popup');
    if (!container || !window.RTF_STORE) return;

    // Create Filter UI
    container.innerHTML = `
        <div class="filter-bar">
            <input type="text" id="loc-search" class="filter-input" placeholder="Search Places..." oninput="renderLocations()">
            <select id="loc-guild-filter" class="filter-select" onchange="renderLocations()">
                <option value="">All Districts</option>
                ${getBoardGuildNames().map(g => `<option value="${g}">${g}</option>`).join('')}
            </select>
        </div>
        <div id="loc-list-content"></div>
    `;

    renderLocations();
}

function renderLocations() {
    const listContainer = document.getElementById('loc-list-content');
    if (!listContainer) return;

    const searchTerm = (document.getElementById('loc-search').value || '').toLowerCase();
    const guildFilter = document.getElementById('loc-guild-filter').value;

    const locs = window.RTF_STORE.state.campaign.locations || [];
    listContainer.innerHTML = '';

    const filtered = locs.filter(loc => {
        const text = `${loc.name} ${loc.district || ''} ${loc.desc || ''} ${loc.notes || ''}`.toLowerCase();
        const matchesSearch = text.includes(searchTerm);
        // Location "District" is essentially the Guild
        const matchesGuild = !guildFilter || (loc.district && loc.district.includes(guildFilter));
        return matchesSearch && matchesGuild;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '<div style="padding:10px; color:#666; font-size:0.8rem;">No Locations found.</div>';
        return;
    }

    filtered.forEach(loc => {
        const el = document.createElement('div');
        el.className = 'tool-item';
        el.draggable = true;
        let body = `${sanitizeText(loc.district || '')}`;
        if (loc.desc) body += `<br>${sanitizeMultiline(loc.desc)}`;
        if (loc.notes) body += `<br><strong>Note:</strong> ${sanitizeMultiline(loc.notes)}`;

        const nodeData = {
            title: loc.name || 'Location',
            body: body,
            meta: {
                sourceType: 'location',
                locationName: loc.name || 'Location',
                district: loc.district || ''
            }
        };
        el.ondragstart = (e) => startDragNew(e, 'location', nodeData);
        el.innerHTML = `<div class="icon">📍</div><div class="label">${sanitizeText(loc.name)}</div>`;
        listContainer.appendChild(el);
    });
}

function initEventToolbar() {
    const container = document.getElementById('event-popup');
    if (!container || !window.RTF_STORE) return;

    container.innerHTML = `
        <div class="filter-bar">
            <input type="text" id="event-search-board" class="filter-input" placeholder="Search events..." oninput="renderBoardEvents()">
            <select id="event-focus-board" class="filter-select" onchange="renderBoardEvents()">
                <option value="">All Focuses</option>
            </select>
        </div>
        <div id="event-list-content"></div>
    `;

    renderBoardEvents();
}

function renderBoardEvents() {
    const listContainer = document.getElementById('event-list-content');
    if (!listContainer || !window.RTF_STORE) return;

    const searchTerm = (document.getElementById('event-search-board').value || '').toLowerCase();
    const focusFilterEl = document.getElementById('event-focus-board');

    const events = (window.RTF_STORE.getEvents ? window.RTF_STORE.getEvents() : (window.RTF_STORE.state.campaign.events || [])).slice();
    const focuses = Array.from(new Set(events.map(e => e.focus).filter(Boolean))).sort();
    if (focusFilterEl) {
        const previouslySelected = focusFilterEl.value;
        focusFilterEl.innerHTML = '<option value="">All Focuses</option>' + focuses.map(f => `<option value="${sanitizeText(f)}">${sanitizeText(f)}</option>`).join('');
        if (focuses.includes(previouslySelected)) focusFilterEl.value = previouslySelected;
    }

    const filtered = events.filter(evt => {
        const text = `${evt.title || ''} ${evt.focus || ''} ${evt.highlights || ''} ${evt.fallout || ''} ${evt.followUp || ''}`.toLowerCase();
        const matchesSearch = text.includes(searchTerm);
        const focusMatch = focusFilterEl && focusFilterEl.value ? evt.focus === focusFilterEl.value : true;
        return matchesSearch && focusMatch;
    }).sort((a, b) => (b.created || '').localeCompare(a.created || ''));

    if (filtered.length === 0) {
        listContainer.innerHTML = '<div style="padding:10px; color:#666; font-size:0.8rem;">No events logged.</div>';
        return;
    }

    listContainer.innerHTML = '';
    filtered.forEach(evt => {
        const el = document.createElement('div');
        el.className = 'tool-item';
        el.draggable = true;
        const title = sanitizeText(evt.title || 'Event');
        const focus = sanitizeText(evt.focus || '');
        const heat = parseInt(evt.heatDelta, 10);
        const meta = focus ? focus : '';
        const heatBadge = !isNaN(heat) && heat !== 0 ? `<span style="color:${heat > 0 ? 'var(--danger)' : 'var(--accent)'}; font-size:0.75rem; margin-left:6px;">${heat > 0 ? '+' : ''}${heat} Heat</span>` : '';
        el.innerHTML = `<div class="icon">🕰️</div><div class="label">${title}${heatBadge}${meta ? `<div style="font-size:0.7rem; color:#aaa;">${meta}</div>` : ''}</div>`;

        const lines = [];
        if (evt.focus) lines.push(`<strong>Focus:</strong> ${sanitizeText(evt.focus)}`);
        if (!isNaN(heat) && heat !== 0) lines.push(`<strong>Heat:</strong> ${heat > 0 ? '+' : ''}${heat}`);
        if (evt.highlights) lines.push(`<strong>Beats:</strong><br>${sanitizeMultiline(evt.highlights)}`);
        if (evt.fallout) lines.push(`<strong>Fallout:</strong><br>${sanitizeMultiline(evt.fallout)}`);
        if (evt.followUp) lines.push(`<strong>Next:</strong> ${sanitizeMultiline(evt.followUp)}`);

        el.ondragstart = (e) => startDragNew(e, 'event', {
            title: evt.title || 'Event',
            body: lines.join('<br>'),
            meta: {
                sourceType: 'timeline-event',
                eventId: evt.id || '',
                heatDelta: !isNaN(heat) ? heat : '',
                focus: evt.focus || ''
            }
        });
        listContainer.appendChild(el);
    });
}

function initRequisitionToolbar() {
    const container = document.getElementById('req-popup');
    if (!container || !window.RTF_STORE) return;

    container.innerHTML = `
        <div class="filter-bar">
            <input type="text" id="req-search-board" class="filter-input" placeholder="Search requisitions..." oninput="renderBoardRequisitions()">
            <select id="req-status-board" class="filter-select" onchange="renderBoardRequisitions()">
                <option value="">All Statuses</option>
                ${REQUISITION_STATUSES.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
        </div>
        <div id="req-list-content"></div>
    `;

    renderBoardRequisitions();
}

function renderBoardRequisitions() {
    const listContainer = document.getElementById('req-list-content');
    if (!listContainer || !window.RTF_STORE) return;

    const searchTerm = (document.getElementById('req-search-board').value || '').toLowerCase();
    const statusFilter = document.getElementById('req-status-board').value;

    const requisitions = (window.RTF_STORE.getRequisitions ? window.RTF_STORE.getRequisitions() : (window.RTF_STORE.state.campaign.requisitions || [])).slice();
    const filtered = requisitions.filter(req => {
        const text = `${req.item || ''} ${req.requester || ''} ${req.purpose || ''} ${req.notes || ''}`.toLowerCase();
        const matchesSearch = text.includes(searchTerm);
        const matchesStatus = statusFilter ? req.status === statusFilter : true;
        return matchesSearch && matchesStatus;
    }).sort((a, b) => {
        const pDiff = (REQUISITION_PRIORITY_WEIGHT[a.priority || 'Routine'] || 0) - (REQUISITION_PRIORITY_WEIGHT[b.priority || 'Routine'] || 0);
        if (pDiff !== 0) return pDiff;
        return (a.created || '').localeCompare(b.created || '');
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '<div style="padding:10px; color:#666; font-size:0.8rem;">No requisitions logged.</div>';
        return;
    }

    listContainer.innerHTML = '';
    filtered.forEach(req => {
        const el = document.createElement('div');
        el.className = 'tool-item';
        el.draggable = true;
        const title = sanitizeText(req.item || 'Requisition');
        const sub = `${sanitizeText(req.requester || 'Unassigned')}${req.priority ? ' • ' + sanitizeText(req.priority) : ''}`;
        el.innerHTML = `<div class="icon">📦</div><div class="label">${title}<div style="font-size:0.7rem; color:#aaa;">${sub}</div></div>`;

        const lines = [];
        lines.push(`<strong>Agent:</strong> ${sanitizeText(req.requester || 'Unassigned')}`);
        if (req.status || req.priority) lines.push(`<strong>Status:</strong> ${sanitizeText(req.status || 'Pending')} (${sanitizeText(req.priority || 'Routine')})`);
        if (req.value) lines.push(`<strong>Value:</strong> ${sanitizeText(req.value)}`);
        if (req.purpose) lines.push(`<strong>Purpose:</strong> ${sanitizeMultiline(req.purpose)}`);
        if (req.notes) lines.push(`<strong>Notes:</strong> ${sanitizeMultiline(req.notes)}`);

        el.ondragstart = (e) => startDragNew(e, 'requisition', {
            title: req.item || 'Requisition',
            body: lines.join('<br>'),
            meta: {
                sourceType: 'requisition',
                requisitionId: req.id || '',
                status: req.status || 'Pending',
                priority: req.priority || 'Routine'
            }
        });
        listContainer.appendChild(el);
    });
}

// --- CORE LOOPS ---

function loop() {
    updatePhysics();
    drawLayer();
    requestAnimationFrame(loop);
}

function updatePhysics() {
    const len = connections.length;

    for (let cIdx = 0; cIdx < len; cIdx++) {
        const conn = connections[cIdx];
        const bufferIdx = connToIndex.get(conn.id);

        if (sleepState[bufferIdx] === 0) continue;

        const c1 = nodeCache.get(conn.from);
        const c2 = nodeCache.get(conn.to);
        if (!c1 || !c2) continue;

        const basePtr = bufferIdx * BYTES_PER_CONN;

        // 1. Pin Endpoints (auto edge anchors based on center-to-center line)
        const endpoints = getConnectionEndpointPositions(c1, c2);
        const p1 = endpoints.from;
        const p2 = endpoints.to;

        physicsBuffer[basePtr] = p1.x;
        physicsBuffer[basePtr + 1] = p1.y;

        const lastPtr = basePtr + (CONFIG.POINTS_COUNT - 1) * STRIDE;
        physicsBuffer[lastPtr] = p2.x;
        physicsBuffer[lastPtr + 1] = p2.y;

        // 2. Verlet Integration
        let totalMotion = 0;

        for (let i = 1; i < CONFIG.POINTS_COUNT - 1; i++) {
            const ptr = basePtr + i * STRIDE;
            const x = physicsBuffer[ptr];
            const y = physicsBuffer[ptr + 1];
            const ox = physicsBuffer[ptr + 2];
            const oy = physicsBuffer[ptr + 3];

            const vx = (x - ox) * 0.90;
            const vy = (y - oy) * 0.90;

            physicsBuffer[ptr + 2] = x;
            physicsBuffer[ptr + 3] = y;

            physicsBuffer[ptr] = x + vx;
            physicsBuffer[ptr + 1] = y + vy + CONFIG.GRAVITY;

            totalMotion += Math.abs(vx) + Math.abs(vy);
        }

        // 3. Constraints
        let maxStress = 0;
        const stepCount = len > 140 ? 1 : CONFIG.PHYSICS_STEPS;

        for (let step = 0; step < stepCount; step++) {
            for (let i = 0; i < CONFIG.POINTS_COUNT - 1; i++) {
                const ptrA = basePtr + i * STRIDE;
                const ptrB = basePtr + (i + 1) * STRIDE;

                const x1 = physicsBuffer[ptrA];
                const y1 = physicsBuffer[ptrA + 1];
                const x2 = physicsBuffer[ptrB];
                const y2 = physicsBuffer[ptrB + 1];

                const dx = x2 - x1;
                const dy = y2 - y1;
                const dist = Math.hypot(dx, dy);

                if (dist === 0) continue;

                const stress = Math.max(0, dist - CONFIG.SEGMENT_LENGTH);
                if (stress > maxStress) maxStress = stress;

                const diff = (dist - CONFIG.SEGMENT_LENGTH) / dist;
                const offsetX = dx * 0.5 * diff;
                const offsetY = dy * 0.5 * diff;

                if (i !== 0) {
                    physicsBuffer[ptrA] += offsetX;
                    physicsBuffer[ptrA + 1] += offsetY;
                }
                if ((i + 1) !== CONFIG.POINTS_COUNT - 1) {
                    physicsBuffer[ptrB] -= offsetX;
                    physicsBuffer[ptrB + 1] -= offsetY;
                }
            }
        }

        physicsBuffer[basePtr + 4] = maxStress;

        if (totalMotion < CONFIG.SLEEP_THRESHOLD) {
            sleepState[bufferIdx] = 0;
        }
    }
}

function drawLayer() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pad = 150;
    const viewL = -view.x / view.scale - pad;
    const viewT = -view.y / view.scale - pad;
    const viewR = (canvas.width - view.x) / view.scale + pad;
    const viewB = (canvas.height - view.y) / view.scale + pad;

    ctx.save();
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    if (isConnecting) {
        ctx.beginPath();
        const startNode = nodeCache.get(connectStart.id);
        const startPos = connectStart.port
            ? getPortPos(startNode, connectStart.port)
            : (startNode
                ? getRectEdgePointTowards(startNode, { x: connectStart.currentX, y: connectStart.currentY })
                : { x: connectStart.x || 0, y: connectStart.y || 0 });
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(connectStart.currentX, connectStart.currentY);
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const len = connections.length;
    const renderRopeDetail = len <= 140;

    // --- PASS 1: SHADOWS ---
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = CONFIG.SHADOW_THICKNESS;

    for (let i = 0; i < len; i++) {
        const conn = connections[i];
        if (focusMode && isBlurred(conn)) continue;

        const bIdx = connToIndex.get(conn.id);
        const base = bIdx * BYTES_PER_CONN;

        // Culling
        const p0x = physicsBuffer[base];
        const lastPtr = base + (CONFIG.POINTS_COUNT - 1) * STRIDE;
        const pNx = physicsBuffer[lastPtr];

        const minX = Math.min(p0x, pNx);
        const maxX = Math.max(p0x, pNx);
        if (maxX < viewL || minX > viewR) continue;
        const p0y = physicsBuffer[base + 1];
        const pNy = physicsBuffer[lastPtr + 1];
        const minY = Math.min(p0y, pNy);
        const maxY = Math.max(p0y, pNy);
        if (maxY < viewT || minY > viewB) continue;

        const off = 2;
        ctx.moveTo(p0x + off, p0y + off);
        for (let pt = 1; pt < CONFIG.POINTS_COUNT - 1; pt++) {
            const ptr = base + pt * STRIDE;
            const nextPtr = base + (pt + 1) * STRIDE;
            const x = physicsBuffer[ptr] + off;
            const y = physicsBuffer[ptr + 1] + off;
            const nx = physicsBuffer[nextPtr] + off;
            const ny = physicsBuffer[nextPtr + 1] + off;
            const xc = (x + nx) / 2;
            const yc = (y + ny) / 2;
            ctx.quadraticCurveTo(x, y, xc, yc);
        }
        ctx.lineTo(pNx + off, pNy + off);
    }
    ctx.stroke();

    // --- PASS 2: WIRES ---
    for (let i = 0; i < len; i++) {
        const conn = connections[i];

        let alpha = 1;
        if (focusMode && isBlurred(conn)) alpha = 0.1;
        ctx.globalAlpha = alpha;
        if (alpha < 0.05) continue;

        const bIdx = connToIndex.get(conn.id);
        const base = bIdx * BYTES_PER_CONN;
        const p0x = physicsBuffer[base];
        const lastPtr = base + (CONFIG.POINTS_COUNT - 1) * STRIDE;
        const pNx = physicsBuffer[lastPtr];

        if (Math.max(p0x, pNx) < viewL || Math.min(p0x, pNx) > viewR) continue;

        const stress = physicsBuffer[base + 4];
        const color = getConnectionColorConfig(conn).hex;
        ctx.strokeStyle = color;
        const ropeWidth = CONFIG.BASE_THICKNESS + Math.min(1.1, stress * 0.04);
        ctx.lineWidth = ropeWidth;
        ctx.shadowColor = hexToRgba(color, 0.45);
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.beginPath();
        ctx.moveTo(p0x, physicsBuffer[base + 1]);

        for (let pt = 1; pt < CONFIG.POINTS_COUNT - 1; pt++) {
            const ptr = base + pt * STRIDE;
            const nextPtr = base + (pt + 1) * STRIDE;
            const x = physicsBuffer[ptr];
            const y = physicsBuffer[ptr + 1];
            const nx = physicsBuffer[nextPtr];
            const ny = physicsBuffer[nextPtr + 1];
            const xc = (x + nx) / 2;
            const yc = (y + ny) / 2;
            ctx.quadraticCurveTo(x, y, xc, yc);
        }

        ctx.lineTo(pNx, physicsBuffer[lastPtr + 1]);
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (renderRopeDetail && alpha > 0.14) {
            // Cosmetic rope detail masks lower simulation point density.
            ctx.lineWidth = Math.max(1, ropeWidth * 0.4);
            ctx.strokeStyle = 'rgba(255,255,255,0.16)';
            ctx.stroke();

            ctx.lineWidth = Math.max(0.8, ropeWidth * 0.22);
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.stroke();
            ctx.setLineDash([]);
        }

        updateLabelPos(conn, base, alpha);
        if (conn.arrowLeft || conn.arrowRight) drawArrows(ctx, conn, base, color);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
}

function isBlurred(conn) {
    const n1 = document.getElementById(conn.from);
    const n2 = document.getElementById(conn.to);
    return (!n1 || !n2 || n1.classList.contains('blurred') || n2.classList.contains('blurred'));
}

function updateLabelPos(conn, basePtr, alpha) {
    const mid = Math.floor(CONFIG.POINTS_COUNT / 2);
    const ptr = basePtr + mid * STRIDE;
    const x = physicsBuffer[ptr];
    const y = physicsBuffer[ptr + 1];

    let el = document.getElementById('lbl_' + conn.id);
    const isEditing = el && el.querySelector('.label-input') === document.activeElement;
    const hasCustomColor = clampConnectionColorIndex(conn.colorIndex) !== 0;

    if ((conn.label || isEditing || hasCustomColor) && alpha > 0.1) {
        if (!el) el = createLabelDOM(conn);
        if (el) syncConnectionLabelColor(conn, el, el.querySelector('.wax-btn'));
        el.style.transform = `translate(${x}px, ${y}px)`;
        el.style.display = 'flex';
        el.style.opacity = alpha;
    } else if (el) {
        el.style.display = 'none';
    }
}

function drawArrows(ctx, conn, basePtr, color) {
    if (CONFIG.POINTS_COUNT < 3) return;

    const drawHead = (idx, rev) => {
        const pIdx = basePtr + idx * STRIDE;
        const prevIdx = basePtr + (idx - 1) * STRIDE;
        const nextIdx = basePtr + (idx + 1) * STRIDE;
        const px = physicsBuffer[pIdx];
        const py = physicsBuffer[pIdx + 1];

        const mx = physicsBuffer[nextIdx] - physicsBuffer[prevIdx];
        const my = physicsBuffer[nextIdx + 1] - physicsBuffer[prevIdx + 1];
        let angle = Math.atan2(my, mx);
        if (rev) angle += Math.PI;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-8, -5);
        ctx.lineTo(8, 0);
        ctx.lineTo(-8, 5);
        ctx.fillStyle = color || '#f1c40f';
        ctx.fill();
        ctx.restore();
    };

    const leftIdx = Math.max(1, Math.min(CONFIG.POINTS_COUNT - 2, Math.floor((CONFIG.POINTS_COUNT - 1) * 0.25)));
    const rightIdx = Math.max(1, Math.min(CONFIG.POINTS_COUNT - 2, Math.floor((CONFIG.POINTS_COUNT - 1) * 0.75)));

    if (conn.arrowLeft) drawHead(leftIdx, conn.arrowLeft === 1);
    if (conn.arrowRight) drawHead(rightIdx, conn.arrowRight === 1);
}

// --- DATA MANAGEMENT ---

function registerConnection(conn) {
    if (allocatedCount >= CONFIG.MAX_CONNECTIONS) return;

    let idx = allocatedCount++;
    connToIndex.set(conn.id, idx);
    sleepState[idx] = 1;

    const c1 = nodeCache.get(conn.from);
    const c2 = nodeCache.get(conn.to);

    if (c1 && c2) {
        const endpoints = getConnectionEndpointPositions(c1, c2);
        const p1 = endpoints.from;
        const p2 = endpoints.to;
        const base = idx * BYTES_PER_CONN;

        for (let i = 0; i < CONFIG.POINTS_COUNT; i++) {
            const t = i / (CONFIG.POINTS_COUNT - 1);
            const x = p1.x + (p2.x - p1.x) * t;
            const y = p1.y + (p2.y - p1.y) * t;

            const ptr = base + i * STRIDE;
            physicsBuffer[ptr] = x;
            physicsBuffer[ptr + 1] = y;
            physicsBuffer[ptr + 2] = x;
            physicsBuffer[ptr + 3] = y;
            physicsBuffer[ptr + 4] = 0;
        }
    }

    if (!nodeGraph.has(conn.from)) nodeGraph.set(conn.from, new Set());
    if (!nodeGraph.has(conn.to)) nodeGraph.set(conn.to, new Set());
    nodeGraph.get(conn.from).add(conn.id);
    nodeGraph.get(conn.to).add(conn.id);
}

function wakeConnected(nodeId) {
    const set = nodeGraph.get(nodeId);
    if (set) {
        set.forEach(connId => {
            const idx = connToIndex.get(connId);
            if (idx !== undefined) sleepState[idx] = 1;
        });
    }
}

// --- DOM & INTERACTION ---

function getPortPos(nodeData, port) {
    if (!nodeData) return { x: 0, y: 0 };
    const { x, y, w, h } = nodeData;
    if (port === 'top') return { x: x + w / 2, y: y };
    if (port === 'bottom') return { x: x + w / 2, y: y + h };
    if (port === 'left') return { x: x, y: y + h / 2 };
    if (port === 'right') return { x: x + w, y: y + h / 2 };
    return { x: x + w / 2, y: y + h / 2 };
}

function getRectEdgePointTowards(nodeData, targetPoint) {
    if (!nodeData) {
        return {
            x: targetPoint && Number.isFinite(targetPoint.x) ? targetPoint.x : 0,
            y: targetPoint && Number.isFinite(targetPoint.y) ? targetPoint.y : 0
        };
    }
    const { x, y, w, h } = nodeData;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const hw = w / 2;
    const hh = h / 2;

    const dx = (targetPoint.x - cx);
    const dy = (targetPoint.y - cy);

    if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) {
        return { x: cx + hw, y: cy };
    }

    if (Math.abs(dx) < 0.0001) {
        return { x: cx, y: cy + (dy > 0 ? hh : -hh) };
    }

    if (Math.abs(dy) < 0.0001) {
        return { x: cx + (dx > 0 ? hw : -hw), y: cy };
    }

    const tx = hw / Math.abs(dx);
    const ty = hh / Math.abs(dy);
    const t = Math.min(tx, ty);

    return {
        x: cx + dx * t,
        y: cy + dy * t
    };
}

function getConnectionEndpointPositions(nodeFrom, nodeTo) {
    if (!nodeFrom || !nodeTo) {
        return { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } };
    }
    const fromCenter = { x: nodeFrom.x + nodeFrom.w / 2, y: nodeFrom.y + nodeFrom.h / 2 };
    const toCenter = { x: nodeTo.x + nodeTo.w / 2, y: nodeTo.y + nodeTo.h / 2 };
    return {
        from: getRectEdgePointTowards(nodeFrom, toCenter),
        to: getRectEdgePointTowards(nodeTo, fromCenter)
    };
}

function updateNodeCache(id) {
    const el = document.getElementById(id);
    if (el) {
        const data = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
        nodeCache.set(id, data);
        wakeConnected(id);
    } else {
        nodeCache.delete(id);
    }
}

function startDragNode(e, el) {
    if (el.classList.contains('editing') || e.button !== 0) return;
    draggedNode = el;

    const worldPos = screenToWorld(e.clientX, e.clientY);
    dragStart.x = worldPos.x;
    dragStart.y = worldPos.y;
    dragStart.nodeX = el.offsetLeft;
    dragStart.nodeY = el.offsetTop;

    updateNodeCache(el.id);
    el.style.willChange = 'transform';
    el.style.pointerEvents = 'none';
}

document.addEventListener('mousemove', (e) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);

    if (draggedNode) {
        const dx = worldPos.x - dragStart.x;
        const dy = worldPos.y - dragStart.y;
        draggedNode.style.transform = `translate(${dx}px, ${dy}px)`;

        const newX = dragStart.nodeX + dx;
        const newY = dragStart.nodeY + dy;
        const cache = nodeCache.get(draggedNode.id);
        if (cache) { cache.x = newX; cache.y = newY; }
        wakeConnected(draggedNode.id);
    }

    if (isConnecting) {
        connectStart.currentX = worldPos.x;
        connectStart.currentY = worldPos.y;
    }

    if (isPanning) {
        view.x += e.clientX - panStart.x;
        view.y += e.clientY - panStart.y;
        panStart = { x: e.clientX, y: e.clientY };
        updateViewCSS();
    }
});

document.addEventListener('mouseup', (e) => {
    if (draggedNode) {
        const worldPos = screenToWorld(e.clientX, e.clientY);
        const dx = worldPos.x - dragStart.x;
        const dy = worldPos.y - dragStart.y;

        const finalX = dragStart.nodeX + dx;
        const finalY = dragStart.nodeY + dy;

        const sourceNode = draggedNode;
        const sourceNodeId = sourceNode.id;
        sourceNode.style.pointerEvents = '';
        const dropNode = (e.target && typeof e.target.closest === 'function') ? e.target.closest('.node') : null;
        const draggedDistance = Math.hypot(dx, dy);
        const canCreateConnection = draggedDistance > 8 &&
            dropNode &&
            dropNode.id !== sourceNodeId &&
            !e.altKey;

        if (canCreateConnection) {
            sourceNode.style.left = dragStart.nodeX + 'px';
            sourceNode.style.top = dragStart.nodeY + 'px';
            sourceNode.style.transform = 'none';
            sourceNode.style.willChange = 'auto';
            updateNodeCache(sourceNodeId);
            createConnectionBetweenNodes(sourceNodeId, dropNode.id);
        } else {
            sourceNode.style.left = finalX + 'px';
            sourceNode.style.top = finalY + 'px';
            sourceNode.style.transform = 'none';
            sourceNode.style.willChange = 'auto';
            updateNodeCache(sourceNodeId);
            saveBoard();
        }

        draggedNode = null;
    }
    if (isConnecting) {
        if (e.target && typeof e.target.closest === 'function') {
            const node = e.target.closest('.node');
            if (node) {
                const port = e.target.classList.contains('port') ? e.target.dataset.port : null;
                completeConnection(node, port);
            }
        }
        isConnecting = false;
    }
    if (isPanning) {
        isPanning = false;
        document.body.style.cursor = panMode ? "grab" : "default";
    }
});

function createNodeMarkup(type, content = {}) {
    const title = sanitizeText(content.title || type.toUpperCase());
    const bodyHtml = sanitizeRichText(content.body || '');
    const icon = NODE_TYPE_ICONS[type] || '❓';
    const withTitle = `<div class="node-title">${title}</div>`;

    if (type === 'person') {
        return `
            <div class="node-bust-media node-media-shell" data-image-slot="portrait">
                <div class="node-media-fallback">${icon}</div>
            </div>
            <div class="node-bust-base">
                ${withTitle}
                <div class="node-body">${bodyHtml}</div>
            </div>
        `;
    }

    if (type === 'location') {
        return `
            <div class="node-postcard-photo node-media-shell" data-image-slot="photo">
                <div class="node-media-fallback">${icon}</div>
                <div class="node-title-strip">${withTitle}</div>
            </div>
            <div class="node-body">${bodyHtml}</div>
        `;
    }

    if (type === 'clue') {
        return `
            <div class="node-evidence-stage">
                <div class="node-clue-media node-media-shell node-media-contain" data-image-slot="evidence">
                    <div class="node-media-fallback">${icon}</div>
                </div>
                <div class="evidence-tag">${withTitle}</div>
            </div>
            <div class="node-body">${bodyHtml}</div>
        `;
    }

    if (type === 'note') {
        return `
            <div class="sticky-sheet">
                ${withTitle}
                <div class="node-body">${bodyHtml}</div>
            </div>
        `;
    }

    if (type === 'event') {
        return `
            <div class="node-timestamp-header">
                <div class="timestamp-caption">TIMESTAMP</div>
                ${withTitle}
            </div>
            <div class="node-body">${bodyHtml}</div>
        `;
    }

    if (type === 'requisition') {
        return `
            <div class="invoice-watermark" aria-hidden="true">[CONFIDENTIAL]</div>
            ${withTitle}
            <div class="node-body">${bodyHtml}</div>
        `;
    }

    return `
        <div class="node-header">
            ${withTitle}
            <div class="node-icon">${icon}</div>
        </div>
        <div class="node-body">${bodyHtml}</div>
    `;
}

function applyNodeImage(nodeEl, imageUrl = '') {
    if (!nodeEl) return;
    const clean = sanitizeImageUrl(imageUrl);
    const slots = nodeEl.querySelectorAll('[data-image-slot]');
    if (!slots.length) return;

    slots.forEach((slot) => {
        if (clean) {
            slot.classList.add('has-image');
            slot.style.backgroundImage = `url("${clean}")`;
        } else {
            slot.classList.remove('has-image');
            slot.style.removeProperty('background-image');
        }
    });
}

function updateNodeImageMeta(nodeEl, imageUrl = '') {
    if (!nodeEl) return;
    const existing = getNodeMeta(nodeEl) || {};
    const clean = sanitizeImageUrl(imageUrl);
    if (clean) {
        existing.imageUrl = clean;
    } else {
        delete existing.imageUrl;
    }
    setNodeMeta(nodeEl, existing);
    applyNodeImage(nodeEl, clean);
}

function createNode(type, x, y, id = null, content = {}) {
    const nodeId = id || 'node_' + Date.now();
    let safeMeta = sanitizeNodeMeta(content.meta);
    const requestedImageUrl = sanitizeImageUrl(content.imageUrl || (safeMeta && safeMeta.imageUrl) || '');
    if (requestedImageUrl) {
        safeMeta = { ...(safeMeta || {}), imageUrl: requestedImageUrl };
    } else if (safeMeta && Object.prototype.hasOwnProperty.call(safeMeta, 'imageUrl')) {
        delete safeMeta.imageUrl;
        if (!Object.keys(safeMeta).length) safeMeta = null;
    }

    const nodeEl = document.createElement('div');
    nodeEl.className = `node type-${type}`;
    nodeEl.id = nodeId;
    nodeEl.style.left = (x - 75) + 'px';
    nodeEl.style.top = (y - 40) + 'px';

    nodeEl.innerHTML = `
        <div class="port top" data-port="top"></div><div class="port bottom" data-port="bottom"></div>
        <div class="port left" data-port="left"></div><div class="port right" data-port="right"></div>
        ${createNodeMarkup(type, content)}
    `;

    nodeEl.onmousedown = (e) => {
        if (e.target.classList.contains('port')) return;
        if (!panMode) startDragNode(e, nodeEl);
    };
    nodeEl.oncontextmenu = (e) => showContextMenu(e, nodeEl);
    nodeEl.querySelectorAll('.port').forEach(p =>
        p.onmousedown = (e) => startConnectionDrag(e, nodeEl, p.dataset.port)
    );

    container.appendChild(nodeEl);
    setNodeMeta(nodeEl, safeMeta);
    applyNodeImage(nodeEl, requestedImageUrl);
    updateNodeCache(nodeId);

    // Ensure node is tracked in global state (both for new and loaded nodes)
    nodes.push({
        id: nodeId,
        type,
        x: x - 75,
        y: y - 40,
        title: content.title || type.toUpperCase(),
        meta: safeMeta
    });

    return nodeEl;
}

function startConnectionDrag(e, node, port) {
    e.stopPropagation();
    e.preventDefault();
    isConnecting = true;
    const wp = screenToWorld(e.clientX, e.clientY);
    connectStart = { id: node.id, port, x: wp.x, y: wp.y, currentX: wp.x, currentY: wp.y };
}

function completeConnection(targetNode, targetPort) {
    if (!targetNode || !connectStart || !connectStart.id) return;
    createConnectionBetweenNodes(connectStart.id, targetNode.id, connectStart.port, targetPort);
}

function syncConnectionLabelColor(conn, labelEl, waxBtn = null) {
    const color = getConnectionColorConfig(conn);
    if (labelEl) {
        labelEl.style.setProperty('--string-color', color.hex);
        labelEl.style.setProperty('--string-glow', hexToRgba(color.hex, 0.45));
    }
    if (waxBtn) {
        waxBtn.style.background = color.hex;
        waxBtn.title = `Wax Seal: ${color.name}`;
    }
}

function createLabelDOM(conn) {
    conn.colorIndex = clampConnectionColorIndex(conn.colorIndex);

    const el = document.createElement('div');
    el.id = 'lbl_' + conn.id;
    el.className = 'string-label';
    el.style.position = 'absolute';
    el.style.left = '0'; el.style.top = '0';

    const btnL = document.createElement('div');
    btnL.className = `arrow-btn ${conn.arrowLeft ? 'active' : ''}`;
    btnL.innerText = { 0: '—', 1: '◀', 2: '▶' }[conn.arrowLeft || 0];
    btnL.onclick = (e) => {
        e.stopPropagation();
        conn.arrowLeft = ((conn.arrowLeft || 0) + 1) % 3;
        btnL.innerText = { 0: '—', 1: '◀', 2: '▶' }[conn.arrowLeft || 0];
        btnL.classList.toggle('active', !!conn.arrowLeft);
        saveBoard();
    };

    const waxBtn = document.createElement('button');
    waxBtn.type = 'button';
    waxBtn.className = 'wax-btn';
    waxBtn.innerText = '◉';
    waxBtn.onmousedown = (e) => e.stopPropagation();
    waxBtn.onclick = (e) => {
        e.stopPropagation();
        conn.colorIndex = (clampConnectionColorIndex(conn.colorIndex) + 1) % CONNECTION_COLOR_PALETTE.length;
        syncConnectionLabelColor(conn, el, waxBtn);
        saveBoard();
    };

    const input = document.createElement('div');
    input.className = 'label-input';
    input.contentEditable = true;
    input.innerText = conn.label || "";
    input.oninput = (e) => {
        const previousLabel = (conn.label || '').trim();
        const nextLabel = (e.target.innerText || '').trim();
        conn.label = e.target.innerText;

        if (!conn.relationshipLogged && !previousLabel && nextLabel) {
            conn.relationshipLogged = true;
            const fromSummary = getNodeSummary(conn.from);
            const toSummary = getNodeSummary(conn.to);
            const fromTitle = fromSummary ? fromSummary.title : 'Unknown';
            const toTitle = toSummary ? toSummary.title : 'Unknown';
            logBoardTimeline({
                title: 'Case Relationship Named',
                kind: 'relationship-named',
                tags: ['relationship', 'connection'],
                highlights: `${fromTitle} ↔ ${toTitle}: ${nextLabel}`
            }, { dedupeKey: `board:relationship:${conn.id}` });
        }

        saveBoard();
    };
    input.onmousedown = (e) => e.stopPropagation();

    const btnR = document.createElement('div');
    btnR.className = `arrow-btn ${conn.arrowRight ? 'active' : ''}`;
    btnR.innerText = { 0: '—', 1: '◀', 2: '▶' }[conn.arrowRight || 0];
    btnR.onclick = (e) => {
        e.stopPropagation();
        conn.arrowRight = ((conn.arrowRight || 0) + 1) % 3;
        btnR.innerText = { 0: '—', 1: '◀', 2: '▶' }[conn.arrowRight || 0];
        btnR.classList.toggle('active', !!conn.arrowRight);
        saveBoard();
    };

    syncConnectionLabelColor(conn, el, waxBtn);
    const controls = document.createElement('div');
    controls.className = 'string-controls';
    controls.append(btnL, waxBtn, btnR);
    el.append(controls, input);
    labelContainer.appendChild(el);
    return el;
}

function screenToWorld(x, y) {
    return { x: (x - view.x) / view.scale, y: (y - view.y) / view.scale };
}

function updateViewCSS() {
    const t = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    container.style.transform = t;
    labelContainer.style.transform = t;
}

function togglePanMode() {
    panMode = !panMode;
    const btn = document.getElementById('btn-pan');
    if (btn) {
        btn.innerText = panMode ? "🖐️ Pan: ON" : "🖐️ Pan: OFF";
        btn.style.background = panMode ? "var(--gold)" : "";
        btn.style.color = panMode ? "#000" : "";
        document.body.style.cursor = panMode ? "grab" : "default";
    }
}

document.addEventListener('wheel', (e) => {
    if (e.target.closest('.toolbar-scroll-wrapper') || e.target.closest('.popup-menu')) return;
    e.preventDefault();
    const d = e.deltaY > 0 ? -1 : 1;
    const f = d * 0.1;
    const mx = e.clientX, my = e.clientY;
    const wx = (mx - view.x) / view.scale;
    const wy = (my - view.y) / view.scale;

    view.scale = Math.max(CONFIG.VIEW_SCALE_MIN, Math.min(view.scale + f, CONFIG.VIEW_SCALE_MAX));
    view.x = mx - wx * view.scale;
    view.y = my - wy * view.scale;
    updateViewCSS();
}, { passive: false });

document.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (panMode && e.button === 0 && !e.target.closest('.node'))) {
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
        document.body.style.cursor = "grabbing";
        e.preventDefault();
    }
});

function saveBoard() {
    const caseNameEl = document.getElementById('caseName');
    const caseName = normalizeCaseName(caseNameEl ? caseNameEl.innerText : 'UNNAMED CASE');
    if (caseNameEl && caseNameEl.innerText !== caseName) caseNameEl.innerText = caseName;

    if (!isHydratingBoard && lastSavedCaseName && caseName !== lastSavedCaseName) {
        logBoardTimeline({
            title: 'Case File Renamed',
            kind: 'case-rename',
            tags: ['case-name'],
            highlights: `"${lastSavedCaseName}" renamed to "${caseName}".`
        }, { dedupeKey: `board:case-rename:${lastSavedCaseName}->${caseName}` });
    }
    lastSavedCaseName = caseName;

    const nodeData = Array.from(document.querySelectorAll('.node')).map(el => {
        const nodeType = getNodeTypeFromEl(el);
        return {
            id: el.id,
            type: nodeType,
            x: parseInt(el.style.left, 10),
            y: parseInt(el.style.top, 10),
            title: el.querySelector('.node-title').innerText,
            body: el.querySelector('.node-body').innerHTML,
            meta: getNodeMeta(el)
        };
    });

    const data = {
        name: caseName,
        nodes: nodeData,
        connections: connections.map(c => ({
            id: c.id, from: c.from, to: c.to, fromPort: c.fromPort, toPort: c.toPort,
            label: c.label, arrowLeft: c.arrowLeft, arrowRight: c.arrowRight,
            relationshipLogged: !!c.relationshipLogged,
            colorIndex: clampConnectionColorIndex(c.colorIndex)
        }))
    };
    if (!writeStoreBoardPayload(data)) {
        localStorage.setItem(LEGACY_BOARD_KEY, JSON.stringify(sanitizeBoardPayload(data)));
    }
}

function loadBoard(options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const data = getPreferredBoardPayload();
    if (!data) return;
    const caseName = normalizeCaseName(data.name || 'UNNAMED CASE');
    document.getElementById('caseName').innerText = caseName;
    lastSavedCaseName = caseName;

    container.innerHTML = '';
    labelContainer.innerHTML = '';
    nodeCache.clear();
    nodeGraph.clear();
    connToIndex.clear();
    allocatedCount = 0;
    nodes = [];
    connections = [];
    if (!opts.preserveOptimizeSnapshot) {
        lastOptimizeSnapshot = null;
        updateUndoOptimizeMenuState();
    }

    isHydratingBoard = true;
    try {
        (data.nodes || []).forEach(n => {
            createNode(n.type, n.x + 75, n.y + 40, n.id, { title: n.title, body: n.body, meta: n.meta });
        });
    } finally {
        isHydratingBoard = false;
    }

    (data.connections || []).forEach(c => {
        if (!c.id) c.id = 'conn_' + Date.now() + Math.random();
        const hydrated = {
            ...c,
            fromPort: c.fromPort || 'auto',
            toPort: c.toPort || 'auto',
            relationshipLogged: !!c.relationshipLogged,
            colorIndex: clampConnectionColorIndex(c.colorIndex)
        };
        connections.push(hydrated);
        registerConnection(hydrated);
    });
}

function clearBoard() {
    if (confirm("Clear board?")) {
        lastOptimizeSnapshot = null;
        updateUndoOptimizeMenuState();
        if (window.RTF_STORE && typeof window.RTF_STORE.clearBoard === 'function') {
            window.RTF_STORE.clearBoard();
        } else if (!writeStoreBoardPayload({ name: "UNNAMED CASE", nodes: [], connections: [] })) {
            localStorage.removeItem(LEGACY_BOARD_KEY);
        }
        localStorage.removeItem(LEGACY_BOARD_KEY);
        location.reload();
    }
}

function showContextMenu(e, node) {
    e.preventDefault();
    contextMenu.style.display = 'block';
    contextMenu.style.left = e.clientX + 'px';
    contextMenu.style.top = e.clientY + 'px';
    contextMenu.dataset.target = node.id;

    const setImageItem = document.getElementById('menu-set-image');
    if (setImageItem) {
        const type = getNodeTypeFromEl(node);
        setImageItem.style.display = IMAGE_EDITABLE_NODE_TYPES.has(type) ? 'block' : 'none';
    }
    updateUndoOptimizeMenuState();
}

function updateUndoOptimizeMenuState() {
    const undoItem = document.getElementById('menu-undo-optimize');
    if (!undoItem) return;
    const enabled = !!lastOptimizeSnapshot;
    undoItem.classList.toggle('disabled', !enabled);
    undoItem.title = enabled
        ? 'Restore layout from before the most recent optimize.'
        : 'No optimize snapshot available yet.';
}
window.onclick = (e) => {
    if (!e.target.closest('.context-menu')) contextMenu.style.display = 'none';
    if (!e.target.closest('.popup-menu') && !e.target.closest('.tool-item')) closePopups();
};

// Explicitly expose to window to avoid scope issues
window.togglePopup = function (id) {
    const el = document.getElementById(id);
    if (!el) return;

    // Close others
    document.querySelectorAll('.popup-menu').forEach(p => {
        if (p.id !== id) p.classList.remove('active');
    });

    el.classList.toggle('active');
};

function closePopups() {
    document.querySelectorAll('.popup-menu').forEach(p => p.classList.remove('active'));
}

function setTargetNodeImageUrl() {
    const id = contextMenu.dataset.target;
    const el = id ? document.getElementById(id) : null;
    if (!el) {
        contextMenu.style.display = 'none';
        return;
    }
    const type = getNodeTypeFromEl(el);
    if (!IMAGE_EDITABLE_NODE_TYPES.has(type)) {
        contextMenu.style.display = 'none';
        return;
    }

    const meta = getNodeMeta(el) || {};
    const current = typeof meta.imageUrl === 'string' ? meta.imageUrl : '';
    const imageLabel = type === 'person' ? 'portrait' : (type === 'location' ? 'location image' : 'clue image');
    const nextRaw = prompt(`Set ${imageLabel} URL (blank clears image):`, current);
    if (nextRaw === null) {
        contextMenu.style.display = 'none';
        return;
    }

    const trimmed = String(nextRaw).trim();
    if (trimmed && !sanitizeImageUrl(trimmed)) {
        alert('Please provide a valid image URL.');
        return;
    }

    updateNodeImageMeta(el, trimmed);
    updateNodeCache(el.id);
    saveBoard();
    contextMenu.style.display = 'none';
}

function editTargetNode() {
    const el = document.getElementById(contextMenu.dataset.target);
    if (!el) return;
    el.classList.add('editing');
    const t = el.querySelector('.node-title');
    const b = el.querySelector('.node-body');
    t.contentEditable = b.contentEditable = true;
    t.focus();

    // Show Formatting Toolbar
    const tb = document.getElementById('formatting-toolbar');
    if (tb) {
        tb.style.display = 'flex';
        // Position to the right of the node
        const rect = el.getBoundingClientRect();
        tb.style.left = (rect.right + 10) + 'px';
        tb.style.top = rect.top + 'px';
    }

    const handleKey = (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b': e.preventDefault(); document.execCommand('bold'); saveBoard(); break;
                case 'i': e.preventDefault(); document.execCommand('italic'); saveBoard(); break;
                case 'u': e.preventDefault(); document.execCommand('underline'); saveBoard(); break;
            }
        }
    };

    t.addEventListener('keydown', handleKey);
    b.addEventListener('keydown', handleKey);

    const end = () => {
        // slight delay to allow button clicks to register before blur hides everything
        setTimeout(() => {
            if (document.activeElement !== t && document.activeElement !== b) {
                t.contentEditable = b.contentEditable = false;
                el.classList.remove('editing');

                t.removeEventListener('keydown', handleKey);
                b.removeEventListener('keydown', handleKey);

                if (tb) tb.style.display = 'none';

                updateNodeCache(el.id);
                saveBoard();
            }
        }, 50);
    };

    t.onblur = end;
    b.onblur = end;

    contextMenu.style.display = 'none';
}

function deleteTargetNode() {
    const id = contextMenu.dataset.target;
    if (!id) return;
    const summary = getNodeSummary(id);
    const linksBeforeDelete = getNodeLinkCount(id);
    if (summary && linksBeforeDelete > 0) {
        const plural = linksBeforeDelete === 1 ? '' : 's';
        logBoardTimeline({
            title: `${getNodeTypeLabel(summary.type)} Thread Removed`,
            kind: 'node-removed',
            tags: ['node-remove', summary.type],
            highlights: `${summary.title} removed from active case map (${linksBeforeDelete} link${plural}).`
        }, { dedupeKey: `board:remove:${id}` });
    }

    const el = document.getElementById(id);
    if (el) el.remove();

    connections = connections.filter(c => {
        if (c.from === id || c.to === id) {
            const lbl = document.getElementById('lbl_' + c.id);
            if (lbl) lbl.remove();
            return false;
        }
        return true;
    });
    saveBoard();
    loadBoard();
    contextMenu.style.display = 'none';
}

function centerAndOptimize() {
    const id = contextMenu.dataset.target;
    if (!id) return;
    lastOptimizeSnapshot = captureLayoutSnapshot();
    updateUndoOptimizeMenuState();
    optimizeLayout(id);
    contextMenu.style.display = 'none';
}

function undoLastOptimize() {
    if (!lastOptimizeSnapshot) {
        contextMenu.style.display = 'none';
        return;
    }

    const snapshot = lastOptimizeSnapshot;
    lastOptimizeSnapshot = null;
    updateUndoOptimizeMenuState();
    applyLayoutSnapshot(snapshot);
    contextMenu.style.display = 'none';
}

function captureLayoutSnapshot() {
    const nodePositions = Array.from(document.querySelectorAll('.node')).map((el) => ({
        id: el.id,
        x: Number.isFinite(parseInt(el.style.left, 10)) ? parseInt(el.style.left, 10) : el.offsetLeft,
        y: Number.isFinite(parseInt(el.style.top, 10)) ? parseInt(el.style.top, 10) : el.offsetTop
    }));

    return {
        nodePositions,
        view: {
            x: view.x,
            y: view.y,
            scale: view.scale
        }
    };
}

function resetConnectionPhysicsFromNodeCache() {
    connections.forEach((conn) => {
        const n1 = nodeCache.get(conn.from);
        const n2 = nodeCache.get(conn.to);
        if (!n1 || !n2) return;

        const idx = connToIndex.get(conn.id);
        if (idx === undefined) return;

        sleepState[idx] = 1;
        const endpoints = getConnectionEndpointPositions(n1, n2);
        const p1 = endpoints.from;
        const p2 = endpoints.to;
        const base = idx * BYTES_PER_CONN;

        for (let i = 0; i < CONFIG.POINTS_COUNT; i++) {
            const t = i / (CONFIG.POINTS_COUNT - 1);
            const px = p1.x + (p2.x - p1.x) * t;
            const py = p1.y + (p2.y - p1.y) * t;
            const ptr = base + i * STRIDE;
            physicsBuffer[ptr] = px;
            physicsBuffer[ptr + 1] = py;
            physicsBuffer[ptr + 2] = px;
            physicsBuffer[ptr + 3] = py;
            physicsBuffer[ptr + 4] = 0;
        }
    });
}

function applyLayoutSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.nodePositions)) return;

    const byId = new Map(snapshot.nodePositions.map((entry) => [entry.id, entry]));
    byId.forEach((entry, id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.left = `${entry.x}px`;
        el.style.top = `${entry.y}px`;
        updateNodeCache(id);
    });

    const snapView = snapshot.view || {};
    if (Number.isFinite(snapView.scale)) {
        view.scale = Math.max(CONFIG.VIEW_SCALE_MIN, Math.min(snapView.scale, CONFIG.VIEW_SCALE_MAX));
    }
    if (Number.isFinite(snapView.x)) view.x = snapView.x;
    if (Number.isFinite(snapView.y)) view.y = snapView.y;
    updateViewCSS();

    resetConnectionPhysicsFromNodeCache();
    saveBoard();
}

function optimizeLayout(centerId) {
    if (!centerId) { console.error("optimizeLayout: No Center ID"); return; }

    // SYNC STATE: Ensure memory matches DOM before calculating
    saveBoard();
    loadBoard({ preserveOptimizeSnapshot: true });

    const centerNode = nodes.find(n => n.id === centerId);
    if (!centerNode) { console.error("optimizeLayout: Node not found", centerId); return; }

    // 1. Identification: Split nodes into connected components (clusters)
    const clusters = getConnectedComponents(nodes, connections);

    // 2. Find the Main Cluster (containing centerId)
    let mainClusterIndex = clusters.findIndex(c => c.some(n => n.id === centerId));
    if (mainClusterIndex === -1) mainClusterIndex = 0; // Should not happen if centerId is valid

    const mainCluster = clusters[mainClusterIndex];
    const otherClusters = clusters.filter((_, i) => i !== mainClusterIndex);

    // 3. Layout Main Cluster (Center it at original position)
    const originX = centerNode.x;
    const originY = centerNode.y;

    // Layout internally relative to (0,0)
    const mainLayout = layoutCluster(mainCluster, centerId);

    // Shift Main Cluster to Origin
    const finalPositions = new Map();
    mainLayout.forEach((pos, id) => {
        finalPositions.set(id, { x: pos.x + originX, y: pos.y + originY });
    });

    // 4. Place Other Clusters
    // We'll place them in a spiral around the main cluster
    const placedRects = [];
    // Add Main Cluster Rect
    placedRects.push(getRect(finalPositions));

    otherClusters.forEach(cluster => {
        // Pick a "root" for this cluster (e.g., node with most connections, or just first)
        // For simplicity, first one.
        const root = cluster[0];
        const layout = layoutCluster(cluster, root.id);

        // Calculate its local bounding box to know its size
        const localRect = getRect(layout); // Relative to its own 0,0
        const items = cluster.length;

        // Find a spot
        // Spiral search from Main Center
        const spot = findEmptySpot(localRect, placedRects, originX, originY);

        // Apply offset
        layout.forEach((pos, id) => {
            finalPositions.set(id, { x: pos.x + spot.x, y: pos.y + spot.y });
        });

        // Add new rect to obstacles
        const newRect = {
            left: localRect.left + spot.x,
            right: localRect.right + spot.x,
            top: localRect.top + spot.y,
            bottom: localRect.bottom + spot.y
        };
        placedRects.push(newRect);
    });

    // 5. Apply Positions & View
    view.x = window.innerWidth / 2 - originX * view.scale;
    view.y = window.innerHeight / 2 - originY * view.scale;
    updateViewCSS();

    finalPositions.forEach((pos, id) => {
        const el = document.getElementById(id);
        if (el) {
            el.style.left = pos.x + 'px';
            el.style.top = pos.y + 'px';
            updateNodeCache(id);
        }
    });

    saveBoard();

    // 6. Physics Reset for new edge-anchored rope endpoints
    resetConnectionPhysicsFromNodeCache();
}

// --- LAYOUT HELPERS ---

function getConnectedComponents(allNodes, allConns) {
    const visited = new Set();
    const clusters = [];

    // Build Adjacency
    const adj = new Map();
    allNodes.forEach(n => adj.set(n.id, []));
    allConns.forEach(c => {
        if (adj.has(c.from)) adj.get(c.from).push(c.to);
        if (adj.has(c.to)) adj.get(c.to).push(c.from);
    });

    allNodes.forEach(node => {
        if (visited.has(node.id)) return;

        const cluster = [];
        const queue = [node.id];
        visited.add(node.id);

        while (queue.length > 0) {
            const currId = queue.shift();
            const n = allNodes.find(x => x.id === currId);
            if (n) cluster.push(n);

            const neighbors = adj.get(currId) || [];
            neighbors.forEach(nid => {
                if (!visited.has(nid)) {
                    visited.add(nid);
                    queue.push(nid);
                }
            });
        }
        clusters.push(cluster);
    });
    return clusters;
}

function layoutCluster(clusterNodes, rootId) {
    const positions = new Map();
    if (clusterNodes.length === 0) return positions;

    // If root not in cluster (shouldn't happen if logic correct), pick first
    if (!clusterNodes.some(n => n.id === rootId)) rootId = clusterNodes[0].id;

    // BFS Layers
    const layers = new Map();
    const visited = new Set();
    const queue = [{ id: rootId, dist: 0 }];
    visited.add(rootId);
    layers.set(rootId, 0);

    // Local Adjacency for this cluster
    const adj = new Map();
    clusterNodes.forEach(n => adj.set(n.id, []));
    connections.forEach(c => {
        if (adj.has(c.from) && adj.has(c.to)) {
            adj.get(c.from).push(c.to);
            adj.get(c.to).push(c.from);
        }
    });

    while (queue.length > 0) {
        const curr = queue.shift();
        const neighbors = adj.get(curr.id) || [];
        neighbors.forEach(nid => {
            if (!visited.has(nid)) {
                visited.add(nid);
                layers.set(nid, curr.dist + 1);
                queue.push({ id: nid, dist: curr.dist + 1 });
            }
        });
    }

    // Grid/Ring Layout
    const SPACING_X = 350; // Increased spacing for lines
    const SPACING_Y = 250;

    // Helper to get rect for a potential position
    const getRectForNode = (id, x, y) => {
        const cache = nodeCache.get(id);
        const w = cache ? cache.w : 200;
        const h = cache ? cache.h : 120;
        // Pad strictly for safety
        const PAD = 20;
        return {
            left: x - PAD,
            top: y - PAD,
            right: x + w + PAD,
            bottom: y + h + PAD
        };
    };

    const isOverlapping = (r1, r2) => {
        return !(r1.left > r2.right ||
            r1.right < r2.left ||
            r1.top > r2.bottom ||
            r1.bottom < r2.top);
    };

    // Helper: Line Intersects Rect
    const lineIntersectsRect = (p1, p2, r) => {
        // Quick bounding box check
        const lineMinX = Math.min(p1.x, p2.x), lineMaxX = Math.max(p1.x, p2.x);
        const lineMinY = Math.min(p1.y, p2.y), lineMaxY = Math.max(p1.y, p2.y);
        if (lineMaxX < r.left || lineMinX > r.right || lineMaxY < r.top || lineMinY > r.bottom) return false;

        // Check if point inside
        if ((p1.x > r.left && p1.x < r.right && p1.y > r.top && p1.y < r.bottom) ||
            (p2.x > r.left && p2.x < r.right && p2.y > r.top && p2.y < r.bottom)) return true;

        // Check intersection with 4 sides
        const segments = [
            [{ x: r.left, y: r.top }, { x: r.right, y: r.top }],
            [{ x: r.right, y: r.top }, { x: r.right, y: r.bottom }],
            [{ x: r.right, y: r.bottom }, { x: r.left, y: r.bottom }],
            [{ x: r.left, y: r.bottom }, { x: r.left, y: r.top }]
        ];

        const ccw = (a, b, c) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
        const intersect = (a, b, c, d) => ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);

        return segments.some(s => intersect(p1, p2, s[0], s[1]));
    };

    const groups = [];
    layers.forEach((dist, id) => {
        if (!groups[dist]) groups[dist] = [];
        groups[dist].push(id);
    });

    // Place Root
    positions.set(rootId, { x: 0, y: 0 });

    // Track established edges to avoid placing nodes on them
    const placedEdges = [];

    for (let d = 1; d < groups.length; d++) {
        if (!groups[d]) continue;
        const layerNodes = groups[d];

        // Inherit heuristic
        const getParentAvgAngle = (nid) => {
            const parents = (adj.get(nid) || []).filter(pid => layers.get(pid) === d - 1);
            if (parents.length === 0) return 0;
            let sumAtan = 0;
            parents.forEach(pid => {
                const p = positions.get(pid);
                if (p) sumAtan += Math.atan2(p.y, p.x);
            });
            return sumAtan / parents.length;
        };
        layerNodes.sort((a, b) => getParentAvgAngle(a) - getParentAvgAngle(b));

        const radius = d * Math.max(SPACING_X, SPACING_Y);
        const angleStep = (2 * Math.PI) / layerNodes.length;

        layerNodes.forEach((nid, idx) => {
            const angle = idx * angleStep;

            // Propose position
            let rx = Math.round((Math.cos(angle) * radius) / SPACING_X) * SPACING_X;
            let ry = Math.round((Math.sin(angle) * radius) / SPACING_Y) * SPACING_Y;

            // Collision Check
            let safety = 0;
            let placed = false;

            // Spiral out if collision
            let spiralRank = 1;
            let spiralAngle = 0;

            while (!placed && safety++ < 200) {
                const candidateRect = getRectForNode(nid, rx, ry);

                // 1. Check against Placed Nodes
                const nodeCollision = Array.from(positions.entries()).some(([pid, p]) => {
                    const otherRect = getRectForNode(pid, p.x, p.y);
                    return isOverlapping(candidateRect, otherRect);
                });

                if (nodeCollision) {
                    // Spiral move
                    const r = spiralRank * (SPACING_X / 3);
                    rx += Math.cos(spiralAngle) * r;
                    ry += Math.sin(spiralAngle) * r;
                    spiralAngle += 1;
                    if (spiralAngle > Math.PI * 2) { spiralAngle = 0; spiralRank++; }
                    continue; // Retry
                }

                // 2. Check against Placed Edges (Node overlaps existing edge)
                const edgeCollision = placedEdges.some(edge =>
                    lineIntersectsRect(edge.p1, edge.p2, candidateRect)
                );

                if (edgeCollision) {
                    const r = spiralRank * (SPACING_X / 3);
                    rx += Math.cos(spiralAngle) * r;
                    ry += Math.sin(spiralAngle) * r;
                    spiralAngle += 1;
                    if (spiralAngle > Math.PI * 2) { spiralAngle = 0; spiralRank++; }
                    continue;
                }

                // 3. Check NEW Edges (New edge overlaps existing node)
                // Get all connections from `nid` to already placed nodes
                const neighbors = adj.get(nid) || [];
                const placedNeighbors = neighbors.filter(nid2 => positions.has(nid2));

                const newEdgeCollision = placedNeighbors.some(nid2 => {
                    const p2 = positions.get(nid2);
                    // Check if line (rx,ry) -> (p2.x, p2.y) hits any *other* placed node
                    return Array.from(positions.entries()).some(([pid, p]) => {
                        if (pid === nid2) return false; // Don't check against the target node itself
                        const rect = getRectForNode(pid, p.x, p.y);
                        return lineIntersectsRect({ x: rx, y: ry }, p2, rect);
                    });
                });

                if (newEdgeCollision) {
                    const r = spiralRank * (SPACING_X / 3);
                    rx += Math.cos(spiralAngle) * r;
                    ry += Math.sin(spiralAngle) * r;
                    spiralAngle += 1;
                    if (spiralAngle > Math.PI * 2) { spiralAngle = 0; spiralRank++; }
                    continue;
                }

                // Success
                placed = true;
            }
            positions.set(nid, { x: rx, y: ry });

            // Add new edges to placedEdges
            const neighbors = adj.get(nid) || [];
            neighbors.forEach(nid2 => {
                if (positions.has(nid2)) {
                    const p2 = positions.get(nid2);
                    placedEdges.push({ p1: { x: rx, y: ry }, p2: p2 });
                }
            });
        });
    }
    return positions;
}

function getRect(posMap) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (posMap instanceof Map) {
        posMap.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        });
    } else {
        // Assume array if not map (not used currently but good safety)
    }

    // Pad slightly
    const PAD = 50;
    return { left: minX - PAD, top: minY - PAD, right: maxX + 150 + PAD, bottom: maxY + 80 + PAD };
}

function findEmptySpot(localRect, obstacles, centerX, centerY) {
    // Spiral search
    const width = localRect.right - localRect.left;
    const height = localRect.bottom - localRect.top;

    let angle = 0;
    let rank = 1;
    const SPACING = 400; // Gap between clusters

    // Limit search to prevent infinite loop
    for (let i = 0; i < 100; i++) {
        // Try current spot
        // Spiral: 
        const r = rank * SPACING;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        // Potential World Rect
        const candidate = {
            left: x + localRect.left,
            right: x + localRect.right,
            top: y + localRect.top,
            bottom: y + localRect.bottom
        };

        // Check collision
        const collide = obstacles.some(obs => {
            return !(candidate.left > obs.right ||
                candidate.right < obs.left ||
                candidate.top > obs.bottom ||
                candidate.bottom < obs.top);
        });

        if (!collide) return { x, y };

        // Next
        angle += 1; // ~57 degrees
        if (angle > Math.PI * 2 * rank) {
            angle = 0;
            rank++;
        }
    }
    // Fallback: far away
    return { x: centerX + 2000, y: centerY + 2000 };
}

function startDragNew(e, type, data = {}) {
    e.dataTransfer.setData('application/json', JSON.stringify({ type, data }));
    e.dataTransfer.effectAllowed = 'copy';
}
document.body.ondragover = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
};
document.body.ondrop = (e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json');
    if (raw) {
        try {
            const payload = JSON.parse(raw);
            const wp = screenToWorld(e.clientX, e.clientY);
            const node = createNode(payload.type, wp.x, wp.y, null, payload.data);
            logNodeAddedToBoard(getNodeSummary(node.id));
            saveBoard();
        } catch (err) {
            console.error("Drop failed", err);
        }
    } else {
        // Fallback for simple types?
        const type = e.dataTransfer.getData('text/plain');
        if (type) {
            const wp = screenToWorld(e.clientX, e.clientY);
            const node = createNode(type, wp.x, wp.y);
            logNodeAddedToBoard(getNodeSummary(node.id));
            saveBoard();
        }
    }
};

// HIT TEST HELPER
function distToSegment(p, v, w) {
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    if (l2 == 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

// RESTORED HIT TEST
document.addEventListener('dblclick', (e) => {
    const n = e.target.closest('.node');
    if (n) {
        focusMode = true;
        document.body.classList.add('focus-active');
        document.querySelectorAll('.node').forEach(el => el.classList.add('blurred'));
        n.classList.remove('blurred');
        // Unblur neighbors
        const neighborIds = new Set();
        connections.forEach(c => {
            if (c.from === n.id) neighborIds.add(c.to);
            if (c.to === n.id) neighborIds.add(c.from);
        });
        neighborIds.forEach(nid => {
            const el = document.getElementById(nid);
            if (el) el.classList.remove('blurred');
        });
        return;
    }

    // HIT TEST STRINGS
    const worldPos = screenToWorld(e.clientX, e.clientY);
    let bestDist = 20; // threshold
    let foundConn = null;

    const len = connections.length;
    for (let i = 0; i < len; i++) {
        const conn = connections[i];
        const bIdx = connToIndex.get(conn.id);
        if (bIdx === undefined) continue;

        const base = bIdx * BYTES_PER_CONN;

        // Iterate segments
        for (let j = 0; j < CONFIG.POINTS_COUNT - 1; j++) {
            const p1Idx = base + j * STRIDE;
            const p2Idx = base + (j + 1) * STRIDE;

            const p1 = { x: physicsBuffer[p1Idx], y: physicsBuffer[p1Idx + 1] };
            const p2 = { x: physicsBuffer[p2Idx], y: physicsBuffer[p2Idx + 1] };

            const d = distToSegment(worldPos, p1, p2);
            if (d < bestDist) {
                bestDist = d;
                foundConn = conn;
            }
        }
    }

    if (foundConn) {
        if (!foundConn.label) {
            foundConn.label = "Note";
            saveBoard();
        }
    } else {
        // RESET FOCUS
        focusMode = false;
        document.body.classList.remove('focus-active');
        // Unblur all nodes explicitly
        document.querySelectorAll('.node').forEach(el => el.classList.remove('blurred'));
    }
});

// Expose filter functions to window for HTML event handlers
window.renderNPCs = renderNPCs;
window.renderLocations = renderLocations;
window.renderBoardEvents = renderBoardEvents;
window.renderBoardRequisitions = renderBoardRequisitions;
