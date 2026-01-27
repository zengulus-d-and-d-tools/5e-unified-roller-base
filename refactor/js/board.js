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
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.effectAllowed = "copy";
}

document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
});

document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    // Try multiple formats for robustness
    let type = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('type');

    // Safety for Guild dragging if browser acts up
    if (!type && e.target.getAttribute('data-type')) {
        type = e.target.getAttribute('data-type');
    }

    if (type) {
        createNode(type, e.clientX, e.clientY);
        saveBoard();
    }
});

// ... [Physics Loop and getPortPos unchanged] ...

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

    // Auto-Title Logic
    let defaultTitle = (type || 'Unknown').toUpperCase();
    if (type && type.length > 4 && !['person', 'location', 'note'].includes(type) && !content.title) {
        defaultTitle = type.charAt(0).toUpperCase() + type.slice(1);
    }

    const title = content.title || defaultTitle;
    const body = content.body || '';

    // Safety fallback for icon
    const icon = iconMap[type] || '❓';

    nodeEl.innerHTML = `
        <div class="port top" data-port="top"></div>
        <div class="port bottom" data-port="bottom"></div>
        <div class="port left" data-port="left"></div>
        <div class="port right" data-port="right"></div>
        <div class="node-header">
            <div class="node-title" contenteditable="true">${title}</div>
            <div class="node-icon">${icon}</div>
        </div>
        <div class="node-body" contenteditable="true">${body}</div>
    `;

    // Listeners
    nodeEl.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('port')) return;
        startDragNode(e, nodeEl);
    });

    // Focus Mode Click - REMOVED ContentEditable check to allow nice UX
    nodeEl.addEventListener('click', (e) => {
        if (draggedNode) return;
        toggleFocus(nodeEl.id);
    });

    nodeEl.addEventListener('contextmenu', (e) => showContextMenu(e, nodeEl));
    nodeEl.addEventListener('input', () => saveBoard());

    nodeEl.querySelectorAll('.port').forEach(p => {
        p.addEventListener('mousedown', (e) => startConnectionDrag(e, nodeEl, p.dataset.port));
    });

    container.appendChild(nodeEl);

    if (!id) {
        nodes.push({ id: nodeId, type, x: x - 75, y: y - 40 });
    }
    return nodeEl;
}

// ... [Node Dragging and Connection Logic unchanged] ...

// --- CLICK INTERACTION FOR STRINGS (Moved from Canvas to Body) ---
document.addEventListener('click', (e) => {
    // 1. If we clicked a UI element, ignore
    if (e.target.closest('.node') ||
        e.target.closest('.toolbar') ||
        e.target.closest('.header-overlay') ||
        e.target.closest('.context-menu') ||
        e.target.closest('.string-label')) { // Allow editing labels
        return;
    }

    // 2. Check for String Clicks (Math)
    let bestDist = 15; // Tolerance
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
        // 3. Background Click -> Reset Focus
        resetFocus();
        focusedNodeId = null;
    }
});

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
