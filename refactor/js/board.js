const container = document.getElementById('board-container');
const labelContainer = document.getElementById('string-label-container');
const canvas = document.getElementById('connection-layer');
const ctx = canvas.getContext('2d');
const contextMenu = document.getElementById('context-menu');

let nodes = [];
let connections = []; // {id: 'c1', from: id, to: id, fromPort: 'btm', toPort: 'top', label: 'conn', labelT: 0.5, physics: []}
let nextId = 1;
let draggedNode = null;
let offset = { x: 0, y: 0 };

// Interaction State
let isConnecting = false;
let connectStart = { id: null, port: null, x: 0, y: 0 };
let activeCase = "UNNAMED";
let focusMode = false;
let focusedNodeId = null;

// Physics Config
const PHYSICS_STEPS = 5;
const GRAVITY = 0.5;
const SEGMENT_LENGTH = 15;
const STIFFNESS = 0.5; // 0-1, 1 is rigid

// --- INITIALIZATION ---
window.onload = () => {
    resizeCanvas();
    loadBoard();
    requestAnimationFrame(physicsLoop);
};

window.onresize = () => resizeCanvas();

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// --- DRAG HELPER (NEW NODE) ---
function startDragNew(e, type) {
    e.dataTransfer.setData('type', type);
}

document.body.addEventListener('dragover', (e) => e.preventDefault());
document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    if (type) {
        createNode(type, e.clientX, e.clientY);
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

        // Initialize points if needed (simple chain of 5 points)
        if (!conn.points || conn.points.length !== 5) {
            conn.points = [];
            for (let i = 0; i < 5; i++) {
                conn.points.push({
                    x: p1.x + (p2.x - p1.x) * (i / 4),
                    y: p1.y + (p2.y - p1.y) * (i / 4),
                    oldx: p1.x + (p2.x - p1.x) * (i / 4),
                    oldy: p1.y + (p2.y - p1.y) * (i / 4),
                    pinned: (i === 0 || i === 4)
                });
            }
        }

        // Update pinned positions
        conn.points[0].x = p1.x; conn.points[0].y = p1.y;
        conn.points[4].x = p2.x; conn.points[4].y = p2.y;

        // Verlet Integration
        for (let i = 0; i < conn.points.length; i++) {
            const p = conn.points[i];
            if (!p.pinned) {
                const vx = (p.x - p.oldx) * 0.9; // Damping
                const vy = (p.y - p.oldy) * 0.9;

                p.oldx = p.x;
                p.oldy = p.y;

                p.x += vx;
                p.y += vy;
                p.y += GRAVITY; // Gravity
            }
        }

        // Constraints
        for (let k = 0; k < 3; k++) { // Iterations
            for (let i = 0; i < conn.points.length - 1; i++) {
                const pA = conn.points[i];
                const pB = conn.points[i + 1];

                const dx = pB.x - pA.x;
                const dy = pB.y - pA.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const diff = (dist - SEGMENT_LENGTH) / dist; // Relax to natural length

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

function getPortPos(nodeEl, port) {
    const r = nodeEl.getBoundingClientRect();
    if (port === 'top') return { x: r.left + r.width / 2, y: r.top };
    if (port === 'bottom') return { x: r.left + r.width / 2, y: r.bottom };
    if (port === 'left') return { x: r.left, y: r.top + r.height / 2 };
    if (port === 'right') return { x: r.right, y: r.top + r.height / 2 };
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
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

    // Auto-Title for Guilds
    let defaultTitle = type.toUpperCase();
    if (type.length > 4 && !['person', 'location', 'note'].includes(type) && !content.title) {
        defaultTitle = type.charAt(0).toUpperCase() + type.slice(1);
    }

    const title = content.title || defaultTitle;
    const body = content.body || '';

    nodeEl.innerHTML = `
        <div class="port top" data-port="top"></div>
        <div class="port bottom" data-port="bottom"></div>
        <div class="port left" data-port="left"></div>
        <div class="port right" data-port="right"></div>
        <div class="node-header">
            <div class="node-title" contenteditable="true">${title}</div>
            <div class="node-icon">${iconMap[type] || '❓'}</div>
        </div>
        <div class="node-body" contenteditable="true">${body}</div>
    `;

    // Listeners
    nodeEl.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('port')) return; // Let port handler take it
        startDragNode(e, nodeEl);
    });

    // Focus Mode Click
    nodeEl.addEventListener('click', (e) => {
        if (draggedNode) return; // Don't focus on drag release
        if (e.target.isContentEditable) return;

        // Single click interaction
        toggleFocus(nodeEl.id);
    });

    nodeEl.addEventListener('contextmenu', (e) => showContextMenu(e, nodeEl));
    nodeEl.addEventListener('input', () => saveBoard());

    // Port Listeners
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
    if (e.target.isContentEditable) return;
    if (e.button !== 0) return;

    draggedNode = el;
    offset.x = e.clientX - el.offsetLeft;
    offset.y = e.clientY - el.offsetTop;
}

