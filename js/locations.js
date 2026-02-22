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
let pendingLinkLocationId = '';
const TRUST_LABELS = ['Hostile', 'Wary', 'Neutral', 'Trusted', 'Loyal'];
const STIGMA_LABELS = ['Clean', 'Rumored', 'Noticed', 'Marked', 'Burned'];

function clampTrackLevel(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.min(4, parsed));
}

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
    const imageRaw = document.getElementById('locImageUrl').value.trim();
    const imageUrl = sanitizeImageUrl(imageRaw);
    const notes = document.getElementById('locNotes').value;
    const connections = document.getElementById('locConnections').value;
    const properties = document.getElementById('locProperties').value;
    const trust = clampTrackLevel(document.getElementById('locTrust').value, 2);
    const stigma = clampTrackLevel(document.getElementById('locStigma').value, 0);

    if (!name) { alert("Name Required"); return; }
    if (imageRaw && !imageUrl) { alert("Please provide a valid image URL."); return; }

    const c = getCampaign();
    if (!c) return;
    if (!c.locations) c.locations = [];
    c.locations.push({
        id: createLocationId(),
        name,
        district,
        desc,
        imageUrl,
        notes,
        connections,
        properties,
        trust,
        stigma
    });
    save();

    // Reset Form
    document.getElementById('locName').value = '';
    document.getElementById('locDistrict').value = '';
    document.getElementById('locDesc').value = '';
    document.getElementById('locImageUrl').value = '';
    document.getElementById('locNotes').value = '';
    document.getElementById('locConnections').value = '';
    document.getElementById('locProperties').value = '';
    document.getElementById('locTrust').value = '2';
    document.getElementById('locStigma').value = '0';
    toggleLocationForm();
}

function updateLocationImage(locationId, value) {
    const c = getCampaign();
    if (!c || !Array.isArray(c.locations)) return;
    const id = String(locationId || '');
    const idx = c.locations.findIndex((entry) => String(entry && entry.id || '') === id);
    if (idx < 0) return;

    const raw = String(value || '').trim();
    const imageUrl = sanitizeImageUrl(raw);
    if (raw && !imageUrl) {
        alert("Please provide a valid image URL.");
        render();
        return;
    }

    c.locations[idx] = {
        ...c.locations[idx],
        imageUrl
    };
    save();
}

function updateLocationField(locationId, field, value) {
    const c = getCampaign();
    if (!c || !Array.isArray(c.locations)) return;
    const id = String(locationId || '');
    const idx = c.locations.findIndex((entry) => String(entry && entry.id || '') === id);
    if (idx < 0) return;

    const allowed = new Set(['name', 'district', 'desc', 'notes', 'connections', 'properties']);
    if (!allowed.has(field)) return;
    c.locations[idx] = {
        ...c.locations[idx],
        [field]: String(value || '').trim()
    };
    save();
}

function updateLocationTrack(locationId, field, delta) {
    const c = getCampaign();
    if (!c || !Array.isArray(c.locations)) return;
    const id = String(locationId || '');
    const idx = c.locations.findIndex((entry) => String(entry && entry.id || '') === id);
    if (idx < 0) return;

    if (field !== 'trust' && field !== 'stigma') return;
    const current = clampTrackLevel(c.locations[idx][field], field === 'trust' ? 2 : 0);
    const next = clampTrackLevel(current + Number(delta || 0), current);
    c.locations[idx] = {
        ...c.locations[idx],
        [field]: next
    };
    save();
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
        const imageUrl = sanitizeImageUrl(loc.imageUrl || '');
        const trust = clampTrackLevel(loc.trust, 2);
        const stigma = clampTrackLevel(loc.stigma, 0);
        const imageMarkup = imageUrl
            ? `<div class="locations-image"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(loc.name || 'Location')} image"></div>`
            : '';
        const rowClass = imageMarkup ? 'has-image' : 'no-image';
        return `
        <div class="locations-row ${rowClass}" data-location-id="${escapeHtml(locationId)}">
            ${imageMarkup}
            <div class="locations-content">
                <div class="locations-summary">
                    <div class="locations-desc-block">
                        <div class="locations-desc-label">Name</div>
                        <input type="text" value="${escapeHtml(loc.name || '')}" placeholder="Location name"
                            data-onchange="updateLocationField('${locationIdArg}', 'name', this.value)">
                    </div>
                    <div class="locations-desc-block">
                        <div class="locations-desc-label">District / Guild</div>
                        <select data-onchange="updateLocationField('${locationIdArg}', 'district', this.value)">
                            <option value="">Unassigned</option>
                            ${guilds.map((g) => `<option value="${escapeHtml(g)}" ${g === String(loc.district || '') ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
                        </select>
                    </div>

                    <div class="locations-desc-block">
                        <div class="locations-desc-label">Description</div>
                        <textarea rows="3" data-onchange="updateLocationField('${locationIdArg}', 'desc', this.value)">${escapeHtml(loc.desc || '')}</textarea>
                    </div>
                    <div class="locations-desc-block">
                        <div class="locations-desc-label">Image URL</div>
                        <input type="url" value="${escapeHtml(loc.imageUrl || '')}" placeholder="https://..."
                            data-onchange="updateLocationImage('${locationIdArg}', this.value)">
                    </div>
                    <div class="locations-desc-block">
                        <div class="locations-desc-label">Connections</div>
                        <textarea rows="3" data-onchange="updateLocationField('${locationIdArg}', 'connections', this.value)">${escapeHtml(loc.connections || '')}</textarea>
                    </div>
                    <div class="locations-desc-block">
                        <div class="locations-desc-label">Properties</div>
                        <textarea rows="3" data-onchange="updateLocationField('${locationIdArg}', 'properties', this.value)">${escapeHtml(loc.properties || '')}</textarea>
                    </div>
                </div>

                <div class="locations-notes">
                    <div class="locations-desc-label">Notes</div>
                    <textarea rows="2" data-onchange="updateLocationField('${locationIdArg}', 'notes', this.value)">${escapeHtml(loc.notes || '')}</textarea>
                </div>

                <div class="locations-track-row">
                    <div class="locations-track">
                        <span class="locations-track-label">Trust</span>
                        <button class="btn locations-track-btn" data-onclick="updateLocationTrack('${locationIdArg}', 'trust', -1)">-</button>
                        <span class="locations-track-value">${escapeHtml(TRUST_LABELS[trust])}</span>
                        <button class="btn locations-track-btn" data-onclick="updateLocationTrack('${locationIdArg}', 'trust', 1)">+</button>
                    </div>
                    <div class="locations-track">
                        <span class="locations-track-label">Stigma</span>
                        <button class="btn locations-track-btn" data-onclick="updateLocationTrack('${locationIdArg}', 'stigma', -1)">-</button>
                        <span class="locations-track-value">${escapeHtml(STIGMA_LABELS[stigma])}</span>
                        <button class="btn locations-track-btn" data-onclick="updateLocationTrack('${locationIdArg}', 'stigma', 1)">+</button>
                    </div>
                </div>
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
window.updateLocationImage = updateLocationImage;
window.updateLocationField = updateLocationField;
window.updateLocationTrack = updateLocationTrack;
