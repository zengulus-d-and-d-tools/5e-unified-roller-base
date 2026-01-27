const container = document.getElementById('board-container');
const canvas = document.getElementById('connection-layer');
const ctx = canvas.getContext('2d');
const contextMenu = document.getElementById('context-menu');

let nodes = [];
let connections = []; // {from: id, to: id}
let nextId = 1;
let draggedNode = null;
let offset = { x: 0, y: 0 };
let isConnecting = false;
let connectStartNode = null;
let activeCase = "UNNAMED";

// --- INITIALIZATION ---
window.onload = () => {
    resizeCanvas();
    loadBoard();
    drawConnections();
};

window.onresize = () => {
    resizeCanvas();
    drawConnections();
};

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// --- DRAG HELPER (NEW NODE) ---
function startDragNew(e, type) {
    e.dataTransfer.setData('type', type);
}

// --- DRAG & DROP ON BOARD ---
document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    if (type) {
        createNode(type, e.clientX, e.clientY);
        saveBoard();
    }
});

// --- NODE CREATION ---
function createNode(type, x, y, id = null, content = {}) {
    const nodeId = id || 'node_' + Date.now();
    const nodeEl = document.createElement('div');
    nodeEl.classList.add('node', 'type-' + type);
    nodeEl.id = nodeId;
    nodeEl.style.left = (x - 75) + 'px'; // Center on cursor
    nodeEl.style.top = (y - 40) + 'px';

    const iconMap = { person: '👤', location: '📍', clue: '🔍', note: '📝' };
    const title = content.title || type.toUpperCase();
    const body = content.body || '';

    nodeEl.innerHTML = `
        <div class="node-header">
            <div class="node-title" contenteditable="true">${title}</div>
            <div class="node-icon">${iconMap[type]}</div>
        </div>
        <div class="node-body" contenteditable="true">${body}</div>
    `;

    // Interactive Listeners
    nodeEl.addEventListener('mousedown', (e) => startDragNode(e, nodeEl));
    nodeEl.addEventListener('click', (e) => selectNode(e, nodeEl));
    nodeEl.addEventListener('contextmenu', (e) => showContextMenu(e, nodeEl));

    // Auto-save on edit
    nodeEl.addEventListener('input', () => saveBoard());

    container.appendChild(nodeEl);

    if (!id) {
        nodes.push({ id: nodeId, type, x: x - 75, y: y - 40 });
    }
    return nodeEl;
}

// --- NODE DRAGGING ---
function startDragNode(e, el) {
    if (e.target.isContentEditable) return; // Allow text selecting
    if (e.button !== 0) return; // Only Left Click

    if (isConnecting) {
        completeConnection(el);
        return;
    }

    draggedNode = el;
    offset.x = e.clientX - el.offsetLeft;
    offset.y = e.clientY - el.offsetTop;

    // Bring to front
    // el.style.zIndex = 100;
}

document.addEventListener('mousemove', (e) => {
    if (draggedNode) {
        const x = e.clientX - offset.x;
        const y = e.clientY - offset.y;
        draggedNode.style.left = x + 'px';
        draggedNode.style.top = y + 'px';

        // Update model
        const nodeData = nodes.find(n => n.id === draggedNode.id);
        if (nodeData) {
            nodeData.x = x;
            nodeData.y = y;
        }

        drawConnections();
    } else if (isConnecting && connectStartNode) {
        // Draw elastic line
        drawConnections(e.clientX, e.clientY);
    }
});

document.addEventListener('mouseup', () => {
    if (draggedNode) {
        draggedNode = null;
        saveBoard();
    }
});

// --- CONNECTIONS ---
function startConnection() {
    if (!contextMenu.dataset.target) return;
    connectStartNode = document.getElementById(contextMenu.dataset.target);
    isConnecting = true;
    document.body.classList.add('connecting');
    hideContextMenu();
}

