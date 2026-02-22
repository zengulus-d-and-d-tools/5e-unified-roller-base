// Use global data if available
const guilds = (typeof window.getRTFGuilds === 'function')
    ? window.getRTFGuilds({ includeGuildless: true })
    : ((window.RTF_DATA && window.RTF_DATA.guilds)
        ? window.RTF_DATA.guilds
        : ["Azorius", "Boros", "Dimir", "Golgari", "Gruul", "Izzet", "Orzhov", "Rakdos", "Selesnya", "Simic", "Guildless"]);

const escapeHtml = (str = '') => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const escapeJsString = (value = '') => String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
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
const delegatedHandlerEvents = ['click', 'change', 'input'];
const delegatedHandlerCache = new Map();
let delegatedHandlersBound = false;

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

let editingNPCId = '';
let editingPreloadedImageOnly = false;
let pendingLinkNPCId = '';
const TRUST_LABELS = ['Hostile', 'Wary', 'Neutral', 'Trusted', 'Loyal'];
const STIGMA_LABELS = ['Clean', 'Rumored', 'Noticed', 'Marked', 'Burned'];

function clampTrackLevel(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.min(4, parsed));
}

const normalizeNPCField = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const GUILD_FILTER_ALIASES = Object.freeze({
    'azorius senate': 'azorius',
    'boros legion': 'boros',
    'house dimir': 'dimir',
    'golgari swarm': 'golgari',
    'gruul clans': 'gruul',
    'izzet league': 'izzet',
    'orzhov syndicate': 'orzhov',
    'cult of rakdos': 'rakdos',
    'selesnya conclave': 'selesnya',
    'simic combine': 'simic'
});
const normalizeGuildFilterKey = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!raw) return '';

    if (Object.prototype.hasOwnProperty.call(GUILD_FILTER_ALIASES, raw)) {
        return GUILD_FILTER_ALIASES[raw];
    }
    return raw;
};
const buildNPCSignature = (npc) => {
    if (!npc || typeof npc !== 'object') return '';
    return [
        normalizeNPCField(npc.name),
        normalizeNPCField(npc.guild),
        normalizeNPCField(npc.wants),
        normalizeNPCField(npc.leverage),
        normalizeNPCField(npc.notes)
    ].join('|');
};

const PRELOADED_NPC_SIGNATURES = new Set(
    (Array.isArray(window.PRELOADED_NPCS) ? window.PRELOADED_NPCS : []).map(buildNPCSignature)
);

function getCampaign() {
    if (!window.RTF_STORE) return null;
    return window.RTF_STORE.state.campaign;
}

function save() {
    if (window.RTF_STORE) window.RTF_STORE.save({ scope: 'campaign.npcs' });
    render();
}

function createNPCId() {
    return 'npc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function findNPCById(npcId) {
    const c = getCampaign();
    if (!c || !Array.isArray(c.npcs)) return { npc: null, index: -1 };
    const id = String(npcId || '');
    const index = c.npcs.findIndex((entry) => String(entry && entry.id || '') === id);
    return {
        npc: index >= 0 ? c.npcs[index] : null,
        index
    };
}

function getLinkedNpcIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get('npcId') || '').trim();
}

function buildNPCDeepLink(npcId) {
    const url = new URL(window.location.href);
    url.searchParams.set('npcId', String(npcId || ''));
    return url.toString();
}

function copyNPCLink(npcId) {
    const id = String(npcId || '').trim();
    if (!id) return;
    const url = buildNPCDeepLink(id);

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(url).catch(() => {
            prompt('Copy NPC link:', url);
        });
        return;
    }
    prompt('Copy NPC link:', url);
}

function buildBoardLinkForNPC(npcId) {
    const url = new URL('board.html', window.location.href);
    url.searchParams.set('linkType', 'npc');
    url.searchParams.set('id', String(npcId || '').trim());
    return url.toString();
}

function openNPCInBoard(npcId) {
    const id = String(npcId || '').trim();
    if (!id) return;
    window.location.assign(buildBoardLinkForNPC(id));
}

