const container = document.getElementById('board-container');
const labelContainer = document.getElementById('string-label-container');
const canvas = document.getElementById('connection-layer');
const ctx = canvas.getContext('2d');
const contextMenu = document.getElementById('context-menu');

let nodes = [];
let connections = [];
let nextId = 1;
let draggedNode = null;
let offset = { x: 0, y: 0 };

// Interaction State
let isConnecting = false;
let connectStart = { id: null, port: null, x: 0, y: 0 };
let activeCase = "UNNAMED";
let focusMode = false;
let focusedNodeId = null;

// View State
let view = { x: 0, y: 0, scale: 1 };
let panMode = false;
let isPanning = false;
let panStart = { x: 0, y: 0 };

// Physics Config
const PHYSICS_STEPS = 5;
const GRAVITY = 0.5;
const SEGMENT_LENGTH = 18;
const STIFFNESS = 0.5;
const POINTS_COUNT = 9;

// --- INITIALIZATION ---
window.onload = () => {
    resizeCanvas();
    loadBoard();
    initGuildToolbar();
    updateViewCSS();
    requestAnimationFrame(physicsLoop);
};

window.onresize = () => resizeCanvas();

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function initGuildToolbar() {
    const guildContainer = document.getElementById('guild-tools');
    if (!guildContainer || !window.RTF_DATA || !window.RTF_DATA.clue) return;

    guildContainer.innerHTML = '';
    window.RTF_DATA.clue.guilds.forEach(g => {
        const el = document.createElement('div');
        el.className = `tool-item g-${g.id}`;
        el.draggable = true;
        el.setAttribute('data-type', g.id);
        el.ondragstart = (e) => startDragNew(e, g.id);

        el.innerHTML = `
            <div class="icon">${g.icon}</div>
            <div class="label">${g.name}</div>
         `;
        guildContainer.appendChild(el);
    });
}

function toggleToolbar() {
    const toolbar = document.getElementById('toolbar-wrapper');
    const btn = document.getElementById('toolbar-toggle');
    toolbar.classList.toggle('toolbar-hidden');
    btn.innerText = toolbar.classList.contains('toolbar-hidden') ? "Show Toolbar" : "Hide Toolbar";
}

// --- COORDINATE MAPPING ---
function screenToWorld(x, y) {
    return {
        x: (x - view.x) / view.scale,
        y: (y - view.y) / view.scale
    };
}

function updateViewCSS() {
    const transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    container.style.transform = transform;
    labelContainer.style.transform = transform;
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

// --- ZOOM & PAN HANDLERS ---
document.addEventListener('wheel', (e) => {
    if (e.target.closest('.toolbar-scroll-wrapper')) return; // Allow toolbar scroll
    e.preventDefault();

    const zoomIntensity = 0.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    const factor = direction * zoomIntensity;

    // Zoom towards mouse
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    // Calculate world point before zoom
    const wx = (mouseX - view.x) / view.scale;
    const wy = (mouseY - view.y) / view.scale;

    let newScale = view.scale + factor;
    // Limits
    newScale = Math.max(0.2, Math.min(newScale, 3));

    // Calculate new Offset so (wx, wy) remains under (mouseX, mouseY)
    // mouseX = newX + wx * newScale
    view.x = mouseX - wx * newScale;
    view.y = mouseY - wy * newScale;
    view.scale = newScale;

    updateViewCSS();
}, { passive: false });

document.addEventListener('mousedown', (e) => {
    // Middle click or Pan Mode (Left Click on BG)
    if (e.button === 1 || (panMode && e.button === 0 && !e.target.closest('.node') && !e.target.closest('.label-input'))) {
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
        document.body.style.cursor = "grabbing";
        e.preventDefault(); // Prevent text selection
    }
});

document.addEventListener('mousemove', (e) => {
    if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        view.x += dx;
        view.y += dy;
        panStart = { x: e.clientX, y: e.clientY };
        updateViewCSS();
    }
});

document.addEventListener('mouseup', (e) => {
    if (isPanning) {
        isPanning = false;
        document.body.style.cursor = panMode ? "grab" : "default";
    }
});


