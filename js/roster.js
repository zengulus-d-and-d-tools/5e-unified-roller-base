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
let pendingLinkNPCId = '';

const normalizeNPCField = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
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

function setFormMode(isEditing) {
    const saveBtn = document.getElementById('npcSaveBtn');
    const cancelBtn = document.getElementById('npcCancelBtn');
    if (saveBtn) saveBtn.textContent = isEditing ? 'Update NPC' : 'Save NPC';
    if (cancelBtn) cancelBtn.classList.toggle('roster-hidden', !isEditing);
}

function clearNPCForm() {
    document.getElementById('npcName').value = '';
    document.getElementById('npcGuild').value = '';
    document.getElementById('npcWants').value = '';
    document.getElementById('npcLeverage').value = '';
    document.getElementById('npcImageUrl').value = '';
    document.getElementById('npcNotes').value = '';
}

function fillNPCForm(npc) {
    document.getElementById('npcName').value = npc && npc.name ? npc.name : '';
    document.getElementById('npcGuild').value = npc && npc.guild ? npc.guild : '';
    document.getElementById('npcWants').value = npc && npc.wants ? npc.wants : '';
    document.getElementById('npcLeverage').value = npc && npc.leverage ? npc.leverage : '';
    document.getElementById('npcImageUrl').value = npc && npc.imageUrl ? npc.imageUrl : '';
    document.getElementById('npcNotes').value = npc && npc.notes ? npc.notes : '';
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
        setFormMode(false);
    }
}

function cancelNPCEdit() {
    editingNPCId = '';
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

    if (!name) { alert("Name Required"); return; }
    if (imageRaw && !imageUrl) { alert("Please provide a valid image URL."); return; }

    const c = getCampaign();
    if (!c) return;
    if (!Array.isArray(c.npcs)) c.npcs = [];

    if (editingNPCId) {
        const { npc: target, index } = findNPCById(editingNPCId);
        if (!target) {
            alert("Could not find NPC to edit.");
            editingNPCId = '';
            setFormMode(false);
            return;
        }
        if (isPreloadedNPC(target)) {
            alert("Preloaded NPCs cannot be edited here.");
            cancelNPCEdit();
            return;
        }

        c.npcs[index] = {
            ...target,
            name,
            guild,
            wants,
            leverage,
            imageUrl,
            notes,
            __rtfSource: 'custom'
        };
    } else {
        c.npcs.push({
            id: createNPCId(),
            name,
            guild,
            wants,
            leverage,
            imageUrl,
            notes,
            __rtfSource: 'custom'
        });
    }

    save();
    cancelNPCEdit();
}

function editNPC(npcId) {
    const { npc } = findNPCById(npcId);
    if (!npc) return;

    if (isPreloadedNPC(npc)) {
        alert("Preloaded NPCs cannot be edited here.");
        return;
    }

    editingNPCId = String(npcId || '');
    ensureGuildOptions();
    fillNPCForm(npc);
    setFormMode(true);

    const form = document.getElementById('npcForm');
    if (form) form.classList.remove('roster-hidden');
    const nameInput = document.getElementById('npcName');
    if (nameInput) nameInput.focus();
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

function render() {
    const c = getCampaign();
    if (!c) return;

    const search = document.getElementById('searchFilter').value.toLowerCase();
    const guildFilter = document.getElementById('guildFilter').value;

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
        const matchesGuild = !guildFilter || guild === guildFilter;
        return matchesName && matchesGuild;
    });

    container.innerHTML = filtered.map(npc => {
        const npcId = String(npc.id || '');
        const npcIdArg = escapeJsString(npcId);
        const imageUrl = sanitizeImageUrl(npc.imageUrl || '');
        const imageMarkup = imageUrl
            ? `<div class="roster-npc-image"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(npc.name || 'NPC')} portrait"></div>`
            : '';
        const locked = isPreloadedNPC(npc);
        const editButton = locked
            ? `<span class="roster-npc-lock-icon" title="Preloaded NPC (read-only)">🔒</span>`
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