function applyPendingNpcDeepLinkFocus() {
    if (!pendingLinkNPCId) return;
    const rows = Array.from(document.querySelectorAll('.roster-npc-row[data-npc-id]'));
    const target = rows.find((row) => row.dataset.npcId === pendingLinkNPCId);
    if (!target) return;

    pendingLinkNPCId = '';
    requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('roster-linked-focus');
        setTimeout(() => {
            target.classList.remove('roster-linked-focus');
        }, 2200);
    });
}

function setFormImageOnlyMode(imageOnly) {
    const ids = ['npcName', 'npcGuild', 'npcWants', 'npcLeverage', 'npcNotes', 'npcTrust', 'npcStigma'];
    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = !!imageOnly;
    });
}

function setFormMode(isEditing, imageOnly = false) {
    const saveBtn = document.getElementById('npcSaveBtn');
    const cancelBtn = document.getElementById('npcCancelBtn');
    if (saveBtn) saveBtn.textContent = isEditing
        ? (imageOnly ? 'Update NPC Image' : 'Update NPC')
        : 'Save NPC';
    if (cancelBtn) cancelBtn.classList.toggle('roster-hidden', !isEditing);
    setFormImageOnlyMode(isEditing && imageOnly);
}

function clearNPCForm() {
    document.getElementById('npcName').value = '';
    document.getElementById('npcGuild').value = '';
    document.getElementById('npcWants').value = '';
    document.getElementById('npcLeverage').value = '';
    document.getElementById('npcImageUrl').value = '';
    document.getElementById('npcNotes').value = '';
    document.getElementById('npcTrust').value = '2';
    document.getElementById('npcStigma').value = '0';
}

function fillNPCForm(npc) {
    document.getElementById('npcName').value = npc && npc.name ? npc.name : '';
    document.getElementById('npcGuild').value = npc && npc.guild ? npc.guild : '';
    document.getElementById('npcWants').value = npc && npc.wants ? npc.wants : '';
    document.getElementById('npcLeverage').value = npc && npc.leverage ? npc.leverage : '';
    document.getElementById('npcImageUrl').value = npc && npc.imageUrl ? npc.imageUrl : '';
    document.getElementById('npcNotes').value = npc && npc.notes ? npc.notes : '';
    document.getElementById('npcTrust').value = String(clampTrackLevel(npc && npc.trust, 2));
    document.getElementById('npcStigma').value = String(clampTrackLevel(npc && npc.stigma, 0));
}

function ensureGuildOptions() {
    const sel = document.getElementById('npcGuild');
    if (!sel) return;
    if (sel.options.length > 1) return;

    guilds.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.innerText = g;
        sel.appendChild(opt);
    });
}

function isPreloadedNPC(npc) {
    if (!npc || typeof npc !== 'object') return false;

    const source = String(npc.__rtfSource || npc.source || '').toLowerCase();
    if (source === 'custom') return false;
    if (source === 'preloaded') return true;

    return PRELOADED_NPC_SIGNATURES.has(buildNPCSignature(npc));
}

function toggleNPCForm() {
    const form = document.getElementById('npcForm');
    if (!form) return;
    const willOpen = form.classList.contains('roster-hidden');
    form.classList.toggle('roster-hidden', !willOpen);

    ensureGuildOptions();
    if (willOpen && !editingNPCId) {
        clearNPCForm();
        setFormMode(false);
    } else if (!willOpen && editingNPCId) {
        editingNPCId = '';
        editingPreloadedImageOnly = false;
        setFormMode(false);
    }
}

function cancelNPCEdit() {
    editingNPCId = '';
    editingPreloadedImageOnly = false;
    clearNPCForm();
    setFormMode(false);
    const form = document.getElementById('npcForm');
    if (form) form.classList.add('roster-hidden');
}

