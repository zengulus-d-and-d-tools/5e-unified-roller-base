let latestSyncStatus = null;
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

// Secret Toggle Logic
function trySecretToggle(e) {
    // Alt + Shift + Click
    if (e.altKey && e.shiftKey) {
        document.body.classList.toggle('secret-active');
        const isSecret = document.body.classList.contains('secret-active');

        document.getElementById('pageTitle').innerText = isSecret ? "Forbidden DM Protocols" : "Tools Hub";

        updateSyncPanelVisibility(latestSyncStatus);
    }
}

// Store Interaction
function handleExport() {
    if (window.RTF_STORE) {
        window.RTF_STORE.export();
    } else {
        alert("Store not loaded.");
    }
}

function handleImport() {
    if (window.RTF_STORE) {
        window.RTF_STORE.import().then(success => {
            if (success) alert("Data imported successfully!");
            renderCaseSwitcher();
        });
    } else {
        alert("Store not loaded.");
    }
}

function setCaseSwitcherStatus(message, isError = false) {
    const el = document.getElementById('case-switcher-status');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('is-error', !!isError);
}

function renderCaseSwitcher() {
    const selectEl = document.getElementById('active-case-select');
    const metaEl = document.getElementById('case-switcher-meta');
    const deleteBtn = document.getElementById('case-delete-btn');
    const renameBtn = document.getElementById('case-rename-btn');
    const createBtn = document.getElementById('case-create-btn');
    if (!selectEl || !metaEl) return;

    if (!window.RTF_STORE || typeof window.RTF_STORE.getCases !== 'function') {
        selectEl.innerHTML = '';
        metaEl.textContent = 'Store unavailable';
        if (deleteBtn) deleteBtn.disabled = true;
        if (renameBtn) renameBtn.disabled = true;
        if (createBtn) createBtn.disabled = true;
        setCaseSwitcherStatus('Store not loaded yet.', true);
        return;
    }

    const cases = window.RTF_STORE.getCases();
    const activeId = window.RTF_STORE.getActiveCaseId();
    const activeCase = typeof window.RTF_STORE.getActiveCase === 'function'
        ? window.RTF_STORE.getActiveCase()
        : null;

    const previous = selectEl.value;
    selectEl.innerHTML = '';
    cases.forEach((entry) => {
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = entry.name || entry.id;
        selectEl.appendChild(option);
    });

    if (cases.some((entry) => entry.id === activeId)) {
        selectEl.value = activeId;
    } else if (cases.some((entry) => entry.id === previous)) {
        selectEl.value = previous;
    }

    const count = cases.length;
    const activeLabel = activeCase && activeCase.name ? activeCase.name : (selectEl.options[selectEl.selectedIndex] && selectEl.options[selectEl.selectedIndex].textContent) || '—';
    metaEl.textContent = `${count} case${count === 1 ? '' : 's'} | Active: ${activeLabel}`;
    if (deleteBtn) deleteBtn.disabled = count <= 1;
    if (renameBtn) renameBtn.disabled = !count;
    if (createBtn) createBtn.disabled = false;
    setCaseSwitcherStatus(`Case context set to "${activeLabel}".`);
}

function selectActiveCase(caseId) {
    if (!window.RTF_STORE || typeof window.RTF_STORE.setActiveCase !== 'function') {
        setCaseSwitcherStatus('Case switching unavailable in this store version.', true);
        return;
    }
    if (!window.RTF_STORE.setActiveCase(caseId)) {
        setCaseSwitcherStatus('Could not switch to that case.', true);
        renderCaseSwitcher();
        return;
    }
    renderCaseSwitcher();
}

function createCaseFromInput() {
    const input = document.getElementById('new-case-name');
    if (!input) return;
    if (!window.RTF_STORE || typeof window.RTF_STORE.createCase !== 'function') {
        setCaseSwitcherStatus('Case creation unavailable in this store version.', true);
        return;
    }
    const name = (input.value || '').trim();
    if (!name) {
        setCaseSwitcherStatus('Enter a case name first.', true);
        input.focus();
        return;
    }
    const id = window.RTF_STORE.createCase(name);
    input.value = '';
    renderCaseSwitcher();
    if (id) setCaseSwitcherStatus(`Created and switched to "${name}".`);
}

