const guilds = (() => {
    const rep = window.RTF_STORE && window.RTF_STORE.state && window.RTF_STORE.state.campaign && window.RTF_STORE.state.campaign.rep;
    const names = rep ? Object.keys(rep).filter(Boolean) : [];
    return names.length ? names : ["General"];
})();

// Rewards converted to a datalist for suggestions while allowing free text
const projectRewards = ["+1 Reputation", "Reduce Heat by 1", "Gain a Contact", "Professional Dev (New Tool/Lang)", "Nonmagical Perk"];

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

// Shortcut to Store Campaign Data
function getCampaign() {
    if (!window.RTF_STORE) return null;
    return window.RTF_STORE.state.campaign;
}

function save() {
    if (window.RTF_STORE) window.RTF_STORE.save({ scope: 'campaign' });
    render();
}

function exportData() {
    if (window.RTF_STORE) window.RTF_STORE.export();
}

function importData() {
    if (window.RTF_STORE) {
        window.RTF_STORE.import().then(success => {
            if (success) {
                alert("Data imported successfully!");
                render();
            }
        });
    }
}

function saveCase() {
    const campaign = getCampaign();
    if (!campaign || !campaign.case) return;
    const c = campaign.case;
    c.title = document.getElementById('caseTitle').value;
    c.guilds = document.getElementById('caseGuilds').value;
    c.goal = document.getElementById('caseGoal').value;
    c.clock = document.getElementById('caseClock').value;
    c.obstacles = document.getElementById('caseObstacles').value;
    c.setPiece = document.getElementById('caseSetPiece').value;
    save();
}

function resetAll() {
    if (confirm("Reset everything? This will wipe the Unified Store.")) {
        localStorage.removeItem('unified_store_v1');
        localStorage.removeItem('unified_unified_v1');
        localStorage.removeItem('invBoardData');
        location.reload();
    }
}

function modRep(g, amt) {
    const campaign = getCampaign();
    if (!campaign || !campaign.rep) return;
    const rep = campaign.rep;
    const key = String(g || '');
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') return;
    rep[key] = Math.max(-2, Math.min(2, (Number(rep[key]) || 0) + amt));
    save();
}

function modHeat(amt) {
    const c = getCampaign();
    if (!c) return;
    c.heat = Math.max(0, Math.min(6, (c.heat || 0) + amt));
    save();
}

// --- PLAYER LOGIC ---
function addPlayer() {
    const c = getCampaign();
    if (!c || !Array.isArray(c.players)) return;
    c.players.push({
        id: 'player_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5),
        name: "New Recruit",
        dp: 2,
        projectClock: 0,
        projectName: "",
        projectReward: "+1 Reputation",
        ac: 10,
        hp: 10,
        pp: 10,
        dc: 10
    });
    save();
}

function modDP(idx, amt) {
    const campaign = getCampaign();
    if (!campaign || !Array.isArray(campaign.players)) return;
    const p = campaign.players[idx];
    if (!p) return;
    p.dp = Math.max(0, Math.min(4, (Number(p.dp) || 0) + amt));
    save();
}

function grantWeeklyDP() {
    const campaign = getCampaign();
    if (!campaign || !Array.isArray(campaign.players)) return;
    campaign.players.forEach((p) => {
        if (!p) return;
        p.dp = Math.max(0, Math.min(4, (Number(p.dp) || 0) + 2));
    });
    save();
}

function modClock(idx, amt) {
    const campaign = getCampaign();
    if (!campaign || !Array.isArray(campaign.players)) return;
    const p = campaign.players[idx];
    if (!p) return;
    p.projectClock = Math.max(0, Math.min(4, (Number(p.projectClock) || 0) + amt));
    save();
}

function deletePlayer(idx) {
    if (!confirm('Delete?')) return;
    const campaign = getCampaign();
    if (!campaign || !Array.isArray(campaign.players)) return;
    campaign.players.splice(idx, 1);
    save();
}

function renderClockPie(value, total = 4, extraClass = '') {
    const maxSegments = total === 6 ? 6 : 4;
    const safeValue = Math.max(0, Math.min(maxSegments, Number(value) || 0));
    const fill = (safeValue / maxSegments) * 360;
    const className = extraClass ? `clock-pie ${extraClass}` : 'clock-pie';
    return `<div class="${className}" data-clock-total="${maxSegments}" data-clock-fill="${fill.toFixed(2)}" role="img" aria-label="Clock ${safeValue} of ${maxSegments}"></div>`;
}

function applyClockPieStyles(scopeEl) {
    const root = scopeEl && typeof scopeEl.querySelectorAll === 'function' ? scopeEl : document;
    root.querySelectorAll('.clock-pie[data-clock-total][data-clock-fill]').forEach((el) => {
        const total = parseInt(el.getAttribute('data-clock-total'), 10);
        const fill = parseFloat(el.getAttribute('data-clock-fill'));
        el.style.setProperty('--clock-total', String(Number.isFinite(total) ? total : 4));
        el.style.setProperty('--clock-fill', `${Number.isFinite(fill) ? fill : 0}deg`);
    });
}

