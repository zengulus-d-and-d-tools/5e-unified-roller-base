(() => {
    const STORAGE_KEY = 'task_force_hq_v1';
    const DEFAULT_GRID = { cols: 26, rows: 18, cell: 48 };
    const ROOM_TYPES = [
        { id: 'command', label: 'Command & Control', color: '#7cdde1' },
        { id: 'logistics', label: 'Logistics & Support', color: '#f7c266' },
        { id: 'arcane', label: 'Arcano-Tech Lab', color: '#be9bff' },
        { id: 'recovery', label: 'Recovery & Hearth', color: '#7ff0c7' },
        { id: 'hangar', label: 'Motor Pool / Hangar', color: '#ff9c7f' },
        { id: 'stealth', label: 'Stealth / Intelligence', color: '#8bb5ff' }
    ];

    const escapeHTML = (str = '') => String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const formatMultiline = (str = '') => escapeHTML(str).replace(/\n/g, '<br>');
    const delegatedHandlerEvents = ['click', 'change', 'input'];
    const delegatedHandlerCache = new Map();
    let delegatedHandlersBound = false;

    const getDelegatedHandlerFn = (code) => {
        if (!delegatedHandlerCache.has(code)) {
            delegatedHandlerCache.set(code, window.RTF_DELEGATED_HANDLER.compile(code));
        }
        return delegatedHandlerCache.get(code);
    };

    const runDelegatedHandler = (el, attrName, event) => {
        const code = el.getAttribute(attrName);
        if (!code) return;

        try {
            const result = getDelegatedHandlerFn(code).call(el, event);
            if (result === false) {
                event.preventDefault();
                event.stopPropagation();
            }
        } catch (err) {
            console.error(`Delegated handler failed for ${attrName}:`, code, err);
        }
    };

    const handleDelegatedDataEvent = (event) => {
        const attrName = `data-on${event.type}`;
        let node = event.target instanceof Element ? event.target : null;

        while (node) {
            if (node.hasAttribute(attrName)) {
                runDelegatedHandler(node, attrName, event);
                if (event.cancelBubble) break;
            }
            node = node.parentElement;
        }
    };

    const bindDelegatedDataHandlers = () => {
        if (delegatedHandlersBound) return;
        delegatedHandlersBound = true;
        delegatedHandlerEvents.forEach((eventName) => {
            document.addEventListener(eventName, handleDelegatedDataEvent);
        });
    };

    const store = window.RTF_STORE;
    const hasStoreBridge = !!(store && typeof store.getHQLayout === 'function' && typeof store.updateHQLayout === 'function');

    const refs = {
        grid: document.getElementById('hq-grid'),
        roomCount: document.getElementById('stat-room-count'),
        downtimeCount: document.getElementById('stat-downtime'),
        resourceCount: document.getElementById('stat-resource'),
        toggleGrid: document.getElementById('toggle-grid'),
        detailPanel: document.getElementById('detail-panel'),
        detailBody: document.querySelector('#detail-panel .detail-body'),
        roomName: document.getElementById('room-name'),
        roomType: document.getElementById('room-type'),
        roomWidth: document.getElementById('room-width'),
        roomHeight: document.getElementById('room-height'),
        roomNotes: document.getElementById('room-notes'),
        downtimeList: document.getElementById('downtime-list'),
        resourceList: document.getElementById('resource-list'),
        addDowntime: document.getElementById('btn-add-downtime'),
        addResource: document.getElementById('btn-add-resource'),
        duplicate: document.getElementById('btn-duplicate'),
        delete: document.getElementById('btn-delete'),
        addCustom: document.getElementById('btn-add-custom'),
        clear: document.getElementById('btn-clear'),
        exportBtn: document.getElementById('btn-export'),
        importBtn: document.getElementById('btn-import'),
        screenshotBtn: document.getElementById('btn-screenshot'),
        floorTabs: document.getElementById('floor-tabs'),
        addFloor: document.getElementById('btn-add-floor'),
        renameFloor: document.getElementById('btn-rename-floor'),
        deleteFloor: document.getElementById('btn-delete-floor'),
        juniorOpsDisplay: document.getElementById('junior-ops-display'),
        juniorOpsMax: document.getElementById('junior-ops-max')
    };

    if (!refs.grid) return;

    let state = sanitizeState(hasStoreBridge ? store.getHQLayout() : loadLocalState());
    let selectedRoomId = null;
    let dragging = null;
    let playerOptions = [];
    let requisitionOptions = [];

    const getMaxJuniorOperatives = () => {
        const domVal = refs.juniorOpsMax ? parseInt(refs.juniorOpsMax.value, 10) : NaN;
        if (Number.isFinite(domVal) && domVal >= 0) return domVal;
        return Number.isFinite(state.maxJuniorOperatives) ? state.maxJuniorOperatives : 0;
    };

    const normalize = (str) => (str || '').trim().toLowerCase();

    const getPlayersFromStore = () => (store && typeof store.getPlayers === 'function') ? store.getPlayers() : [];
    const getRequisitionsFromStore = () => (store && typeof store.getRequisitions === 'function') ? store.getRequisitions() : [];

    const findPlayerById = (id) => playerOptions.find(p => p.id === id);
    const findRequisitionById = (id) => requisitionOptions.find(r => r.id === id);

    const resolvePlayerIdByName = (name) => {
        const normalized = normalize(name);
        if (!normalized) return '';
        const players = getPlayersFromStore();
        const found = players.find(p => normalize(p.name) === normalized);
        return found && found.id ? found.id : '';
    };

    const resolveRequisitionIdByName = (name) => {
        const normalized = normalize(name);
        if (!normalized) return '';
        const requisitions = getRequisitionsFromStore();
        const found = requisitions.find(req => normalize(req.item) === normalized || normalize(req.purpose) === normalized || normalize(req.requester) === normalized);
        return found && found.id ? found.id : '';
    };

    init();

    function init() {
        bindDelegatedDataHandlers();
        refs.toggleGrid.checked = state.snapToGrid;
        refs.juniorOpsMax.value = state.maxJuniorOperatives;
        buildTypeSelect();
        refreshAssigneeLists();
        renderFloorTabs();
        renderRooms();
        syncJuniorOpsMaxInput();
        updateDetailPanel();
        bindUI();
        window.addEventListener('focus', refreshAssigneeLists);
        window.addEventListener('rtf-store-updated', handleStoreUpdated);
    }

    function handleStoreUpdated(event) {
        if (!event || !event.detail || event.detail.source !== 'remote') return;
        if (!hasStoreBridge) return;
        state = sanitizeState(store.getHQLayout());
        refreshAssigneeLists();
        renderFloorTabs();
        renderRooms();
        syncJuniorOpsMaxInput();
        updateDetailPanel();
    }

    function sanitizeState(raw) {
        const base = raw || {};
        const grid = sanitizeGrid(base.grid || {});
        let floors = Array.isArray(base.floors) ? base.floors.map((floor, idx) => sanitizeFloor(floor, idx, grid)) : [];
        if (!floors.length) floors = [createFloor('Street Level')];
        const activeFloorId = floors.some(f => f.id === base.activeFloorId) ? base.activeFloorId : floors[0].id;
        return {
            grid,
            floors,
            snapToGrid: base.snapToGrid !== undefined ? !!base.snapToGrid : true,
            activeFloorId,
            maxJuniorOperatives: typeof base.maxJuniorOperatives === 'number' ? base.maxJuniorOperatives : 0
        };
    }

    function sanitizeGrid(grid) {
        return {
            cols: clampNumber(parseInt(grid.cols, 10) || DEFAULT_GRID.cols, 6, 60),
            rows: clampNumber(parseInt(grid.rows, 10) || DEFAULT_GRID.rows, 6, 60),
            cell: clampNumber(parseInt(grid.cell, 10) || DEFAULT_GRID.cell, 24, 96)
        };
    }

    function sanitizeFloor(floor, idx, grid) {
        return {
            id: floor && floor.id ? floor.id : uniqueId('floor'),
            name: floor && floor.name ? floor.name : `Level ${idx + 1}`,
            rooms: Array.isArray(floor && floor.rooms) ? floor.rooms.map(room => sanitizeRoom(room, grid)) : []
        };
    }

    function sanitizeRoom(room, grid = state.grid) {
        const width = clampNumber(room.w ?? room.width ?? 4, 1, grid.cols);
        const height = clampNumber(room.h ?? room.height ?? 3, 1, grid.rows);
        return {
            id: room.id || uniqueId('room'),
            name: room.name || 'Unnamed Room',
            type: ROOM_TYPES.some(t => t.id === room.type) ? room.type : ROOM_TYPES[0].id,
            x: clampNumber(room.x ?? 2, 0, grid.cols - width),
            y: clampNumber(room.y ?? 2, 0, grid.rows - height),
            w: width,
            h: height,
            notes: room.notes || '',
            downtimeSlots: Array.isArray(room.downtimeSlots) ? room.downtimeSlots.map(s => sanitizeSlot(s, 'downtime')) : [],
            resourceSlots: Array.isArray(room.resourceSlots) ? room.resourceSlots.map(s => sanitizeSlot(s, 'resource')) : []
        };
    }

    function sanitizeSlot(slot, type) {
        const source = slot || {};
        if (typeof slot === 'string') {
            return type === 'downtime'
                ? { id: uniqueId('slot'), label: slot, description: '', playerId: '', junior: false, clock: 0, clockTotal: 4 }
                : { id: uniqueId('slot'), label: slot, requisitionId: '' };
        }
        const descriptionSource = source.description ?? source.benefit ?? source.effect ?? source.details ?? '';
        const base = {
            id: source.id || uniqueId('slot'),
            label: source.label || '',
            description: typeof descriptionSource === 'string' ? descriptionSource : String(descriptionSource || '')
        };
        if (type === 'downtime') {
            base.playerId = source.playerId || source.assignedPlayerId || '';
            base.junior = !!source.junior;
            base.clockTotal = normalizeClockTotal(parseInt(source.clockTotal ?? source.totalSegments ?? source.segments, 10));
            base.clock = clampClockValue(parseInt(source.clock ?? source.progress ?? source.value, 10) || 0, base.clockTotal);
            if (!base.playerId && source.assigned) base.playerId = resolvePlayerIdByName(source.assigned);
            if (!base.playerId && source.assignedName) base.playerId = resolvePlayerIdByName(source.assignedName);
            if (!base.playerId && source.legacyAssignee) base.legacyAssignee = source.legacyAssignee;
            if (!base.playerId && source.assigned && !base.legacyAssignee) base.legacyAssignee = source.assigned;
        } else {
            base.requisitionId = source.requisitionId || source.assignedResourceId || source.linkedRequisitionId || '';
            if (!base.requisitionId && source.assigned) base.requisitionId = resolveRequisitionIdByName(source.assigned);
            if (!base.requisitionId && source.legacyAssignee) base.legacyAssignee = source.legacyAssignee;
            if (!base.requisitionId && source.assigned && !base.legacyAssignee) base.legacyAssignee = source.assigned;
        }
        return base;
    }

    function loadLocalState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : getDefaultState();
        } catch (err) {
            console.warn('RTF_HQ: Failed to load local state', err);
            return getDefaultState();
        }
    }

    function getDefaultState() {
        const floor = createFloor('Street Level');
        return {
            grid: { ...DEFAULT_GRID },
            floors: [floor],
            snapToGrid: true,
            activeFloorId: floor.id
        };
    }

    function persistState() {
        const payload = sanitizeState(state);
        if (hasStoreBridge) {
            store.updateHQLayout(payload);
        } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        }
        state = payload;
    }

    function buildTypeSelect() {
        refs.roomType.innerHTML = '';
        ROOM_TYPES.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.label;
            refs.roomType.appendChild(opt);
        });
    }

    function nudgedPlacement(room, floor) {
        const offset = floor.rooms.length % 4;
        room.x = clampNumber(room.x + offset, 0, state.grid.cols - room.w);
        room.y = clampNumber(room.y + offset, 0, state.grid.rows - room.h);
    }

    function renderRooms() {
        refs.grid.innerHTML = '';
        refs.grid.style.width = state.grid.cols * state.grid.cell + 'px';
        refs.grid.style.height = state.grid.rows * state.grid.cell + 'px';
        const floor = getActiveFloor();
        const rooms = floor ? floor.rooms : [];

        rooms.forEach(room => {
            const el = document.createElement('div');
            el.className = 'room';
            if (room.id === selectedRoomId) el.classList.add('selected');
            const type = getRoomType(room.type);
            el.style.left = room.x * state.grid.cell + 'px';
            el.style.top = room.y * state.grid.cell + 'px';
            el.style.width = room.w * state.grid.cell + 'px';
            el.style.height = room.h * state.grid.cell + 'px';
            el.style.borderColor = type.color;
            el.style.boxShadow = `0 10px 30px rgba(0,0,0,0.35), 0 0 20px ${type.color}33`;
            el.dataset.id = room.id;
            el.innerHTML = `
                <div class="room-label">
                    <span class="room-name">${escapeHTML(room.name)}</span>
                </div>
                <div class="room-slots">
                    <span>⏱ ${room.downtimeSlots.length}</span>
                    <span>⚙ ${room.resourceSlots.length}</span>
                </div>
                <div class="room-designation">${escapeHTML(type.label)}</div>
            `;
            el.addEventListener('pointerdown', (ev) => startDrag(ev, room.id));
            el.addEventListener('click', (ev) => {
                ev.stopPropagation();
                selectRoom(room.id);
            });
            el.addEventListener('mouseenter', (ev) => showRoomPopout(ev, room));
            el.addEventListener('mouseleave', hideRoomPopout);
            refs.grid.appendChild(el);
        });

        updateStats();
    }

    function startDrag(ev, roomId) {
        if (ev.button !== 0) return;
        const found = findRoomWithFloor(roomId);
        if (!found) return;
        if (found.floor.id !== state.activeFloorId) {
            state.activeFloorId = found.floor.id;
            renderFloorTabs();
        }
        selectRoom(roomId);
        ev.preventDefault();
        const gridRect = refs.grid.getBoundingClientRect();
        dragging = {
            id: roomId,
            offsetX: ev.clientX - gridRect.left - found.room.x * state.grid.cell,
            offsetY: ev.clientY - gridRect.top - found.room.y * state.grid.cell
        };
        window.addEventListener('pointermove', onDrag);
        window.addEventListener('pointerup', stopDrag);
    }

    function onDrag(ev) {
        if (!dragging) return;
        const room = getRoom(dragging.id);
        if (!room) return;
        const rect = refs.grid.getBoundingClientRect();
        let rawX = (ev.clientX - rect.left - dragging.offsetX) / state.grid.cell;
        let rawY = (ev.clientY - rect.top - dragging.offsetY) / state.grid.cell;
        if (state.snapToGrid) {
            rawX = Math.round(rawX);
            rawY = Math.round(rawY);
        }
        room.x = clampNumber(rawX, 0, state.grid.cols - room.w);
        room.y = clampNumber(rawY, 0, state.grid.rows - room.h);
        renderRooms();
        ev.preventDefault();
    }

    function stopDrag() {
        if (dragging) {
            persistState();
        }
        dragging = null;
        window.removeEventListener('pointermove', onDrag);
        window.removeEventListener('pointerup', stopDrag);
    }

    function selectRoom(id) {
        selectedRoomId = id;
        const located = id ? findRoomWithFloor(id) : null;
        if (located && located.floor.id !== state.activeFloorId) {
            state.activeFloorId = located.floor.id;
            renderFloorTabs();
        }
        updateDetailPanel();
        renderRooms();
    }

    function getActiveFloor() {
        if (!state.floors.length) {
            const floor = createFloor('Street Level');
            state.floors.push(floor);
            state.activeFloorId = floor.id;
        }
        const floor = state.floors.find(f => f.id === state.activeFloorId) || state.floors[0];
        state.activeFloorId = floor.id;
        return floor;
    }

    function getAllRooms() {
        return state.floors.flatMap(f => f.rooms);
    }

    function getRoom(id) {
        const data = findRoomWithFloor(id);
        return data ? data.room : null;
    }

    function findRoomWithFloor(id) {
        if (!id) return null;
        for (const floor of state.floors) {
            const room = floor.rooms.find(r => r.id === id);
            if (room) return { room, floor };
        }
        return null;
    }

    function getJuniorOpsCount() {
        let count = 0;
        state.floors.forEach(f => {
            f.rooms.forEach(r => {
                r.downtimeSlots.forEach(s => {
                    if (s.junior) count++;
                });
            });
        });
        return count;
    }

    function updateStats() {
        const rooms = getAllRooms();
        const downtime = rooms.reduce((sum, r) => sum + r.downtimeSlots.length, 0);
        const resources = rooms.reduce((sum, r) => sum + r.resourceSlots.length, 0);
        refs.roomCount.textContent = rooms.length;
        refs.downtimeCount.textContent = downtime;
        refs.resourceCount.textContent = resources;

        const used = getJuniorOpsCount();
        const max = getMaxJuniorOperatives();
        const available = Math.max(0, max - used);
        refs.juniorOpsDisplay.textContent = available;
    }


    function updateDetailPanel() {
        const room = getRoom(selectedRoomId);
        const empty = refs.detailPanel.querySelector('.detail-empty');
        if (!room) {
            empty.style.display = 'block';
            refs.detailBody.classList.add('hidden');
            return;
        }
        empty.style.display = 'none';
        refs.detailBody.classList.remove('hidden');
        refs.roomName.value = room.name;
        refs.roomType.value = room.type;
        refs.roomWidth.value = room.w;
        refs.roomHeight.value = room.h;
        refs.roomNotes.value = room.notes;
        refs.toggleGrid.checked = state.snapToGrid;
        renderSlotList(refs.downtimeList, room.downtimeSlots, 'downtime');
        renderSlotList(refs.resourceList, room.resourceSlots, 'resource');
    }



    function renderSlotList(container, slots, type) {
        container.innerHTML = '';
        if (!slots.length) {
            const empty = document.createElement('p');
            empty.className = 'mini';
            empty.textContent = `No ${type === 'downtime' ? 'downtime' : 'resource'} slots yet.`;
            container.appendChild(empty);
            return;
        }
        slots.forEach(slot => {
            const item = document.createElement('div');
            item.className = 'slot-item';
            item.dataset.id = slot.id;
            if (type === 'downtime' && slot.junior) {
                item.title = 'Junior operative';
            }
            const assignmentMarkup = type === 'downtime'
                ? buildPlayerAssignment(slot)
                : buildResourceAssignment(slot);
            const descriptionField = type === 'downtime'
                ? `<textarea class="slot-field slot-desc" data-field="description" rows="2" placeholder="Description / Benefit">${escapeHTML(slot.description || '')}</textarea>`
                : '';
            const clockControl = type === 'downtime' ? buildSlotClock(slot) : '';
            item.innerHTML = `
                <div class="slot-row">
                    <input class="slot-field slot-label" data-field="label" type="text" placeholder="Slot name" value="${escapeHTML(slot.label)}">
                    ${descriptionField}
                </div>
                ${assignmentMarkup}
                ${clockControl}
                <button class="btn ghost small" data-action="remove">Remove</button>
            `;
            container.appendChild(item);
        });
    }

    function renderClockPie(value, total = 4, extraClass = '') {
        const maxSegments = normalizeClockTotal(total);
        const safeValue = clampClockValue(value, maxSegments);
        const fill = Math.round((safeValue / maxSegments) * 360);
        const className = extraClass ? `clock-pie ${extraClass}` : 'clock-pie';
        return `<div class="${className} clock-total-${maxSegments} clock-fill-${fill}" role="img" aria-label="Clock ${safeValue} of ${maxSegments}"></div>`;
    }

    function buildSlotClock(slot) {
        const total = normalizeClockTotal(slot.clockTotal);
        const value = clampClockValue(slot.clock, total);
        const active4 = total === 4 ? ' active' : '';
        const active6 = total === 6 ? ' active' : '';
        return `
            <div class="slot-row">
                <label>Downtime Clock</label>
                <div class="slot-clock-controls">
                    ${renderClockPie(value, total, 'slot-clock-pie')}
                    <span class="slot-clock-readout">${value}/${total}</span>
                    <button class="btn ghost small clock-step" data-action="clock-down" aria-label="Decrease clock">-</button>
                    <button class="btn ghost small clock-step" data-action="clock-up" aria-label="Increase clock">+</button>
                    <div class="slot-clock-total" role="group" aria-label="Clock segment count">
                        <button class="btn ghost small clock-total-btn${active4}" data-action="clock-total" data-total="4">4</button>
                        <button class="btn ghost small clock-total-btn${active6}" data-action="clock-total" data-total="6">6</button>
                    </div>
                </div>
            </div>
        `;
    }

    function buildPlayerAssignment(slot) {
        const options = playerOptions.map((p) => {
            const rawId = String(p.id || '');
            const safeId = escapeHTML(rawId);
            return `<option value="${safeId}" ${rawId === slot.playerId ? 'selected' : ''}>${escapeHTML(p.name || 'Unnamed')} (${p.dp ?? 0} DP)</option>`;
        }).join('');
        const info = buildSlotInfo('downtime', slot);
        const checked = slot.junior ? 'checked' : '';
        const assignmentClass = `slot-assignment${slot.junior ? ' is-junior' : ''}`;
        const selectAttrs = slot.junior ? ' disabled aria-hidden="true" tabindex="-1"' : '';
        return `
            <div class="slot-row">
                <label>Assigned Operative</label>
                <div class="${assignmentClass}">
                    <select class="slot-select" data-type="downtime"${selectAttrs}>
                        <option value="">Unassigned</option>
                        ${options}
                    </select>
                    <span class="junior-pill">Junior operative</span>
                    <label class="slot-junior-toggle">
                        <input type="checkbox" class="slot-junior" ${checked}> Junior Op.
                    </label>
                </div>
                ${info}
            </div>
        `;
    }

    function buildResourceAssignment(slot) {
        const options = requisitionOptions.map((r) => {
            const rawId = String(r.id || '');
            const safeId = escapeHTML(rawId);
            return `<option value="${safeId}" ${rawId === slot.requisitionId ? 'selected' : ''}>${escapeHTML(r.item || 'Untitled')} (${escapeHTML(r.status || 'Pending')})</option>`;
        }).join('');
        const info = buildSlotInfo('resource', slot);
        return `
            <div class="slot-row">
                <label>Staged Resource</label>
                <select class="slot-select" data-type="resource">
                    <option value="">Unassigned</option>
                    ${options}
                </select>
                ${info}
            </div>
        `;
    }

    function buildSlotInfo(type, slot) {
        if (type === 'downtime') {
            const player = findPlayerById(slot.playerId);
            if (player) {
                const project = player.projectName ? ` • Project: ${escapeHTML(player.projectName)}` : '';
                return `<div class="slot-info">${escapeHTML(player.name || 'Unnamed')} • ${player.dp ?? 0} DP${project}</div>`;
            }
            if (slot.junior) {
                return '<div class="slot-info slot-info-junior">Junior operative</div>';
            }
            if (slot.legacyAssignee) {
                return `<div class="slot-info warning">Legacy assignment: ${escapeHTML(slot.legacyAssignee)}</div>`;
            }
            return '';
        }
        const req = findRequisitionById(slot.requisitionId);
        if (req) {
            const status = req.status ? ` • ${escapeHTML(req.status)}` : '';
            const priority = req.priority ? ` • ${escapeHTML(req.priority)}` : '';
            return `<div class="slot-info">${escapeHTML(req.item || 'Untitled')}${status}${priority}</div>`;
        }
        if (slot.legacyAssignee) {
            return `<div class="slot-info warning">Legacy link: ${escapeHTML(slot.legacyAssignee)}</div>`;
        }
        return '';
    }

    function renderFloorTabs() {
        if (!refs.floorTabs) return;
        refs.floorTabs.innerHTML = '';
        state.floors.forEach(floor => {
            const btn = document.createElement('button');
            btn.className = `floor-tab${floor.id === state.activeFloorId ? ' active' : ''}`;
            btn.dataset.floorId = floor.id;
            btn.innerHTML = `
                <span class="floor-name">${escapeHTML(floor.name)}</span>
                <span class="floor-count">${floor.rooms.length} rooms</span>
            `;
            refs.floorTabs.appendChild(btn);
        });
    }

    function bindUI() {
        refs.grid.addEventListener('click', (ev) => {
            if (ev.target === refs.grid) {
                selectRoom(null);
            }
        });

        refs.roomName.addEventListener('input', (ev) => updateSelectedRoom('name', ev.target.value));
        refs.roomType.addEventListener('change', (ev) => updateSelectedRoom('type', ev.target.value));

        refs.roomWidth.addEventListener('change', (ev) => {
            const value = clampNumber(parseInt(ev.target.value, 10) || 1, 1, state.grid.cols);
            ev.target.value = value;
            const room = getRoom(selectedRoomId);
            if (!room) return;
            room.w = Math.min(value, state.grid.cols - room.x);
            persistState();
            renderRooms();
        });

        refs.roomHeight.addEventListener('change', (ev) => {
            const value = clampNumber(parseInt(ev.target.value, 10) || 1, 1, state.grid.rows);
            ev.target.value = value;
            const room = getRoom(selectedRoomId);
            if (!room) return;
            room.h = Math.min(value, state.grid.rows - room.y);
            persistState();
            renderRooms();
        });

        refs.roomNotes.addEventListener('input', (ev) => updateSelectedRoom('notes', ev.target.value));
        refs.toggleGrid.addEventListener('change', (ev) => {
            state.snapToGrid = ev.target.checked;
            persistState();
        });

        refs.addDowntime.addEventListener('click', () => addSlot('downtime'));
        refs.addResource.addEventListener('click', () => addSlot('resource'));

        refs.downtimeList.addEventListener('input', handleSlotFieldInput('downtime'));
        refs.resourceList.addEventListener('input', handleSlotFieldInput('resource'));
        refs.downtimeList.addEventListener('change', handleSlotChange('downtime'));
        refs.resourceList.addEventListener('change', handleSlotChange('resource'));
        refs.downtimeList.addEventListener('click', handleSlotRemove('downtime'));
        refs.resourceList.addEventListener('click', handleSlotRemove('resource'));

        refs.duplicate.addEventListener('click', duplicateRoom);
        refs.delete.addEventListener('click', deleteRoom);
        refs.addCustom.addEventListener('click', addCustomRoom);
        refs.clear.addEventListener('click', clearFloor);
        refs.exportBtn.addEventListener('click', exportLayout);
        refs.importBtn.addEventListener('click', importLayout);
        refs.screenshotBtn.addEventListener('click', takeScreenshot);

        refs.floorTabs.addEventListener('click', (ev) => {
            const tab = ev.target.closest('.floor-tab');
            if (!tab) return;
            if (tab.dataset.floorId !== state.activeFloorId) {
                state.activeFloorId = tab.dataset.floorId;
                selectedRoomId = null;
                persistState();
                renderFloorTabs();
                renderRooms();
                updateDetailPanel();
            }
        });
        refs.addFloor.addEventListener('click', addFloor);
        refs.renameFloor.addEventListener('click', renameFloor);
        if (refs.deleteFloor) refs.deleteFloor.addEventListener('click', deleteFloor);

        const onJuniorOpsInput = () => syncJuniorOpsMaxInput();
        refs.juniorOpsMax.addEventListener('input', onJuniorOpsInput);
        refs.juniorOpsMax.addEventListener('change', onJuniorOpsInput);
    }

    function syncJuniorOpsMaxInput(inputEl = refs.juniorOpsMax) {
        if (!inputEl) return;
        const used = getJuniorOpsCount();
        let val = parseInt(inputEl.value, 10);
        if (!Number.isFinite(val)) {
            val = Number.isFinite(state.maxJuniorOperatives) ? state.maxJuniorOperatives : 0;
        }
        val = Math.max(used, Math.max(0, val)); // Cannot be less than currently assigned
        inputEl.value = val;
        const prev = state.maxJuniorOperatives;
        state.maxJuniorOperatives = val;
        if (prev !== val) {
            persistState();
        }
        updateStats();
        updateDetailPanel();
    }

    function addSlot(type) {
        const room = getRoom(selectedRoomId);
        if (!room) return;
        const list = type === 'downtime' ? room.downtimeSlots : room.resourceSlots;
        list.push(type === 'downtime'
            ? { id: uniqueId('slot'), label: 'Downtime Slot', description: '', playerId: '', junior: false, clock: 0, clockTotal: 4 }
            : { id: uniqueId('slot'), label: 'Resource Bay', description: '', requisitionId: '' });
        persistState();
        updateDetailPanel();
        renderRooms();
    }

    function handleSlotChange(type) {
        return (ev) => {
            const room = getRoom(selectedRoomId);
            if (!room) return;
            const item = ev.target.closest('.slot-item');
            if (!item) return;
            const slotId = item.dataset.id;
            const list = type === 'downtime' ? room.downtimeSlots : room.resourceSlots;
            const slot = list.find(s => s.id === slotId);
            if (!slot) return;

            if (ev.target.classList.contains('slot-select')) {
                if (type === 'downtime') {
                    slot.playerId = ev.target.value;
                    if (slot.playerId) slot.junior = false; // Primary assignment overrides junior
                } else {
                    slot.requisitionId = ev.target.value;
                }
                slot.legacyAssignee = '';
            } else if (ev.target.classList.contains('slot-junior')) {
                if (ev.target.checked) {
                    const used = getJuniorOpsCount();
                    const max = getMaxJuniorOperatives();
                    if (used >= max) {
                        ev.target.checked = false;
                        alert(`No Junior Operatives available! (Max: ${max})`);
                        return;
                    }
                }
                slot.junior = ev.target.checked;
                if (slot.junior) slot.playerId = ''; // Junior overrides specific player
            } else {
                return;
            }

            persistState();
            updateDetailPanel();
            renderRooms();
        };
    }

    function handleSlotFieldInput(type) {
        return (ev) => {
            if (!ev.target.classList.contains('slot-field')) return;
            const field = ev.target.dataset.field;
            if (!field) return;
            const room = getRoom(selectedRoomId);
            if (!room) return;
            const item = ev.target.closest('.slot-item');
            if (!item) return;
            const slotId = item.dataset.id;
            const list = type === 'downtime' ? room.downtimeSlots : room.resourceSlots;
            const slot = list.find(s => s.id === slotId);
            if (!slot) return;
            slot[field] = ev.target.value;
            persistState();
            renderRooms();
        };
    }

    function handleSlotRemove(type) {
        return (ev) => {
            const action = ev.target.dataset.action;
            if (!action) return;
            const room = getRoom(selectedRoomId);
            if (!room) return;
            const item = ev.target.closest('.slot-item');
            if (!item) return;
            const slotId = item.dataset.id;
            const list = type === 'downtime' ? room.downtimeSlots : room.resourceSlots;
            const slot = list.find(s => s.id === slotId);
            if (!slot) return;

            if (type === 'downtime' && (action === 'clock-up' || action === 'clock-down' || action === 'clock-total')) {
                if (action === 'clock-total') {
                    slot.clockTotal = normalizeClockTotal(parseInt(ev.target.dataset.total, 10));
                    slot.clock = clampClockValue(slot.clock, slot.clockTotal);
                } else {
                    const delta = action === 'clock-up' ? 1 : -1;
                    slot.clock = clampClockValue((slot.clock || 0) + delta, normalizeClockTotal(slot.clockTotal));
                }
                persistState();
                updateDetailPanel();
                renderRooms();
                return;
            }

            if (action !== 'remove') return;
            const idx = list.findIndex(s => s.id === slotId);
            if (idx >= 0) {
                list.splice(idx, 1);
                persistState();
                updateDetailPanel();
                renderRooms();
            }
        };
    }

    function updateSelectedRoom(field, value) {
        const room = getRoom(selectedRoomId);
        if (!room) return;
        room[field] = value;
        persistState();
        renderRooms();
    }

    function duplicateRoom() {
        const found = findRoomWithFloor(selectedRoomId);
        if (!found) return;
        const copy = JSON.parse(JSON.stringify(found.room));
        copy.id = uniqueId('room');
        copy.name = `${found.room.name} Copy`;
        copy.x = clampNumber(found.room.x + 1, 0, state.grid.cols - found.room.w);
        copy.y = clampNumber(found.room.y + 1, 0, state.grid.rows - found.room.h);
        found.floor.rooms.push(copy);
        selectRoom(copy.id);
        persistState();
        renderRooms();
    }

    function deleteRoom() {
        const found = findRoomWithFloor(selectedRoomId);
        if (!found) return;
        if (!confirm('Remove this room from the map?')) return;
        const idx = found.floor.rooms.findIndex(r => r.id === selectedRoomId);
        if (idx >= 0) {
            found.floor.rooms.splice(idx, 1);
            selectedRoomId = null;
            persistState();
            renderRooms();
            updateDetailPanel();
        }
    }

    function addCustomRoom() {
        const floor = getActiveFloor();
        const room = sanitizeRoom({
            id: uniqueId('room'),
            name: 'Custom Chamber',
            type: ROOM_TYPES[0].id,
            x: 2,
            y: 2,
            w: 4,
            h: 3,
            notes: '',
            downtimeSlots: [],
            resourceSlots: []
        });
        nudgedPlacement(room, floor);
        floor.rooms.push(room);
        selectRoom(room.id);
        persistState();
        renderRooms();
        renderFloorTabs();
    }

    function clearFloor() {
        const floor = getActiveFloor();
        if (!floor || !floor.rooms.length) return;
        if (!confirm(`Clear all rooms from ${floor.name}?`)) return;
        floor.rooms = [];
        selectedRoomId = null;
        persistState();
        renderRooms();
        updateDetailPanel();
    }

    function addFloor() {
        const baseName = `Level ${state.floors.length + 1}`;
        const name = prompt('Name for the new floor?', baseName) || baseName;
        const floor = createFloor(name);
        state.floors.push(floor);
        state.activeFloorId = floor.id;
        selectedRoomId = null;
        persistState();
        renderFloorTabs();
        renderRooms();
        updateDetailPanel();
    }

    function renameFloor() {
        const floor = getActiveFloor();
        if (!floor) return;
        const name = prompt('Rename this floor:', floor.name);
        if (!name) return;
        floor.name = name.trim();
        persistState();
        renderFloorTabs();
        renderRooms();
    }

    function deleteFloor() {
        if (state.floors.length <= 1) {
            alert('Need at least one floor. Clear it instead if you want a blank slate.');
            return;
        }
        const floor = getActiveFloor();
        if (!floor) return;
        if (!confirm(`Delete ${floor.name} and all rooms on it?`)) return;
        state.floors = state.floors.filter(f => f.id !== floor.id);
        state.activeFloorId = state.floors[0].id;
        selectedRoomId = null;
        persistState();
        renderFloorTabs();
        renderRooms();
        updateDetailPanel();
    }

    function exportLayout() {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `task_force_hq_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    function importLayout() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (ev) => {
            const file = ev.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const parsed = JSON.parse(reader.result);
                    state = sanitizeState(parsed);
                    selectedRoomId = null;
                    persistState();
                    if (refs.juniorOpsMax) {
                        refs.juniorOpsMax.value = state.maxJuniorOperatives;
                        syncJuniorOpsMaxInput();
                    }
                    renderFloorTabs();
                    renderRooms();
                    updateDetailPanel();
                } catch (err) {
                    alert('Invalid HQ data file');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function resolveColor(cssVal) {
        if (!cssVal) return 'transparent';
        const temp = document.createElement('div');
        temp.style.color = cssVal;
        document.body.appendChild(temp);
        const resolved = getComputedStyle(temp).color;
        document.body.removeChild(temp);
        return resolved;
    }

    async function takeScreenshot() {
        const floor = getActiveFloor();
        const rooms = floor ? floor.rooms : [];
        const width = state.grid.cols * state.grid.cell;
        const height = state.grid.rows * state.grid.cell;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Resolve CSS Variables using standard styling from body or :root
        const style = getComputedStyle(document.body);
        const bgTop = style.getPropertyValue('--bg-top').trim() || '#1a2337';
        const bgBottom = style.getPropertyValue('--bg-bottom').trim() || '#05070f';
        const gridColor = resolveColor(style.getPropertyValue('--blueprint-grid').trim()) || 'rgba(173, 216, 230, 0.08)';
        const accentTertiary = style.getPropertyValue('--accent-tertiary').trim() || '#4ecdc4';
        const textMain = resolveColor(style.getPropertyValue('--hq-soft').trim()) || '#e0e0e0';
        const textMuted = resolveColor(style.getPropertyValue('--hq-muted').trim()) || '#888';
        const roomBg = resolveColor(style.getPropertyValue('--panel-bg').trim()) || '#0c121f';
        const resolvedBgTop = resolveColor(bgTop);
        const resolvedBgBottom = resolveColor(bgBottom);

        // 1. Draw Background Gradient
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, resolvedBgTop);
        grad.addColorStop(1, resolvedBgBottom);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // 2. Draw Grid
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;

        ctx.beginPath();
        for (let x = 0; x <= state.grid.cols; x++) {
            ctx.moveTo(x * state.grid.cell, 0);
            ctx.lineTo(x * state.grid.cell, height);
        }
        for (let y = 0; y <= state.grid.rows; y++) {
            ctx.moveTo(0, y * state.grid.cell);
            ctx.lineTo(width, y * state.grid.cell);
        }
        ctx.stroke();

        // 3. Lighting Overlay (Radial)
        ctx.save();
        const radX = width * 0.2;
        const radY = height * 0.2;
        const radR = Math.max(width, height) * 0.8;
        const lightGrad = ctx.createRadialGradient(radX, radY, 0, radX, radY, radR);
        // Approximation of the complex CSS gradient
        const accentColor = resolveColor(accentTertiary); // likely rgb(...)

        // We want a subtle colored glow at top left, fading to transparent
        // Use a low opacity version of the accent color
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.15; // 15% opacity overall for the gradient layer
        lightGrad.addColorStop(0, accentColor);
        lightGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = lightGrad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();

        // 4. Draw Rooms
        rooms.forEach(room => {
            const type = getRoomType(room.type);
            const x = room.x * state.grid.cell;
            const y = room.y * state.grid.cell;
            const w = room.w * state.grid.cell;
            const h = room.h * state.grid.cell;

            const rX = x + 4;
            const rY = y + 4;
            const rW = w - 8;
            const rH = h - 8;
            const radius = 12;

            ctx.save();

            // Room Shadow
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetY = 10;

            // Room Background
            // Mix slightly to emulate backdrop
            ctx.fillStyle = roomBg;
            // We draw the bg first. 
            // Note: Canvas doesn't do backdrop-filter (blur behind). We just use opacity.
            ctx.globalAlpha = 0.85;

            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(rX, rY, rW, rH, radius);
            } else {
                ctx.rect(rX, rY, rW, rH);
            }
            ctx.fill();

            // Room Border & Color Glow
            ctx.globalAlpha = 1.0;
            ctx.shadowColor = resolveColor(type.color);
            ctx.shadowBlur = 15; // Glow effect
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            ctx.strokeStyle = resolveColor(type.color);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            // Text: Name
            ctx.save();
            ctx.fillStyle = textMain;
            ctx.font = '600 15px "Segoe UI", Roboto, sans-serif';
            ctx.textBaseline = 'top';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.fillText(room.name, rX + 12, rY + 12);
            ctx.restore();

            // Text: Slots
            ctx.save();
            ctx.fillStyle = textMuted;
            ctx.font = '12px "Segoe UI", Roboto, sans-serif';
            ctx.textBaseline = 'top';
            const slotText = `⏱ ${room.downtimeSlots.length}   ⚙ ${room.resourceSlots.length}`;
            ctx.fillText(slotText, rX + 12, rY + 34);
            ctx.restore();

            // Designation Badge
            const dText = type.label.toUpperCase();
            ctx.save();
            ctx.font = '10px "Segoe UI", Roboto, sans-serif';
            const dMetrics = ctx.measureText(dText);
            const dW = dMetrics.width + 16;
            const dH = 20;
            const badgeX = rX + 12;
            const badgeY = (rY + rH) - dH - 10;

            // Badge Bg
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, dW, dH, 10);
            else ctx.rect(badgeX, badgeY, dW, dH);
            ctx.fill();

            // Badge Border
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Badge Text
            ctx.fillStyle = textMain;
            ctx.textBaseline = 'middle';
            ctx.fillText(dText, badgeX + 8, badgeY + dH / 2 + 1); // +1 for visual centering
            ctx.restore();
        });

        // 5. Footer Metadata
        ctx.save();
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillStyle = textMain;
        ctx.font = '18px "Segoe UI", sans-serif';
        ctx.fillText(`${floor ? floor.name : 'HQ'} • Ravnica Task Force HQ`, 20, height - 40);

        ctx.font = '13px "Segoe UI", sans-serif';
        ctx.fillStyle = textMuted;
        ctx.fillText(`Exported ${new Date().toLocaleString()}`, 20, height - 20);
        ctx.restore();

        // 6. Download
        canvas.toBlob(blob => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `hq_blueprint_${new Date().toISOString().slice(0, 10)}.png`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 0);
        });
    }

    function refreshAssigneeLists() {
        playerOptions = getPlayersFromStore().map(p => ({
            id: String(p.id || ''),
            name: p.name || 'Unnamed Operative',
            dp: p.dp ?? 0,
            projectName: p.projectName || '',
            projectReward: p.projectReward || ''
        }));
        requisitionOptions = getRequisitionsFromStore().map(req => ({
            id: String(req.id || ''),
            item: req.item || req.purpose || 'Unlabeled Request',
            status: req.status || 'Pending',
            priority: req.priority || '',
            requester: req.requester || ''
        }));
        if (selectedRoomId) {
            updateDetailPanel();
        }
    }

    function createFloor(name = `Level ${state.floors ? state.floors.length + 1 : 1}`) {
        return { id: uniqueId('floor'), name, rooms: [] };
    }

    function getRoomType(id) {
        return ROOM_TYPES.find(t => t.id === id) || ROOM_TYPES[0];
    }

    function clampNumber(value, min, max) {
        return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
    }

    function normalizeClockTotal(total) {
        return total === 6 ? 6 : 4;
    }

    function clampClockValue(value, total = 4) {
        const max = normalizeClockTotal(total);
        return clampNumber(parseInt(value, 10) || 0, 0, max);
    }

    function uniqueId(prefix) {
        return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
    }
    function showRoomPopout(ev, room) {
        if (dragging) return;
        refs.grid.classList.add('has-focus');

        const pop = document.createElement('div');
        pop.className = 'room-popout';
        pop.id = 'active-room-popout';

        const type = getRoomType(room.type);

        let content = `
            <div>
                <div class="meta">${escapeHTML(type.label)}</div>
                <h4>${escapeHTML(room.name)}</h4>
            </div>
        `;

        // Downtime Section
        if (room.downtimeSlots.length > 0) {
            content += `<div class="section"><div class="meta">Downtime Activities</div>`;
            room.downtimeSlots.forEach(slot => {
                let assignee = 'Unassigned';
                if (slot.playerId) {
                    const p = findPlayerById(slot.playerId);
                    assignee = p ? p.name : 'Unknown Agent';
                } else if (slot.junior) {
                    assignee = 'Junior operative';
                } else if (slot.legacyAssignee) {
                    assignee = slot.legacyAssignee;
                }
                const clockTotal = normalizeClockTotal(slot.clockTotal);
                const clockValue = clampClockValue(slot.clock, clockTotal);
                const assigneeWithClock = `${assignee} • ${clockValue}/${clockTotal}`;
                const detail = slot.description ? `<small>${formatMultiline(slot.description)}</small>` : '';
                const labelBlock = `<span>${escapeHTML(slot.label)}</span>${detail}`;
                content += `<div class="pop-row${slot.description ? ' has-desc' : ''}"><div class="pop-label">${labelBlock}</div><span class="assignee">${escapeHTML(assigneeWithClock)}</span></div>`;
            });
            content += `</div>`;
        }

        // Resource Section
        if (room.resourceSlots.length > 0) {
            content += `<div class="section"><div class="meta">Resource Bays</div>`;
            room.resourceSlots.forEach(slot => {
                let status = 'Empty';
                if (slot.requisitionId) {
                    const r = findRequisitionById(slot.requisitionId);
                    status = r ? (r.item || r.purpose) : 'Unknown Asset';
                } else if (slot.legacyAssignee) {
                    status = slot.legacyAssignee;
                }
                content += `<div class="pop-row"><span>${escapeHTML(slot.label)}</span><span class="assignee">${escapeHTML(status)}</span></div>`;
            });
            content += `</div>`;
        }

        if (room.downtimeSlots.length === 0 && room.resourceSlots.length === 0) {
            content += `<div class="empty-msg">No active slots configured.</div>`;
        }

        pop.innerHTML = content;
        document.body.appendChild(pop);

        // Positioning
        const roomRect = ev.currentTarget.getBoundingClientRect();
        const popRect = pop.getBoundingClientRect();

        let top = roomRect.top;
        let left = roomRect.right + 20; // Default: Right side

        // If not enough space on right, try left
        if (left + popRect.width > window.innerWidth - 20) {
            left = roomRect.left - popRect.width - 20;
        }

        // Clamp vertical
        if (top + popRect.height > window.innerHeight - 20) {
            top = window.innerHeight - popRect.height - 20;
        }
        if (top < 20) top = 20;

        pop.style.top = top + 'px';
        pop.style.left = left + 'px';
    }

    function hideRoomPopout() {
        refs.grid.classList.remove('has-focus');
        const pop = document.getElementById('active-room-popout');
        if (pop) pop.remove();
    }
})();
