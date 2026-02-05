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
}

function initGuildToolbar() {
    const guildContainer = document.getElementById('guild-popup');
    if (!guildContainer || !window.RTF_DATA || !window.RTF_DATA.clue) return;

    guildContainer.innerHTML = '';
    window.RTF_DATA.clue.guilds.forEach(g => {
        const el = document.createElement('div');
        el.className = `tool-item g-${g.id}`;
        el.draggable = true;
        el.ondragstart = (e) => startDragNew(e, g.id, { title: g.name, body: 'Guild' });
        el.innerHTML = `<div class="icon">${g.icon}</div><div class="label">${g.name}</div>`;
        guildContainer.appendChild(el);
    });
}

function initNPCToolbar() {
    const container = document.getElementById('npc-popup');
    if (!container || !window.RTF_STORE) return;

    const npcs = window.RTF_STORE.state.campaign.npcs || [];
    container.innerHTML = '';

    if (npcs.length === 0) {
        container.innerHTML = '<div style="padding:10px; color:#666; font-size:0.8rem;">No NPCs found.</div>';
    }

    npcs.forEach(npc => {
        const el = document.createElement('div');
        el.className = 'tool-item';
        el.draggable = true;
        // Map NPC data to Node content
        const nodeData = {
            title: npc.name,
            body: `${npc.guild || 'Unassigned'}\n${npc.wants || ''}`
        };
        el.ondragstart = (e) => startDragNew(e, 'person', nodeData);
        el.innerHTML = `<div class="icon">👤</div><div class="label">${npc.name}</div>`;
        container.appendChild(el);
    });
}

