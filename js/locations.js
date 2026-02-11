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
const delegatedHandlerEvents = ['click', 'change', 'input'];
const delegatedHandlerCache = new Map();
let delegatedHandlersBound = false;
let pendingLinkLocationId = '';

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

function createLocationId() {
    return 'loc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function getLocationIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get('locationId') || '').trim();
}

function buildLocationDeepLink(locationId) {
    const url = new URL(window.location.href);
    url.searchParams.set('locationId', String(locationId || ''));
    return url.toString();
}

function copyLocationLink(locationId) {
    const id = String(locationId || '').trim();
    if (!id) return;
    const url = buildLocationDeepLink(id);

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(url).catch(() => {
            prompt('Copy location link:', url);
        });
        return;
    }
    prompt('Copy location link:', url);
}

function buildBoardLinkForLocation(locationId) {
    const url = new URL('board.html', window.location.href);
    url.searchParams.set('linkType', 'location');
    url.searchParams.set('id', String(locationId || '').trim());
    return url.toString();
}

function openLocationInBoard(locationId) {
    const id = String(locationId || '').trim();
    if (!id) return;
    window.location.assign(buildBoardLinkForLocation(id));
}

function applyPendingLocationDeepLinkFocus() {
    if (!pendingLinkLocationId) return;
    const rows = Array.from(document.querySelectorAll('.locations-row[data-location-id]'));
    const target = rows.find((row) => row.dataset.locationId === pendingLinkLocationId);
    if (!target) return;

    pendingLinkLocationId = '';
    requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('locations-linked-focus');
        setTimeout(() => {
            target.classList.remove('locations-linked-focus');
        }, 2200);
    });
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
    c.locations.push({ id: createLocationId(), name, district, desc, notes });
    save();

    // Reset Form
    document.getElementById('locName').value = '';
    document.getElementById('locDistrict').value = '';
    document.getElementById('locDesc').value = '';
    document.getElementById('locNotes').value = '';
    toggleLocationForm();
}

function deleteLocation(locationId) {
    if (confirm("Delete this Location?")) {
        const c = getCampaign();
        if (!c || !Array.isArray(c.locations)) return;
        const id = String(locationId || '');
        const idx = c.locations.findIndex((entry) => String(entry && entry.id || '') === id);
        if (idx < 0) return;
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

    const list = (c.locations || []).filter((loc) => loc && typeof loc === 'object');
    let mutatedIds = false;
    list.forEach((loc) => {
        if (!loc.id) {
            loc.id = createLocationId();
            mutatedIds = true;
        }
    });
    if (mutatedIds && window.RTF_STORE) {
        setTimeout(() => {
            window.RTF_STORE.save({ scope: 'campaign.locations' });
        }, 0);
    }

    const filtered = list.filter(loc => {
        const name = String(loc.name || '');
        const district = String(loc.district || '');
        const matchesName = name.toLowerCase().includes(search);
        const matchesDistrict = !districtFilter || district === districtFilter;
        return matchesName && matchesDistrict;
    });

    container.innerHTML = filtered.map(loc => {
        const locationId = String(loc.id || '');
        const locationIdArg = escapeJsString(locationId);
        return `
        <div class="locations-row" data-location-id="${escapeHtml(locationId)}">
            <div class="locations-name">${escapeHtml(loc.name)}</div>
            <div class="locations-district">${escapeHtml(loc.district || 'Unassigned')}</div>
            
            <div class="locations-desc-block">
                <div class="locations-desc-label">Description</div>
                ${escapeHtml(loc.desc || '-')}
            </div>
            
            <div class="locations-notes">
                ${escapeHtml(loc.notes || '')}
            </div>

            <button class="btn locations-board-btn" data-onclick="openLocationInBoard('${locationIdArg}')" title="Open on board">🧩</button>
            <button class="btn locations-link-btn" data-onclick="copyLocationLink('${locationIdArg}')" title="Copy deep link">🔗</button>
            <button class="btn locations-delete-btn" data-onclick="deleteLocation('${locationIdArg}')" title="Delete Location">&times;</button>
        </div>
    `;
    }).join('');

    applyPendingLocationDeepLinkFocus();
}

window.addEventListener('load', () => {
    pendingLinkLocationId = getLocationIdFromUrl();
    if (window.RTF_STORE) {
        render();
    } else {
        setTimeout(render, 100);
    }
});

window.addEventListener('rtf-store-updated', () => {
    render();
});

window.copyLocationLink = copyLocationLink;
window.openLocationInBoard = openLocationInBoard;