function renameActiveCase() {
    if (!window.RTF_STORE || typeof window.RTF_STORE.renameCase !== 'function') {
        setCaseSwitcherStatus('Case rename unavailable in this store version.', true);
        return;
    }
    const active = window.RTF_STORE.getActiveCase && window.RTF_STORE.getActiveCase();
    if (!active || !active.id) {
        setCaseSwitcherStatus('No active case to rename.', true);
        return;
    }
    const next = prompt('Rename active case:', active.name || '');
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) {
        setCaseSwitcherStatus('Case name cannot be empty.', true);
        return;
    }
    if (!window.RTF_STORE.renameCase(active.id, trimmed)) {
        setCaseSwitcherStatus('Case rename failed.', true);
        return;
    }
    renderCaseSwitcher();
    setCaseSwitcherStatus(`Renamed case to "${trimmed}".`);
}

function deleteActiveCase() {
    if (!window.RTF_STORE || typeof window.RTF_STORE.deleteCase !== 'function') {
        setCaseSwitcherStatus('Case delete unavailable in this store version.', true);
        return;
    }
    const active = window.RTF_STORE.getActiveCase && window.RTF_STORE.getActiveCase();
    const allCases = window.RTF_STORE.getCases && window.RTF_STORE.getCases();
    if (!active || !active.id) {
        setCaseSwitcherStatus('No active case to delete.', true);
        return;
    }
    if (!Array.isArray(allCases) || allCases.length <= 1) {
        setCaseSwitcherStatus('At least one case must remain.', true);
        return;
    }
    const ok = confirm(`Delete case "${active.name}"?\n\nThis removes that case's board and timeline events only.`);
    if (!ok) return;
    if (!window.RTF_STORE.deleteCase(active.id)) {
        setCaseSwitcherStatus('Case delete failed.', true);
        return;
    }
    renderCaseSwitcher();
}

function getSyncFormValues() {
    return {
        supabaseUrl: (document.getElementById('sync-url').value || '').trim(),
        anonKey: (document.getElementById('sync-key').value || '').trim(),
        campaignId: (document.getElementById('sync-campaign').value || '').trim(),
        profileName: (document.getElementById('sync-profile').value || '').trim()
    };
}

function normalizeConnectPayload(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const supabaseUrl = (raw.supabaseUrl || raw.projectUrl || raw.url || '').trim();
    const anonKey = (raw.anonKey || raw.key || raw.publicKey || '').trim();
    const campaignId = (raw.campaignId || raw.slug || raw.campaign || '').trim();
    const profileName = (raw.profileName || raw.profile || '').trim();
    if (!supabaseUrl || !anonKey || !campaignId) return null;
    return {
        supabaseUrl,
        anonKey,
        campaignId,
        profileName,
        enabled: true,
        autoConnect: true
    };
}

async function applyConnectProfile(raw, opts = {}) {
    if (!window.RTF_STORE) return { ok: false, error: 'Store not loaded.' };
    const options = opts && typeof opts === 'object' ? opts : {};
    const payload = normalizeConnectPayload(raw);
    if (!payload) return { ok: false, error: 'Invalid connect.json format.' };

    window.RTF_STORE.setSyncConfig(payload, { reconnect: false });
    applySyncConfigToForm(window.RTF_STORE.getSyncConfig());

    if (options.connect === false) return { ok: true, connected: false };

    const result = await window.RTF_STORE.connectSync();
    if (!result.ok) {
        const status = window.RTF_STORE.getSyncStatus();
        return { ok: false, error: status.lastError || 'Connect failed.' };
    }
    return { ok: true, connected: true };
}

function importConnectFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        try {
            setQuickStatus('importing connect.json...');
            const text = await file.text();
            const parsed = JSON.parse(text);
            const result = await applyConnectProfile(parsed);
            if (!result.ok) {
                setQuickStatus(result.error || 'failed to import connect.json.');
                alert(result.error || 'Failed to import connect.json.');
                return;
            }
            setQuickStatus('connected.');
            alert('connect.json imported and sync connected.');
        } catch (err) {
            setQuickStatus('invalid connect.json file.');
            alert('Invalid connect.json file.');
        }
    };
    input.click();
}

async function readBundledConnect() {
    try {
        const response = await fetch('connect.json', { cache: 'no-store' });
        if (!response.ok) return null;
        const json = await response.json();
        return normalizeConnectPayload(json);
    } catch (err) {
        return null;
    }
}

async function useBundledConnect() {
    setQuickStatus('checking bundled connect.json...');
    const payload = await readBundledConnect();
    if (!payload) {
        setQuickStatus('no valid bundled connect.json found.');
        alert('No valid bundled connect.json found at site root.');
        return;
    }
    setQuickStatus('connecting with bundled config...');
    const result = await applyConnectProfile(payload);
    if (!result.ok) {
        setQuickStatus(result.error || 'failed using bundled connect.json.');
        alert(result.error || 'Failed using bundled connect.json.');
        return;
    }
    setQuickStatus('connected.');
    alert('Bundled connect.json applied and connected.');
}

async function tryAutoConnectFromBundledDefault() {
    if (!window.RTF_STORE) return;
    const current = window.RTF_STORE.getSyncConfig();
    const hasStoredConfig = !!(current && current.supabaseUrl && current.anonKey && current.campaignId);
    if (hasStoredConfig) return;

    const payload = await readBundledConnect();
    if (!payload) return;
    await applyConnectProfile(payload);
}

function applySyncConfigToForm(config) {
    if (!config) return;
    document.getElementById('sync-url').value = config.supabaseUrl || '';
    document.getElementById('sync-key').value = config.anonKey || '';
    document.getElementById('sync-campaign').value = config.campaignId || '';
    document.getElementById('sync-profile').value = config.profileName || '';
}

function fmtSyncTime(ts) {
    if (!ts) return '—';
    try {
        return new Date(ts).toLocaleString();
    } catch (err) {
        return '—';
    }
}

function setSyncStatusText(status) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    if (!status) {
        el.textContent = 'Cloud sync status unavailable.';
        renderSyncConflictPanel(null);
        return;
    }
    const parts = [
        `Mode: ${status.mode || 'unknown'}`,
        `Connected: ${status.connected ? 'yes' : 'no'}`,
        `Campaign: ${status.campaignId || '—'}`,
        `User: ${status.userId ? status.userId.slice(0, 8) + '…' : '—'}`,
        `Local Rev: ${Number.isFinite(status.localRevision) ? status.localRevision : 0}`,
        `Remote Rev: ${Number.isFinite(status.remoteRevision) ? status.remoteRevision : 0}`,
        `Last Pull: ${fmtSyncTime(status.lastPullAt)}`,
        `Last Push: ${fmtSyncTime(status.lastPushAt)}`,
        `Peers: ${Number.isFinite(status.presencePeers) ? status.presencePeers : 0}`,
        `Remote Locks: ${Number.isFinite(status.activeRemoteLocks) ? status.activeRemoteLocks : 0}`,
        `Dirty Scopes: ${Number.isFinite(status.dirtyScopes) ? status.dirtyScopes : 0}`,
        status.pendingPush ? 'Pending Local Push: yes' : 'Pending Local Push: no',
        status.message ? `Note: ${status.message}` : ''
    ].filter(Boolean);
    el.textContent = parts.join(' | ');
    renderSyncConflictPanel(status);
}

function formatScopeList(scopes) {
    if (!Array.isArray(scopes) || !scopes.length) return '—';
    return scopes.join(', ');
}