document.addEventListener('mousemove', (e) => {
    if (draggedNode) {
        const x = e.clientX - offset.x;
        const y = e.clientY - offset.y;
        draggedNode.style.left = x + 'px';
        draggedNode.style.top = y + 'px';

        const nodeData = nodes.find(n => n.id === draggedNode.id);
        if (nodeData) {
            nodeData.x = x;
            nodeData.y = y;
        }
    }

    // Active Connection Line (Visual Only)
    if (isConnecting) {
        // Redraw happens in physics loop, we just need the mouse var available ideally,
        // but for simplicity we rely on 'connectStart' and drawing an extra line in drawConnections
        connectStart.currentX = e.clientX;
        connectStart.currentY = e.clientY;
    }
});

document.addEventListener('mouseup', (e) => {
    if (draggedNode) {
        draggedNode = null;
        saveBoard();
    }
    if (isConnecting) {
        // Check if dropped on a port
        if (e.target.classList.contains('port')) {
            const targetNode = e.target.closest('.node');
            const targetPort = e.target.dataset.port;
            completeConnection(targetNode, targetPort);
        } else {
            // Cancel
            isConnecting = false;
        }
    }
});

// --- CONNECTION LOGIC ---
function startConnectionDrag(e, node, port) {
    e.stopPropagation();
    e.preventDefault();
    isConnecting = true;
    connectStart = { id: node.id, port: port, x: e.clientX, y: e.clientY, currentX: e.clientX, currentY: e.clientY };
}

function completeConnection(targetNode, targetPort) {
    if (targetNode.id === connectStart.id) return;

    // Check duplicates
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
            points: [] // Physics init will happen in loop
        };
        connections.push(newConn);
        saveBoard();
    }
    isConnecting = false;
}

// --- DRAWING ---
function drawConnections() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Active Drag Line
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

    // Draw Exisiting Physics Strings
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    connections.forEach(conn => {
        // Opacity logic for Focus Mode
        let alpha = 0.8;
        if (focusMode) {
            const involved = (conn.from === focusedNodeId || conn.to === focusedNodeId);
            if (!involved) {
                // Check if both nodes are in the "focused group" (recursion) - simpler: just check immediate
                // If not connected to focused node, dim it
                alpha = 0.1;

                // Advanced: Check if part of the focused tree. 
                // For now, simple logic: if neither end is current focus, dim.
                // Better logic inside updateFocusVisuals handled class, 
                // but canvas needs manual alpha.
                const n1 = document.getElementById(conn.from);
                const n2 = document.getElementById(conn.to);
                if (n1.classList.contains('blurred') || n2.classList.contains('blurred')) {
                    alpha = 0.1;
                }
            }
        }

        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#c0392b'; // Dark Red String

        if (conn.points && conn.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(conn.points[0].x, conn.points[0].y);
            // Draw curve through points
            for (let i = 1; i < conn.points.length - 1; i++) {
                const xc = (conn.points[i].x + conn.points[i + 1].x) / 2;
                const yc = (conn.points[i].y + conn.points[i + 1].y) / 2;
                ctx.quadraticCurveTo(conn.points[i].x, conn.points[i].y, xc, yc);
            }
            ctx.lineTo(conn.points[conn.points.length - 1].x, conn.points[conn.points.length - 1].y);
            ctx.stroke();

            // Update Label Position
            updateLabel(conn, alpha);
        }
    });
    ctx.globalAlpha = 1;
}

