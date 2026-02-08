// --- CONFIGURATION ---
const CONFIG = {
    PHYSICS_STEPS: 3,
    GRAVITY: 0.6,
    SEGMENT_LENGTH: 18,
    POINTS_COUNT: 9,
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

const sanitizeText = (text = '') => String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const sanitizeMultiline = (text = '') => sanitizeText(text).replace(/\n/g, '<br>');
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
    requestAnimationFrame(loop);
};

window.onresize = () => resizeCanvas();

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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

function initGuildToolbar() {
    const guildContainer = document.getElementById('guild-popup');
    if (!guildContainer || !window.RTF_DATA || !window.RTF_DATA.clue) return;

    guildContainer.innerHTML = '<div id="guild-list-content"></div>';
    const list = document.getElementById('guild-list-content');

    window.RTF_DATA.clue.guilds.forEach(g => {
        const el = document.createElement('div');
        el.className = `tool-item g-${g.id}`;
        el.draggable = true;
        el.ondragstart = (e) => startDragNew(e, g.id, { title: g.name, body: 'Guild' });
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
                ${(window.RTF_DATA && window.RTF_DATA.guilds ? window.RTF_DATA.guilds.map(g => `<option value="${g}">${g}</option>`).join('') : '')}
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
        let body = `${npc.guild || 'Unassigned'}`;
        if (npc.wants) body += `<br><strong>Wants:</strong> ${npc.wants}`;
        if (npc.leverage) body += `<br><strong>Lev:</strong>   ${npc.leverage}`;
        if (npc.notes) body += `<br><strong>Note:</strong>  ${npc.notes}`;

        const nodeData = {
            title: npc.name,
            body: body
        };
        el.ondragstart = (e) => startDragNew(e, 'person', nodeData);
        el.innerHTML = `<div class="icon">👤</div><div class="label">${npc.name}</div>`;
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
                ${(window.RTF_DATA && window.RTF_DATA.guilds ? window.RTF_DATA.guilds.map(g => `<option value="${g}">${g}</option>`).join('') : '')}
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
        let body = `${loc.district || ''}`;
        if (loc.desc) body += `<br>${loc.desc}`;
        if (loc.notes) body += `<br><strong>Note:</strong>  ${loc.notes}`;

        const nodeData = {
            title: loc.name,
            body: body
        };
        el.ondragstart = (e) => startDragNew(e, 'location', nodeData);
        el.innerHTML = `<div class="icon">📍</div><div class="label">${loc.name}</div>`;
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

        el.ondragstart = (e) => startDragNew(e, 'event', { title: evt.title || 'Event', body: lines.join('<br>') });
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

        el.ondragstart = (e) => startDragNew(e, 'requisition', { title: req.item || 'Requisition', body: lines.join('<br>') });
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

        // 1. Pin Endpoints
        const p1 = getPortPos(c1, conn.fromPort);
        const p2 = getPortPos(c2, conn.toPort);

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
        const stepCount = CONFIG.PHYSICS_STEPS;

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
        const startPos = getPortPos(nodeCache.get(connectStart.id), connectStart.port);
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
        const t = Math.min(1, stress / CONFIG.MAX_STRETCH);

        if (t > 0.05) {
            const gb = Math.floor(255 * (1 - t));
            ctx.strokeStyle = `rgb(255, ${gb}, ${gb})`;
            ctx.lineWidth = CONFIG.BASE_THICKNESS;
        } else {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = CONFIG.BASE_THICKNESS;
        }

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

        updateLabelPos(conn, base, alpha);
        if (conn.arrowLeft || conn.arrowRight) drawArrows(ctx, conn, base);
    }

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

    if ((conn.label || isEditing) && alpha > 0.1) {
        if (!el) el = createLabelDOM(conn);
        el.style.transform = `translate(${x}px, ${y}px)`;
        el.style.display = 'flex';
        el.style.opacity = alpha;
    } else if (el) {
        el.style.display = 'none';
    }
}

function drawArrows(ctx, conn, basePtr) {
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
        ctx.fillStyle = '#f1c40f';
        ctx.fill();
        ctx.restore();
    };

    if (conn.arrowLeft) drawHead(2, conn.arrowLeft === 1);
    if (conn.arrowRight) drawHead(6, conn.arrowRight === 1);
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
        const p1 = getPortPos(c1, conn.fromPort);
        const p2 = getPortPos(c2, conn.toPort);
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
    const { x, y, w, h } = nodeData;
    if (port === 'top') return { x: x + w / 2, y: y };
    if (port === 'bottom') return { x: x + w / 2, y: y + h };
    if (port === 'left') return { x: x, y: y + h / 2 };
    if (port === 'right') return { x: x + w, y: y + h / 2 };
    return { x: x + w / 2, y: y + h / 2 };
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

        draggedNode.style.left = finalX + 'px';
        draggedNode.style.top = finalY + 'px';
        draggedNode.style.transform = 'none';
        draggedNode.style.willChange = 'auto';

        updateNodeCache(draggedNode.id);
        saveBoard();
        draggedNode = null;
    }
    if (isConnecting) {
        if (e.target.classList.contains('port')) {
            const node = e.target.closest('.node');
            completeConnection(node, e.target.dataset.port);
        }
        isConnecting = false;
    }
    if (isPanning) {
        isPanning = false;
        document.body.style.cursor = panMode ? "grab" : "default";
    }
});

