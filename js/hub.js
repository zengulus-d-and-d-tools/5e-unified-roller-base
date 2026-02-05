// Use global data if available, fallback to hardcoded (safety)
const guilds = (window.RTF_DATA && window.RTF_DATA.guilds) ? window.RTF_DATA.guilds :
    ["Azorius", "Boros", "Dimir", "Golgari", "Gruul", "Izzet", "Orzhov", "Rakdos", "Selesnya", "Simic"];

// Rewards converted to a datalist for suggestions while allowing free text
const projectRewards = ["+1 Reputation", "Reduce Heat by 1", "Gain a Contact", "Professional Dev (New Tool/Lang)", "Nonmagical Perk"];

// Shortcut to Store Campaign Data
function getCampaign() {
    if (!window.RTF_STORE) return null;
    return window.RTF_STORE.state.campaign;
}

function save() {
    if (window.RTF_STORE) window.RTF_STORE.save();
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
    const c = getCampaign().case;
    if (!c) return;
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
        localStorage.removeItem('ravnica_unified_v1');
        location.reload();
    }
}

function modRep(g, amt) {
    const rep = getCampaign().rep;
    rep[g] = Math.max(-2, Math.min(2, (rep[g] || 0) + amt));
    save();
}

function modHeat(amt) {
    const c = getCampaign();
    c.heat = Math.max(0, Math.min(6, (c.heat || 0) + amt));
    save();
}

// --- PLAYER LOGIC ---
function addPlayer() {
    const c = getCampaign();
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
    const p = getCampaign().players[idx];
    p.dp = Math.max(0, Math.min(4, p.dp + amt));
    save();
}

function grantWeeklyDP() {
    getCampaign().players.forEach(p => p.dp = Math.min(4, p.dp + 2));
    save();
}

function modClock(idx, amt) {
    const p = getCampaign().players[idx];
    p.projectClock = Math.max(0, Math.min(4, p.projectClock + amt));
    save();
}

function updatePlayer(idx, field, val) {
    getCampaign().players[idx][field] = val;
    save();
}



function render() {
    const c = getCampaign();
    if (!c) return; // Wait for store load

    // Render Case Info
    document.getElementById('caseTitle').value = c.case.title || "";
    document.getElementById('caseGuilds').value = c.case.guilds || "";
    document.getElementById('caseGoal').value = c.case.goal || "";
    document.getElementById('caseClock').value = c.case.clock || "";
    document.getElementById('caseObstacles').value = c.case.obstacles || "";
    document.getElementById('caseSetPiece').value = c.case.setPiece || "";

    // Shared Status
    document.getElementById('repGrid').innerHTML = guilds.map(g => `
            <div style="text-align:center; padding:8px; border:1px solid var(--border); border-radius:6px; background:rgba(0,0,0,0.3);">
                <div class="mini-label" style="font-size:0.6rem;">${g}</div>
                <div style="font-size:1.2rem; font-weight:900; color:${(c.rep[g] || 0) > 0 ? '#2ecc71' : (c.rep[g] || 0) < 0 ? '#ff6b6b' : '#666'}">${(c.rep[g] || 0) > 0 ? '+' : ''}${c.rep[g] || 0}</div>
                <div style="display:flex; justify-content:center; gap:5px; margin-top:5px;">
                    <button class="btn" onclick="modRep('${g}',-1)" style="padding:2px 8px;">-</button>
                    <button class="btn" onclick="modRep('${g}',1)" style="padding:2px 8px;">+</button>
                </div>
            </div>
        `).join('');

    document.getElementById('heatVal').innerText = c.heat || 0;
    document.getElementById('heatFill').style.width = ((c.heat || 0) / 6 * 100) + '%';

    let warn = "";
    if ((c.heat || 0) >= 6) warn = "CRITICAL: Hard Constraint mandated.";
    else if ((c.heat || 0) >= 3) warn = "WARNING: Complication Scene triggered.";
    document.getElementById('heatWarning').innerText = warn;

    // Player List
    document.getElementById('rosterList').innerHTML = (c.players || []).map((p, i) => `
            <div class="player-row">
                <div>
                    <input type="text" value="${p.name}" onchange="updatePlayer(${i}, 'name', this.value)">
                    <div class="dp-counter" style="margin-top:12px;">${p.dp} DP</div>
                    <div style="display:flex; justify-content:center; gap:5px; margin-top:8px;">
                        <button class="btn" onclick="modDP(${i},-1)">Spend</button>
                        <button class="btn" onclick="modDP(${i},1)">Add</button>
                    </div>
                </div>
                <div style="grid-column: span 2;">
                    <span class="mini-label">Active Project Clock (4 Segments)</span>
                    <input type="text" placeholder="Project Name (e.g., Learn Draconic)..." value="${p.projectName}" onchange="updatePlayer(${i}, 'projectName', this.value)" style="margin-bottom:8px;">
                    <div style="display:flex; gap:10px;">
                        <input type="text" list="reward-options" placeholder="Reward Goal..." value="${p.projectReward}" onchange="updatePlayer(${i}, 'projectReward', this.value)" style="flex:2;">
                        <datalist id="reward-options">
                            ${projectRewards.map(r => `<option value="${r}">`).join('')}
                        </datalist>
                        <div class="clock-container" style="flex:1; justify-content:flex-end;">
                            ${[1, 2, 3, 4].map(s => `<div class="clock-seg ${p.projectClock >= s ? 'filled' : ''}"></div>`).join('')}
                            <button class="btn" onclick="modClock(${i},1)" style="margin-left:8px;">+</button>
                            <button class="btn" onclick="modClock(${i},-1)">-</button>
                        </div>
                    </div>
                </div>
                <button class="btn" style="color:var(--danger); border-color:transparent;" onclick="if(confirm('Delete?')){getCampaign().players.splice(${i},1); save();}">&times;</button>
            </div>
        `).join('');


}

// Initial Render on Load
window.onload = () => {
    // Check if store loaded
    if (window.RTF_STORE) {
        render();
    } else {
        setTimeout(render, 100); // Simple retry
    }
};