function renderSyncConflictPanel(status) {
    const panel = document.getElementById('sync-conflict-box');
    const detail = document.getElementById('sync-conflict-detail');
    if (!panel || !detail) return;

    const conflict = (window.RTF_STORE && typeof window.RTF_STORE.getPendingConflict === 'function')
        ? window.RTF_STORE.getPendingConflict()
        : null;
    const hasConflict = !!(conflict || (status && status.pendingConflict));
    panel.classList.toggle('tools-hidden', !hasConflict);
    if (!hasConflict) {
        detail.textContent = 'Remote changes overlap local edits.';
        return;
    }

    const dirtyScopes = conflict ? formatScopeList(conflict.dirtyScopes) : formatScopeList(status && status.conflictScopes);
    const remoteScopes = conflict ? formatScopeList(conflict.remoteChangedScopes) : '—';
    const overlap = conflict ? formatScopeList(conflict.overlappingScopes) : formatScopeList(status && status.conflictScopes);
    detail.textContent = `Local scopes: ${dirtyScopes} | Remote scopes: ${remoteScopes} | Overlap: ${overlap}`;
}

function setQuickStatus(message) {
    const el = document.getElementById('sync-quick-status');
    if (!el) return;
    el.textContent = `Status: ${message}`;
}

function setQuickStatusFromSync(status) {
    if (!status) {
        setQuickStatus('sync status unavailable.');
        return;
    }
    if (status.mode === 'conflict' || status.pendingConflict) {
        setQuickStatus('conflict detected: resolve in Cloud Sync panel.');
        return;
    }
    if (status.mode === 'locked') {
        setQuickStatus('soft lock detected on a remote peer.');
        return;
    }
    if (status.connected) {
        const campaign = status.campaignId || 'unknown';
        const user = status.userId ? status.userId.slice(0, 8) + '…' : 'user';
        setQuickStatus(`connected to "${campaign}" as ${user}.`);
        return;
    }
    if (status.mode === 'connecting') {
        setQuickStatus('connecting...');
        return;
    }
    if (status.lastError) {
        setQuickStatus(`error: ${status.lastError}`);
        return;
    }
    setQuickStatus(status.message || 'not connected.');
}

function setCustomizeStatus(message, isError = false) {
    const el = document.getElementById('customize-status');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('is-error', !!isError);
}

