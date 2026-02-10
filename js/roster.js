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
const delegatedHandlerEvents = ['click', 'change', 'input'];
const delegatedHandlerCache = new Map();
let delegatedHandlersBound = false;

function getDelegatedHandlerFn(code) {
    if (!delegatedHandlerCache.has(code)) {
        delegatedHandlerCache.set(code, new Function('event', `return (function(){ ${code} }).call(this);`));
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

let editingNPCIndex = null;

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
    document.getElementById('npcNotes').value = '';
}

function fillNPCForm(npc) {
    document.getElementById('npcName').value = npc && npc.name ? npc.name : '';
    document.getElementById('npcGuild').value = npc && npc.guild ? npc.guild : '';
    document.getElementById('npcWants').value = npc && npc.wants ? npc.wants : '';
    document.getElementById('npcLeverage').value = npc && npc.leverage ? npc.leverage : '';
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
    if (willOpen && editingNPCIndex === null) {
        clearNPCForm();
        setFormMode(false);
    } else if (!willOpen && editingNPCIndex !== null) {
        editingNPCIndex = null;
        setFormMode(false);
    }
}

function cancelNPCEdit() {
    editingNPCIndex = null;
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
    const notes = document.getElementById('npcNotes').value.trim();

    if (!name) { alert("Name Required"); return; }

    const c = getCampaign();
    if (!c) return;
    if (!Array.isArray(c.npcs)) c.npcs = [];

    if (editingNPCIndex !== null) {
        const idx = Number(editingNPCIndex);
        const target = c.npcs[idx];
        if (!target) {
            alert("Could not find NPC to edit.");
            editingNPCIndex = null;
            setFormMode(false);
            return;
        }
        if (isPreloadedNPC(target)) {
            alert("Preloaded NPCs cannot be edited here.");
            cancelNPCEdit();
            return;
        }

        c.npcs[idx] = {
            ...target,
            name,
            guild,
            wants,
            leverage,
            notes,
            __rtfSource: 'custom'
        };
    } else {
        c.npcs.push({ name, guild, wants, leverage, notes, __rtfSource: 'custom' });
    }

    save();
    cancelNPCEdit();
}

function editNPC(idx) {
    const c = getCampaign();
    if (!c || !Array.isArray(c.npcs)) return;
    const npc = c.npcs[idx];
    if (!npc) return;

    if (isPreloadedNPC(npc)) {
        alert("Preloaded NPCs cannot be edited here.");
        return;
    }

    editingNPCIndex = idx;
    ensureGuildOptions();
    fillNPCForm(npc);
    setFormMode(true);

    const form = document.getElementById('npcForm');
    if (form) form.classList.remove('roster-hidden');
    const nameInput = document.getElementById('npcName');
    if (nameInput) nameInput.focus();
}

function deleteNPC(idx) {
    if (!confirm("Delete this NPC?")) return;
    const c = getCampaign();
    if (!c || !Array.isArray(c.npcs)) return;
    c.npcs.splice(idx, 1);
    if (editingNPCIndex === idx) {
        cancelNPCEdit();
    } else if (editingNPCIndex !== null && idx < editingNPCIndex) {
        editingNPCIndex -= 1;
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

    // Map first to preserve original index, then filter.
    const list = (c.npcs || []).map((npc, idx) => ({ ...npc, origIdx: idx }));

    const filtered = list.filter(npc => {
        const name = String(npc.name || '');
        const guild = String(npc.guild || '');
        const matchesName = name.toLowerCase().includes(search);
        const matchesGuild = !guildFilter || guild === guildFilter;
        return matchesName && matchesGuild;
    });

    container.innerHTML = filtered.map(npc => {
        const locked = isPreloadedNPC(npc);
        const editButton = locked
            ? `<span class="roster-npc-lock-icon" title="Preloaded NPC (read-only)">🔒</span>`
            : `<button class="btn roster-npc-edit-btn" data-onclick="editNPC(${npc.origIdx})" title="Edit NPC">✏️</button>`;

        return `
        <div class="roster-npc-row">
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

            <div class="roster-npc-notes">
                ${escapeHtml(npc.notes || '')}
            </div>

            ${editButton}
            <button class="btn roster-npc-delete-btn" data-onclick="deleteNPC(${npc.origIdx})" title="Delete NPC">&times;</button>
        </div>
    `;
    }).join('');
}

window.onload = () => {
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
};
