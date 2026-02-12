let latestSyncStatus = null;
const delegatedHandlerEvents = ['click', 'change', 'input'];
const delegatedHandlerCache = new Map();
let delegatedHandlersBound = false;
let groupLoaderDraft = [];
const GROUP_LOADER_FALLBACK_NAME = 'General';
const GROUP_LOADER_MAX = 80;

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

function setSecretMode(enabled) {
    const isSecret = !!enabled;
    document.body.classList.toggle('secret-active', isSecret);
    const title = document.getElementById('pageTitle');
    if (title) title.innerText = isSecret ? 'Forbidden DM Protocols' : 'Tools Hub';
    if (!isSecret) closeGroupLoaderWizard();
    updateSyncPanelVisibility(latestSyncStatus);
}

// Secret Toggle Logic
function trySecretToggle(e) {
    // Alt + Shift + Click
    if (e.altKey && e.shiftKey) {
        setSecretMode(!document.body.classList.contains('secret-active'));
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
            renderGroupLoaderMeta();
        });
    } else {
        alert("Store not loaded.");
    }
}

function normalizeGroupLoaderName(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    if (normalized === '__proto__' || normalized === 'prototype' || normalized === 'constructor') return '';
    return normalized.slice(0, 120);
}

function dedupeGroupLoaderNames(list) {
    const source = Array.isArray(list) ? list : [];
    const seen = new Set();
    const out = [];
    source.forEach((entry) => {
        const name = normalizeGroupLoaderName(entry);
        if (!name) return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(name);
    });
    return out.slice(0, GROUP_LOADER_MAX);
}

function parseGroupLoaderInput(raw) {
    const text = String(raw || '');
    const trimmed = text.trim();
    if (!trimmed) return [];

    let tokens = [];
    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) tokens = parsed;
        } catch (err) {
            // Fall back to line/comma parsing below.
        }
    }
    if (!tokens.length) {
        trimmed.split(/\r?\n/).forEach((line) => {
            line.split(/[;,]+/).forEach((part) => {
                tokens.push(part);
            });
        });
    }
    return dedupeGroupLoaderNames(tokens);
}

function getCurrentGroupNames() {
    const rep = window.RTF_STORE && window.RTF_STORE.state
        && window.RTF_STORE.state.campaign
        && window.RTF_STORE.state.campaign.rep
        && typeof window.RTF_STORE.state.campaign.rep === 'object'
        ? window.RTF_STORE.state.campaign.rep
        : {};
    return dedupeGroupLoaderNames(Object.keys(rep).filter(Boolean));
}

function findRepValue(rep, name) {
    const source = rep && typeof rep === 'object' ? rep : {};
    const direct = Number(source[name]);
    if (Number.isFinite(direct)) return direct;
    const key = String(name || '').toLowerCase();
    const match = Object.keys(source).find((entry) => entry.toLowerCase() === key);
    const fallback = match ? Number(source[match]) : 0;
    return Number.isFinite(fallback) ? fallback : 0;
}

function summarizeGroupNames(names, max = 4) {
    if (!Array.isArray(names) || !names.length) return GROUP_LOADER_FALLBACK_NAME;
    const shown = names.slice(0, max).join(', ');
    if (names.length <= max) return shown;
    return `${shown}, +${names.length - max} more`;
}

function setGroupLoaderStatus(message, isError = false) {
    const el = document.getElementById('group-loader-status');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('is-error', !!isError);
}

function isGroupLoaderOpen() {
    const panel = document.getElementById('group-loader-panel');
    return !!(panel && !panel.classList.contains('tools-hidden'));
}

function setGroupLoaderOpen(open) {
    const panel = document.getElementById('group-loader-panel');
    if (!panel) return;
    panel.classList.toggle('tools-hidden', !open);
}

function setGroupLoaderStep(step) {
    const entry = document.getElementById('group-loader-step-entry');
    const review = document.getElementById('group-loader-step-review');
    if (!entry || !review) return;
    const isReview = step === 'review';
    entry.classList.toggle('tools-hidden', isReview);
    review.classList.toggle('tools-hidden', !isReview);
}

function renderGroupLoaderPreview(names) {
    const preview = document.getElementById('group-loader-preview');
    if (!preview) return;
    const list = Array.isArray(names) ? names : [];
    preview.innerHTML = '';
    if (!list.length) {
        const empty = document.createElement('span');
        empty.className = 'group-loader-empty';
        empty.textContent = 'No names entered yet.';
        preview.appendChild(empty);
        return;
    }
    list.forEach((name) => {
        const chip = document.createElement('span');
        chip.className = 'group-loader-chip';
        chip.textContent = name;
        preview.appendChild(chip);
    });
}

function renderGroupLoaderMeta() {
    const meta = document.getElementById('group-loader-meta');
    if (!meta) return;
    if (!window.RTF_STORE || !window.RTF_STORE.state || !window.RTF_STORE.state.campaign) {
        meta.textContent = 'Current groups: store unavailable';
        return;
    }
    const names = getCurrentGroupNames();
    meta.textContent = `Current groups: ${names.length} (${summarizeGroupNames(names)})`;
}

function resetGroupLoaderWizard() {
    groupLoaderDraft = [];
    renderGroupLoaderPreview([]);
    setGroupLoaderStep('entry');
    setGroupLoaderStatus('Enter group names, then click "Next: Review".');
}

