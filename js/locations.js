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

function getCampaign() {
    if (!window.RTF_STORE) return null;
    return window.RTF_STORE.state.campaign;
}

function save() {
    if (window.RTF_STORE) window.RTF_STORE.save();
    render();
}

function toggleLocationForm() {
    const f = document.getElementById('locationForm');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';

    // Populate District Dropdown if empty
    const sel = document.getElementById('locDistrict');
    if (sel.options.length <= 1) {
        guilds.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.innerText = g;
            sel.appendChild(opt);
        });
    }
}

function addLocation() {
    const name = document.getElementById('locName').value;
    const district = document.getElementById('locDistrict').value;
    const desc = document.getElementById('locDesc').value;
    const notes = document.getElementById('locNotes').value;

    if (!name) { alert("Name Required"); return; }

    const c = getCampaign();
    if (!c.locations) c.locations = [];
    c.locations.push({ name, district, desc, notes });
    save();

    // Reset Form
    document.getElementById('locName').value = '';
    document.getElementById('locDistrict').value = '';
    document.getElementById('locDesc').value = '';
    document.getElementById('locNotes').value = '';
    toggleLocationForm();
}

function deleteLocation(idx) {
    if (confirm("Delete this Location?")) {
        const c = getCampaign();
        c.locations.splice(idx, 1);
        save();
    }
}

function render() {
    const c = getCampaign();
    if (!c) return;

    const search = document.getElementById('searchFilter').value.toLowerCase();
    const districtFilter = document.getElementById('districtFilter').value;

    // Populate Filter if empty
    const dFilter = document.getElementById('districtFilter');
    if (dFilter.options.length <= 1) {
        guilds.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.innerText = g;
            dFilter.appendChild(opt);
        });
    }

    const container = document.getElementById('locationList');
    if (!container) return;

    // We map FIRST to preserve original index, THEN filter
    // Note: If we just splice by filtered index we might delete the wrong item.
    // The safest way is to store the original index.
    const list = (c.locations || []).map((loc, idx) => ({ ...loc, origIdx: idx }));

    const filtered = list.filter(loc => {
        const name = String(loc.name || '');
        const district = String(loc.district || '');
        const matchesName = name.toLowerCase().includes(search);
        const matchesDistrict = !districtFilter || district === districtFilter;
        return matchesName && matchesDistrict;
    });

    container.innerHTML = filtered.map(loc => `
        <div style="position:relative; display:grid; grid-template-columns: 1.5fr 1fr 2fr; gap:10px; align-items:start; padding:15px; padding-right:40px; border-bottom:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.1); margin-bottom:5px; border-radius:4px;">
            <div style="font-weight:bold; font-size:1.1rem;">${escapeHtml(loc.name)}</div>
            <div style="color:var(--accent); font-weight:bold;">${escapeHtml(loc.district || 'Unassigned')}</div>
            
            <div style="font-size:0.9rem;">
                <div style="color:#888; font-size:0.8rem; text-transform:uppercase;">Description</div>
                ${escapeHtml(loc.desc || '-')}
            </div>
            
            <div style="grid-column: 1 / -1; margin-top:5px; font-size:0.9rem; color:#aaa; font-style:italic; border-top:1px solid rgba(255,255,255,0.05); padding-top:5px;">
                ${escapeHtml(loc.notes || '')}
            </div>

            <button class="btn" onclick="deleteLocation(${loc.origIdx})" style="position:absolute; right:10px; top:10px; padding:4px 8px; color:var(--danger); border:none; background:transparent; font-size:1.2rem; cursor:pointer;" title="Delete Location">&times;</button>
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