function updateLabel(conn, alpha) {
    let el = document.getElementById('lbl_' + conn.id);

    // Allow clicking string to add label
    // If no label and no element, we don't draw text, but we need interaction region?
    // For simplicity: We only show label if it exists or if we enable a mode.
    // IMPROVEMENT: Draw a small transparent clickable region or calculate distance on click.

    if (conn.label) {
        if (!el) {
            el = document.createElement('div');
            el.id = 'lbl_' + conn.id;
            el.className = 'string-label';
            el.contentEditable = true;
            el.innerText = conn.label;
            el.oninput = (e) => { conn.label = e.target.innerText; saveBoard(); };
            el.onmousedown = (e) => e.stopPropagation(); // prevent drag pass through
            labelContainer.appendChild(el);
        }

        // Calculate Position at T
        // Approx length along segments
        // Simple linear approx for now between middle points
        const midIdx = Math.floor(conn.points.length / 2);
        const pt = conn.points[midIdx];

        el.style.left = pt.x + 'px';
        el.style.top = pt.y + 'px';
        el.style.opacity = alpha;
        el.style.display = 'block';
    } else {
        if (el) el.style.display = 'none';
    }
}

// Click string logic (Global Click Handler for Canvas interactions)
canvas.addEventListener('click', (e) => {
    // Find closest string segment
    let bestDist = 10;
    let closestConn = null;

    connections.forEach(conn => {
        if (!conn.points) return;
        for (let i = 0; i < conn.points.length - 1; i++) {
            const dist = distToSegment({ x: e.clientX, y: e.clientY }, conn.points[i], conn.points[i + 1]);
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
        // Background Click -> Reset Focus
        resetFocus();
        focusedNodeId = null;
    }
});

function distToSegment(p, v, w) {
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    if (l2 == 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

// --- FOCUS MODE LOGIC ---
function toggleFocus(nodeId) {
    if (focusMode && focusedNodeId === nodeId) {
        resetFocus(); // Toggle off
        return;
    }

    focusMode = true;
    focusedNodeId = nodeId;
    document.body.classList.add('focus-active');

    // 1. Reset all
    document.querySelectorAll('.node').forEach(n => {
        n.classList.remove('focused');
        n.classList.add('blurred');
    });

    // 2. BFS to find connected nodes
    const graph = buildAdjacency();
    const related = new Set();
    const queue = [nodeId];
    related.add(nodeId);

    // Only 1 degree of separation? Or full tree? 
    // User asked: "click a connected item, the original stays selected but the ones connected to that are brought back"
    // Implies we highlight the Tree. Let's do Full Connected Component.

    while (queue.length > 0) {
        const curr = queue.shift();
        const neighbors = graph[curr] || [];
        neighbors.forEach(n => {
            if (!related.has(n)) {
                related.add(n);
                queue.push(n);
            }
        });
    }

    // 3. Highlight related
    related.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('blurred');
            if (id === focusedNodeId) el.classList.add('focused'); // Primary focus
        }
    });
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

document.body.addEventListener('dblclick', (e) => {
    if (e.target === document.body || e.target.id === 'connection-layer') {
        resetFocus();
    }
});

function buildAdjacency() {
    const g = {};
    connections.forEach(c => {
        if (!g[c.from]) g[c.from] = [];
        if (!g[c.to]) g[c.to] = [];
        g[c.from].push(c.to);
        g[c.to].push(c.from);
    });
    return g;
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

function deleteTargetNode() {
    const id = contextMenu.dataset.target;
    if (id) {
        const el = document.getElementById(id);
        if (el) el.remove();
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
            label: c.label
        })) // Clean points
    };

    localStorage.setItem('invBoardData', JSON.stringify(data));
}

function loadBoard() {
    const raw = localStorage.getItem('invBoardData');
    if (raw) {
        const data = JSON.parse(raw);
        document.getElementById('caseName').innerText = data.name || "UNNAMED";

        connections = data.connections || [];
        // Reset points for physics gen
        connections.forEach(c => c.points = []);

        nodes = data.nodes || [];
        container.innerHTML = '';
        nodes.forEach(n => {
            createNode(n.type, n.x + 75, n.y + 40, n.id, { title: n.title, body: n.body });
        });
    }
}

// --- EXPORT / IMPORT ---
function exportBoard() {
    saveBoard(); // Ensure latest state
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
                // Validate JSON?
                const json = JSON.parse(evt.target.result);
                if (json.nodes && json.connections) {
                    localStorage.setItem('invBoardData', JSON.stringify(json));
                    loadBoard();
                    drawConnections(); // Redraw immediately
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