function addNPC() {
    const name = document.getElementById('npcName').value.trim();
    const guild = document.getElementById('npcGuild').value;
    const wants = document.getElementById('npcWants').value.trim();
    const leverage = document.getElementById('npcLeverage').value.trim();
    const imageRaw = document.getElementById('npcImageUrl').value.trim();
    const imageUrl = sanitizeImageUrl(imageRaw);
    const notes = document.getElementById('npcNotes').value.trim();
    const trust = clampTrackLevel(document.getElementById('npcTrust').value, 2);
    const stigma = clampTrackLevel(document.getElementById('npcStigma').value, 0);

    if (!name && !editingPreloadedImageOnly) { alert("Name Required"); return; }
    if (imageRaw && !imageUrl) { alert("Please provide a valid image URL."); return; }

    const c = getCampaign();
    if (!c) return;
    if (!Array.isArray(c.npcs)) c.npcs = [];

    if (editingNPCId) {
        const { npc: target, index } = findNPCById(editingNPCId);
        if (!target) {
            alert("Could not find NPC to edit.");
            editingNPCId = '';
            editingPreloadedImageOnly = false;
            setFormMode(false);
            return;
        }
        if (isPreloadedNPC(target) || editingPreloadedImageOnly) {
            c.npcs[index] = {
                ...target,
                imageUrl,
                __rtfSource: 'preloaded'
            };
        } else {
            c.npcs[index] = {
                ...target,
                name,
                guild,
                wants,
                leverage,
                imageUrl,
                notes,
                trust,
                stigma,
                __rtfSource: 'custom'
            };
        }
    } else {
        c.npcs.push({
            id: createNPCId(),
            name,
            guild,
            wants,
            leverage,
            imageUrl,
            notes,
            trust,
            stigma,
            __rtfSource: 'custom'
        });
    }

    save();
    cancelNPCEdit();
}

function editNPC(npcId) {
    const { npc } = findNPCById(npcId);
    if (!npc) return;
    const isPreloaded = isPreloadedNPC(npc);

    editingNPCId = String(npcId || '');
    editingPreloadedImageOnly = isPreloaded;
    ensureGuildOptions();
    fillNPCForm(npc);
    setFormMode(true, isPreloaded);

    const form = document.getElementById('npcForm');
    if (form) form.classList.remove('roster-hidden');
    const focusTarget = isPreloaded
        ? document.getElementById('npcImageUrl')
        : document.getElementById('npcName');
    if (focusTarget) focusTarget.focus();
}

function deleteNPC(npcId) {
    if (!confirm("Delete this NPC?")) return;
    const c = getCampaign();
    if (!c || !Array.isArray(c.npcs)) return;

    const id = String(npcId || '');
    const idx = c.npcs.findIndex((entry) => String(entry && entry.id || '') === id);
    if (idx < 0) return;

    c.npcs.splice(idx, 1);
    if (editingNPCId === id) {
        cancelNPCEdit();
    }
    save();
}

function updateNPCTrack(npcId, field, delta) {
    if (field !== 'trust' && field !== 'stigma') return;
    const { npc, index } = findNPCById(npcId);
    if (!npc || index < 0) return;
    const c = getCampaign();
    if (!c || !Array.isArray(c.npcs)) return;
    const current = clampTrackLevel(npc[field], field === 'trust' ? 2 : 0);
    c.npcs[index] = {
        ...npc,
        [field]: clampTrackLevel(current + Number(delta || 0), current)
    };
    save();
}

