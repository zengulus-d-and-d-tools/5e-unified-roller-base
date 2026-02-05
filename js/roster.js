// Use global data if available
const guilds = (window.RTF_DATA && window.RTF_DATA.guilds) ? window.RTF_DATA.guilds :
    ["Azorius", "Boros", "Dimir", "Golgari", "Gruul", "Izzet", "Orzhov", "Rakdos", "Selesnya", "Simic"];

function getCampaign() {
    if (!window.RTF_STORE) return null;
    return window.RTF_STORE.state.campaign;
}

function save() {
    if (window.RTF_STORE) window.RTF_STORE.save();
    render();
}

function toggleNPCForm() {
    const f = document.getElementById('npcForm');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';

    // Populate Guild Dropdown if empty
    const sel = document.getElementById('npcGuild');
    if (sel.options.length <= 1) {
        guilds.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.innerText = g;
            sel.appendChild(opt);
        });
    }
}

function addNPC() {
    const name = document.getElementById('npcName').value;
    const guild = document.getElementById('npcGuild').value;
    const wants = document.getElementById('npcWants').value;
    const leverage = document.getElementById('npcLeverage').value;
    const notes = document.getElementById('npcNotes').value;

    if (!name) { alert("Name Required"); return; }

    const c = getCampaign();
    if (!c.npcs) c.npcs = [];
    c.npcs.push({ name, guild, wants, leverage, notes });
    save();

    // Reset Form
    document.getElementById('npcName').value = '';
    document.getElementById('npcWants').value = '';
    document.getElementById('npcLeverage').value = '';
    document.getElementById('npcNotes').value = '';
    toggleNPCForm();
}

function deleteNPC(idx) {
    if (confirm("Delete this NPC?")) {
        const c = getCampaign();
        // Since we might be filtering, we need to find the actual index in the main array
        // But simply, we can just re-render after deleting from the *filtered* view if we are careful,
        // OR better: pass the ID? We don't have IDs. We have indices.
        // Issue: partial render indices != data indices.
        // Fix: Render the loop with original indices.
        c.npcs.splice(idx, 1);
        save();
    }
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

    // We map FIRST to preserve original index, THEN filter
    const list = (c.npcs || []).map((npc, idx) => ({ ...npc, origIdx: idx }));

    const filtered = list.filter(npc => {
        const matchesName = npc.name.toLowerCase().includes(search);
        const matchesGuild = !guildFilter || npc.guild === guildFilter;
        return matchesName && matchesGuild;
    });

    container.innerHTML = filtered.map(npc => `
        <div style="display:grid; grid-template-columns: 1fr 1fr 2fr 2fr auto; gap:10px; align-items:start; padding:15px; border-bottom:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.1); margin-bottom:5px; border-radius:4px;">
            <div style="font-weight:bold; font-size:1.1rem;">${npc.name}</div>
            <div style="color:var(--accent); font-weight:bold;">${npc.guild}</div>
            
            <div style="font-size:0.9rem;">
                <div style="color:#888; font-size:0.8rem; text-transform:uppercase;">Wants</div>
                ${npc.wants || '-'}
            </div>
            <div style="font-size:0.9rem;">
                <div style="color:#888; font-size:0.8rem; text-transform:uppercase;">Leverage</div>
                ${npc.leverage || '-'}
            </div>
            
            <div style="grid-column: 1 / -1; margin-top:5px; font-size:0.9rem; color:#aaa; font-style:italic;">
                ${npc.notes || ''}
            </div>

            <button class="btn" onclick="deleteNPC(${npc.origIdx})" style="position:absolute; right:15px; margin-top:0px; padding:4px 8px; color:var(--danger); border:none; background:transparent; font-size:1.2rem;">&times;</button>
        </div>
    `).join('');
}

window.onload = () => {
    if (window.RTF_STORE) {
        render();
    } else {
        setTimeout(render, 100);
    }
};