function updatePlayer(idx, field, val) {
    const campaign = getCampaign();
    if (!campaign || !Array.isArray(campaign.players)) return;
    if (!campaign.players[idx]) return;
    if (!['name', 'projectName', 'projectReward'].includes(field)) return;
    campaign.players[idx][field] = val;
    save();
}



function render() {
    const c = getCampaign();
    if (!c) return; // Wait for store load
    const players = Array.isArray(c.players) ? c.players : [];

    // Render Case Info
    const caseData = c.case || {};
    document.getElementById('caseTitle').value = caseData.title || "";
    document.getElementById('caseGuilds').value = caseData.guilds || "";
    document.getElementById('caseGoal').value = caseData.goal || "";
    document.getElementById('caseClock').value = caseData.clock || "";
    document.getElementById('caseObstacles').value = caseData.obstacles || "";
    document.getElementById('caseSetPiece').value = caseData.setPiece || "";

    // Shared Status
    document.getElementById('repGrid').innerHTML = guilds.map((g) => {
        const repRaw = Number(c.rep && c.rep[g]);
        const repVal = Number.isFinite(repRaw) ? Math.max(-2, Math.min(2, repRaw)) : 0;
        const repClass = repVal > 0 ? 'hub-rep-value-pos' : repVal < 0 ? 'hub-rep-value-neg' : 'hub-rep-value-neutral';
        const guildArg = escapeJsString(g);
        return `
            <div class="hub-rep-card">
                <div class="mini-label hub-rep-mini-label">${escapeHtml(g)}</div>
                <div class="hub-rep-value ${repClass}">${repVal > 0 ? '+' : ''}${repVal}</div>
                <div class="hub-rep-actions">
                    <button class="btn hub-btn-compact" data-onclick="modRep('${guildArg}', -1)">-</button>
                    <button class="btn hub-btn-compact" data-onclick="modRep('${guildArg}', 1)">+</button>
                </div>
            </div>
        `;
    }).join('');

    const heatRaw = Number(c.heat);
    const safeHeat = Number.isFinite(heatRaw) ? Math.max(0, Math.min(6, heatRaw)) : 0;
    document.getElementById('heatVal').innerText = safeHeat;
    document.getElementById('heatFill').style.width = ((safeHeat / 6) * 100) + '%';

    let warn = "";
    if (safeHeat >= 6) warn = "CRITICAL: Hard Constraint mandated.";
    else if (safeHeat >= 3) warn = "WARNING: Complication Scene triggered.";
    document.getElementById('heatWarning').innerText = warn;

    // Player List
    const rewardOptions = projectRewards.map((reward) => `<option value="${escapeHtml(reward)}"></option>`).join('');
    const rosterMarkup = players.map((p, i) => {
        const safeName = escapeHtml(p.name || '');
        const safeProjectName = escapeHtml(p.projectName || '');
        const safeProjectReward = escapeHtml(p.projectReward || '');
        const safeDP = Number.isFinite(Number(p.dp)) ? Number(p.dp) : 0;
        const safeClock = Math.max(0, Math.min(4, Number(p.projectClock) || 0));
        return `
            <div class="player-row">
                <div>
                    <input type="text" value="${safeName}" data-onchange="updatePlayer(${i}, 'name', this.value)">
                    <div class="dp-counter hub-dp-counter">${safeDP} DP</div>
                    <div class="hub-player-dp-actions">
                        <button class="btn" data-onclick="modDP(${i},-1)">Spend</button>
                        <button class="btn" data-onclick="modDP(${i},1)">Add</button>
                    </div>
                </div>
                <div class="hub-player-project-col">
                    <span class="mini-label">Active Project Clock (4 Segments)</span>
                    <input type="text" class="hub-project-name-input" placeholder="Project Name (e.g., Learn Draconic)..." value="${safeProjectName}" data-onchange="updatePlayer(${i}, 'projectName', this.value)">
                    <div class="hub-project-row">
                        <input type="text" class="hub-project-reward-input" list="reward-options" placeholder="Reward Goal..." value="${safeProjectReward}" data-onchange="updatePlayer(${i}, 'projectReward', this.value)">
                        <div class="clock-container hub-clock-container-end">
                            ${renderClockPie(safeClock, 4)}
                            <span class="clock-readout">${safeClock}/4</span>
                            <button class="btn clock-btn" data-onclick="modClock(${i},1)">+</button>
                            <button class="btn clock-btn" data-onclick="modClock(${i},-1)">-</button>
                        </div>
                    </div>
                </div>
                <button class="btn hub-btn-delete-player" data-onclick="deletePlayer(${i})">&times;</button>
            </div>
        `;
    }).join('');
    document.getElementById('rosterList').innerHTML = `${rosterMarkup}<datalist id="reward-options">${rewardOptions}</datalist>`;

    applyClockPieStyles(document.getElementById('rosterList'));

}

// Initial render on load
window.addEventListener('load', () => {
    // Check if store loaded
    if (window.RTF_STORE) {
        render();
    } else {
        setTimeout(render, 100); // Simple retry
    }
});
