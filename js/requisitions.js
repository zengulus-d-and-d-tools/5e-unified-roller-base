(function () {
    const STATUS = ["Pending", "Approved", "In Transit", "Delivered", "Denied"];
    const PRIORITIES = ["Routine", "Tactical", "Emergency"];
    const PRIORITY_WEIGHT = PRIORITIES.reduce((acc, val, idx) => {
        acc[val] = idx;
        return acc;
    }, {});
    const guilds = (window.RTF_DATA && window.RTF_DATA.guilds) ||
        ["Azorius", "Boros", "Dimir", "Golgari", "Gruul", "Izzet", "Orzhov", "Rakdos", "Selesnya", "Simic", "Guildless"];

    const escapeHtml = (str = '') => String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const getStore = () => window.RTF_STORE;
    const getLogger = () => {
        const logger = window.RTF_SESSION_LOG;
        if (!logger || typeof logger.logMajorEvent !== 'function') return null;
        return logger;
    };

    function logRequisitionGained(req) {
        const logger = getLogger();
        if (!logger || !req) return;
        logger.logMajorEvent({
            title: `Requisition Logged: ${req.item || 'Untitled Request'}`,
            focus: req.guild || req.requester || 'Task Force',
            tags: ['auto', 'requisition', 'gained'],
            highlights: `${req.requester || 'Unknown requester'} logged ${req.item || 'a requisition'} (${req.priority || 'Routine'} priority).`,
            source: 'requisitions',
            kind: 'requisition-gained'
        }, { dedupeKey: `req:gained:${req.id || req.item || ''}` });
    }

    function logRequisitionDelivered(req, prevStatus) {
        const logger = getLogger();
        if (!logger || !req) return;
        logger.logMajorEvent({
            title: `Requisition Delivered: ${req.item || 'Untitled Request'}`,
            focus: req.guild || req.requester || 'Task Force',
            tags: ['auto', 'requisition', 'delivered'],
            highlights: `${req.item || 'Requisition'} marked Delivered${prevStatus ? ` (from ${prevStatus})` : ''}.`,
            source: 'requisitions',
            kind: 'requisition-delivered'
        }, { dedupeKey: `req:delivered:${req.id || req.item || ''}` });
    }

    function populateOptions() {
        const guildSelect = document.getElementById('reqGuild');
        const prioritySelect = document.getElementById('reqPriority');
        const statusSelect = document.getElementById('reqStatus');
        const guildFilter = document.getElementById('reqGuildFilter');

        if (guildSelect && guildSelect.options.length === 0) {
            guildSelect.innerHTML = '<option value="">Guild / Source</option>' + guilds.map(g => `<option value="${g}">${g}</option>`).join('');
        }
        if (prioritySelect && prioritySelect.options.length === 0) {
            prioritySelect.innerHTML = '<option value="Routine">Routine</option>' + PRIORITIES.filter(p => p !== 'Routine').map(p => `<option value="${p}">${p}</option>`).join('');
        }
        if (statusSelect && statusSelect.options.length === 0) {
            statusSelect.innerHTML = STATUS.map(s => `<option value="${s}">${s}</option>`).join('');
        }
        if (guildFilter && guildFilter.options.length === 1) {
            guilds.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g;
                opt.textContent = g;
                guildFilter.appendChild(opt);
            });
        }
        const statusFilter = document.getElementById('reqStatusFilter');
        if (statusFilter && statusFilter.options.length === 1) {
            STATUS.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                statusFilter.appendChild(opt);
            });
        }
        const priorityFilter = document.getElementById('reqPriorityFilter');
        if (priorityFilter && priorityFilter.options.length === 1) {
            PRIORITIES.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                priorityFilter.appendChild(opt);
            });
        }
    }

    function toggleReqForm() {
        const form = document.getElementById('reqForm');
        if (!form) return;
        if (form.style.display === 'block') {
            form.style.display = 'none';
        } else {
            populateOptions();
            form.style.display = 'block';
            document.getElementById('reqItem').focus();
        }
    }

    function resetForm() {
        ['reqItem', 'reqRequester', 'reqValue', 'reqPurpose', 'reqNotes', 'reqTags'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const prioritySelect = document.getElementById('reqPriority');
        if (prioritySelect) prioritySelect.value = 'Routine';
        const statusSelect = document.getElementById('reqStatus');
        if (statusSelect) statusSelect.value = 'Pending';
        const guildSelect = document.getElementById('reqGuild');
        if (guildSelect) guildSelect.value = '';
    }

    function addRequisition() {
        const store = getStore();
        if (!store) return;
        const item = document.getElementById('reqItem').value.trim();
        const requester = document.getElementById('reqRequester').value.trim();
        if (!item || !requester) {
            alert('Item and Requester are required.');
            return;
        }
        const data = {
            id: 'req_' + Date.now(),
            item,
            requester,
            guild: document.getElementById('reqGuild').value,
            priority: document.getElementById('reqPriority').value,
            status: document.getElementById('reqStatus').value,
            value: document.getElementById('reqValue').value,
            purpose: document.getElementById('reqPurpose').value,
            notes: document.getElementById('reqNotes').value,
            tags: document.getElementById('reqTags').value,
            created: new Date().toISOString()
        };
        store.addRequisition(data);
        logRequisitionGained(data);
        resetForm();
        toggleReqForm();
        renderRequisitions();
    }

    function updateReqField(id, field, value) {
        const store = getStore();
        if (!store) return;
        const existing = (store.getRequisitions() || []).find(req => req.id === id) || null;
        const prevStatus = existing && existing.status ? existing.status : '';
        store.updateRequisition(id, { [field]: value });

        if (field === 'status') {
            const nextStatus = String(value || '');
            if (prevStatus !== 'Delivered' && nextStatus === 'Delivered') {
                const latest = (store.getRequisitions() || []).find(req => req.id === id) || existing;
                logRequisitionDelivered(latest, prevStatus);
            }
        }

        renderRequisitions();
    }

    function deleteRequisition(id) {
        if (!confirm('Delete this requisition?')) return;
        const store = getStore();
        if (!store) return;
        store.deleteRequisition(id);
        renderRequisitions();
    }

    function buildOptions(list, selected) {
        return list.map(item => `<option value="${item}" ${item === selected ? 'selected' : ''}>${item}</option>`).join('');
    }

    function buildCard(req) {
        return `
        <div class="req-card">
            <h3>
                <input type="text" value="${escapeHtml(req.item || '')}" placeholder="Item"
                    onchange="updateReqField('${req.id}', 'item', this.value)">
                <select class="status-pill" onchange="updateReqField('${req.id}', 'status', this.value)">
                    ${buildOptions(STATUS, req.status || 'Pending')}
                </select>
            </h3>
            <div class="req-meta">
                <div>
                    <label>Requested By</label>
                    <input type="text" value="${escapeHtml(req.requester || '')}" placeholder="Agent"
                        onchange="updateReqField('${req.id}', 'requester', this.value)">
                </div>
                <div>
                    <label>Guild / Source</label>
                    <select onchange="updateReqField('${req.id}', 'guild', this.value)">
                        <option value="">Unspecified</option>
                        ${buildOptions(guilds, req.guild)}
                    </select>
                </div>
                <div>
                    <label>Priority</label>
                    <select onchange="updateReqField('${req.id}', 'priority', this.value)">
                        ${buildOptions(PRIORITIES, req.priority || 'Routine')}
                    </select>
                </div>
                <div>
                    <label>Value</label>
                    <input type="text" value="${escapeHtml(req.value || '')}" placeholder="Cost"
                        onchange="updateReqField('${req.id}', 'value', this.value)">
                </div>
            </div>
            <textarea class="req-notes" placeholder="Purpose / Justification"
                onchange="updateReqField('${req.id}', 'purpose', this.value)">${escapeHtml(req.purpose || '')}</textarea>
            <textarea class="req-notes" placeholder="Notes / Attachments"
                onchange="updateReqField('${req.id}', 'notes', this.value)">${escapeHtml(req.notes || '')}</textarea>
            <input type="text" placeholder="Tags" value="${escapeHtml(req.tags || '')}"
                onchange="updateReqField('${req.id}', 'tags', this.value)">
            <div class="req-actions">
                <small style="color:#666; flex:1;">Logged ${req.created ? new Date(req.created).toLocaleDateString() : '—'}</small>
                <button class="btn btn-danger" onclick="deleteRequisition('${req.id}')">Delete</button>
            </div>
        </div>`;
    }

    function renderRequisitions() {
        const store = getStore();
        populateOptions();
        const container = document.getElementById('reqList');
        if (!container || !store) return;
        const search = (document.getElementById('reqSearch').value || '').toLowerCase();
        const statusFilter = document.getElementById('reqStatusFilter').value;
        const guildFilter = document.getElementById('reqGuildFilter').value;
        const priorityFilter = document.getElementById('reqPriorityFilter').value;

        const list = (store.getRequisitions() || []).slice();
        const filtered = list.filter(req => {
            const text = `${req.item || ''} ${req.requester || ''} ${req.purpose || ''} ${req.notes || ''} ${req.tags || ''}`.toLowerCase();
            const matchesSearch = search ? text.includes(search) : true;
            const matchesStatus = statusFilter ? req.status === statusFilter : true;
            const matchesGuild = guildFilter ? req.guild === guildFilter : true;
            const matchesPriority = priorityFilter ? req.priority === priorityFilter : true;
            return matchesSearch && matchesStatus && matchesGuild && matchesPriority;
        });

        filtered.sort((a, b) => {
            const priorityDiff = (PRIORITY_WEIGHT[a.priority || 'Routine'] || 0) - (PRIORITY_WEIGHT[b.priority || 'Routine'] || 0);
            if (priorityDiff !== 0) return priorityDiff;
            return (a.created || '').localeCompare(b.created || '');
        });

        container.innerHTML = filtered.length
            ? filtered.map(buildCard).join('')
            : '<div class="empty-state">No requisitions logged. Use “+ New Request” to add one.</div>';
    }

    function init() {
        populateOptions();
        renderRequisitions();
    }

    function waitForStore() {
        if (getStore()) {
            init();
        } else {
            setTimeout(waitForStore, 100);
        }
    }

    window.toggleReqForm = toggleReqForm;
    window.addRequisition = addRequisition;
    window.renderRequisitions = renderRequisitions;
    window.updateReqField = updateReqField;
    window.deleteRequisition = deleteRequisition;

    window.addEventListener('load', waitForStore);
})();
