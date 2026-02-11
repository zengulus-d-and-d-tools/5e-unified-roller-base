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

function getCampaign() {
    if (!window.RTF_STORE) return null;
    return window.RTF_STORE.state.campaign;
}

function save() {
    if (window.RTF_STORE) window.RTF_STORE.save({ scope: 'campaign.locations' });
    render();
}

function ensureDistrictOptions() {
    const formSelect = document.getElementById('locDistrict');
    if (formSelect && formSelect.options.length <= 1) {
        guilds.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.innerText = g;
            formSelect.appendChild(opt);
        });
    }

    const filterSelect = document.getElementById('districtFilter');
    if (filterSelect && filterSelect.options.length <= 1) {
        guilds.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.innerText = g;
            filterSelect.appendChild(opt);
        });
    }
}

function toggleLocationForm() {
    const f = document.getElementById('locationForm');
    if (!f) return;
    f.classList.toggle('locations-hidden');
    ensureDistrictOptions();
}

function addLocation() {
    const name = document.getElementById('locName').value;
    const district = document.getElementById('locDistrict').value;
    const desc = document.getElementById('locDesc').value;
    const notes = document.getElementById('locNotes').value;

    if (!name) { alert("Name Required"); return; }

    const c = getCampaign();
    if (!c) return;
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
        if (!c || !Array.isArray(c.locations)) return;
        c.locations.splice(idx, 1);
        save();
    }
}

function render() {
    const c = getCampaign();
    if (!c) return;

    const search = document.getElementById('searchFilter').value.toLowerCase();
    const districtFilter = document.getElementById('districtFilter').value;

    ensureDistrictOptions();

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
        <div class="locations-row">
            <div class="locations-name">${escapeHtml(loc.name)}</div>
            <div class="locations-district">${escapeHtml(loc.district || 'Unassigned')}</div>
            
            <div class="locations-desc-block">
                <div class="locations-desc-label">Description</div>
                ${escapeHtml(loc.desc || '-')}
            </div>
            
            <div class="locations-notes">
                ${escapeHtml(loc.notes || '')}
            </div>

            <button class="btn locations-delete-btn" data-onclick="deleteLocation(${loc.origIdx})" title="Delete Location">&times;</button>
        </div>
    `).join('');
}

window.addEventListener('load', () => {
    if (window.RTF_STORE) {
        render();
    } else {
        setTimeout(render, 100);
    }
});