function completeConnection(targetEl) {
    if (targetEl.id === connectStartNode.id) return;

    // Check duplicate
    const exists = connections.some(c =>
        (c.from === connectStartNode.id && c.to === targetEl.id) ||
        (c.from === targetEl.id && c.to === connectStartNode.id)
    );

    if (!exists) {
        connections.push({ from: connectStartNode.id, to: targetEl.id });
        saveBoard();
    }

    isConnecting = false;
    connectStartNode = null;
    document.body.classList.remove('connecting');
    drawConnections();
}

// Cancel connecting on global click if not hitting a node
document.addEventListener('click', (e) => {
    if (isConnecting && !e.target.closest('.node')) {
        isConnecting = false;
        connectStartNode = null;
        document.body.classList.remove('connecting');
        drawConnections();
    }
    hideContextMenu();
});

function drawConnections(mouseX, mouseY) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#d35400'; // String color
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.6;

    // Draw existing
    connections.forEach(conn => {
        const n1 = document.getElementById(conn.from);
        const n2 = document.getElementById(conn.to);
        if (n1 && n2) {
            drawCurve(n1, n2);
        }
    });

    // Draw active elastic
    if (isConnecting && connectStartNode && mouseX) {
        const rect = connectStartNode.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(mouseX, mouseY);
        ctx.strokeStyle = '#f1c40f';
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function drawCurve(el1, el2) {
    const r1 = el1.getBoundingClientRect();
    const r2 = el2.getBoundingClientRect();

    const x1 = r1.left + r1.width / 2;
    const y1 = r1.top + r1.height / 2;
    const x2 = r2.left + r2.width / 2;
    const y2 = r2.top + r2.height / 2;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    // Simple line for now, maybe bezier later
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

// --- CONTEXT MENU ---
function showContextMenu(e, node) {
    e.preventDefault();
    contextMenu.style.display = 'block';
    contextMenu.style.left = e.clientX + 'px';
    contextMenu.style.top = e.clientY + 'px';
    contextMenu.dataset.target = node.id;
}

function hideContextMenu() {
    contextMenu.style.display = 'none';
}

function deleteTargetNode() {
    const id = contextMenu.dataset.target;
    if (id) {
        const el = document.getElementById(id);
        if (el) el.remove();

        // Remove from data
        nodes = nodes.filter(n => n.id !== id);
        connections = connections.filter(c => c.from !== id && c.to !== id);

        saveBoard();
        drawConnections();
    }
    hideContextMenu();
}

function selectNode(e, el) {
    // Optional: highlight selection logic
}

// --- PERSISTENCE ---
function saveBoard() {
    // Scrape DOM for latest content
    const currentNodes = Array.from(document.querySelectorAll('.node')).map(el => ({
        id: el.id,
        type: el.classList.contains('type-person') ? 'person' :
            el.classList.contains('type-location') ? 'location' :
                el.classList.contains('type-clue') ? 'clue' : 'note',
        x: parseInt(el.style.left),
        y: parseInt(el.style.top),
        title: el.querySelector('.node-title').innerText,
        body: el.querySelector('.node-body').innerText
    }));

    const data = {
        name: document.getElementById('caseName').innerText,
        nodes: currentNodes,
        connections: connections
    };

    localStorage.setItem('invBoardData', JSON.stringify(data));
}

function loadBoard() {
    const raw = localStorage.getItem('invBoardData');
    if (raw) {
        const data = JSON.parse(raw);
        document.getElementById('caseName').innerText = data.name || "UNNAMED";
        connections = data.connections || [];
        nodes = data.nodes || [];

        container.innerHTML = '';
        nodes.forEach(n => {
            createNode(n.type, n.x + 75, n.y + 40, n.id, { title: n.title, body: n.body });
        });
    }
}

function clearBoard() {
    if (confirm("Clear the entire investigation board?")) {
        nodes = [];
        connections = [];
        container.innerHTML = '';
        saveBoard();
        drawConnections();
    }
}