function initLocationToolbar() {
    const container = document.getElementById('location-popup');
    if (!container || !window.RTF_STORE) return;

    const locs = window.RTF_STORE.state.campaign.locations || [];
    container.innerHTML = '';

    if (locs.length === 0) {
        container.innerHTML = '<div style="padding:10px; color:#666; font-size:0.8rem;">No Locations found.</div>';
    }

    locs.forEach(loc => {
        const el = document.createElement('div');
        el.className = 'tool-item';
        el.draggable = true;
        const nodeData = {
            title: loc.name,
            body: `${loc.district || ''}\n${loc.desc || ''}`
        };
        el.ondragstart = (e) => startDragNew(e, 'location', nodeData);
        el.innerHTML = `<div class="icon">📍</div><div class="label">${loc.name}</div>`;
        container.appendChild(el);
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

    const iconMap = { person: '👤', location: '📍', clue: '🔍', note: '📝', azorius: '⚖️', boros: '⚔️', dimir: '👁️', golgari: '🍄', gruul: '🔥', izzet: '⚡', orzhov: '💰', rakdos: '🎪', selesnya: '🌳', simic: '🧬' };
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
    if (e.target.closest('.toolbar-scroll-wrapper')) return;
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
        body: el.querySelector('.node-body').innerText
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

    const end = () => {
        t.contentEditable = b.contentEditable = false;
        el.classList.remove('editing');
        updateNodeCache(el.id);
        saveBoard();
    };
    t.onblur = () => setTimeout(() => { if (document.activeElement !== t && document.activeElement !== b) end(); }, 50);
    b.onblur = () => setTimeout(() => { if (document.activeElement !== t && document.activeElement !== b) end(); }, 50);
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

    // 1. Reset View to Center
    // We want the centerNode to be at screen center (approx width/2, height/2)
    // view.x + node.x * view.scale = screenCenter
    // We'll just reset view to 0,0 and move the node to 0,0 (virtual coords) then build around it
    // Actually simpler: Build layout around (0,0) in world space, then pan view to center O,O

    // BFS to assign layers
    const layers = new Map(); // id -> distance
    const visited = new Set();
    const queue = [{ id: centerId, dist: 0 }];
    visited.add(centerId);
    layers.set(centerId, 0);

    const adj = new Map();
    nodes.forEach(n => adj.set(n.id, []));
    connections.forEach(c => {
        if (adj.has(c.from)) adj.get(c.from).push(c.to);
        if (adj.has(c.to)) adj.get(c.to).push(c.from);
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

    // Handle disconnected components (assign to generic outer layer)
    const maxDist = Math.max(...layers.values());
    nodes.forEach(n => {
        if (!visited.has(n.id)) {
            layers.set(n.id, maxDist + 2); // Push well outside connected graph
        }
    });

    // 2. Assign Grid Positions
    // Grid Spacing
    const SPACING_X = 250;
    const SPACING_Y = 180;
    const groups = [];

    // Group by layer
    layers.forEach((dist, id) => {
        if (!groups[dist]) groups[dist] = [];
        groups[dist].push(id);
    });

    const newPositions = new Map();
    newPositions.set(centerId, { x: 0, y: 0 });

    // Iterate layers
    for (let d = 1; d < groups.length; d++) {
        if (!groups[d]) continue;

        let layerNodes = groups[d];

        // Sort heuristic: Minimize crossing by sorting based on parent angle/position
        // For each node, find average position of its parents in d-1
        layerNodes.sort((a, b) => {
            const getParentAvgAngle = (nid) => {
                const parents = (adj.get(nid) || []).filter(pid => layers.get(pid) === d - 1);
                if (parents.length === 0) return 0;
                let sumAtan = 0;
                parents.forEach(pid => {
                    const pPos = newPositions.get(pid);
                    sumAtan += Math.atan2(pPos.y, pPos.x);
                });
                return sumAtan / parents.length;
            };
            return getParentAvgAngle(a) - getParentAvgAngle(b);
        });

        // Layout: concentric rectangle/circle
        // Simple approach: Place in a ring roughly proportional to perimeters
        const items = layerNodes.length;
        const radius = d * Math.max(SPACING_X, SPACING_Y);
        const angleStep = (2 * Math.PI) / items;

        layerNodes.forEach((nid, idx) => {
            const angle = idx * angleStep;
            // Snap to approximate grid?
            // Let's stick to radial for "minimizing crossovers" efficiently, 
            // but we can snap resultant positions to a grid if "grid" is strict.
            // User asked for "Grid that minimises crossover".
            // Let's map radial coords to nearest grid points to satisfy "Grid".

            let rx = Math.round((Math.cos(angle) * radius) / SPACING_X) * SPACING_X;
            let ry = Math.round((Math.sin(angle) * radius) / SPACING_Y) * SPACING_Y;

            // Avoid collisions (rudimentary)
            while (Array.from(newPositions.values()).some(p => p.x === rx && p.y === ry)) {
                // If occupied, spiral out slightly? Or just shift.
                rx += (Math.random() > 0.5 ? 1 : -1) * (SPACING_X / 2); // Jiggle
            }

            newPositions.set(nid, { x: rx, y: ry });
        });
    }

    // Apply New Positions
    // Apply center offset so the CENTER node is at the current view center?
    // User asked to "Centre this".
    // Let's set View to focus on (0,0) and place CenterNode at (0,0).

    // Reset View
    view.x = window.innerWidth / 2;
    view.y = window.innerHeight / 2;
    view.scale = 1;
    updateViewCSS();

    newPositions.forEach((pos, id) => {
        const el = document.getElementById(id);
        if (el) {
            el.style.left = pos.x + 'px';
            el.style.top = pos.y + 'px';
            // CRITICAL: Update the cache so physics sees the new position
            updateNodeCache(id);
        }
    });

    saveBoard();

    // 3. Smart Port Optimization
    // Now that nodes are in place, find the closest ports for every connection
    connections.forEach(c => {
        const n1 = nodeCache.get(c.from);
        const n2 = nodeCache.get(c.to);
        if (!n1 || !n2) return;

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
    });

    // Force physics wake-up & Reset string positions to straight lines
    connections.forEach(c => {
        const idx = connToIndex.get(c.id);
        if (idx !== undefined) {
            sleepState[idx] = 1;

            // Reset particles to a straight line between the new endpoints
            const c1 = nodeCache.get(c.from);
            const c2 = nodeCache.get(c.to);
            if (c1 && c2) {
                const p1 = getPortPos(c1, c.fromPort);
                const p2 = getPortPos(c2, c.toPort);
                const base = idx * BYTES_PER_CONN;

                for (let i = 0; i < CONFIG.POINTS_COUNT; i++) {
                    const t = i / (CONFIG.POINTS_COUNT - 1);
                    const px = p1.x + (p2.x - p1.x) * t;
                    const py = p1.y + (p2.y - p1.y) * t;

                    const ptr = base + i * STRIDE;
                    physicsBuffer[ptr] = px;        // x
                    physicsBuffer[ptr + 1] = py;    // y
                    physicsBuffer[ptr + 2] = px;    // oldx
                    physicsBuffer[ptr + 3] = py;    // oldy
                    physicsBuffer[ptr + 4] = 0;     // stress
                }
            }
        }
    });
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
        document.querySelectorAll('.node').forEach(el => el.classList.remove('blurred'));
    }
});