// --- DRAG HELPER (NEW NODE) ---
function startDragNew(e, type) {
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.effectAllowed = "copy";
}

document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
});

document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    let type = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('type');
    if (!type && e.target.getAttribute('data-type')) type = e.target.getAttribute('data-type');

    if (type) {
        // Drop coordinates are screen. Need World.
        const worldPos = screenToWorld(e.clientX, e.clientY);
        createNode(type, worldPos.x, worldPos.y);
        saveBoard();
    }
});

// --- PHYSICS LOOP ---
function physicsLoop() {
    updatePhysics();
    drawConnections();
    requestAnimationFrame(physicsLoop);
}

function updatePhysics() {
    connections.forEach(conn => {
        const n1 = document.getElementById(conn.from);
        const n2 = document.getElementById(conn.to);
        if (!n1 || !n2) return;

        const p1 = getPortPos(n1, conn.fromPort);
        const p2 = getPortPos(n2, conn.toPort);

        if (!conn.points || conn.points.length !== POINTS_COUNT) {
            conn.points = [];
            for (let i = 0; i < POINTS_COUNT; i++) {
                conn.points.push({
                    x: p1.x + (p2.x - p1.x) * (i / (POINTS_COUNT - 1)),
                    y: p1.y + (p2.y - p1.y) * (i / (POINTS_COUNT - 1)),
                    oldx: p1.x + (p2.x - p1.x) * (i / (POINTS_COUNT - 1)),
                    oldy: p1.y + (p2.y - p1.y) * (i / (POINTS_COUNT - 1)),
                    pinned: (i === 0 || i === POINTS_COUNT - 1)
                });
            }
        }

        conn.points[0].x = p1.x; conn.points[0].y = p1.y;
        conn.points[POINTS_COUNT - 1].x = p2.x; conn.points[POINTS_COUNT - 1].y = p2.y;

        for (let i = 0; i < conn.points.length; i++) {
            const p = conn.points[i];
            if (!p.pinned) {
                const vx = (p.x - p.oldx) * 0.9;
                const vy = (p.y - p.oldy) * 0.9;
                p.oldx = p.x;
                p.oldy = p.y;
                p.x += vx;
                p.y += vy;
                p.y += GRAVITY;
            }
        }

        for (let k = 0; k < 3; k++) {
            for (let i = 0; i < conn.points.length - 1; i++) {
                const pA = conn.points[i];
                const pB = conn.points[i + 1];

                const dx = pB.x - pA.x;
                const dy = pB.y - pA.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const diff = (dist - SEGMENT_LENGTH) / dist;

                if (!pA.pinned) {
                    pA.x += dx * 0.5 * diff;
                    pA.y += dy * 0.5 * diff;
                }
                if (!pB.pinned) {
                    pB.x -= dx * 0.5 * diff;
                    pB.y -= dy * 0.5 * diff;
                }
            }
        }
    });
}

// IMPORTANT: getPortPos needs to return WORLD coordinates because nodes are transformed relative to 0,0 WORLD, 
// BUT getBoundingClientRect returns SCREEN coordinates.
// Since the container is transformed, its local coordinates are World coords.
// node.offsetLeft/Top is relative to container (World).
// But we need exact edge. 
// Standard node is 150x80 (or auto). 
// Safer to use node.offsetLeft + width.
function getPortPos(nodeEl, port) {
    // We use offsetLeft/Top because they are relative to the Container (World Space)
    // CAUTION: styles applied transform on container, so offset props are correct in local space.
    const left = nodeEl.offsetLeft;
    const top = nodeEl.offsetTop;
    const width = nodeEl.offsetWidth;
    const height = nodeEl.offsetHeight;

    if (port === 'top') return { x: left + width / 2, y: top };
    if (port === 'bottom') return { x: left + width / 2, y: top + height };
    if (port === 'left') return { x: left, y: top + height / 2 };
    if (port === 'right') return { x: left + width, y: top + height / 2 };
    return { x: left + width / 2, y: top + height / 2 };
}