function normalizeFilenameLabel(raw) {
    return String(raw || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
}

function parseSeedArray(rawText, label) {
    const text = String(rawText || '').trim();
    if (!text) return [];
    let parsed = null;
    try {
        parsed = JSON.parse(text);
    } catch (err) {
        throw new Error(`${label} JSON is invalid.`);
    }
    if (!Array.isArray(parsed)) {
        throw new Error(`${label} JSON must be an array.`);
    }
    return parsed;
}

function coerceGuildSeedEntry(entry) {
    if (typeof entry === 'string') return entry.trim();
    if (entry && typeof entry === 'object') return String(entry.name || '').trim();
    return '';
}

function normalizeGuildSeedEntry(entry, idx) {
    const name = coerceGuildSeedEntry(entry);
    if (!name) throw new Error(`Guild row ${idx + 1} is missing "name".`);
    return name;
}

function dedupeStringsPreserveOrder(values) {
    const seen = new Set();
    const out = [];
    values.forEach((value) => {
        const name = String(value || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(name);
    });
    return out;
}

function coerceNpcSeedRow(row) {
    const source = row && typeof row === 'object' ? row : {};
    return {
        name: String(source.name || '').trim(),
        guild: String(source.guild || '').trim(),
        wants: String(source.wants || '').trim(),
        leverage: String(source.leverage || '').trim(),
        notes: String(source.notes || '').trim()
    };
}

function normalizeNpcSeedRow(row, idx) {
    const item = coerceNpcSeedRow(row);
    if (!item.name) throw new Error(`NPC row ${idx + 1} is missing "name".`);
    return item;
}

function coerceLocationSeedRow(row) {
    const source = row && typeof row === 'object' ? row : {};
    return {
        name: String(source.name || '').trim(),
        district: String(source.district || '').trim(),
        desc: String(source.desc || '').trim(),
        notes: String(source.notes || '').trim()
    };
}

function normalizeLocationSeedRow(row, idx) {
    const item = coerceLocationSeedRow(row);
    if (!item.name) throw new Error(`Location row ${idx + 1} is missing "name".`);
    return item;
}

function buildPreloadFile(varName, items) {
    const json = JSON.stringify(items, null, 4);
    const indentedJson = json
        .split('\n')
        .map((line, idx) => (idx === 0 ? line : `    ${line}`))
        .join('\n');

    return `(function (global) {\n    global.${varName} = ${indentedJson};\n})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));\n`;
}

function downloadTextFile(filename, text, type = 'text/javascript') {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function getCustomizeSeedArrays() {
    const guildsRaw = parseSeedArray(document.getElementById('customize-guilds-json').value, 'Guild seed');
    const npcsRaw = parseSeedArray(document.getElementById('customize-npcs-json').value, 'NPC seed');
    const locationsRaw = parseSeedArray(document.getElementById('customize-locations-json').value, 'Location seed');
    return {
        guilds: dedupeStringsPreserveOrder(guildsRaw.map(normalizeGuildSeedEntry)),
        npcs: npcsRaw.map(normalizeNpcSeedRow),
        locations: locationsRaw.map(normalizeLocationSeedRow)
    };
}

function writeCustomizeForm(guilds, npcs, locations) {
    document.getElementById('customize-guilds-json').value = JSON.stringify(guilds, null, 2);
    document.getElementById('customize-npcs-json').value = JSON.stringify(npcs, null, 2);
    document.getElementById('customize-locations-json').value = JSON.stringify(locations, null, 2);
}

function loadCustomizeDefaults() {
    try {
        const guilds = (typeof window.getRTFGuilds === 'function')
            ? window.getRTFGuilds({ includeGuildless: true }).map(coerceGuildSeedEntry).filter(Boolean)
            : (Array.isArray(window.PRELOADED_GUILDS) ? window.PRELOADED_GUILDS.map(coerceGuildSeedEntry).filter(Boolean) : []);
        const npcs = Array.isArray(window.PRELOADED_NPCS) ? window.PRELOADED_NPCS.map(coerceNpcSeedRow) : [];
        const locations = Array.isArray(window.PRELOADED_LOCATIONS) ? window.PRELOADED_LOCATIONS.map(coerceLocationSeedRow) : [];
        writeCustomizeForm(guilds, npcs, locations);
        setCustomizeStatus(`Loaded defaults (${guilds.length} Guilds, ${npcs.length} NPCs, ${locations.length} Locations).`);
    } catch (err) {
        setCustomizeStatus(err && err.message ? err.message : 'Failed to load defaults.', true);
    }
}

function loadCustomizeFromCampaign() {
    if (!window.RTF_STORE || !window.RTF_STORE.state || !window.RTF_STORE.state.campaign) {
        setCustomizeStatus('Campaign store is not ready yet.', true);
        return;
    }
    try {
        const c = window.RTF_STORE.state.campaign;
        const npcs = (Array.isArray(c.npcs) ? c.npcs : []).map(coerceNpcSeedRow);
        const locations = (Array.isArray(c.locations) ? c.locations : []).map(coerceLocationSeedRow);
        const guilds = dedupeStringsPreserveOrder([
            ...Object.keys(c.rep || {}),
            ...npcs.map((npc) => npc.guild),
            ...locations.map((loc) => loc.district)
        ]);
        writeCustomizeForm(guilds, npcs, locations);
        setCustomizeStatus(`Loaded campaign store (${guilds.length} Guilds, ${npcs.length} NPCs, ${locations.length} Locations).`);
    } catch (err) {
        setCustomizeStatus(err && err.message ? err.message : 'Failed to load campaign data.', true);
    }
}

function buildCustomDataFiles() {
    const seed = getCustomizeSeedArrays();
    const labelRaw = document.getElementById('customize-label').value;
    const label = normalizeFilenameLabel(labelRaw);
    const suffix = label ? `-${label}` : '';
    return {
        guilds: {
            filename: `data-guilds${suffix}.js`,
            content: buildPreloadFile('PRELOADED_GUILDS', seed.guilds)
        },
        npcs: {
            filename: `data-npcs${suffix}.js`,
            content: buildPreloadFile('PRELOADED_NPCS', seed.npcs)
        },
        locations: {
            filename: `data-locations${suffix}.js`,
            content: buildPreloadFile('PRELOADED_LOCATIONS', seed.locations)
        }
    };
}

function downloadCustomDataFile(kind) {
    try {
        const files = buildCustomDataFiles();
        const selected = kind === 'guilds'
            ? files.guilds
            : (kind === 'locations' ? files.locations : files.npcs);
        downloadTextFile(selected.filename, selected.content, 'text/javascript');
        setCustomizeStatus(`Downloaded ${selected.filename}.`);
    } catch (err) {
        setCustomizeStatus(err && err.message ? err.message : 'Failed to build data file.', true);
    }
}

function downloadCustomDataFiles() {
    try {
        const files = buildCustomDataFiles();
        downloadTextFile(files.guilds.filename, files.guilds.content, 'text/javascript');
        downloadTextFile(files.npcs.filename, files.npcs.content, 'text/javascript');
        downloadTextFile(files.locations.filename, files.locations.content, 'text/javascript');
        setCustomizeStatus(`Downloaded ${files.guilds.filename}, ${files.npcs.filename}, and ${files.locations.filename}.`);
    } catch (err) {
        setCustomizeStatus(err && err.message ? err.message : 'Failed to build data files.', true);
    }
}

function updateSyncPanelVisibility(status) {
    const panel = document.getElementById('sync-panel');
    const customize = document.getElementById('customize-panel');
    const quick = document.getElementById('sync-quick');
    if (!panel || !quick) return;

    const isSecret = document.body.classList.contains('secret-active');
    const connected = !!(status && status.connected);

    // Manual credentials/admin controls stay behind secret mode.
    panel.classList.toggle('tools-hidden', !isSecret);
    if (customize) customize.classList.toggle('tools-hidden', !isSecret);
    // Quick connect is for onboarding only; hide after successful connection.
    quick.classList.toggle('tools-hidden', connected);
}

function saveSyncConfig() {
    if (!window.RTF_STORE) {
        alert('Store not loaded.');
        return;
    }
    const form = getSyncFormValues();
    window.RTF_STORE.setSyncConfig({
        ...form,
        enabled: true
    }, { reconnect: false });
    applySyncConfigToForm(window.RTF_STORE.getSyncConfig());
    setSyncStatusText(window.RTF_STORE.getSyncStatus());
    alert('Sync config saved locally.');
}

async function connectSync() {
    if (!window.RTF_STORE) {
        alert('Store not loaded.');
        return;
    }
    const form = getSyncFormValues();
    window.RTF_STORE.setSyncConfig({
        ...form,
        enabled: true
    }, { reconnect: false });
    applySyncConfigToForm(window.RTF_STORE.getSyncConfig());
    const result = await window.RTF_STORE.connectSync();
    if (!result.ok) {
        const status = window.RTF_STORE.getSyncStatus();
        alert(status.lastError || 'Failed to connect cloud sync.');
    }
}

async function disconnectSync() {
    if (!window.RTF_STORE) return;
    await window.RTF_STORE.disconnectSync('manual');
}

async function pullSyncNow() {
    if (!window.RTF_STORE) return;
    const result = await window.RTF_STORE.pullFromCloud({ force: true });
    if (!result.ok) {
        if (result.reason === 'conflict') {
            alert('Conflict detected while pulling. Resolve it in the Cloud Sync panel.');
            return;
        }
        const status = window.RTF_STORE.getSyncStatus();
        alert(status.lastError || 'Cloud pull failed.');
    }
}

async function pushSyncNow() {
    if (!window.RTF_STORE) return;
    const result = await window.RTF_STORE.pushToCloud();
    if (!result.ok) {
        if (result.reason === 'conflict') {
            alert('Sync conflict detected. Use "Accept Remote" or "Keep Local + Merge Push" in the Cloud Sync panel.');
            return;
        }
        if (result.reason === 'locked') {
            const proceed = confirm('Another player has an active soft lock on one of your dirty scopes. Force push anyway?');
            if (proceed) {
                const forced = await window.RTF_STORE.pushToCloud({ force: true });
                if (forced.ok) return;
            }
        }
        const status = window.RTF_STORE.getSyncStatus();
        alert(status.lastError || 'Cloud push failed.');
    }
}

async function anonymousSignIn() {
    if (!window.RTF_STORE) return;
    const profile = (document.getElementById('sync-profile').value || '').trim();
    const result = await window.RTF_STORE.signInAnonymously(profile);
    if (!result.ok) {
        const status = window.RTF_STORE.getSyncStatus();
        alert(status.lastError || 'Anonymous sign-in failed.');
    }
}

async function signOutSync() {
    if (!window.RTF_STORE) return;
    const result = await window.RTF_STORE.signOutSyncUser();
    if (!result.ok) alert(result.error || 'Sign out failed.');
}

async function acceptRemoteConflict() {
    if (!window.RTF_STORE || typeof window.RTF_STORE.resolvePendingConflict !== 'function') return;
    const result = await window.RTF_STORE.resolvePendingConflict('accept-remote');
    if (!result.ok) {
        alert(result.error || 'Failed to accept remote state.');
    }
}

async function keepLocalConflict() {
    if (!window.RTF_STORE || typeof window.RTF_STORE.resolvePendingConflict !== 'function') return;
    const result = await window.RTF_STORE.resolvePendingConflict('keep-local');
    if (!result.ok) {
        const status = window.RTF_STORE.getSyncStatus ? window.RTF_STORE.getSyncStatus() : null;
        alert((status && status.lastError) || result.error || 'Failed to keep local changes.');
    }
}

function exportConnectFile() {
    if (!window.RTF_STORE) {
        alert('Store not loaded.');
        return;
    }
    const config = window.RTF_STORE.getSyncConfig();
    const payload = {
        supabaseUrl: config.supabaseUrl || '',
        anonKey: config.anonKey || '',
        campaignId: config.campaignId || '',
        profileName: ''
    };
    if (!payload.supabaseUrl || !payload.anonKey || !payload.campaignId) {
        alert('Missing URL, anon key, or campaign ID.');
        return;
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'connect.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function initSyncPanel() {
    if (!window.RTF_STORE) {
        setTimeout(initSyncPanel, 120);
        return;
    }
    renderCaseSwitcher();
    const caseInput = document.getElementById('new-case-name');
    if (caseInput && !caseInput.dataset.boundEnter) {
        caseInput.dataset.boundEnter = '1';
        caseInput.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            createCaseFromInput();
        });
    }
    loadCustomizeDefaults();
    applySyncConfigToForm(window.RTF_STORE.getSyncConfig());
    latestSyncStatus = window.RTF_STORE.getSyncStatus();
    setSyncStatusText(latestSyncStatus);
    setQuickStatusFromSync(latestSyncStatus);
    updateSyncPanelVisibility(latestSyncStatus);
    window.RTF_STORE.onSyncStatus((status) => {
        latestSyncStatus = status;
        setSyncStatusText(status);
        setQuickStatusFromSync(status);
        updateSyncPanelVisibility(status);
    });
    tryAutoConnectFromBundledDefault();
}

bindDelegatedDataHandlers();

window.addEventListener('load', initSyncPanel);
window.addEventListener('rtf-store-updated', () => {
    renderCaseSwitcher();
});
window.addEventListener('rtf-sync-status', (event) => {
    latestSyncStatus = event.detail || null;
    setSyncStatusText(latestSyncStatus);
    setQuickStatusFromSync(latestSyncStatus);
    updateSyncPanelVisibility(latestSyncStatus);
});
window.addEventListener('rtf-sync-conflict', () => {
    const status = window.RTF_STORE && window.RTF_STORE.getSyncStatus ? window.RTF_STORE.getSyncStatus() : latestSyncStatus;
    setSyncStatusText(status || latestSyncStatus);
});