function previewGroupLoaderInput() {
    if (!window.RTF_STORE) {
        setGroupLoaderStatus('Store not loaded.', true);
        return;
    }
    const input = document.getElementById('group-loader-input');
    const parsed = parseGroupLoaderInput(input ? input.value : '');
    if (!parsed.length) {
        setGroupLoaderStatus('Enter at least one valid group name.', true);
        return;
    }
    groupLoaderDraft = parsed;
    renderGroupLoaderPreview(groupLoaderDraft);
    setGroupLoaderStep('review');
    setGroupLoaderStatus(`Review ${groupLoaderDraft.length} group name${groupLoaderDraft.length === 1 ? '' : 's'}, then load.`);
}

function getGroupLoaderMode() {
    const selected = document.querySelector('input[name="group-loader-mode"]:checked');
    return selected && selected.value === 'merge' ? 'merge' : 'replace';
}

function buildNextRepMapFromDraft(names, mode) {
    const incoming = dedupeGroupLoaderNames(names);
    const currentRep = window.RTF_STORE && window.RTF_STORE.state
        && window.RTF_STORE.state.campaign
        && window.RTF_STORE.state.campaign.rep
        && typeof window.RTF_STORE.state.campaign.rep === 'object'
        ? window.RTF_STORE.state.campaign.rep
        : {};
    const currentNames = dedupeGroupLoaderNames(Object.keys(currentRep).filter(Boolean));
    const targetNames = mode === 'merge'
        ? dedupeGroupLoaderNames(currentNames.concat(incoming))
        : incoming;
    const safeNames = targetNames.length ? targetNames : [GROUP_LOADER_FALLBACK_NAME];
    const nextRep = Object.create(null);
    safeNames.forEach((name) => {
        nextRep[name] = findRepValue(currentRep, name);
    });
    return nextRep;
}

function applyGroupLoaderInput() {
    if (!window.RTF_STORE || !window.RTF_STORE.state || !window.RTF_STORE.state.campaign) {
        setGroupLoaderStatus('Store not loaded.', true);
        return;
    }
    const input = document.getElementById('group-loader-input');
    const sourceNames = groupLoaderDraft.length ? groupLoaderDraft : parseGroupLoaderInput(input ? input.value : '');
    if (!sourceNames.length) {
        setGroupLoaderStatus('Nothing to load. Enter names first.', true);
        return;
    }
    const mode = getGroupLoaderMode();
    window.RTF_STORE.state.campaign.rep = buildNextRepMapFromDraft(sourceNames, mode);
    window.RTF_STORE.save({ scope: 'campaign.rep' });
    groupLoaderDraft = [];
    renderGroupLoaderMeta();
    setGroupLoaderStep('entry');
    setGroupLoaderStatus(`Loaded ${Object.keys(window.RTF_STORE.state.campaign.rep || {}).length} groups into shared store.`);
    closeGroupLoaderWizard();
}

function openGroupLoaderWizard() {
    setSecretMode(true);
    setGroupLoaderOpen(true);
    const panel = document.getElementById('group-loader-panel');
    const input = document.getElementById('group-loader-input');
    if (input && typeof input.focus === 'function') {
        input.focus();
        input.select();
    }
}

function closeGroupLoaderWizard() {
    setGroupLoaderOpen(false);
}

function handleGroupLoaderBackdropClick(event) {
    if (!event || !event.target) return;
    const panel = document.getElementById('group-loader-panel');
    if (!panel) return;
    if (event.target === panel) closeGroupLoaderWizard();
}

function handleGroupLoaderShortcut(event) {
    if (!event.altKey || !event.shiftKey) return;
    if ((event.key || '').toLowerCase() !== 'l') return;
    event.preventDefault();
    openGroupLoaderWizard();
}

function handleGlobalEscape(event) {
    if ((event.key || '') !== 'Escape') return;
    if (!isGroupLoaderOpen()) return;
    event.preventDefault();
    closeGroupLoaderWizard();
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

function promptRequiredConnectPlayerName() {
    while (true) {
        const entered = prompt('Enter your player name for sync tracking (required):', '');
        if (entered === null) return '';
        const cleanName = entered.trim();
        if (cleanName) return cleanName;
        alert('Player name is required to connect.');
    }
}

async function applyConnectProfile(raw, opts = {}) {
    if (!window.RTF_STORE) return { ok: false, error: 'Store not loaded.' };
    const options = opts && typeof opts === 'object' ? opts : {};
    const payload = normalizeConnectPayload(raw);
    if (!payload) return { ok: false, error: 'Invalid connect.json format.' };
    const suppliedProfileName = typeof options.profileName === 'string' ? options.profileName.trim() : '';
    const profileName = suppliedProfileName || promptRequiredConnectPlayerName();
    if (!profileName) return { ok: false, error: 'Player name is required to connect.' };
    payload.profileName = profileName;

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
        const target = event && event.target ? event.target : null;
        const file = target && target.files && target.files[0] ? target.files[0] : null;
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

function updateSyncPanelVisibility(status) {
    const panel = document.getElementById('sync-panel');
    const quick = document.getElementById('sync-quick');
    if (!panel || !quick) return;

    const isSecret = document.body.classList.contains('secret-active');
    const connected = !!(status && status.connected);

    // Manual credentials/admin controls stay behind secret mode.
    panel.classList.toggle('tools-hidden', !isSecret);
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
    applySyncConfigToForm(window.RTF_STORE.getSyncConfig());
    renderGroupLoaderMeta();
    resetGroupLoaderWizard();
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
    renderGroupLoaderMeta();
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
window.addEventListener('keydown', handleGroupLoaderShortcut);
window.addEventListener('keydown', handleGlobalEscape);