// --- NODE CREATION ---
function createNode(type, x, y, id = null, content = {}) {
    const nodeId = id || 'node_' + Date.now();
    const nodeEl = document.createElement('div');
    nodeEl.classList.add('node', 'type-' + type);
    nodeEl.id = nodeId;
    nodeEl.style.left = (x - 75) + 'px';
    nodeEl.style.top = (y - 40) + 'px';

    const iconMap = {
        person: '👤', location: '📍', clue: '🔍', note: '📝',
        azorius: '⚖️', boros: '⚔️', dimir: '👁️', golgari: '🍄', gruul: '🔥',
        izzet: '⚡', orzhov: '💰', rakdos: '🎪', selesnya: '🌳', simic: '🧬'
    };

    let defaultTitle = (type || 'Unknown').toUpperCase();
    if (type && type.length > 4 && !['person', 'location', 'note'].includes(type) && !content.title) {
        defaultTitle = type.charAt(0).toUpperCase() + type.slice(1);
    }

    const title = content.title || defaultTitle;
    const body = content.body || '';
    const icon = iconMap[type] || '❓';

    nodeEl.innerHTML = `
        <div class="port top" data-port="top"></div>
        <div class="port bottom" data-port="bottom"></div>
        <div class="port left" data-port="left"></div>
        <div class="port right" data-port="right"></div>
        <div class="node-header">
            <div class="node-title">${title}</div>
            <div class="node-icon">${icon}</div>
        </div>
        <div class="node-body">${body}</div>
    `;

    nodeEl.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('port')) return;
        if (panMode && e.button === 0) return; // Don't drag nodes in Pan Mode (unless we want to? Usually distinct modes)
        startDragNode(e, nodeEl);
    });

    nodeEl.addEventListener('contextmenu', (e) => showContextMenu(e, nodeEl));

    nodeEl.querySelectorAll('.port').forEach(p => {
        p.addEventListener('mousedown', (e) => startConnectionDrag(e, nodeEl, p.dataset.port));
    });

    container.appendChild(nodeEl);

    if (!id) {
        nodes.push({ id: nodeId, type, x: x - 75, y: y - 40 });
    }
    return nodeEl;
}

// --- NODE DRAGGING ---
function startDragNode(e, el) {
    if (el.classList.contains('editing')) return;
    if (e.button !== 0) return;

    draggedNode = el;
    // Map screen click to world offset
    const worldPos = screenToWorld(e.clientX, e.clientY);
    offset.x = worldPos.x - el.offsetLeft;
    offset.y = worldPos.y - el.offsetTop;
}

document.addEventListener('mousemove', (e) => {
    // World Mouse Pos
    const worldPos = screenToWorld(e.clientX, e.clientY);

    if (draggedNode) {
        const x = worldPos.x - offset.x;
        const y = worldPos.y - offset.y;
        draggedNode.style.left = x + 'px';
        draggedNode.style.top = y + 'px';

        const nodeData = nodes.find(n => n.id === draggedNode.id);
        if (nodeData) {
            nodeData.x = x;
            nodeData.y = y;
        }
    }
    if (isConnecting) {
        // Track current mouse in World Space
        connectStart.currentX = worldPos.x;
        connectStart.currentY = worldPos.y;
    }
});

document.addEventListener('mouseup', (e) => {
    if (draggedNode) {
        draggedNode = null;
        saveBoard();
    }
    if (isConnecting) {
        if (e.target.classList.contains('port')) {
            const targetNode = e.target.closest('.node');
            const targetPort = e.target.dataset.port;
            completeConnection(targetNode, targetPort);
        } else {
            isConnecting = false;
        }
    }
});

// --- CONNECTION LOGIC ---
function startConnectionDrag(e, node, port) {
    e.stopPropagation();
    e.preventDefault();
    isConnecting = true;
    const worldPos = screenToWorld(e.clientX, e.clientY);
    connectStart = { id: node.id, port: port, x: worldPos.x, y: worldPos.y, currentX: worldPos.x, currentY: worldPos.y };
}

function completeConnection(targetNode, targetPort) {
    if (targetNode.id === connectStart.id) return;

    const exists = connections.some(c =>
        (c.from === connectStart.id && c.to === targetNode.id) ||
        (c.from === targetNode.id && c.to === connectStart.id)
    );

    if (!exists) {
        const newConn = {
            id: 'conn_' + Date.now(),
            from: connectStart.id,
            to: targetNode.id,
            fromPort: connectStart.port,
            toPort: targetPort,
            label: '',
            labelT: 0.5,
            points: [],
            arrowLeft: 0,
            arrowRight: 0
        };
        connections.push(newConn);
        saveBoard();
    }
    isConnecting = false;
}

