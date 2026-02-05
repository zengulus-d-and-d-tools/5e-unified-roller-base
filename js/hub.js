// Use global data if available, fallback to hardcoded (safety)
const guilds = (window.RTF_DATA && window.RTF_DATA.guilds) ? window.RTF_DATA.guilds :
    ["Azorius", "Boros", "Dimir", "Golgari", "Gruul", "Izzet", "Orzhov", "Rakdos", "Selesnya", "Simic"];

// Rewards converted to a datalist for suggestions while allowing free text
const projectRewards = ["+1 Reputation", "Reduce Heat by 1", "Gain a Contact", "Professional Dev (New Tool/Lang)", "Nonmagical Perk"];

// Initialize state dynamically
let state = {
    rep: guilds.reduce((acc, g) => { acc[g] = 0; return acc; }, {}),
    heat: 0,
    players: [],
    case: { title: "", guilds: "", goal: "", clock: "", obstacles: "", setPiece: "" }
};

function loadState() {
    try {
        const saved = localStorage.getItem('ravnicaHubV3_2');
        if (saved) {
            const loaded = JSON.parse(saved);
            // Migration: Ensure all current guilds exist in loaded state
            guilds.forEach(g => {
                if (loaded.rep[g] === undefined) loaded.rep[g] = 0;
            });
            state = loaded;
        }
    } catch (e) { console.error("Corrupted Save", e); }
}

function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "ravnica_hub_backup_" + new Date().toISOString().slice(0, 10) + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const loaded = JSON.parse(event.target.result);
                if (confirm("Overwrite current data with imported file?")) {
                    // Migration on import as well
                    guilds.forEach(g => {
                        if (loaded.rep && loaded.rep[g] === undefined) loaded.rep[g] = 0;
                    });
                    state = loaded;
                    save();
                    alert("Data imported successfully!");
                }
            } catch (err) {
                alert("Invalid JSON file");
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function save() {
    localStorage.setItem('ravnicaHubV3_2', JSON.stringify(state));
    render();
}

function saveCase() {
    state.case.title = document.getElementById('caseTitle').value;
    state.case.guilds = document.getElementById('caseGuilds').value;
    state.case.goal = document.getElementById('caseGoal').value;
    state.case.clock = document.getElementById('caseClock').value;
    state.case.obstacles = document.getElementById('caseObstacles').value;
    state.case.setPiece = document.getElementById('caseSetPiece').value;
    save();
}

function resetAll() { if (confirm("Reset everything?")) { localStorage.removeItem('ravnicaHubV3_2'); location.reload(); } }
function modRep(g, amt) { state.rep[g] = Math.max(-2, Math.min(2, (state.rep[g] || 0) + amt)); save(); }
function modHeat(amt) { state.heat = Math.max(0, Math.min(6, state.heat + amt)); save(); }

function addPlayer() {
    state.players.push({ name: "New Recruit", dp: 2, projectClock: 0, projectName: "", projectReward: "+1 Reputation" });
    save();
}

function modDP(idx, amt) { state.players[idx].dp = Math.max(0, Math.min(4, state.players[idx].dp + amt)); save(); }
function grantWeeklyDP() { state.players.forEach(p => p.dp = Math.min(4, p.dp + 2)); save(); }
function modClock(idx, amt) { state.players[idx].projectClock = Math.max(0, Math.min(4, state.players[idx].projectClock + amt)); save(); }

function updatePlayer(idx, field, val) { state.players[idx][field] = val; save(); }

function render() {
    // Render Case Info
    document.getElementById('caseTitle').value = state.case.title || "";
    document.getElementById('caseGuilds').value = state.case.guilds || "";
    document.getElementById('caseGoal').value = state.case.goal || "";
    document.getElementById('caseClock').value = state.case.clock || "";
    document.getElementById('caseObstacles').value = state.case.obstacles || "";
    document.getElementById('caseSetPiece').value = state.case.setPiece || "";

    // Shared Status
    document.getElementById('repGrid').innerHTML = guilds.map(g => `
            <div style="text-align:center; padding:8px; border:1px solid var(--border); border-radius:6px; background:rgba(0,0,0,0.3);">
                <div class="mini-label" style="font-size:0.6rem;">${g}</div>
                <div style="font-size:1.2rem; font-weight:900; color:${(state.rep[g] || 0) > 0 ? '#2ecc71' : (state.rep[g] || 0) < 0 ? '#ff6b6b' : '#666'}">${(state.rep[g] || 0) > 0 ? '+' : ''}${state.rep[g] || 0}</div>
                <div style="display:flex; justify-content:center; gap:5px; margin-top:5px;">
                    <button class="btn" onclick="modRep('${g}',-1)" style="padding:2px 8px;">-</button>
                    <button class="btn" onclick="modRep('${g}',1)" style="padding:2px 8px;">+</button>
                </div>
            </div>
        `).join('');

    document.getElementById('heatVal').innerText = state.heat;
    document.getElementById('heatFill').style.width = (state.heat / 6 * 100) + '%';

    let warn = "";
    if (state.heat >= 6) warn = "CRITICAL: Hard Constraint mandated.";
    else if (state.heat >= 3) warn = "WARNING: Complication Scene triggered.";
    document.getElementById('heatWarning').innerText = warn;

    // Player List
    document.getElementById('rosterList').innerHTML = state.players.map((p, i) => `
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
                <button class="btn" style="color:var(--danger); border-color:transparent;" onclick="if(confirm('Delete?')){state.players.splice(${i},1); save();}">&times;</button>
            </div>
        `).join('');
}

loadState(); render();
