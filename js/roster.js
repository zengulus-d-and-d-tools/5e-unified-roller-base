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
    if (window.RTF_STORE) window.RTF_STORE.save();
    render();
}

function setFormMode(isEditing) {
    const saveBtn = document.getElementById('npcSaveBtn');
    const cancelBtn = document.getElementById('npcCancelBtn');
    if (saveBtn) saveBtn.textContent = isEditing ? 'Update NPC' : 'Save NPC';
    if (cancelBtn) cancelBtn.style.display = isEditing ? 'inline-block' : 'none';
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
    const willOpen = form.style.display === 'none';
    form.style.display = willOpen ? 'block' : 'none';

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
    if (form) form.style.display = 'none';
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
    if (form) form.style.display = 'block';
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
            ? `<span style="position:absolute; right:44px; top:10px; color:#888; font-size:1rem;" title="Preloaded NPC (read-only)">🔒</span>`
            : `<button class="btn" onclick="editNPC(${npc.origIdx})" style="position:absolute; right:44px; top:8px; padding:4px 7px; color:var(--accent); border:none; background:transparent; font-size:1rem; cursor:pointer;" title="Edit NPC">✏️</button>`;

        return `
        <div style="position:relative; display:grid; grid-template-columns: 1.5fr 1fr 1.5fr 1.5fr; gap:10px; align-items:start; padding:15px; padding-right:72px; border-bottom:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.1); margin-bottom:5px; border-radius:4px;">
            <div style="font-weight:bold; font-size:1.1rem;">${escapeHtml(npc.name)}</div>
            <div style="color:var(--accent); font-weight:bold;">${escapeHtml(npc.guild)}</div>

            <div style="font-size:0.9rem;">
                <div style="color:#888; font-size:0.8rem; text-transform:uppercase;">Wants</div>
                ${escapeHtml(npc.wants || '-')}
            </div>
            <div style="font-size:0.9rem;">
                <div style="color:#888; font-size:0.8rem; text-transform:uppercase;">Leverage</div>
                ${escapeHtml(npc.leverage || '-')}
            </div>

            <div style="grid-column: 1 / -1; margin-top:5px; font-size:0.9rem; color:#aaa; font-style:italic; border-top:1px solid rgba(255,255,255,0.05); padding-top:5px;">
                ${escapeHtml(npc.notes || '')}
            </div>

            ${editButton}
            <button class="btn" onclick="deleteNPC(${npc.origIdx})" style="position:absolute; right:10px; top:10px; padding:4px 8px; color:var(--danger); border:none; background:transparent; font-size:1.2rem; cursor:pointer;" title="Delete NPC">&times;</button>
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