// --- DRAWING ---
function drawConnections() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear screen

    // Apply View Transform
    ctx.save();
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    if (isConnecting) {
        ctx.beginPath();
        const startEl = document.getElementById(connectStart.id);
        const startPos = getPortPos(startEl, connectStart.port);
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(connectStart.currentX, connectStart.currentY);
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    connections.forEach(conn => {
        let alpha = 1;
        if (focusMode) {
            const n1 = document.getElementById(conn.from);
            const n2 = document.getElementById(conn.to);
            if (!n1 || !n2 || n1.classList.contains('blurred') || n2.classList.contains('blurred')) {
                alpha = 0.1;
            }
        }

        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#c0392b';

        if (conn.points && conn.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(conn.points[0].x, conn.points[0].y);
            for (let i = 1; i < conn.points.length - 1; i++) {
                const xc = (conn.points[i].x + conn.points[i + 1].x) / 2;
                const yc = (conn.points[i].y + conn.points[i + 1].y) / 2;
                ctx.quadraticCurveTo(conn.points[i].x, conn.points[i].y, xc, yc);
            }
            ctx.lineTo(conn.points[conn.points.length - 1].x, conn.points[conn.points.length - 1].y);
            ctx.stroke();

            const centerPt = updateLabel(conn, alpha);

            // Draw Arrows (Anchored Logic)
            if (conn.points.length > 6) {
                const OFFSET = 0; // Not needed if anchoring directly on point

                // Left Arrow: Index 2
                if (conn.arrowLeft !== 0) {
                    // Determine angle at p[2] using p[1] and p[3]
                    const idx = 2;
                    const pA = conn.points[idx - 1];
                    const pB = conn.points[idx + 1];
                    const pt = conn.points[idx];
                    const angle = Math.atan2(pB.y - pA.y, pB.x - pA.x);

                    if (conn.arrowLeft === 1) // Arrow pointing 'back' relative to flow -> Towards Start
                        drawArrowHead(ctx, pt.x, pt.y, angle + Math.PI);
                    else
                        drawArrowHead(ctx, pt.x, pt.y, angle);
                }

                // Right Arrow: Index 6 (Total 9: 0..8, so 6 is 75%)
                if (conn.arrowRight !== 0) {
                    const idx = 6;
                    const pA = conn.points[idx - 1];
                    const pB = conn.points[idx + 1];
                    const pt = conn.points[idx];
                    const angle = Math.atan2(pB.y - pA.y, pB.x - pA.x);

                    if (conn.arrowRight === 1)
                        drawArrowHead(ctx, pt.x, pt.y, angle + Math.PI);
                    else
                        drawArrowHead(ctx, pt.x, pt.y, angle);
                }
            }
        }
    });

    ctx.restore(); // Reset transform for next frame (or clears mostly)
}

function drawArrowHead(ctx, x, y, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(6, 0);
    ctx.lineTo(-6, 4);
    ctx.fillStyle = '#f1c40f';
    ctx.fill();
    ctx.restore();
}