function createNode(type, x, y, id = null, content = {}) {
    const nodeId = id || 'node_' + Date.now();
    const nodeEl = document.createElement('div');
    nodeEl.className = `node type-${type}`;
    nodeEl.id = nodeId;
    nodeEl.style.left = (x - 75) + 'px';
    nodeEl.style.top = (y - 40) + 'px';

    const iconMap = { person: '👤', location: '📍', clue: '🔍', note: '📝', event: '🕰️', requisition: '📦', azorius: '⚖️', boros: '⚔️', dimir: '👁️', golgari: '🍄', gruul: '🔥', izzet: '⚡', orzhov: '💰', rakdos: '🎪', selesnya: '🌳', simic: '🧬' };
    const icon = iconMap[type] || '❓';
    const title = content.title || type.toUpperCase();

    nodeEl.innerHTML = `
        <div class="port top" data-port="top"></div><div class="port bottom" data-port="bottom"></div>
        <div class="port left" data-port="left"></div><div class="port right" data-port="right"></div>
        <div class="node-header"><div class="node-title">${title}</div><div class="node-icon">${icon}</div></div>
        <div class="node-body">${content.body || ''}</div>
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
    updateNodeCache(nodeId);

    // Ensure node is tracked in global state (both for new and loaded nodes)
    nodes.push({ id: nodeId, type, x: x - 75, y: y - 40 });

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
    if (targetNode.id === connectStart.id) return;
    if (connections.some(c => (c.from === connectStart.id && c.to === targetNode.id) || (c.from === targetNode.id && c.to === connectStart.id))) return;

    const newConn = {
        id: 'conn_' + Date.now(),
        from: connectStart.id, to: targetNode.id,
        fromPort: connectStart.port, toPort: targetPort,
        label: '', arrowLeft: 0, arrowRight: 0
    };

    connections.push(newConn);
    registerConnection(newConn);
    saveBoard();
}

function createLabelDOM(conn) {
    const el = document.createElement('div');
    el.id = 'lbl_' + conn.id;
    el.className = 'string-label';
    el.style.position = 'absolute';
    el.style.left = '0'; el.style.top = '0';

    const btnL = document.createElement('div');
    btnL.className = `arrow-btn ${conn.arrowLeft ? 'active' : ''}`;
    btnL.innerText = { 0: '—', 1: '◀', 2: '▶' }[conn.arrowLeft || 0];
    btnL.onclick = (e) => { conn.arrowLeft = ((conn.arrowLeft || 0) + 1) % 3; saveBoard(); };

    const input = document.createElement('div');
    input.className = 'label-input';
    input.contentEditable = true;
    input.innerText = conn.label || "";
    input.oninput = (e) => { conn.label = e.target.innerText; saveBoard(); };
    input.onmousedown = (e) => e.stopPropagation();

    const btnR = document.createElement('div');
    btnR.className = `arrow-btn ${conn.arrowRight ? 'active' : ''}`;
    btnR.innerText = { 0: '—', 1: '◀', 2: '▶' }[conn.arrowRight || 0];
    btnR.onclick = (e) => { conn.arrowRight = ((conn.arrowRight || 0) + 1) % 3; saveBoard(); };

    el.append(btnL, input, btnR);
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
    const nodeData = Array.from(document.querySelectorAll('.node')).map(el => ({
        id: el.id,
        type: Array.from(el.classList).find(c => c.startsWith('type-')).replace('type-', ''),
        x: parseInt(el.style.left), y: parseInt(el.style.top),
        title: el.querySelector('.node-title').innerText,
        body: el.querySelector('.node-body').innerHTML
    }));

    const data = {
        name: document.getElementById('caseName').innerText,
        nodes: nodeData,
        connections: connections.map(c => ({
            id: c.id, from: c.from, to: c.to, fromPort: c.fromPort, toPort: c.toPort,
            label: c.label, arrowLeft: c.arrowLeft, arrowRight: c.arrowRight
        }))
    };
    localStorage.setItem('invBoardData', JSON.stringify(data));
}

function loadBoard() {
    const raw = localStorage.getItem('invBoardData');
    if (!raw) return;
    const data = JSON.parse(raw);
    document.getElementById('caseName').innerText = data.name || "UNNAMED";

    container.innerHTML = '';
    labelContainer.innerHTML = '';
    nodeCache.clear();
    nodeGraph.clear();
    connToIndex.clear();
    allocatedCount = 0;
    nodes = [];
    connections = [];

    (data.nodes || []).forEach(n => {
        createNode(n.type, n.x + 75, n.y + 40, n.id, { title: n.title, body: n.body });
    });

    (data.connections || []).forEach(c => {
        if (!c.id) c.id = 'conn_' + Date.now() + Math.random();
        connections.push(c);
        registerConnection(c);
    });
}

function clearBoard() {
    if (confirm("Clear board?")) {
        localStorage.removeItem('invBoardData');
        location.reload();
    }
}

function showContextMenu(e, node) {
    e.preventDefault();
    contextMenu.style.display = 'block';
    contextMenu.style.left = e.clientX + 'px';
    contextMenu.style.top = e.clientY + 'px';
    contextMenu.dataset.target = node.id;
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
    optimizeLayout(id);
    contextMenu.style.display = 'none';
}

function optimizeLayout(centerId) {
    if (!centerId) { console.error("optimizeLayout: No Center ID"); return; }

    // SYNC STATE: Ensure memory matches DOM before calculating
    saveBoard();
    loadBoard();

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

    // 6. Smart Port Optimization & Physics Reset
    connections.forEach(c => {
        const n1 = nodeCache.get(c.from);
        const n2 = nodeCache.get(c.to);
        if (!n1 || !n2) return;

        // Optimization: pick closest ports
        let minD = Infinity;
        let best = { from: c.fromPort, to: c.toPort };

        ['top', 'bottom', 'left', 'right'].forEach(p1 => {
            const pos1 = getPortPos(n1, p1);
            ['top', 'bottom', 'left', 'right'].forEach(p2 => {
                const pos2 = getPortPos(n2, p2);
                const d = Math.hypot(pos1.x - pos2.x, pos1.y - pos2.y);
                if (d < minD) {
                    minD = d;
                    best = { from: p1, to: p2 };
                }
            });
        });
        c.fromPort = best.from;
        c.toPort = best.to;

        // Reset Physics
        const idx = connToIndex.get(c.id);
        if (idx !== undefined) {
            sleepState[idx] = 1;
            const p1 = getPortPos(n1, c.fromPort);
            const p2 = getPortPos(n2, c.toPort);
            const base = idx * BYTES_PER_CONN;
            for (let i = 0; i < CONFIG.POINTS_COUNT; i++) {
                const t = i / (CONFIG.POINTS_COUNT - 1);
                const px = p1.x + (p2.x - p1.x) * t;
                const py = p1.y + (p2.y - p1.y) * t;
                const ptr = base + i * STRIDE;
                physicsBuffer[ptr] = px; physicsBuffer[ptr + 1] = py;
                physicsBuffer[ptr + 2] = px; physicsBuffer[ptr + 3] = py;
                physicsBuffer[ptr + 4] = 0;
            }
        }
    });
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
            createNode(payload.type, wp.x, wp.y, null, payload.data);
            saveBoard();
        } catch (err) {
            console.error("Drop failed", err);
        }
    } else {
        // Fallback for simple types?
        const type = e.dataTransfer.getData('text/plain');
        if (type) {
            const wp = screenToWorld(e.clientX, e.clientY);
            createNode(type, wp.x, wp.y);
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
