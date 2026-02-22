(function () {
    const SOFT_DELETE_MS = 12000;
    const escapeHtml = (str = '') => String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const escapeJsString = (str = '') => String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    const delegatedHandlerEvents = ['click', 'change', 'input'];
    const delegatedHandlerCache = new Map();
    let delegatedHandlersBound = false;
    let deleteManager = null;
    let pendingDeepLinkFocus = '';
    const sanitizeImageUrl = (url = '') => {
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
    };

    function getDelegatedHandlerFn(code) {
        if (!delegatedHandlerCache.has(code)) {
            delegatedHandlerCache.set(code, window.RTF_DELEGATED_HANDLER.compile(code));
        }
        return delegatedHandlerCache.get(code);
    }

    function runDelegatedHandler(el, attrName, event) {
        const code = el.getAttribute(attrName);
        if (!code) return;

        try {
            const result = getDelegatedHandlerFn(code).call(el, event);
            if (result === false) {
                event.preventDefault();
                event.stopPropagation();
            }
        }
        catch (err) {
            console.error(`Delegated handler failed for ${attrName}:`, code, err);
        }
    }

    function handleDelegatedDataEvent(event) {
        const attrName = `data-on${event.type}`;
        let node = event.target instanceof Element ? event.target : null;

        while (node) {
            if (node.hasAttribute(attrName)) {
                runDelegatedHandler(node, attrName, event);
                if (event.cancelBubble) break;
            }
            node = node.parentElement;
        }
    }

    function bindDelegatedDataHandlers() {
        if (delegatedHandlersBound) return;
        delegatedHandlersBound = true;
        delegatedHandlerEvents.forEach((eventName) => {
            document.addEventListener(eventName, handleDelegatedDataEvent);
        });
    }

    bindDelegatedDataHandlers();

    const getStore = () => window.RTF_STORE;
    const getDeleteManager = () => {
        if (deleteManager) return deleteManager;
        const api = window.RTF_SOFT_DELETE;
        if (!api || typeof api.createSoftDeleteManager !== 'function') return null;
        deleteManager = api.createSoftDeleteManager({
            undoMs: SOFT_DELETE_MS,
            host: document.body,
            onStateChange: () => renderTimeline()
        });
        return deleteManager;
    };
    const HEAT_SYNC_KEY = 'rtf_timeline_auto_heat';
    const HEAT_MIN = 0;
    const HEAT_MAX = 6;
    const LEAD_STORAGE_KEY = 'rtf_lead_queue_v1';
    const LEAD_VOTER_NAME_KEY = 'rtf_lead_voter_name_v1';
    const LEAD_TYPES = ['npc', 'location', 'clue', 'event', 'requisition', 'theory', 'other'];
    const LEAD_STATUSES = ['open', 'blocked', 'resolved', 'dead-end'];
    const LEAD_STATUS_LABELS = {
        open: 'Open',
        blocked: 'Blocked',
        resolved: 'Resolved',
        'dead-end': 'Dead End'
    };
    const LEAD_VOTE_LABELS = {
        hot: 'Hot',
        cold: 'Cold',
        'dead-end': 'Dead End'
    };
    const LEAD_VOTE_SCORES = {
        hot: 2,
        cold: 0,
        'dead-end': -2
    };
    const PREP_PROCEDURE_STATE_KEY = 'rtf_prep_procedure_state_v1';
    const FREE_SHIELD_SESSION_PREFIX = 'rtf_procedure_free_shield_used_v1:';

    const parseHeatDelta = (value) => {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const clampHeat = (value) => Math.max(HEAT_MIN, Math.min(HEAT_MAX, value));

    const isHeatAutoSyncEnabled = () => {
        const stored = localStorage.getItem(HEAT_SYNC_KEY);
        if (stored === null) return true;
        return stored === 'true';
    };

    const setHeatAutoSync = (enabled) => {
        localStorage.setItem(HEAT_SYNC_KEY, String(Boolean(enabled)));
    };

    const applyHeatDelta = (delta, store) => {
        if (!delta || !store || !store.state || !store.state.campaign) return;
        if (!isHeatAutoSyncEnabled()) return;
        const current = Number(store.state.campaign.heat) || 0;
        store.state.campaign.heat = clampHeat(current + delta);
        if (typeof store.save === 'function') store.save({ scope: 'campaign.heat' });
    };

    const getActiveCaseId = () => {
        const store = getStore();
        if (!store || typeof store.getActiveCaseId !== 'function') return 'case_primary';
        return String(store.getActiveCaseId() || 'case_primary');
    };

    const normalizeLeadType = (value) => {
        const clean = String(value || '').trim().toLowerCase();
        return LEAD_TYPES.includes(clean) ? clean : 'other';
    };

    const normalizeLeadStatus = (value) => {
        const clean = String(value || '').trim().toLowerCase();
        return LEAD_STATUSES.includes(clean) ? clean : 'open';
    };

    const normalizeLeadVotes = (votes) => {
        const source = votes && typeof votes === 'object' ? votes : {};
        const out = {};
        Object.keys(source).forEach((name) => {
            const cleanName = String(name || '').trim().slice(0, 60);
            const vote = String(source[name] || '').trim().toLowerCase();
            if (!cleanName) return;
            if (!Object.prototype.hasOwnProperty.call(LEAD_VOTE_LABELS, vote)) return;
            out[cleanName] = vote;
        });
        return out;
    };

    const createLeadId = () => `lead_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const sanitizeLead = (raw, idx = 0) => {
        const source = raw && typeof raw === 'object' ? raw : {};
        const nowIso = new Date().toISOString();
        return {
            id: String(source.id || `lead_${idx + 1}`).trim() || createLeadId(),
            type: normalizeLeadType(source.type),
            targetId: String(source.targetId || '').trim().slice(0, 120),
            title: String(source.title || '').trim().slice(0, 180) || `Lead ${idx + 1}`,
            question: String(source.question || '').trim().slice(0, 500),
            nextStep: String(source.nextStep || '').trim().slice(0, 500),
            status: normalizeLeadStatus(source.status),
            votes: normalizeLeadVotes(source.votes),
            created: String(source.created || nowIso),
            updated: String(source.updated || source.created || nowIso)
        };
    };

    const readLeadStorage = () => {
        try {
            const raw = localStorage.getItem(LEAD_STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (err) {
            return {};
        }
    };

    const writeLeadStorage = (value) => {
        const clean = value && typeof value === 'object' ? value : {};
        localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(clean));
    };

    const getCaseLeads = (caseId = getActiveCaseId()) => {
        const all = readLeadStorage();
        const list = Array.isArray(all[caseId]) ? all[caseId] : [];
        return list.map((entry, idx) => sanitizeLead(entry, idx));
    };

    const saveCaseLeads = (leads, caseId = getActiveCaseId()) => {
        const all = readLeadStorage();
        const clean = Array.isArray(leads) ? leads.map((entry, idx) => sanitizeLead(entry, idx)) : [];
        all[caseId] = clean;
        writeLeadStorage(all);
    };

    const getLeadScore = (lead) => {
        if (!lead || !lead.votes || typeof lead.votes !== 'object') return 0;
        return Object.values(lead.votes).reduce((sum, vote) => {
            if (!Object.prototype.hasOwnProperty.call(LEAD_VOTE_SCORES, vote)) return sum;
            return sum + LEAD_VOTE_SCORES[vote];
        }, 0);
    };

    const formatLeadVotes = (lead) => {
        if (!lead || !lead.votes || typeof lead.votes !== 'object') return 'No votes yet';
        const voters = Object.keys(lead.votes);
        if (!voters.length) return 'No votes yet';
        return voters.map((name) => `${name}: ${LEAD_VOTE_LABELS[lead.votes[name]] || lead.votes[name]}`).join(' | ');
    };

    const getLeadStatusRank = (status) => {
        if (status === 'open') return 0;
        if (status === 'blocked') return 1;
        if (status === 'resolved') return 2;
        if (status === 'dead-end') return 3;
        return 4;
    };

    const getCurrentLeadVoter = () => {
        const input = document.getElementById('leadVoter');
        const fromInput = input ? String(input.value || '').trim() : '';
        if (fromInput) {
            localStorage.setItem(LEAD_VOTER_NAME_KEY, fromInput);
            return fromInput.slice(0, 60);
        }
        const stored = getStoredLeadVoter();
        if (stored) {
            if (input) input.value = stored;
            return stored;
        }
        const generated = getOrCreateLeadVoter();
        if (input) input.value = generated;
        return generated;
    };

    const getProcedureState = () => {
        try {
            const raw = localStorage.getItem(PREP_PROCEDURE_STATE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            const prep = parsed.prep && typeof parsed.prep === 'object' ? parsed.prep : null;
            const procedure = parsed.procedure && typeof parsed.procedure === 'object' ? parsed.procedure : null;
            if (!prep || !procedure) return null;
            const prepTotal = Number.isFinite(Number(prep.total)) ? Math.max(1, Number(prep.total)) : 4;
            const prepFilled = Number.isFinite(Number(prep.filled)) ? Math.max(0, Math.min(prepTotal, Number(prep.filled))) : 0;
            const procedureTotal = Number.isFinite(Number(procedure.total)) ? Math.max(1, Number(procedure.total)) : 4;
            const procedureFilled = Number.isFinite(Number(procedure.filled)) ? Math.max(0, Math.min(procedureTotal, Number(procedure.filled))) : 0;
            return {
                ...parsed,
                prep: { ...prep, total: prepTotal, filled: prepFilled },
                procedure: { ...procedure, total: procedureTotal, filled: procedureFilled }
            };
        } catch (err) {
            return null;
        }
    };

    const saveProcedureState = (state) => {
        if (!state || typeof state !== 'object') return;
        localStorage.setItem(PREP_PROCEDURE_STATE_KEY, JSON.stringify(state));
    };

    const getFreeShieldSessionKey = () => `${FREE_SHIELD_SESSION_PREFIX}${getActiveCaseId()}`;

    const hasFreeShieldAvailable = (procedureState = getProcedureState()) => {
        if (!procedureState || !procedureState.prep) return false;
        const prep = procedureState.prep;
        const prepReady = Number(prep.total) > 0 && Number(prep.filled) >= Number(prep.total);
        if (!prepReady) return false;
        return sessionStorage.getItem(getFreeShieldSessionKey()) !== '1';
    };

    function clearTimelineLinkParamsFromUrl() {
        if (!window.history || typeof window.history.replaceState !== 'function') return;
        const url = new URL(window.location.href);
        const keys = ['search', 'focus', 'source', 'id'];
        let changed = false;
        keys.forEach((key) => {
            if (!url.searchParams.has(key)) return;
            url.searchParams.delete(key);
            changed = true;
        });
        if (changed) window.history.replaceState({}, document.title, url.toString());
    }

    function applyTimelineLinkFiltersFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const search = String(params.get('search') || '').trim();
        const focus = String(params.get('focus') || '').trim();
        const id = String(params.get('id') || '').trim();
        const effectiveSearch = search || id;
        if (!effectiveSearch && !focus) return;

        const searchInput = document.getElementById('eventSearch');
        if (searchInput && effectiveSearch) searchInput.value = effectiveSearch;
        pendingDeepLinkFocus = focus;
        clearTimelineLinkParamsFromUrl();
    }

    function buildBoardLinkForEvent(id) {
        const url = new URL('board.html', window.location.href);
        url.searchParams.set('linkType', 'timeline-event');
        url.searchParams.set('id', String(id || '').trim());
        return url.toString();
    }

    function openTimelineEventInBoard(id) {
        const cleanId = String(id || '').trim();
        if (!cleanId) return;
        window.location.assign(buildBoardLinkForEvent(cleanId));
    }

    function toggleEventForm() {
        const form = document.getElementById('eventForm');
        if (!form) return;
        form.style.display = form.style.display === 'block' ? 'none' : 'block';
        if (form.style.display === 'block') {
            document.getElementById('eventTitle').focus();
        }
    }

    function resetForm() {
        ['eventTitle', 'eventFocus', 'eventTags', 'eventImageUrl', 'eventHighlights', 'eventFallout', 'eventFollow'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const heat = document.getElementById('eventHeat');
        if (heat) heat.value = '';
    }

    function addTimelineEvent() {
        const store = getStore();
        if (!store) return;
        const title = document.getElementById('eventTitle').value.trim();
        if (!title) {
            alert('Event name required.');
            return;
        }
        const imageRaw = document.getElementById('eventImageUrl').value.trim();
        const imageUrl = sanitizeImageUrl(imageRaw);
        if (imageRaw && !imageUrl) {
            alert('Please provide a valid image URL.');
            return;
        }
        const data = {
            id: 'event_' + Date.now(),
            title,
            focus: document.getElementById('eventFocus').value,
            heatDelta: document.getElementById('eventHeat').value,
            tags: document.getElementById('eventTags').value,
            imageUrl,
            highlights: document.getElementById('eventHighlights').value,
            fallout: document.getElementById('eventFallout').value,
            followUp: document.getElementById('eventFollow').value,
            resolved: false,
            created: new Date().toISOString()
        };
        store.addEvent(data);
        applyHeatDelta(parseHeatDelta(data.heatDelta), store);
        resetForm();
        toggleEventForm();
        renderTimeline();
    }

    function addLead(leadLike) {
        const caseId = getActiveCaseId();
        const existing = getCaseLeads(caseId);
        const lead = sanitizeLead({
            ...leadLike,
            id: createLeadId(),
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        }, existing.length);
        existing.push(lead);
        saveCaseLeads(existing, caseId);
        renderLeadQueue();
        return lead;
    }

    function addLeadFromForm() {
        const type = normalizeLeadType(document.getElementById('leadType').value);
        const title = String(document.getElementById('leadTitle').value || '').trim();
        const targetId = String(document.getElementById('leadTargetId').value || '').trim();
        const question = String(document.getElementById('leadQuestion').value || '').trim();
        const nextStep = String(document.getElementById('leadNextStep').value || '').trim();
        if (!title || !question || !nextStep) {
            alert('Lead title, question, and next step are required.');
            return;
        }
        addLead({
            type,
            title,
            targetId,
            question,
            nextStep,
            status: 'open',
            votes: {}
        });
        document.getElementById('leadTitle').value = '';
        document.getElementById('leadTargetId').value = '';
        document.getElementById('leadQuestion').value = '';
        document.getElementById('leadNextStep').value = '';
    }

    function addLeadFromEvent(eventId) {
        const cleanId = String(eventId || '').trim();
        if (!cleanId) return;
        const existing = getCaseLeads(getActiveCaseId()).find((lead) =>
            lead && lead.type === 'event' &&
            String(lead.targetId || '') === cleanId &&
            lead.status !== 'resolved' &&
            lead.status !== 'dead-end'
        );
        if (existing) return existing;
        const store = getStore();
        if (!store || typeof store.getEvents !== 'function') return;
        const evt = (store.getEvents() || []).find((entry) => String(entry && entry.id || '') === cleanId);
        if (!evt) return;
        return addLead({
            type: 'event',
            targetId: cleanId,
            title: evt.title || 'Untitled Event',
            question: `What does this event reveal about the case?`,
            nextStep: `Follow up on "${evt.title || 'event'}".`,
            status: 'open',
            votes: {}
        });
    }

    function openLeadsPage(leadId = '') {
        const url = new URL('leads.html', window.location.href);
        const cleanLeadId = String(leadId || '').trim();
        if (cleanLeadId) url.searchParams.set('leadId', cleanLeadId);
        window.location.assign(url.toString());
    }

    function queueLeadFromEvent(eventId) {
        const lead = addLeadFromEvent(eventId);
        if (!lead || !lead.id) return;
        openLeadsPage(lead.id);
    }

    function updateLeadField(leadId, field, value) {
        const id = String(leadId || '').trim();
        if (!id) return;
        const caseId = getActiveCaseId();
        const list = getCaseLeads(caseId);
        const idx = list.findIndex((lead) => lead.id === id);
        if (idx < 0) return;

        if (field === 'title' || field === 'question' || field === 'nextStep' || field === 'targetId') {
            list[idx][field] = String(value || '').trim();
        }
        if (field === 'type') list[idx].type = normalizeLeadType(value);
        if (field === 'status') list[idx].status = normalizeLeadStatus(value);
        list[idx].updated = new Date().toISOString();
        saveCaseLeads(list, caseId);
        renderLeadQueue();
    }

    function setLeadVote(leadId, vote) {
        const id = String(leadId || '').trim();
        const voteKey = String(vote || '').trim().toLowerCase();
        if (!id || !Object.prototype.hasOwnProperty.call(LEAD_VOTE_LABELS, voteKey)) return;
        const voter = getCurrentLeadVoter();
        if (!voter) {
            alert('Enter your voter name before voting.');
            return;
        }
        const caseId = getActiveCaseId();
        const list = getCaseLeads(caseId);
        const idx = list.findIndex((lead) => lead.id === id);
        if (idx < 0) return;
        list[idx].votes = list[idx].votes && typeof list[idx].votes === 'object' ? list[idx].votes : {};
        list[idx].votes[voter] = voteKey;
        list[idx].updated = new Date().toISOString();
        saveCaseLeads(list, caseId);
        renderLeadQueue();
    }

    function clearLeadVote(leadId) {
        const id = String(leadId || '').trim();
        if (!id) return;
        const voter = getCurrentLeadVoter();
        if (!voter) return;
        const caseId = getActiveCaseId();
        const list = getCaseLeads(caseId);
        const idx = list.findIndex((lead) => lead.id === id);
        if (idx < 0) return;
        if (!list[idx].votes || typeof list[idx].votes !== 'object') return;
        delete list[idx].votes[voter];
        list[idx].updated = new Date().toISOString();
        saveCaseLeads(list, caseId);
        renderLeadQueue();
    }

    function deleteLead(leadId) {
        const id = String(leadId || '').trim();
        if (!id) return;
        const caseId = getActiveCaseId();
        const list = getCaseLeads(caseId);
        const idx = list.findIndex((lead) => lead.id === id);
        if (idx < 0) return;
        list.splice(idx, 1);
        saveCaseLeads(list, caseId);
        renderLeadQueue();
    }

    function isBoardNodeId(value) {
        const clean = String(value || '').trim();
        return /^node_[a-z0-9_-]+$/i.test(clean);
    }

    function openLeadOnBoard(leadId) {
        const id = String(leadId || '').trim();
        if (!id) return;
        const list = getCaseLeads(getActiveCaseId());
        const lead = list.find((entry) => entry.id === id);
        if (!lead) return;
        const target = String(lead.targetId || '').trim();
        if (!target) {
            alert('This lead has no target ID to open on board.');
            return;
        }

        const url = new URL('board.html', window.location.href);
        if (isBoardNodeId(target)) {
            url.searchParams.set('nodeId', target);
            window.location.assign(url.toString());
            return;
        }

        const linkTypeMap = {
            npc: 'npc',
            location: 'location',
            event: 'timeline-event',
            requisition: 'requisition'
        };
        const linkType = linkTypeMap[lead.type];
        if (linkType) {
            url.searchParams.set('linkType', linkType);
            url.searchParams.set('id', target);
            window.location.assign(url.toString());
            return;
        }

        alert('Board jump needs a board node ID (node_...) or an NPC/location/event/requisition lead.');
    }

    function renderLeadQueue() {
        const listEl = document.getElementById('leadList');
        const summaryEl = document.getElementById('leadSummary');
        if (!listEl || !summaryEl) return;

        const voter = getCurrentLeadVoter();
        const leads = getCaseLeads(getActiveCaseId());
        const sorted = leads.slice().sort((a, b) => {
            const statusDelta = getLeadStatusRank(a.status) - getLeadStatusRank(b.status);
            if (statusDelta !== 0) return statusDelta;
            const scoreDelta = getLeadScore(b) - getLeadScore(a);
            if (scoreDelta !== 0) return scoreDelta;
            return String(b.updated || '').localeCompare(String(a.updated || ''));
        });

        const openCount = sorted.filter((lead) => lead.status === 'open').length;
        const blockedCount = sorted.filter((lead) => lead.status === 'blocked').length;
        summaryEl.textContent = `${sorted.length} leads • ${openCount} open • ${blockedCount} blocked${voter ? ` • voting as ${voter}` : ''}`;

        if (!sorted.length) {
            listEl.innerHTML = '<div class="lead-empty">No leads yet. Create one from events or add manually.</div>';
            return;
        }

        listEl.innerHTML = sorted.map((lead) => {
            const leadId = escapeJsString(lead.id);
            const score = getLeadScore(lead);
            const currentVote = voter && lead.votes ? lead.votes[voter] : '';
            return `
                <article class="lead-card">
                    <div class="lead-head">
                        <strong>${escapeHtml(lead.title)}</strong>
                        <div class="lead-meta">
                            <span class="lead-pill">${escapeHtml((lead.type || 'other').toUpperCase())}</span>
                            <span class="lead-pill">${escapeHtml(LEAD_STATUS_LABELS[lead.status] || 'Open')}</span>
                            <span class="lead-pill score">Score ${score >= 0 ? '+' : ''}${score}</span>
                        </div>
                    </div>
                    <div class="lead-row">
                        <div>
                            <label>Question</label>
                            <input type="text" value="${escapeHtml(lead.question || '')}" data-onchange="updateLeadField('${leadId}', 'question', this.value)">
                        </div>
                        <div>
                            <label>Next Step</label>
                            <input type="text" value="${escapeHtml(lead.nextStep || '')}" data-onchange="updateLeadField('${leadId}', 'nextStep', this.value)">
                        </div>
                    </div>
                    <div class="lead-row">
                        <div>
                            <label>Status</label>
                            <select data-onchange="updateLeadField('${leadId}', 'status', this.value)">
                                ${LEAD_STATUSES.map((status) => `<option value="${status}" ${status === lead.status ? 'selected' : ''}>${escapeHtml(LEAD_STATUS_LABELS[status])}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label>Target ID</label>
                            <input type="text" value="${escapeHtml(lead.targetId || '')}" data-onchange="updateLeadField('${leadId}', 'targetId', this.value)">
                        </div>
                    </div>
                    <div class="lead-vote-row">
                        <button class="btn ${currentVote === 'hot' ? 'is-selected' : ''}" data-onclick="setLeadVote('${leadId}', 'hot')">Hot</button>
                        <button class="btn ${currentVote === 'cold' ? 'is-selected' : ''}" data-onclick="setLeadVote('${leadId}', 'cold')">Cold</button>
                        <button class="btn ${currentVote === 'dead-end' ? 'is-selected' : ''}" data-onclick="setLeadVote('${leadId}', 'dead-end')">Dead End</button>
                        <button class="btn" data-onclick="clearLeadVote('${leadId}')">Clear Vote</button>
                    </div>
                    <div class="lead-vote-summary">${escapeHtml(formatLeadVotes(lead))}</div>
                    <div class="lead-actions">
                        <button class="btn" data-onclick="openLeadOnBoard('${leadId}')">Board</button>
                        <button class="btn btn-danger" data-onclick="deleteLead('${leadId}')">Delete</button>
                    </div>
                </article>
            `;
        }).join('');
    }

    function spendProcedureShield(eventId) {
        const cleanId = String(eventId || '').trim();
        if (!cleanId) return;
        const store = getStore();
        if (!store || typeof store.getEvents !== 'function') return;
        const events = store.getEvents() || [];
        const evt = events.find((entry) => String(entry && entry.id || '') === cleanId);
        if (!evt) return;

        const heat = parseHeatDelta(evt.heatDelta);
        if (heat <= 0) {
            alert('Procedure Shield can only be used on events with positive Heat.');
            return;
        }

        const procedureState = getProcedureState();
        if (!procedureState) {
            alert('Open Prep & Procedure Clocks first so shield resources are available.');
            return;
        }

        const freeShield = hasFreeShieldAvailable(procedureState);
        if (!freeShield && Number(procedureState.procedure.filled || 0) < 1) {
            alert('No Procedure segments available to spend.');
            return;
        }

        if (freeShield) {
            sessionStorage.setItem(getFreeShieldSessionKey(), '1');
        } else {
            procedureState.procedure.filled = Math.max(0, Number(procedureState.procedure.filled || 0) - 1);
            saveProcedureState(procedureState);
        }

        const nextHeat = Math.max(0, heat - 1);
        updateEventField(cleanId, 'heatDelta', String(nextHeat));

        const priorFollowUp = String(evt.followUp || '').trim();
        const shieldLine = `Procedure Shield used (${freeShield ? 'free prep bonus' : 'spent 1 Procedure'}): Heat ${heat > 0 ? '+' : ''}${heat} -> ${nextHeat > 0 ? '+' : ''}${nextHeat}.`;
        const mergedFollowUp = priorFollowUp ? `${priorFollowUp}\n${shieldLine}` : shieldLine;
        updateEventField(cleanId, 'followUp', mergedFollowUp);

        store.addEvent({
            id: `event_proc_shield_${Date.now()}`,
            title: 'Procedure Shield Activated',
            focus: evt.focus || 'Timeline',
            heatDelta: '',
            tags: 'procedure,shield,heat-control',
            highlights: `${shieldLine} Source event: ${evt.title || cleanId}.`,
            fallout: '',
            followUp: '',
            source: 'timeline',
            kind: 'procedure-shield',
            resolved: false,
            created: new Date().toISOString()
        });
        renderTimeline();
    }

    function updateEventField(id, field, value) {
        const store = getStore();
        if (!store) return;
        let nextValue = value;
        if (field === 'imageUrl') {
            const raw = String(value || '').trim();
            const clean = sanitizeImageUrl(raw);
            if (raw && !clean) {
                alert('Please provide a valid image URL.');
                renderTimeline();
                return;
            }
            nextValue = clean;
        }
        const existing = (store.getEvents ? store.getEvents() : []).find(evt => evt.id === id);
        const previousHeat = existing ? parseHeatDelta(existing.heatDelta) : 0;
        store.updateEvent(id, { [field]: nextValue });
        if (field === 'heatDelta') {
            const nextHeat = parseHeatDelta(nextValue);
            applyHeatDelta(nextHeat - previousHeat, store);
        }
        renderTimeline();
    }

    function deleteTimelineEvent(id) {
        const store = getStore();
        if (!store) return;
        const existing = (store.getEvents ? store.getEvents() : []).find(evt => evt.id === id);
        if (!existing) return;
        const previousHeat = existing ? parseHeatDelta(existing.heatDelta) : 0;

        const manager = getDeleteManager();
        if (!manager) {
            if (!confirm('Delete this logged event?')) return;
            store.deleteEvent(id);
            applyHeatDelta(-previousHeat, store);
            renderTimeline();
            return;
        }

        manager.schedule({
            id,
            label: `Event removed: ${existing.title || 'Untitled Event'}`,
            onFinalize: () => {
                store.deleteEvent(id);
                applyHeatDelta(-previousHeat, store);
                renderTimeline();
            },
            onUndo: () => {
                renderTimeline();
            }
        });
        renderTimeline();
    }

    function renderTagPills(tags) {
        if (!tags) return '';
        return tags.split(',').map(t => t.trim()).filter(Boolean)
            .map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`)
            .join('');
    }

    function normalizeRecapText(value) {
        if (!value) return '—';
        const cleaned = String(value).trim();
        if (!cleaned) return '—';
        return cleaned.replace(/\s*\n+\s*/g, ' ');
    }

    function buildEventCard(evt) {
        const evtId = escapeJsString(evt.id || '');
        const heat = parseInt(evt.heatDelta, 10);
        const heatClass = heat > 0 ? 'tag-pill-heat-up' : 'tag-pill-heat-down';
        const heatText = !isNaN(heat) && heat !== 0
            ? `<span class="tag-pill ${heatClass}">Heat ${heat > 0 ? '+' : ''}${heat}</span>`
            : '';
        const focusDisplay = evt.focus ? `<span class="tag-pill">${escapeHtml(evt.focus)}</span>` : '';
        const resolved = Boolean(evt.resolved);
        const statusClass = resolved ? 'resolved' : 'pending';
        const statusLabel = resolved ? 'Resolved' : 'Pending';
        const imageUrl = sanitizeImageUrl(evt.imageUrl || '');
        const imageMarkup = imageUrl
            ? `<div class="event-image-block"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(evt.title || 'Event')} image"></div>`
            : '';
        const showProcedureShield = !isNaN(heat) && heat > 0;
        const freeShieldAvailable = showProcedureShield && hasFreeShieldAvailable(getProcedureState());
        const procedureShieldButton = showProcedureShield
            ? `<button class="btn btn-procedure ${freeShieldAvailable ? 'is-free' : ''}" data-onclick="spendProcedureShield('${evtId}')">${freeShieldAvailable ? 'Shield -1 (Free)' : 'Shield -1'}</button>`
            : '';

        return `
        <div class="event-card${imageMarkup ? ' has-image' : ''}">
            <div class="event-card-content">
                <div class="event-head">
                    <h3><input type="text" value="${escapeHtml(evt.title || '')}" placeholder="Title"
                        data-onchange="updateEventField('${evtId}', 'title', this.value)"></h3>
                    <button class="toggle-btn status-toggle status-pill ${statusClass} ${resolved ? 'active' : ''}" type="button"
                        aria-pressed="${resolved ? 'true' : 'false'}"
                        data-onclick="toggleResolved('${evtId}', this)">${statusLabel}</button>
                </div>
                <div class="event-meta">
                    <div>
                        <label>Focus</label>
                        <input type="text" value="${escapeHtml(evt.focus || '')}" placeholder="District / Guild"
                            data-onchange="updateEventField('${evtId}', 'focus', this.value)">
                    </div>
                    <div>
                        <label>Heat Δ</label>
                        <input type="number" value="${escapeHtml(evt.heatDelta || '')}" placeholder="0"
                            data-onchange="updateEventField('${evtId}', 'heatDelta', this.value)">
                    </div>
                    <div>
                        <label>Tags</label>
                        <input type="text" value="${escapeHtml(evt.tags || '')}" placeholder="tags"
                            data-onchange="updateEventField('${evtId}', 'tags', this.value)">
                    </div>
                    <div>
                        <label>Image URL</label>
                        <input type="url" value="${escapeHtml(evt.imageUrl || '')}" placeholder="https://..."
                            data-onchange="updateEventField('${evtId}', 'imageUrl', this.value)">
                    </div>
                </div>
                <div class="event-pill-row">${heatText} ${focusDisplay} ${renderTagPills(evt.tags)}</div>
                <div class="event-body">
                    <textarea placeholder="Highlights" data-onchange="updateEventField('${evtId}', 'highlights', this.value)">${escapeHtml(evt.highlights || '')}</textarea>
                    <textarea placeholder="Fallout" data-onchange="updateEventField('${evtId}', 'fallout', this.value)">${escapeHtml(evt.fallout || '')}</textarea>
                    <textarea placeholder="Follow Ups" data-onchange="updateEventField('${evtId}', 'followUp', this.value)">${escapeHtml(evt.followUp || '')}</textarea>
                </div>
                <div class="event-actions">
                    <small class="event-log-meta">Logged ${evt.created ? new Date(evt.created).toLocaleString() : '—'}</small>
                    ${procedureShieldButton}
                    <button class="btn" data-onclick="queueLeadFromEvent('${evtId}')">Lead Queue</button>
                    <button class="btn" data-onclick="openTimelineEventInBoard('${evtId}')">Board</button>
                    <button class="btn btn-danger" data-onclick="deleteTimelineEvent('${evtId}')">Delete</button>
                </div>
            </div>
            ${imageMarkup}
        </div>`;
    }

    function populateFocusFilter(events) {
        const filter = document.getElementById('eventFocusFilter');
        if (!filter) return;
        const preserved = filter.value;
        const focusValues = Array.from(new Set(events.map(e => e.focus).filter(Boolean))).sort();
        filter.innerHTML = '<option value="">All Focuses</option>' + focusValues.map(focus => `<option value="${escapeHtml(focus)}">${escapeHtml(focus)}</option>`).join('');
        if (pendingDeepLinkFocus && focusValues.includes(pendingDeepLinkFocus)) {
            filter.value = pendingDeepLinkFocus;
            pendingDeepLinkFocus = '';
            return;
        }
        if (focusValues.includes(preserved)) {
            filter.value = preserved;
        }
    }

    function getFilteredEvents() {
        const store = getStore();
        const manager = getDeleteManager();
        if (!store) {
            return { filtered: [], filters: null };
        }
        const events = (store.getEvents() || []).slice();
        populateFocusFilter(events);

        const search = (document.getElementById('eventSearch').value || '').toLowerCase();
        const focusFilter = document.getElementById('eventFocusFilter').value;
        const sort = document.getElementById('eventSort').value;
        const impactOnly = isButtonPressed('eventImpactOnly');
        const hideResolved = isButtonPressed('eventHideResolved');

        const filtered = events.filter(evt => {
            if (manager && manager.isPending(evt.id)) return false;
            const text = `${evt.id || ''} ${evt.title || ''} ${evt.focus || ''} ${evt.highlights || ''} ${evt.fallout || ''} ${evt.followUp || ''} ${evt.tags || ''}`.toLowerCase();
            const matchesSearch = search ? text.includes(search) : true;
            const matchesFocus = focusFilter ? evt.focus === focusFilter : true;
            const heat = parseInt(evt.heatDelta, 10);
            const matchesImpact = impactOnly ? (!isNaN(heat) && heat !== 0) || (evt.fallout && evt.fallout.trim()) : true;
            const matchesResolved = hideResolved ? !evt.resolved : true;
            return matchesSearch && matchesFocus && matchesImpact && matchesResolved;
        });

        filtered.sort((a, b) => {
            if (sort === 'heat') {
                const aHeat = Math.abs(parseInt(a.heatDelta || '0', 10));
                const bHeat = Math.abs(parseInt(b.heatDelta || '0', 10));
                return bHeat - aHeat;
            }
            const aTime = a.created || '';
            const bTime = b.created || '';
            if (sort === 'oldest') {
                return aTime.localeCompare(bTime);
            }
            return bTime.localeCompare(aTime);
        });

        return {
            filtered,
            filters: {
                search,
                focusFilter,
                sort,
                impactOnly
            }
        };
    }

    function buildExportRecap(events, filters) {
        const lines = [];
        lines.push('# Mission Timeline Recap');
        lines.push(`Generated: ${new Date().toLocaleString()}`);
        lines.push('');
        lines.push('## Active Filters');
        lines.push(`- Search: ${filters.search ? `"${filters.search}"` : 'None'}`);
        lines.push(`- Focus: ${filters.focusFilter || 'All'}`);
        lines.push(`- Sort: ${filters.sort}`);
        lines.push(`- Impact only: ${filters.impactOnly ? 'Yes' : 'No'}`);
        lines.push('');

        events.forEach(evt => {
            const title = normalizeRecapText(evt.title);
            const focus = normalizeRecapText(evt.focus);
            const heat = parseInt(evt.heatDelta, 10);
            const heatDisplay = Number.isNaN(heat) ? '—' : `${heat > 0 ? '+' : ''}${heat}`;
            lines.push(`### ${title}`);
            lines.push(`- Focus: ${focus}`);
            lines.push(`- Heat Δ: ${heatDisplay}`);
            lines.push(`- Image: ${normalizeRecapText(evt.imageUrl)}`);
            lines.push(`- Highlights: ${normalizeRecapText(evt.highlights)}`);
            lines.push(`- Fallout: ${normalizeRecapText(evt.fallout)}`);
            lines.push(`- Follow-up: ${normalizeRecapText(evt.followUp)}`);
            lines.push('');
        });

        return lines.join('\n').trim() + '\n';
    }

    function triggerRecapDownload(text) {
        const dateStamp = new Date().toISOString().slice(0, 10);
        const blob = new Blob([text], { type: 'text/markdown' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `mission-timeline-recap-${dateStamp}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 500);
    }

    function exportTimelineRecap() {
        const { filtered, filters } = getFilteredEvents();
        if (!filters) return;
        if (!filtered.length) {
            alert('No matching events to export.');
            return;
        }
        const recapText = buildExportRecap(filtered, filters);
        triggerRecapDownload(recapText);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(recapText).catch(() => {
                // Clipboard may be blocked; download already started.
            });
        }
    }

    function renderTimeline() {
        const container = document.getElementById('timelineList');
        if (!container) return;
        const { filtered } = getFilteredEvents();

        container.innerHTML = filtered.length
            ? filtered.map(buildEventCard).join('')
            : '<div class="empty-state">No events logged yet.</div>';
        renderLeadQueue();
    }

    function init() {
        getDeleteManager();
        const autoHeatToggle = document.getElementById('eventAutoHeat');
        if (autoHeatToggle) {
            setButtonPressed(autoHeatToggle, isHeatAutoSyncEnabled());
        }
        applyTimelineLinkFiltersFromUrl();
        const voterInput = document.getElementById('leadVoter');
        if (voterInput) {
            voterInput.value = getOrCreateLeadVoter();
            voterInput.addEventListener('input', () => {
                localStorage.setItem(LEAD_VOTER_NAME_KEY, String(voterInput.value || '').trim().slice(0, 60));
                renderLeadQueue();
            });
        }
        renderTimeline();
    }

    function waitForStore() {
        if (getStore()) {
            init();
        } else {
            setTimeout(waitForStore, 100);
        }
    }

    window.toggleEventForm = toggleEventForm;
    window.addTimelineEvent = addTimelineEvent;
    window.renderTimeline = renderTimeline;
    window.updateEventField = updateEventField;
    window.deleteTimelineEvent = deleteTimelineEvent;
    window.setHeatAutoSync = setHeatAutoSync;
    window.exportTimelineRecap = exportTimelineRecap;
    window.openTimelineEventInBoard = openTimelineEventInBoard;
    window.spendProcedureShield = spendProcedureShield;
    window.addLeadFromEvent = addLeadFromEvent;
    window.queueLeadFromEvent = queueLeadFromEvent;
    window.addLeadFromForm = addLeadFromForm;
    window.openLeadsPage = openLeadsPage;
    window.updateLeadField = updateLeadField;
    window.setLeadVote = setLeadVote;
    window.clearLeadVote = clearLeadVote;
    window.deleteLead = deleteLead;
    window.openLeadOnBoard = openLeadOnBoard;
    window.toggleFilterButton = toggleFilterButton;
    window.toggleAutoHeat = toggleAutoHeat;
    window.toggleResolved = toggleResolved;

    window.addEventListener('load', waitForStore);
    window.addEventListener('beforeunload', () => {
        const manager = getDeleteManager();
        if (manager && typeof manager.flush === 'function') manager.flush();
    });
    window.addEventListener('storage', (event) => {
        if (!event || event.key !== LEAD_STORAGE_KEY) return;
        renderLeadQueue();
    });
    window.addEventListener('rtf-store-updated', (event) => {
        if (!event || !event.detail || event.detail.source !== 'remote') return;
        renderTimeline();
    });

    function setButtonPressed(button, pressed) {
        if (!button) return;
        const isPressed = Boolean(pressed);
        button.setAttribute('aria-pressed', String(isPressed));
        button.classList.toggle('active', isPressed);
    }

    function isButtonPressed(id) {
        const button = document.getElementById(id);
        return button ? button.getAttribute('aria-pressed') === 'true' : false;
    }

    function toggleFilterButton(button, callback) {
        if (!button) return;
        const next = button.getAttribute('aria-pressed') !== 'true';
        setButtonPressed(button, next);
        if (typeof callback === 'function') callback();
    }

    function toggleAutoHeat(button) {
        if (!button) return;
        const next = button.getAttribute('aria-pressed') !== 'true';
        setButtonPressed(button, next);
        setHeatAutoSync(next);
    }

    function toggleResolved(id, button) {
        if (!button) return;
        const next = button.getAttribute('aria-pressed') !== 'true';
        setButtonPressed(button, next);
        updateEventField(id, 'resolved', next);
    }
})();
    const createDefaultLeadVoter = () => `Player-${Math.floor(1000 + Math.random() * 9000)}`;

    const getStoredLeadVoter = () => String(localStorage.getItem(LEAD_VOTER_NAME_KEY) || '').trim().slice(0, 60);

    const getOrCreateLeadVoter = () => {
        const existing = getStoredLeadVoter();
        if (existing) return existing;
        const generated = createDefaultLeadVoter();
        localStorage.setItem(LEAD_VOTER_NAME_KEY, generated);
        return generated;
    };