function render() {
    const c = getCampaign();
    if (!c) return;

    const search = document.getElementById('searchFilter').value.toLowerCase();
    const guildFilter = document.getElementById('guildFilter').value;
    const guildFilterKey = normalizeGuildFilterKey(guildFilter);

    // Populate Filter if empty
    const gFilter = document.getElementById('guildFilter');
    if (gFilter.options.length <= 1) {
        guilds.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.innerText = g;
            gFilter.appendChild(opt);
        });
    }

    const container = document.getElementById('npcList');
    if (!container) return;

    const list = (c.npcs || []).filter((npc) => npc && typeof npc === 'object');
    let mutatedIds = false;
    list.forEach((npc) => {
        if (!npc.id) {
            npc.id = createNPCId();
            mutatedIds = true;
        }
    });
    if (mutatedIds && window.RTF_STORE) {
        setTimeout(() => {
            window.RTF_STORE.save({ scope: 'campaign.npcs' });
        }, 0);
    }

    const filtered = list.filter(npc => {
        const name = String(npc.name || '');
        const guild = String(npc.guild || '');
        const matchesName = name.toLowerCase().includes(search);
        const matchesGuild = !guildFilterKey || normalizeGuildFilterKey(guild) === guildFilterKey;
        return matchesName && matchesGuild;
    });

    container.innerHTML = filtered.map(npc => {
        const npcId = String(npc.id || '');
        const npcIdArg = escapeJsString(npcId);
        const trust = clampTrackLevel(npc.trust, 2);
        const stigma = clampTrackLevel(npc.stigma, 0);
        const imageUrl = sanitizeImageUrl(npc.imageUrl || '');
        const imageMarkup = imageUrl
            ? `<div class="roster-npc-image"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(npc.name || 'NPC')} portrait"></div>`
            : '';
        const locked = isPreloadedNPC(npc);
        const editButton = locked
            ? `<button class="btn roster-npc-edit-btn" data-onclick="editNPC('${npcIdArg}')" title="Set NPC image (preloaded details are locked)">🖼️</button>`
            : `<button class="btn roster-npc-edit-btn" data-onclick="editNPC('${npcIdArg}')" title="Edit NPC">✏️</button>`;
        const rowClass = imageMarkup ? 'has-image' : 'no-image';

        return `
        <div class="roster-npc-row ${rowClass}" data-npc-id="${escapeHtml(npcId)}">
            ${imageMarkup}
            <div class="roster-npc-content">
                <div class="roster-npc-summary">
                    <div class="roster-npc-name">${escapeHtml(npc.name)}</div>
                    <div class="roster-npc-guild">${escapeHtml(npc.guild)}</div>

                    <div class="roster-npc-meta-block">
                        <div class="roster-npc-meta-label">Wants</div>
                        ${escapeHtml(npc.wants || '-')}
                    </div>
                    <div class="roster-npc-meta-block">
                        <div class="roster-npc-meta-label">Leverage</div>
                        ${escapeHtml(npc.leverage || '-')}
                    </div>
                    <div class="roster-npc-meta-block">
                        <div class="roster-npc-meta-label">Trust</div>
                        <div class="roster-track-row">
                            <button class="btn roster-track-btn" data-onclick="updateNPCTrack('${npcIdArg}', 'trust', -1)">-</button>
                            <span class="roster-track-value">${escapeHtml(TRUST_LABELS[trust])}</span>
                            <button class="btn roster-track-btn" data-onclick="updateNPCTrack('${npcIdArg}', 'trust', 1)">+</button>
                        </div>
                    </div>
                    <div class="roster-npc-meta-block">
                        <div class="roster-npc-meta-label">Stigma</div>
                        <div class="roster-track-row">
                            <button class="btn roster-track-btn" data-onclick="updateNPCTrack('${npcIdArg}', 'stigma', -1)">-</button>
                            <span class="roster-track-value">${escapeHtml(STIGMA_LABELS[stigma])}</span>
                            <button class="btn roster-track-btn" data-onclick="updateNPCTrack('${npcIdArg}', 'stigma', 1)">+</button>
                        </div>
                    </div>
                </div>

                <div class="roster-npc-notes">
                    ${escapeHtml(npc.notes || '')}
                </div>
            </div>

            ${editButton}
            <button class="btn roster-npc-board-btn" data-onclick="openNPCInBoard('${npcIdArg}')" title="Open on board">🧩</button>
            <button class="btn roster-npc-link-btn" data-onclick="copyNPCLink('${npcIdArg}')" title="Copy deep link">🔗</button>
            <button class="btn roster-npc-delete-btn" data-onclick="deleteNPC('${npcIdArg}')" title="Delete NPC">&times;</button>
        </div>
    `;
    }).join('');

    applyPendingNpcDeepLinkFocus();
}

window.addEventListener('load', () => {
    pendingLinkNPCId = getLinkedNpcIdFromUrl();
    if (window.RTF_STORE) {
        ensureGuildOptions();
        setFormMode(false);
        render();
    } else {
        setTimeout(() => {
            ensureGuildOptions();
            setFormMode(false);
            render();
        }, 100);
    }
});

window.addEventListener('rtf-store-updated', () => {
    render();
});

window.copyNPCLink = copyNPCLink;
window.openNPCInBoard = openNPCInBoard;
window.updateNPCTrack = updateNPCTrack;
