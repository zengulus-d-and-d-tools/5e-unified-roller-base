(function (global) {
    'use strict';

    const DEFAULT_STORY_NAME = 'My Story';
    const MAX_NODES = 260;
    const MAX_CONNECTIONS = 1200;
    const NODE_TYPES = new Set(['person', 'event', 'clue', 'theory', 'note', 'group']);
    const NODE_TYPE_LABELS = {
        person: 'Person',
        event: 'Event',
        clue: 'Clue',
        theory: 'Theory',
        note: 'Note',
        group: 'Group Box'
    };

    const NODE_DEFAULT_WIDTH = 250;
    const NODE_DEFAULT_HEIGHT = 172;
    const GROUP_DEFAULT_WIDTH = 460;
    const GROUP_DEFAULT_HEIGHT = 300;
    const GROUP_MIN_WIDTH = 220;
    const GROUP_MIN_HEIGHT = 140;
    const GROUP_MAX_WIDTH = 2200;
    const GROUP_MAX_HEIGHT = 1600;

    const WORLD_WIDTH = 3600;
    const WORLD_HEIGHT = 2400;
    const VIEW_SCALE_MIN = 0.45;
    const VIEW_SCALE_MAX = 2.5;

    const SVG_NS = 'http://www.w3.org/2000/svg';

    const refs = {
        root: null,
        stage: null,
        svg: null,
        nodeLayer: null,
        labelLayer: null,
        status: null,
        panBtn: null
    };

    let story = createDefaultStory();
    let linkSourceId = null;
    let onChange = null;
    let initialized = false;
    let suppressChange = false;

    let dragState = null;
    let resizeState = null;
    let panDrag = null;
    let panMode = false;

    let renderQueued = false;
    let addNudge = 0;
    let persistTimer = null;

    function createDefaultStory() {
        return {
            name: DEFAULT_STORY_NAME,
            view: { x: 0, y: 0, scale: 1 },
            nodes: [],
            connections: []
        };
    }

    function deepClone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function sanitizeString(value, fallback = '', maxLen = 2000) {
        const text = typeof value === 'string' ? value : fallback;
        return text.slice(0, maxLen);
    }

    function sanitizeNumber(value, fallback = 0, min = -Infinity, max = Infinity) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        return clamp(parsed, min, max);
    }

    function sanitizeBoolean(value, fallback = false) {
        if (typeof value === 'boolean') return value;
        return fallback;
    }

    function sanitizeToken(value, prefix = 'entry') {
        const raw = String(value || '').trim();
        const clean = raw.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
        if (!clean || clean === '__proto__' || clean === 'prototype' || clean === 'constructor') {
            return buildId(prefix);
        }
        return clean;
    }

    function buildId(prefix = 'entry') {
        const head = String(prefix || 'entry').replace(/[^A-Za-z0-9_]/g, '').slice(0, 20) || 'entry';
        return `${head}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function resolveNodeType(value) {
        const token = String(value || '').trim().toLowerCase();
        if (!NODE_TYPES.has(token)) return 'note';
        return token;
    }

    function normalizeView(rawView) {
        const view = rawView && typeof rawView === 'object' ? rawView : {};
        return {
            x: sanitizeNumber(view.x, 0, -16000, 16000),
            y: sanitizeNumber(view.y, 0, -16000, 16000),
            scale: sanitizeNumber(view.scale, 1, VIEW_SCALE_MIN, VIEW_SCALE_MAX)
        };
    }

    function sanitizeStory(raw) {
        const source = raw && typeof raw === 'object' ? raw : {};
        const out = createDefaultStory();
        out.name = sanitizeString(source.name, DEFAULT_STORY_NAME, 120) || DEFAULT_STORY_NAME;
        out.view = normalizeView(source.view);

        const nodesSource = Array.isArray(source.nodes) ? source.nodes : [];
        const nodeIds = new Set();

        nodesSource.slice(0, MAX_NODES).forEach((entry, index) => {
            const row = entry && typeof entry === 'object' ? entry : {};
            let nodeId = sanitizeToken(row.id || `story_node_${index}`, 'story_node');
            while (nodeIds.has(nodeId)) nodeId = buildId('story_node');
            nodeIds.add(nodeId);

            const type = resolveNodeType(row.type);
            const fallbackTitle = NODE_TYPE_LABELS[type] || 'Note';
            const node = {
                id: nodeId,
                type,
                x: Math.round(sanitizeNumber(row.x, 120 + (index % 6) * 30, -5000, WORLD_WIDTH + 5000)),
                y: Math.round(sanitizeNumber(row.y, 120 + (index % 6) * 30, -5000, WORLD_HEIGHT + 5000)),
                title: sanitizeString(row.title, fallbackTitle, 200) || fallbackTitle,
                body: sanitizeString(row.body, '', 12000)
            };

            if (type === 'group') {
                const widthSource = row.w !== undefined ? row.w : row.width;
                const heightSource = row.h !== undefined ? row.h : row.height;
                node.w = Math.round(sanitizeNumber(widthSource, GROUP_DEFAULT_WIDTH, GROUP_MIN_WIDTH, GROUP_MAX_WIDTH));
                node.h = Math.round(sanitizeNumber(heightSource, GROUP_DEFAULT_HEIGHT, GROUP_MIN_HEIGHT, GROUP_MAX_HEIGHT));
                if (!node.title) node.title = 'Group Box';
            }

            out.nodes.push(node);
        });

        const linksSource = Array.isArray(source.connections) ? source.connections : [];
        const pairSet = new Set();
        const linkIds = new Set();

        linksSource.slice(0, MAX_CONNECTIONS).forEach((entry, index) => {
            const row = entry && typeof entry === 'object' ? entry : {};
            const from = sanitizeString(row.from, '', 120);
            const to = sanitizeString(row.to, '', 120);
            if (!nodeIds.has(from) || !nodeIds.has(to) || from === to) return;

            const pair = from < to ? `${from}::${to}` : `${to}::${from}`;
            if (pairSet.has(pair)) return;
            pairSet.add(pair);

            let id = sanitizeToken(row.id || `story_link_${index}`, 'story_link');
            while (linkIds.has(id)) id = buildId('story_link');
            linkIds.add(id);

            out.connections.push({
                id,
                from,
                to,
                label: sanitizeString(row.label, '', 120),
                arrowStart: sanitizeBoolean(row.arrowStart, false),
                arrowEnd: sanitizeBoolean(row.arrowEnd, false)
            });
        });

        return out;
    }

    function queryDomRefs() {
        refs.root = document.getElementById('myStoryBoardRoot');
        refs.stage = document.getElementById('myStoryBoardStage');
        refs.svg = document.getElementById('myStoryConnections');
        refs.nodeLayer = document.getElementById('myStoryNodes');
        refs.labelLayer = document.getElementById('myStoryLabels');
        refs.status = document.getElementById('myStoryStatus');
        refs.panBtn = document.getElementById('myStoryPanBtn');

        if (refs.stage && !refs.labelLayer) {
            const labelLayer = document.createElement('div');
            labelLayer.id = 'myStoryLabels';
            labelLayer.className = 'my-story-labels';
            refs.stage.appendChild(labelLayer);
            refs.labelLayer = labelLayer;
        }

        return !!(refs.root && refs.stage && refs.svg && refs.nodeLayer && refs.labelLayer && refs.status);
    }

    function syncWorldBounds() {
        if (!refs.svg || !refs.nodeLayer || !refs.labelLayer) return;
        refs.svg.setAttribute('viewBox', `0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`);
        refs.svg.setAttribute('width', String(WORLD_WIDTH));
        refs.svg.setAttribute('height', String(WORLD_HEIGHT));

        refs.nodeLayer.style.width = `${WORLD_WIDTH}px`;
        refs.nodeLayer.style.height = `${WORLD_HEIGHT}px`;
        refs.labelLayer.style.width = `${WORLD_WIDTH}px`;
        refs.labelLayer.style.height = `${WORLD_HEIGHT}px`;

        refs.svg.style.transformOrigin = '0 0';
        refs.nodeLayer.style.transformOrigin = '0 0';
        refs.labelLayer.style.transformOrigin = '0 0';
    }

    function setStatus(message, mode = 'idle') {
        if (!refs.status) return;
        refs.status.textContent = message;
        refs.status.setAttribute('data-mode', mode);
    }

    function setIdleStatus() {
        if (linkSourceId) return;
        if (panMode) {
            setStatus('Pan mode is ON. Drag empty space to move the board and use mouse wheel to zoom.', 'info');
            return;
        }
        setStatus('Add nodes, drag them into place, use Link for relationships, and Alt+click a line to delete it.', 'idle');
    }

    function emitChange() {
        if (suppressChange || typeof onChange !== 'function') return;
        try {
            onChange(deepClone(story));
        } catch (error) {
            console.error('My Story board onChange failed', error);
        }
    }

    function emitChangeSoon() {
        if (suppressChange) return;
        if (persistTimer) clearTimeout(persistTimer);
        persistTimer = setTimeout(() => {
            persistTimer = null;
            emitChange();
        }, 140);
    }

    function getNodeById(nodeId) {
        return story.nodes.find((node) => node.id === nodeId) || null;
    }

    function getNodeElementById(nodeId) {
        if (!refs.nodeLayer || !nodeId) return null;
        return refs.nodeLayer.querySelector(`.my-story-node[data-node-id="${nodeId}"]`);
    }

    function resolveNodeBox(node, nodeEl = null) {
        if (!node) return { w: NODE_DEFAULT_WIDTH, h: NODE_DEFAULT_HEIGHT };
        if (node.type === 'group') {
            const w = Math.round(sanitizeNumber(node.w, GROUP_DEFAULT_WIDTH, GROUP_MIN_WIDTH, GROUP_MAX_WIDTH));
            const h = Math.round(sanitizeNumber(node.h, GROUP_DEFAULT_HEIGHT, GROUP_MIN_HEIGHT, GROUP_MAX_HEIGHT));
            return { w, h };
        }

        const measuredW = nodeEl && nodeEl.offsetWidth > 20 ? nodeEl.offsetWidth : NODE_DEFAULT_WIDTH;
        const measuredH = nodeEl && nodeEl.offsetHeight > 20 ? nodeEl.offsetHeight : NODE_DEFAULT_HEIGHT;
        return { w: measuredW, h: measuredH };
    }

    function clampNodeToWorld(node, nodeEl = null) {
        if (!node) return;
        const box = resolveNodeBox(node, nodeEl);
        const maxX = Math.max(8, WORLD_WIDTH - box.w - 8);
        const maxY = Math.max(8, WORLD_HEIGHT - box.h - 8);
        node.x = Math.round(clamp(sanitizeNumber(node.x, 8, -5000, 5000), 8, maxX));
        node.y = Math.round(clamp(sanitizeNumber(node.y, 8, -5000, 5000), 8, maxY));
        if (node.type === 'group') {
            node.w = Math.round(clamp(sanitizeNumber(node.w, GROUP_DEFAULT_WIDTH, GROUP_MIN_WIDTH, GROUP_MAX_WIDTH), GROUP_MIN_WIDTH, GROUP_MAX_WIDTH));
            node.h = Math.round(clamp(sanitizeNumber(node.h, GROUP_DEFAULT_HEIGHT, GROUP_MIN_HEIGHT, GROUP_MAX_HEIGHT), GROUP_MIN_HEIGHT, GROUP_MAX_HEIGHT));
        }
    }

    function refreshLinkModeUI() {
        if (!refs.nodeLayer) return;
        refs.nodeLayer.querySelectorAll('.my-story-node').forEach((el) => {
            const nodeId = el.getAttribute('data-node-id');
            const node = getNodeById(nodeId);
            const isSource = !!(linkSourceId && node && node.type !== 'group' && node.id === linkSourceId);
            el.classList.toggle('link-source', isSource);
        });

        if (linkSourceId) {
            const sourceNode = getNodeById(linkSourceId);
            const title = sourceNode ? (sourceNode.title || NODE_TYPE_LABELS[sourceNode.type] || 'node') : 'node';
            setStatus(`Link mode: select a target for "${title}".`, 'link');
        } else {
            setIdleStatus();
        }
    }

    function setLinkSource(nextSourceId) {
        linkSourceId = nextSourceId || null;
        refreshLinkModeUI();
    }

    function cancelLinkMode() {
        if (!linkSourceId) return;
        setLinkSource(null);
    }

    function syncPanModeUI() {
        if (refs.panBtn) {
            refs.panBtn.textContent = panMode ? 'Pan: ON' : 'Pan: OFF';
            refs.panBtn.classList.toggle('active', panMode);
        }
        if (refs.stage) {
            refs.stage.classList.toggle('pan-mode', panMode);
            if (!panDrag) refs.stage.classList.remove('panning');
        }
        if (!linkSourceId) setIdleStatus();
    }

    function applyView() {
        if (!refs.svg || !refs.nodeLayer || !refs.labelLayer) return;
        story.view = normalizeView(story.view);
        const transform = `translate(${story.view.x}px, ${story.view.y}px) scale(${story.view.scale})`;
        refs.svg.style.transform = transform;
        refs.nodeLayer.style.transform = transform;
        refs.labelLayer.style.transform = transform;
        queueRenderConnections();
    }

    function worldFromStagePosition(localX, localY) {
        return {
            x: (localX - story.view.x) / story.view.scale,
            y: (localY - story.view.y) / story.view.scale
        };
    }

    function screenToWorld(clientX, clientY) {
        if (!refs.stage) return { x: 0, y: 0 };
        const rect = refs.stage.getBoundingClientRect();
        return worldFromStagePosition(clientX - rect.left, clientY - rect.top);
    }

    function shouldStartPan(event) {
        if (!refs.stage || !event) return false;
        const isMouse = event.pointerType === 'mouse' || event.pointerType === undefined;
        if (isMouse && event.button === 1) return true;
        if (!panMode) return false;
        if (isMouse && event.button !== 0) return false;
        if (event.target && event.target.closest('.my-story-node, .my-story-connection-label, input, textarea, button, .my-story-group-resize')) {
            return false;
        }
        return true;
    }

    function handlePanMove(event) {
        if (!panDrag) return;
        story.view.x = panDrag.originX + (event.clientX - panDrag.startX);
        story.view.y = panDrag.originY + (event.clientY - panDrag.startY);
        applyView();
        emitChangeSoon();
    }

    function finishPan() {
        if (!panDrag) return;
        document.removeEventListener('pointermove', handlePanMove);
        document.removeEventListener('pointerup', finishPan);
        document.removeEventListener('pointercancel', finishPan);

        panDrag = null;
        if (refs.stage) refs.stage.classList.remove('panning');
        emitChange();
    }

    function startPan(event) {
        if (!shouldStartPan(event)) return;

        panDrag = {
            startX: event.clientX,
            startY: event.clientY,
            originX: story.view.x,
            originY: story.view.y
        };

        if (refs.stage) refs.stage.classList.add('panning');
        document.addEventListener('pointermove', handlePanMove);
        document.addEventListener('pointerup', finishPan);
        document.addEventListener('pointercancel', finishPan);

        event.preventDefault();
    }

    function handleStageWheel(event) {
        if (!refs.stage) return;
        if (event.target && event.target.closest('input, textarea')) return;
        event.preventDefault();

        const rect = refs.stage.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;

        const wx = (px - story.view.x) / story.view.scale;
        const wy = (py - story.view.y) / story.view.scale;

        const factor = event.deltaY < 0 ? 1.12 : 0.89;
        const nextScale = clamp(story.view.scale * factor, VIEW_SCALE_MIN, VIEW_SCALE_MAX);
        if (Math.abs(nextScale - story.view.scale) < 0.0001) return;

        story.view.scale = nextScale;
        story.view.x = px - (wx * nextScale);
        story.view.y = py - (wy * nextScale);

        applyView();
        emitChangeSoon();
    }

    function collectGroupFollowers(groupNode) {
        if (!groupNode || groupNode.type !== 'group') return [];
        const groupBox = resolveNodeBox(groupNode);
        const left = groupNode.x;
        const top = groupNode.y;
        const right = left + groupBox.w;
        const bottom = top + groupBox.h;

        const followers = [];
        story.nodes.forEach((node) => {
            if (!node || node.id === groupNode.id || node.type === 'group') return;
            const box = resolveNodeBox(node);
            const cx = node.x + (box.w * 0.5);
            const cy = node.y + (box.h * 0.5);
            if (cx >= left && cx <= right && cy >= top && cy <= bottom) {
                followers.push({
                    id: node.id,
                    startX: node.x,
                    startY: node.y,
                    node,
                    el: getNodeElementById(node.id)
                });
            }
        });
        return followers;
    }

    function handleNodeDragMove(event) {
        if (!dragState) return;
        const node = getNodeById(dragState.nodeId);
        if (!node) return;

        const point = screenToWorld(event.clientX, event.clientY);
        const rawDx = point.x - dragState.startWorldX;
        const rawDy = point.y - dragState.startWorldY;

        node.x = Math.round(dragState.nodeStartX + rawDx);
        node.y = Math.round(dragState.nodeStartY + rawDy);
        clampNodeToWorld(node, dragState.nodeEl);

        const actualDx = node.x - dragState.nodeStartX;
        const actualDy = node.y - dragState.nodeStartY;

        if (dragState.nodeEl) {
            dragState.nodeEl.style.left = `${node.x}px`;
            dragState.nodeEl.style.top = `${node.y}px`;
        }

        if (Array.isArray(dragState.followers) && dragState.followers.length) {
            dragState.followers.forEach((entry) => {
                if (!entry || !entry.node) return;
                entry.node.x = Math.round(entry.startX + actualDx);
                entry.node.y = Math.round(entry.startY + actualDy);
                clampNodeToWorld(entry.node, entry.el || null);
                if (entry.el) {
                    entry.el.style.left = `${entry.node.x}px`;
                    entry.el.style.top = `${entry.node.y}px`;
                }
            });
        }

        queueRenderConnections();
    }

    function finishNodeDrag(event) {
        if (!dragState) return;
        document.removeEventListener('pointermove', handleNodeDragMove);
        document.removeEventListener('pointerup', finishNodeDrag);
        document.removeEventListener('pointercancel', finishNodeDrag);

        if (dragState.nodeEl) {
            dragState.nodeEl.classList.remove('dragging');
            if (typeof dragState.nodeEl.releasePointerCapture === 'function' && event && event.pointerId !== undefined) {
                try {
                    dragState.nodeEl.releasePointerCapture(event.pointerId);
                } catch (err) {
                    // Ignore pointer capture release errors.
                }
            }
        }

        dragState = null;
        emitChange();
    }

    function startNodeDrag(event, nodeId, nodeEl) {
        if (!nodeEl || !refs.stage) return;
        const isMouse = event.pointerType === 'mouse' || event.pointerType === undefined;
        if (isMouse && event.button !== 0) return;
        if (event.target && event.target.closest('input, textarea, button, .my-story-group-resize')) return;

        const node = getNodeById(nodeId);
        if (!node) return;

        const point = screenToWorld(event.clientX, event.clientY);
        dragState = {
            nodeId,
            nodeEl,
            nodeStartX: node.x,
            nodeStartY: node.y,
            startWorldX: point.x,
            startWorldY: point.y,
            followers: node.type === 'group' ? collectGroupFollowers(node) : []
        };

        nodeEl.classList.add('dragging');
        if (typeof nodeEl.setPointerCapture === 'function' && event.pointerId !== undefined) {
            try {
                nodeEl.setPointerCapture(event.pointerId);
            } catch (err) {
                // Ignore pointer capture errors.
            }
        }

        document.addEventListener('pointermove', handleNodeDragMove);
        document.addEventListener('pointerup', finishNodeDrag);
        document.addEventListener('pointercancel', finishNodeDrag);

        event.preventDefault();
        event.stopPropagation();
    }

    function handleGroupResizeMove(event) {
        if (!resizeState) return;
        const node = getNodeById(resizeState.nodeId);
        if (!node || node.type !== 'group') return;

        const point = screenToWorld(event.clientX, event.clientY);
        const dx = point.x - resizeState.startWorldX;
        const dy = point.y - resizeState.startWorldY;

        node.w = Math.round(clamp(resizeState.startW + dx, GROUP_MIN_WIDTH, GROUP_MAX_WIDTH));
        node.h = Math.round(clamp(resizeState.startH + dy, GROUP_MIN_HEIGHT, GROUP_MAX_HEIGHT));
        clampNodeToWorld(node, resizeState.nodeEl);

        resizeState.nodeEl.style.width = `${node.w}px`;
        resizeState.nodeEl.style.height = `${node.h}px`;
        resizeState.nodeEl.style.left = `${node.x}px`;
        resizeState.nodeEl.style.top = `${node.y}px`;

        queueRenderConnections();
    }

    function finishGroupResize(event) {
        if (!resizeState) return;
        document.removeEventListener('pointermove', handleGroupResizeMove);
        document.removeEventListener('pointerup', finishGroupResize);
        document.removeEventListener('pointercancel', finishGroupResize);

        if (resizeState.nodeEl && typeof resizeState.nodeEl.releasePointerCapture === 'function' && event && event.pointerId !== undefined) {
            try {
                resizeState.nodeEl.releasePointerCapture(event.pointerId);
            } catch (err) {
                // Ignore pointer capture release errors.
            }
        }

        resizeState = null;
        emitChange();
    }

    function startGroupResize(event, nodeId, nodeEl) {
        const node = getNodeById(nodeId);
        if (!node || node.type !== 'group' || !nodeEl) return;

        const point = screenToWorld(event.clientX, event.clientY);
        resizeState = {
            nodeId,
            nodeEl,
            startW: node.w || GROUP_DEFAULT_WIDTH,
            startH: node.h || GROUP_DEFAULT_HEIGHT,
            startWorldX: point.x,
            startWorldY: point.y
        };

        if (typeof nodeEl.setPointerCapture === 'function' && event.pointerId !== undefined) {
            try {
                nodeEl.setPointerCapture(event.pointerId);
            } catch (err) {
                // Ignore pointer capture errors.
            }
        }

        document.addEventListener('pointermove', handleGroupResizeMove);
        document.addEventListener('pointerup', finishGroupResize);
        document.addEventListener('pointercancel', finishGroupResize);

        event.preventDefault();
        event.stopPropagation();
    }

    function removeConnection(connectionId) {
        const idx = story.connections.findIndex((conn) => conn.id === connectionId);
        if (idx < 0) return;
        story.connections.splice(idx, 1);
        renderConnections();
        emitChange();
    }

    function removeNode(nodeId) {
        const idx = story.nodes.findIndex((node) => node.id === nodeId);
        if (idx < 0) return;

        story.nodes.splice(idx, 1);
        story.connections = story.connections.filter((conn) => conn.from !== nodeId && conn.to !== nodeId);
        if (linkSourceId === nodeId) linkSourceId = null;

        renderNodes();
        renderConnections();
        emitChange();
        refreshLinkModeUI();
    }

    function addConnection(fromId, toId) {
        if (!fromId || !toId || fromId === toId) return false;
        const from = getNodeById(fromId);
        const to = getNodeById(toId);
        if (!from || !to) return false;

        if (from.type === 'group' || to.type === 'group') {
            setStatus('Group boxes are background-only and cannot be linked.', 'warn');
            return false;
        }

        const exists = story.connections.some((conn) =>
            (conn.from === fromId && conn.to === toId) || (conn.from === toId && conn.to === fromId)
        );
        if (exists) {
            setStatus('Those nodes are already connected.', 'warn');
            return false;
        }

        if (story.connections.length >= MAX_CONNECTIONS) {
            setStatus('Connection limit reached for this board.', 'warn');
            return false;
        }

        story.connections.push({
            id: buildId('story_link'),
            from: fromId,
            to: toId,
            label: '',
            arrowStart: false,
            arrowEnd: false
        });

        renderConnections();
        emitChange();
        setStatus('Link created.', 'ok');
        return true;
    }

    function queueRenderConnections() {
        if (renderQueued) return;
        renderQueued = true;
        requestAnimationFrame(() => {
            renderQueued = false;
            renderConnections();
        });
    }

    function createArrowHead(group, fromX, fromY, toX, toY) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;

        const tipX = toX - (ux * 18);
        const tipY = toY - (uy * 18);
        const baseX = tipX - (ux * 11);
        const baseY = tipY - (uy * 11);

        const leftX = baseX - (uy * 6);
        const leftY = baseY + (ux * 6);
        const rightX = baseX + (uy * 6);
        const rightY = baseY - (ux * 6);

        const arrow = document.createElementNS(SVG_NS, 'polygon');
        arrow.setAttribute('class', 'my-story-connection-arrow');
        arrow.setAttribute('points', `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`);
        group.appendChild(arrow);
    }

    function createConnectionLabel(conn, midX, midY) {
        if (!refs.labelLayer) return;

        const labelEl = document.createElement('div');
        labelEl.className = 'my-story-connection-label';
        labelEl.style.left = `${midX}px`;
        labelEl.style.top = `${midY}px`;

        const startArrowBtn = document.createElement('button');
        startArrowBtn.type = 'button';
        startArrowBtn.className = 'my-story-conn-btn';
        startArrowBtn.textContent = '◀';
        startArrowBtn.title = 'Toggle arrow toward source node';
        startArrowBtn.classList.toggle('active', !!conn.arrowStart);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'my-story-conn-input';
        input.value = conn.label || '';
        input.placeholder = 'Relationship';
        input.maxLength = 120;

        const endArrowBtn = document.createElement('button');
        endArrowBtn.type = 'button';
        endArrowBtn.className = 'my-story-conn-btn';
        endArrowBtn.textContent = '▶';
        endArrowBtn.title = 'Toggle arrow toward target node';
        endArrowBtn.classList.toggle('active', !!conn.arrowEnd);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'my-story-conn-btn danger';
        deleteBtn.textContent = 'X';
        deleteBtn.title = 'Delete link';

        startArrowBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            conn.arrowStart = !conn.arrowStart;
            renderConnections();
            emitChange();
        });

        endArrowBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            conn.arrowEnd = !conn.arrowEnd;
            renderConnections();
            emitChange();
        });

        deleteBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            removeConnection(conn.id);
        });

        input.addEventListener('input', () => {
            conn.label = sanitizeString(input.value, '', 120);
            emitChangeSoon();
        });

        [labelEl, startArrowBtn, input, endArrowBtn, deleteBtn].forEach((el) => {
            el.addEventListener('pointerdown', (event) => {
                event.stopPropagation();
            });
        });

        labelEl.append(startArrowBtn, input, endArrowBtn, deleteBtn);
        refs.labelLayer.appendChild(labelEl);
    }

    function renderConnections() {
        if (!refs.svg || !refs.nodeLayer || !refs.labelLayer) return;
        refs.svg.innerHTML = '';
        refs.labelLayer.innerHTML = '';

        const nodesById = new Map();
        refs.nodeLayer.querySelectorAll('.my-story-node').forEach((el) => {
            nodesById.set(el.getAttribute('data-node-id'), el);
        });

        story.connections.forEach((conn) => {
            const fromNode = getNodeById(conn.from);
            const toNode = getNodeById(conn.to);
            const fromEl = nodesById.get(conn.from);
            const toEl = nodesById.get(conn.to);
            if (!fromNode || !toNode || !fromEl || !toEl) return;

            const fromBox = resolveNodeBox(fromNode, fromEl);
            const toBox = resolveNodeBox(toNode, toEl);

            const x1 = fromNode.x + (fromBox.w / 2);
            const y1 = fromNode.y + (fromBox.h / 2);
            const x2 = toNode.x + (toBox.w / 2);
            const y2 = toNode.y + (toBox.h / 2);

            const group = document.createElementNS(SVG_NS, 'g');
            group.setAttribute('data-connection-id', conn.id);

            const line = document.createElementNS(SVG_NS, 'line');
            line.setAttribute('x1', String(x1));
            line.setAttribute('y1', String(y1));
            line.setAttribute('x2', String(x2));
            line.setAttribute('y2', String(y2));
            line.setAttribute('class', 'my-story-connection-line');
            group.appendChild(line);

            if (conn.arrowStart) createArrowHead(group, x2, y2, x1, y1);
            if (conn.arrowEnd) createArrowHead(group, x1, y1, x2, y2);

            const hitArea = document.createElementNS(SVG_NS, 'line');
            hitArea.setAttribute('x1', String(x1));
            hitArea.setAttribute('y1', String(y1));
            hitArea.setAttribute('x2', String(x2));
            hitArea.setAttribute('y2', String(y2));
            hitArea.setAttribute('class', 'my-story-connection-hit');
            hitArea.addEventListener('click', (event) => {
                event.stopPropagation();
                if (!event.altKey) return;
                removeConnection(conn.id);
            });
            group.appendChild(hitArea);

            refs.svg.appendChild(group);

            const midX = (x1 + x2) * 0.5;
            const midY = (y1 + y2) * 0.5;
            createConnectionLabel(conn, midX, midY);
        });
    }

    function renderStandardNode(node, nodeEl) {
        const head = document.createElement('div');
        head.className = 'my-story-node-head';

        const label = document.createElement('span');
        label.className = 'my-story-node-label';
        label.textContent = NODE_TYPE_LABELS[node.type] || 'Note';

        const actions = document.createElement('div');
        actions.className = 'my-story-node-actions';

        const linkBtn = document.createElement('button');
        linkBtn.type = 'button';
        linkBtn.className = 'my-story-node-btn';
        linkBtn.textContent = 'Link';
        linkBtn.title = 'Connect this node to another node';
        linkBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (linkSourceId && linkSourceId !== node.id) {
                addConnection(linkSourceId, node.id);
                setLinkSource(null);
            } else if (linkSourceId === node.id) {
                setLinkSource(null);
            } else {
                setLinkSource(node.id);
            }
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'my-story-node-btn danger';
        deleteBtn.textContent = 'X';
        deleteBtn.title = 'Delete node';
        deleteBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            removeNode(node.id);
        });

        actions.append(linkBtn, deleteBtn);
        head.append(label, actions);

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.className = 'my-story-node-title';
        titleInput.value = node.title || '';
        titleInput.placeholder = 'Title';
        titleInput.addEventListener('input', () => {
            node.title = sanitizeString(titleInput.value, '', 200);
            emitChangeSoon();
        });

        const bodyInput = document.createElement('textarea');
        bodyInput.className = 'my-story-node-body';
        bodyInput.value = node.body || '';
        bodyInput.placeholder = 'Details';
        bodyInput.addEventListener('input', () => {
            node.body = sanitizeString(bodyInput.value, '', 12000);
            emitChangeSoon();
        });

        nodeEl.append(head, titleInput, bodyInput);

        head.addEventListener('pointerdown', (event) => {
            startNodeDrag(event, node.id, nodeEl);
        });

        nodeEl.addEventListener('click', (event) => {
            if (!linkSourceId) return;
            if (event.target && event.target.closest('button, input, textarea')) return;
            if (linkSourceId !== node.id) {
                addConnection(linkSourceId, node.id);
            }
            setLinkSource(null);
        });
    }

    function renderGroupNode(node, nodeEl) {
        nodeEl.classList.add('group-box');
        const size = resolveNodeBox(node);
        nodeEl.style.width = `${size.w}px`;
        nodeEl.style.height = `${size.h}px`;

        const tagWrap = document.createElement('div');
        tagWrap.className = 'my-story-group-tag-wrap';

        const tagInput = document.createElement('input');
        tagInput.type = 'text';
        tagInput.className = 'my-story-group-tag-input';
        tagInput.value = node.title || 'Group Box';
        tagInput.placeholder = 'Group Label';
        tagInput.maxLength = 200;
        tagInput.addEventListener('input', () => {
            node.title = sanitizeString(tagInput.value, 'Group Box', 200) || 'Group Box';
            emitChangeSoon();
        });
        tagWrap.appendChild(tagInput);

        const actions = document.createElement('div');
        actions.className = 'my-story-group-actions';

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'my-story-node-btn danger';
        deleteBtn.textContent = 'X';
        deleteBtn.title = 'Delete group box';
        deleteBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            removeNode(node.id);
        });
        actions.append(deleteBtn);

        const hint = document.createElement('p');
        hint.className = 'my-story-group-hint';
        hint.textContent = 'Drag this box to move enclosed nodes together.';

        const notes = document.createElement('textarea');
        notes.className = 'my-story-group-notes';
        notes.value = node.body || '';
        notes.placeholder = 'Optional group notes';
        notes.addEventListener('input', () => {
            node.body = sanitizeString(notes.value, '', 12000);
            emitChangeSoon();
        });

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'my-story-group-resize';
        resizeHandle.title = 'Resize group box';
        resizeHandle.addEventListener('pointerdown', (event) => {
            startGroupResize(event, node.id, nodeEl);
        });

        nodeEl.append(tagWrap, actions, hint, notes, resizeHandle);

        nodeEl.addEventListener('pointerdown', (event) => {
            if (event.target && event.target.closest('input, textarea, button, .my-story-group-resize')) return;
            startNodeDrag(event, node.id, nodeEl);
        });
    }

    function renderNodes() {
        if (!refs.nodeLayer) return;
        refs.nodeLayer.innerHTML = '';

        const orderedNodes = story.nodes.slice().sort((a, b) => {
            const aGroup = a.type === 'group' ? 0 : 1;
            const bGroup = b.type === 'group' ? 0 : 1;
            if (aGroup !== bGroup) return aGroup - bGroup;
            return 0;
        });

        const fragment = document.createDocumentFragment();

        orderedNodes.forEach((node) => {
            const nodeEl = document.createElement('article');
            nodeEl.className = `my-story-node type-${node.type}`;
            nodeEl.setAttribute('data-node-id', node.id);

            clampNodeToWorld(node, nodeEl);
            nodeEl.style.left = `${node.x}px`;
            nodeEl.style.top = `${node.y}px`;

            if (node.type === 'group') {
                renderGroupNode(node, nodeEl);
            } else {
                renderStandardNode(node, nodeEl);
            }

            fragment.appendChild(nodeEl);
        });

        refs.nodeLayer.appendChild(fragment);
        refreshLinkModeUI();
    }

    function addNode(type = 'note') {
        const safeType = resolveNodeType(type);
        if (story.nodes.length >= MAX_NODES) {
            setStatus('Node limit reached for this board.', 'warn');
            return null;
        }

        const localX = refs.stage ? refs.stage.clientWidth * 0.5 : 600;
        const localY = refs.stage ? refs.stage.clientHeight * 0.5 : 400;
        const center = worldFromStagePosition(localX, localY);

        const nudge = (addNudge % 9) * 24;
        addNudge += 1;

        const nextNode = {
            id: buildId('story_node'),
            type: safeType,
            x: Math.round(center.x - (NODE_DEFAULT_WIDTH * 0.5) + nudge),
            y: Math.round(center.y - (NODE_DEFAULT_HEIGHT * 0.5) + nudge),
            title: NODE_TYPE_LABELS[safeType] || 'Note',
            body: ''
        };

        if (safeType === 'group') {
            nextNode.w = GROUP_DEFAULT_WIDTH;
            nextNode.h = GROUP_DEFAULT_HEIGHT;
            nextNode.title = 'Group Box';
            nextNode.y = Math.round(center.y - (GROUP_DEFAULT_HEIGHT * 0.5) + nudge);
            nextNode.x = Math.round(center.x - (GROUP_DEFAULT_WIDTH * 0.5) + nudge);
        }

        clampNodeToWorld(nextNode);
        story.nodes.push(nextNode);

        renderNodes();
        renderConnections();
        emitChange();
        return nextNode.id;
    }

    function clearBoard() {
        story.nodes = [];
        story.connections = [];
        setLinkSource(null);
        renderNodes();
        renderConnections();
        emitChange();
    }

    function refreshLayout() {
        if (!initialized) return;
        syncWorldBounds();

        if (refs.nodeLayer) {
            refs.nodeLayer.querySelectorAll('.my-story-node').forEach((nodeEl) => {
                const node = getNodeById(nodeEl.getAttribute('data-node-id'));
                clampNodeToWorld(node, nodeEl);
                if (!node) return;
                nodeEl.style.left = `${node.x}px`;
                nodeEl.style.top = `${node.y}px`;
                if (node.type === 'group') {
                    const size = resolveNodeBox(node, nodeEl);
                    nodeEl.style.width = `${size.w}px`;
                    nodeEl.style.height = `${size.h}px`;
                }
            });
        }

        applyView();
        queueRenderConnections();
    }

    function load(payload) {
        suppressChange = true;
        try {
            story = sanitizeStory(payload);
            setLinkSource(null);
            renderNodes();
            applyView();
            renderConnections();
            syncPanModeUI();
        } finally {
            suppressChange = false;
        }
    }

    function getSnapshot() {
        return deepClone(story);
    }

    function togglePanMode() {
        panMode = !panMode;
        syncPanModeUI();
    }

    function resetView() {
        story.view = { x: 0, y: 0, scale: 1 };
        applyView();
        emitChange();
    }

    function init(options = {}) {
        if (!queryDomRefs()) return false;
        if (typeof options.onChange === 'function') onChange = options.onChange;

        if (initialized) {
            refreshLayout();
            return true;
        }

        syncWorldBounds();

        refs.stage.addEventListener('pointerdown', (event) => {
            startPan(event);
        });

        refs.stage.addEventListener('wheel', handleStageWheel, { passive: false });

        refs.stage.addEventListener('click', (event) => {
            if (!linkSourceId) return;
            if (event.target === refs.stage || event.target === refs.svg || event.target === refs.nodeLayer || event.target === refs.labelLayer) {
                setLinkSource(null);
            }
        });

        window.addEventListener('resize', refreshLayout);

        initialized = true;
        syncPanModeUI();
        renderNodes();
        applyView();
        renderConnections();
        refreshLinkModeUI();
        return true;
    }

    global.MyStoryBoard = {
        init,
        load,
        getSnapshot,
        addNode,
        clear: clearBoard,
        cancelLink: cancelLinkMode,
        refreshLayout,
        togglePanMode,
        resetView
    };
})(window);