function updateLabel(conn, alpha) {
    let el = document.getElementById('lbl_' + conn.id);
    const midIdx = Math.floor(conn.points.length / 2);
    const pt = conn.points[midIdx];

    // Check if currently editing
    const isEditing = el && el.querySelector('.label-input') === document.activeElement;

    // MANDATORY FIX: Use a boolean flag to keep it visible if it was just edited to empty
    // OR if the value is non-empty.
    if (conn.label || isEditing) {
        if (!el) {
            el = document.createElement('div');
            el.id = 'lbl_' + conn.id;
            el.className = 'string-label';

            const btnLeft = document.createElement('div');
            btnLeft.className = 'arrow-btn';
            btnLeft.onclick = (e) => {
                e.stopPropagation();
                conn.arrowLeft = ((conn.arrowLeft || 0) + 1) % 3;
                saveBoard();
            };

            const input = document.createElement('div');
            input.className = 'label-input';
            input.contentEditable = true;
            input.innerText = conn.label || "";

            // Input Handler
            input.oninput = (e) => {
                conn.label = e.target.innerText; // Keep data in sync
                saveBoard();
            };
            input.onmousedown = (e) => e.stopPropagation();

            // Key Handler
            input.onkeydown = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    input.blur(); // Blur triggers disappearance if empty next frame
                }
            };

            const btnRight = document.createElement('div');
            btnRight.className = 'arrow-btn';
            btnRight.onclick = (e) => {
                e.stopPropagation();
                conn.arrowRight = ((conn.arrowRight || 0) + 1) % 3;
                saveBoard();
            };

            el.appendChild(btnLeft);
            el.appendChild(input);
            el.appendChild(btnRight);
            labelContainer.appendChild(el);
        }

        const input = el.querySelector('.label-input');
        if (input && document.activeElement !== input) {
            // Sync display value with data, but avoid recursion during typing
            if (input.innerText !== (conn.label || "")) {
                input.innerText = conn.label || "";
            }
        }

        const stateMap = { 0: '—', 1: '◀', 2: '▶' };

        el.children[0].innerText = stateMap[conn.arrowLeft || 0];
        el.children[2].innerText = stateMap[conn.arrowRight || 0];
        el.children[0].className = 'arrow-btn ' + (conn.arrowLeft !== 0 ? 'active' : '');
        el.children[2].className = 'arrow-btn ' + (conn.arrowRight !== 0 ? 'active' : '');

        el.style.left = pt.x + 'px';
        el.style.top = pt.y + 'px';
        el.style.opacity = alpha;
        el.style.pointerEvents = (alpha < 0.5) ? 'none' : 'auto';

        el.style.display = 'flex';
    } else {
        if (el) el.style.display = 'none';
    }
    return pt;
}

// --- INTERACTION EVENT LISTENERS ---

document.addEventListener('dblclick', (e) => {
    e.preventDefault();

    const nodeEl = e.target.closest('.node');
    if (nodeEl) {
        enterFocusMode(nodeEl.id);
        return;
    }

    // String Check - Needs Screen to World for Mouse Check?
    // distToSegment assumes Points are in World. Mouse needs to be World.
    const worldM = screenToWorld(e.clientX, e.clientY);

    let bestDist = 20;
    let closestConn = null;
    connections.forEach(conn => {
        if (!conn.points) return;
        for (let i = 0; i < conn.points.length - 1; i++) {
            const dist = distToSegment({ x: worldM.x, y: worldM.y }, conn.points[i], conn.points[i + 1]);
            if (dist < bestDist) {
                bestDist = dist;
                closestConn = conn;
            }
        }
    });

    if (closestConn) {
        if (!closestConn.label) {
            closestConn.label = "Note";
            saveBoard();
        }
    } else {
        resetFocus();
    }
});

document.addEventListener('click', (e) => {
    const nodeEl = e.target.closest('.node');
    if (nodeEl && nodeEl.classList.contains('editing')) return;

    if (nodeEl) {
        if (focusMode) {
            if (nodeEl.classList.contains('blurred')) {
                nodeEl.classList.remove('blurred');
            } else {
                nodeEl.classList.add('blurred');
            }
        }
        return;
    }
});

function distToSegment(p, v, w) {
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    if (l2 == 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}


// --- ACCESSORY FUNCTIONS ---
function enterFocusMode(nodeId) {
    focusMode = true;
    focusedNodeId = nodeId;
    document.body.classList.add('focus-active');

    document.querySelectorAll('.node').forEach(n => {
        n.classList.remove('focused');
        n.classList.add('blurred');
    });

    expandFocus(nodeId);

    const main = document.getElementById(nodeId);
    if (main) main.classList.add('focused');
}

function expandFocus(nodeId) {
    unblurNode(nodeId);
    connections.forEach(c => {
        if (c.from === nodeId) unblurNode(c.to);
        if (c.to === nodeId) unblurNode(c.from);
    });
}

function unblurNode(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('blurred');
}

function resetFocus() {
    focusMode = false;
    focusedNodeId = null;
    document.body.classList.remove('focus-active');
    document.querySelectorAll('.node').forEach(n => {
        n.classList.remove('blurred');
        n.classList.remove('focused');
    });
}


// --- CONTEXT MENU ---
function showContextMenu(e, node) {
    e.preventDefault();
    contextMenu.style.display = 'block';
    contextMenu.style.left = e.clientX + 'px';
    contextMenu.style.top = e.clientY + 'px';
    contextMenu.dataset.target = node.id;
}

window.onclick = (e) => {
    if (!e.target.closest('.context-menu')) contextMenu.style.display = 'none';
};

// --- EDIT NODE ---
function editTargetNode() {
    const id = contextMenu.dataset.target;
    if (id) {
        const el = document.getElementById(id);
        if (el) {
            const title = el.querySelector('.node-title');
            const body = el.querySelector('.node-body');

            el.classList.add('editing');
            title.contentEditable = true;
            body.contentEditable = true;
            title.focus();

            const finishEdit = () => {
                title.contentEditable = false;
                body.contentEditable = false;
                el.classList.remove('editing');
                saveBoard();
            };

            const onBlur = () => {
                setTimeout(() => {
                    if (document.activeElement !== title && document.activeElement !== body) {
                        finishEdit();
                    }
                }, 50);
            };

            title.addEventListener('blur', onBlur);
            body.addEventListener('blur', onBlur);

            title.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    body.focus();
                }
            });

            const range = document.createRange();
            range.selectNodeContents(title);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
        contextMenu.style.display = 'none';
    }
}

function deleteTargetNode() {
    const id = contextMenu.dataset.target;
    if (id) {
        const el = document.getElementById(id);
        if (el) el.remove();

        const removedConns = connections.filter(c => c.from === id || c.to === id);

        removedConns.forEach(c => {
            const lbl = document.getElementById('lbl_' + c.id);
            if (lbl) lbl.remove();
        });

        nodes = nodes.filter(n => n.id !== id);
        connections = connections.filter(c => c.from !== id && c.to !== id);
        saveBoard();
    }
}

// --- PERSISTENCE ---
function saveBoard() {
    const currentNodes = Array.from(document.querySelectorAll('.node')).map(el => ({
        id: el.id,
        type: Array.from(el.classList).find(c => c.startsWith('type-')).replace('type-', ''),
        x: parseInt(el.style.left),
        y: parseInt(el.style.top),
        title: el.querySelector('.node-title').innerText,
        body: el.querySelector('.node-body').innerText
    }));

    const data = {
        name: document.getElementById('caseName').innerText,
        nodes: currentNodes,
        connections: connections.map(c => ({
            from: c.from, to: c.to,
            fromPort: c.fromPort, toPort: c.toPort,
            label: c.label,
            arrowLeft: c.arrowLeft,
            arrowRight: c.arrowRight
        }))
    };

    localStorage.setItem('invBoardData', JSON.stringify(data));
}

function loadBoard() {
    const raw = localStorage.getItem('invBoardData');
    if (raw) {
        const data = JSON.parse(raw);
        document.getElementById('caseName').innerText = data.name || "UNNAMED";

        connections = data.connections || [];
        connections.forEach(c => c.points = []);

        nodes = data.nodes || [];
        container.innerHTML = '';
        labelContainer.innerHTML = '';
        nodes.forEach(n => {
            createNode(n.type, n.x + 75, n.y + 40, n.id, { title: n.title, body: n.body });
        });
    }
}

function exportBoard() {
    saveBoard();
    const raw = localStorage.getItem('invBoardData');
    if (!raw) return;

    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `case_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importBoard() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const json = JSON.parse(evt.target.result);
                if (json.nodes && json.connections) {
                    localStorage.setItem('invBoardData', JSON.stringify(json));
                    loadBoard();
                    alert("Case File Loaded Successfully!");
                } else {
                    alert("Invalid File Format");
                }
            } catch (err) {
                console.error(err);
                alert("Error Parsing File");
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function clearBoard() {
    if (confirm("Clear the entire investigation board?")) {
        nodes = [];
        connections = [];
        container.innerHTML = '';
        labelContainer.innerHTML = '';
        saveBoard();
    }
}
