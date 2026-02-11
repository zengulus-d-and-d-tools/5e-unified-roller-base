const DEFAULT_GM_DATA = {
    combatants: [],
    bestiary: [], // [{name, init, dex, hp, count}]
    round: 1,
    activeIdx: 0,
    webhook: '',
    discordActive: false,
    scratchpad: '',
    rollLevel: 1
};
let gmData = JSON.parse(JSON.stringify(DEFAULT_GM_DATA));

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

// ... existing vars ...

function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeString(value, fallback = '', maxLen = 4000) {
    return (typeof value === 'string' ? value : fallback).slice(0, maxLen);
}

function sanitizeNumber(value, fallback = 0, min = -Infinity, max = Infinity) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function sanitizeGMData(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const sanitized = JSON.parse(JSON.stringify(DEFAULT_GM_DATA));

    sanitized.combatants = Array.isArray(source.combatants) ? source.combatants.slice(0, 300).map((entry, idx) => {
        const row = entry && typeof entry === 'object' ? entry : {};
        const hasHp = row.hp !== null && row.hp !== undefined && row.hp !== '';
        const hp = hasHp ? sanitizeNumber(row.hp, 0, 0, 999999) : null;
        const maxHp = hasHp ? sanitizeNumber(row.maxHp, hp, 0, 999999) : null;
        return {
            id: sanitizeString(String(row.id ?? `combat_${idx}`), `combat_${idx}`, 80),
            name: sanitizeString(row.name || 'Enemy', 'Enemy', 160),
            total: sanitizeNumber(row.total, 0, -999, 999),
            tie: sanitizeNumber(row.tie, 10, 1, 30),
            hp,
            maxHp,
            tags: Array.isArray(row.tags) ? row.tags.slice(0, 20).map((tag) => sanitizeString(tag, '', 120)).filter(Boolean) : []
        };
    }) : [];

    sanitized.bestiary = Array.isArray(source.bestiary) ? source.bestiary.slice(0, 400).map((entry) => {
        const row = entry && typeof entry === 'object' ? entry : {};
        return {
            name: sanitizeString(row.name || '', '', 160),
            baseName: sanitizeString(row.baseName || '', '', 160),
            count: sanitizeNumber(row.count, 1, 1, 99),
            initMod: sanitizeNumber(row.initMod, 0, -20, 20),
            dex: sanitizeNumber(row.dex, 10, 1, 30),
            hp: sanitizeNumber(row.hp, 0, 0, 999999)
        };
    }) : [];

    sanitized.round = Math.round(sanitizeNumber(source.round, 1, 1, 100000));
    sanitized.activeIdx = Math.round(sanitizeNumber(source.activeIdx, 0, 0, Math.max(0, sanitized.combatants.length - 1)));
    sanitized.webhook = sanitizeString(source.webhook || '', '', 2000);
    sanitized.discordActive = !!source.discordActive;
    sanitized.scratchpad = sanitizeString(source.scratchpad || '', '', 100000);
    sanitized.rollLevel = Math.round(sanitizeNumber(source.rollLevel, 1, 1, 30));

    return sanitized;
}

// --- BESTIARY LOGIC ---
function saveMobPreset() {
    const name = document.getElementById('mobSaveName').value.trim();
    if (!name) return alert("Enter a name");

    const preset = {
        name: name,
        baseName: document.getElementById('mobName').value,
        count: document.getElementById('mobCount').value,
        initMod: document.getElementById('mobInitMod').value,
        dex: document.getElementById('mobDexScore').value,
        hp: document.getElementById('mobHP').value
    };

    gmData.bestiary.push(preset);
    document.getElementById('mobSaveName').value = '';
    saveGM(); renderBestiary();
}

function loadMobPreset(idx) {
    const p = gmData.bestiary[idx];
    document.getElementById('mobName').value = p.baseName || '';
    document.getElementById('mobCount').value = p.count || 1;
    document.getElementById('mobInitMod').value = p.initMod || '';
    document.getElementById('mobDexScore').value = p.dex || '';
    document.getElementById('mobHP').value = p.hp || '';
    alert("Loaded: " + p.name);
}

function delMobPreset(idx) {
    if (confirm("Delete preset?")) {
        gmData.bestiary.splice(idx, 1);
        saveGM(); renderBestiary();
    }
}

function renderBestiary() {
    const list = document.getElementById('bestiaryList');
    if (!list || !gmData.bestiary) return;

    if (gmData.bestiary.length === 0) {
        list.innerHTML = '<div class="gm-bestiary-empty">No presets saved.</div>';
        return;
    }

    list.innerHTML = gmData.bestiary.map((b, i) => `
                <div class="gm-bestiary-item">
                    <span class="gm-bestiary-item-name">${escapeHtml(b.name || 'Preset')}</span>
                    <div class="gm-bestiary-item-actions">
                        <button class="btn-sec btn-sm" data-onclick="loadMobPreset(${i})">Load</button>
                        <button class="btn-danger btn-sm" data-onclick="delMobPreset(${i})">&times;</button>
                    </div>
                </div>
            `).join('');
}

// --- CONDITION TAGS ---
function addTag(idx) {
    const tag = prompt("Tag (e.g. Prone, Stunned):");
    if (tag) {
        if (!gmData.combatants[idx].tags) gmData.combatants[idx].tags = [];
        gmData.combatants[idx].tags.push(tag);
        saveGM(); renderCombat();
    }
}

function removeTag(cIdx, tIdx) {
    gmData.combatants[cIdx].tags.splice(tIdx, 1);
    saveGM(); renderCombat();
}

let rollMode = 'norm'; // norm, adv, dis
let luckMode = 0; // -1, 0, 1

// --- CONDITIONS & LOOT DATA ---
const conditions = {
    "Blinded": "Auto-fail sight checks. Attacks against you have Adv. Your attacks have Disadv.",
    "Charmed": "Can't attack charmer. Charmer has Adv on social checks vs you.",
    "Deafened": "Auto-fail hearing checks.",
    "Frightened": "Disadv on checks/attacks while source is visible. Can't move closer.",
    "Grappled": "Speed 0. Ends if grappler incapacitated or moved away.",
    "Incapacitated": "No Actions or Reactions.",
    "Invisible": "Heavily Obscured. Attacks against you have Disadv. Your attacks have Adv.",
    "Paralyzed": "Incapacitated. Can't move/speak. Auto-fail Str/Dex saves. Attacks against have Adv. Critical hit if attacker is within 5ft.",
    "Petrified": "Weight x10. Incapacitated. Unaware. Resist all dmg. Immune Poison/Disease.",
    "Poisoned": "Disadv on Atk and Checks.",
    "Prone": "Crawl (half speed). Disadv on your Atks. Melee atks against you have Adv. Ranged atks against you have Disadv.",
    "Restrained": "Speed 0. Disadv on Dex saves. Attacks against you have Adv. Your attacks have Disadv.",
    "Stunned": "Incapacitated. Can't move. Auto-fail Str/Dex saves. Attacks against you have Adv.",
    "Unconscious": "Incapacitated. Drop items. Prone. Auto-fail Str/Dex saves. Attacks against have Adv. Crit if within 5ft."
};

const lootTables = {
    pocket: [
        { adjs: ["Rusty", "Bent", "Scratched", "Dull", "Twisted", "Tarnished"], nouns: ["Iron Nail", "Copper Coin (Fake)", "Tin Spoon", "Belt Buckle", "Skeleton Key", "Needle", "Brass Button"] },
        { adjs: ["Soggy", "Crumpled", "Torn", "Stained", "Moldy", "Greasy", "Faded"], nouns: ["Grocery List", "Handkerchief", "Playing Card", "Map Scrap", "Love Letter", "Ticket Stub", "Rag"] },
        { adjs: ["Rotten", "Dried", "Half-eaten", "Withered", "Stinky", "Petrified"], nouns: ["Apple Core", "Rat Tail", "Flower", "Root", "Crust of Bread", "Fish Bone", "Beetle Shell"] },
        { adjs: ["Tangled", "Knotted", "Frayed", "Short", "Braided", "Sticky"], nouns: ["Ball of String", "Length of Twine", "Copper Wire", "Shoelace", "Ribbon", "Wick", "Lock of Hair"] }
    ],
    trinket: {
        nouns: ["Ring", "Animal Figurine", "Bead", "Button", "Comb", "Whistle", "Locket", "Thimble", "Brooch", "Cameo", "Coin", "Pendant", "Earring", "Bangle"],
        suffixes: ["engraved with a name", "that feels warm", "missing a piece", "stained with ink", "smelling of sulfur", "wrapped in twine", "depicting a skull", "from a foreign land", "with a hidden compartment", "covered in runes"],
        cheap: { materials: ["Wooden", "Clay", "Pewter", "Bone", "Rusted Iron", "Chipped Ceramic", "Soapstone", "Leather", "Rough Copper", "Tin", "Carved Stone"], values: ["1 cp", "5 cp", "8 cp", "2 sp", "5 sp"] },
        fancy: { materials: ["Silver-inlaid", "Carved Ivory", "Polished Jade", "Gilded", "Crystal", "Obsidian", "Clockwork", "Alabaster", "Ancient Bronze", "Mahogany", "Electrum"], values: ["1 gp", "2 gp", "3 gp", "5 gp"] }
    }
};

// --- INITIALIZATION ---
function init() {
    const saved = localStorage.getItem('gmDashboardData');
    if (saved) {
        try {
            gmData = sanitizeGMData(JSON.parse(saved));
        } catch (err) {
            console.error('Failed to parse gmDashboardData; using defaults.', err);
            gmData = sanitizeGMData(DEFAULT_GM_DATA);
        }
    } else {
        gmData = sanitizeGMData(gmData);
    }
    document.getElementById('webhookUrl').value = gmData.webhook || '';
    document.getElementById('discordActive').checked = gmData.discordActive || false;
    document.getElementById('scratchpad').value = gmData.scratchpad || '';
    document.getElementById('rollLevel').value = gmData.rollLevel || 1;

    updateBonuses();
    renderCombat();
    renderConditions();
    if (!gmData.bestiary) gmData.bestiary = [];
    renderBestiary();
}

function exportGM() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gmData));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "gm_dashboard_" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
}

function importGM() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = e => {
        const target = e && e.target ? e.target : null;
        const file = target && target.files && target.files[0] ? target.files[0] : null;
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const payload = event && event.target ? event.target.result : '';
                if (typeof payload !== 'string') {
                    alert("Error loading JSON");
                    return;
                }
                const loaded = JSON.parse(payload);
                if (!loaded || typeof loaded !== 'object') {
                    alert("Error loading JSON");
                    return;
                }
                if (confirm("Overwrite data?")) {
                    gmData = sanitizeGMData(loaded);
                    saveGM();
                    location.reload();
                }
            } catch (e) { alert("Error loading JSON"); }
        };
        reader.onerror = () => alert("Error loading JSON");
        reader.readAsText(file);
    };
    input.click();
}

function saveGM() {
    gmData.webhook = document.getElementById('webhookUrl').value;
    gmData.discordActive = document.getElementById('discordActive').checked;
    gmData.scratchpad = document.getElementById('scratchpad').value;
    gmData.rollLevel = parseInt(document.getElementById('rollLevel').value) || 1;
    gmData = sanitizeGMData(gmData);
    localStorage.setItem('gmDashboardData', JSON.stringify(gmData));
}

// --- ROLLER LOGIC ---
function getPB(level) {
    return Math.ceil(1 + (level / 4));
}

function updateBonuses() {
    const lvl = parseInt(document.getElementById('rollLevel').value) || 1;
    const pb = getPB(lvl);

    document.getElementById('pbDisplay').innerText = `PB: +${pb}`;

    // Calculate with Luck included!
    const calc = (base) => {
        const val = base + luckMode;
        return (val >= 0 ? '+' : '') + val;
    };

    document.getElementById('bonus-inc').innerText = calc(-1);
    document.getElementById('bonus-comp').innerText = calc(pb);
    document.getElementById('bonus-tal').innerText = calc(pb + 2);
    document.getElementById('bonus-exp').innerText = calc((pb * 2) + 2);
    document.getElementById('bonus-mas').innerText = calc((pb * 2) + 5);

    saveGM();
}

function setMode(mode) {
    rollMode = mode;
    document.querySelectorAll('.toggle-btn[data-mode]').forEach(b => b.classList.remove('active'));
    document.querySelector(`.toggle-btn[data-mode="${mode}"]`).classList.add('active');
}

function setLuck(luckStr) {
    if (luckStr === 'bad') luckMode = -1;
    else if (luckStr === 'good') luckMode = 1;
    else luckMode = 0;

    document.querySelectorAll('.toggle-btn[data-luck]').forEach(b => b.classList.remove('active'));
    document.querySelector(`.toggle-btn[data-luck="${luckStr}"]`).classList.add('active');

    updateBonuses();
}

// SHARED ROLL FUNCTION
function performRoll(bonus, reasonText) {
    const name = document.getElementById('adhocName').value || "GM";

    let rolls = [];
    let rawResult = 0;
    let formula = "";
    const r1 = Math.floor(Math.random() * 20) + 1;

    if (rollMode === 'norm') {
        rolls = [r1];
        rawResult = r1;
        formula = `[${r1}]`;
    } else {
        const r2 = Math.floor(Math.random() * 20) + 1;
        rolls = [r1, r2];
        if (rollMode === 'adv') {
            rawResult = Math.max(r1, r2);
            formula = `[${r1}, ${r2}] (ADV)`;
        } else {
            rawResult = Math.min(r1, r2);
            formula = `[${r1}, ${r2}] (DIS)`;
        }
    }

    const total = rawResult + bonus;
    if (bonus !== 0) formula += ` ${bonus >= 0 ? '+' : ''}${bonus}`;

    // UI Update
    document.getElementById('rollLabel').innerText = `${name} - ${reasonText}`;
    document.getElementById('rollVal').innerText = total;
    document.getElementById('rollFormula').innerText = formula;

    // Discord
    if (gmData.discordActive && gmData.webhook) {
        const isSecret = document.getElementById('secretRoll').checked;
        let content = `**${total}**\n${formula}`;
        if (isSecret) content = `||${content}||`;

        let color = 16777215; // White
        if (total >= 20) color = 3066993; // Green
        else if (total <= 5) color = 15158332; // Red

        sendDiscord(name, reasonText, content, isSecret ? 3447003 : color);
    }
}

function rollTier(tier) {
    const reasonInput = document.getElementById('adhocReason').value;
    const lvl = parseInt(document.getElementById('rollLevel').value) || 1;
    const pb = getPB(lvl);

    let baseBonus = 0;
    let tierLabel = "";

    switch (tier) {
        case 'crap': baseBonus = -1; tierLabel = "Crap"; break;
        case 'competent': baseBonus = pb; tierLabel = "Competent"; break;
        case 'talented': baseBonus = pb + 2; tierLabel = "Talented"; break;
        case 'expert': baseBonus = (pb * 2) + 2; tierLabel = "Expert"; break;
        case 'master': baseBonus = (pb * 2) + 5; tierLabel = "Master"; break;
    }

    // Apply Luck here mathematically
    const finalBonus = baseBonus + luckMode;

    // Clean Log Logic: Use input if available, else fallback to Tier Name
    const reason = reasonInput || tierLabel;

    performRoll(finalBonus, reason);
}

function rollManual() {
    const val = document.getElementById('manualBonus').value;
    const bonus = parseInt(val) || 0;
    const reasonInput = document.getElementById('adhocReason').value;
    const reason = reasonInput || "Manual Roll";

    performRoll(bonus, reason);
}

function sendDiscord(name, title, desc, color) {
    const payload = {
        embeds: [{
            author: { name: name },
            title: title,
            description: desc,
            color: color
        }]
    };
    fetch(gmData.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(console.error);
}

function updateDC(val) {
    const diffs = { 5: "Very Easy", 10: "Easy", 15: "Medium", 20: "Hard", 25: "Very Hard", 30: "Nearly Impossible" };
    document.getElementById('dcDisplay').innerText = "DC " + val;
    document.getElementById('dcDesc').innerText = diffs[val] || "Custom";
}

// --- COMBAT FUNCTIONS ---
function sortCombat() {
    gmData.combatants.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return b.tie - a.tie;
    });
}

function addSingle() {
    const name = document.getElementById('addName').value || "Enemy";
    const initVal = parseFloat(document.getElementById('addInit').value) || 0;
    const dexScore = parseInt(document.getElementById('addDex').value) || 10;
    const hp = document.getElementById('addHP').value;

    gmData.combatants.push({
        id: Date.now(),
        name: name,
        total: initVal,
        tie: dexScore,
        hp: hp ? parseInt(hp) : null,
        maxHp: hp ? parseInt(hp) : null
    });

    document.getElementById('addName').value = "";
    document.getElementById('addInit').value = "";

    sortCombat();
    saveGM();
    renderCombat();
}

function genMobs() {
    const baseName = document.getElementById('mobName').value || "Mob";
    const count = parseInt(document.getElementById('mobCount').value) || 1;
    const mod = parseInt(document.getElementById('mobInitMod').value) || 0;
    const score = parseInt(document.getElementById('mobDexScore').value) || 10;
    const hp = parseInt(document.getElementById('mobHP').value) || 0;

    for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * 20) + 1;
        const total = roll + mod;
        const name = count > 1 ? `${baseName} ${i + 1}` : baseName;

        gmData.combatants.push({
            id: Date.now() + i,
            name: name,
            total: total,
            tie: score,
            hp: hp > 0 ? hp : null,
            maxHp: hp > 0 ? hp : null
        });
    }

    sortCombat();
    saveGM();
    renderCombat();
    const mobBody = document.getElementById('mobBody');
    if (mobBody) mobBody.classList.remove('open');
}

function toggleMobBody() {
    const mobBody = document.getElementById('mobBody');
    if (!mobBody) return;
    mobBody.classList.toggle('open');
}

function renderCombat() {
    const list = document.getElementById('combatList');
    document.getElementById('roundVal').innerText = gmData.round;

    list.innerHTML = gmData.combatants.map((c, i) => {
        const activeClass = (i === gmData.activeIdx) ? 'active' : '';
        const safeTotal = Number.isFinite(Number(c.total)) ? Number(c.total) : 0;
        const safeTie = Number.isFinite(Number(c.tie)) ? Number(c.tie) : 0;
        const safeName = escapeHtml(c.name || 'Combatant');
        let hpHtml = '';
        if (c.hp !== null) {
            const safeHp = Number.isFinite(Number(c.hp)) ? Number(c.hp) : 0;
            const safeMaxHp = Number.isFinite(Number(c.maxHp)) ? Number(c.maxHp) : 0;
            const bloodiedClass = (safeMaxHp > 0 && safeHp <= safeMaxHp / 2) ? 'hp-bloodied' : 'hp-healthy';
            hpHtml = `
                    <div class="hp-controls">
                        <button class="btn-dmg-qs" data-onclick="modHP(${i}, -1)">-1</button>
                        <button class="btn-dmg-qs" data-onclick="modHP(${i}, -5)">-5</button>
                        <div class="hp-display ${bloodiedClass}" data-onclick="setHP(${i})">${safeHp}</div>
                    </div>
                `;
        }

        return `
            <div class="combat-item ${activeClass}">
                <div class="init-box">
                    <div class="init-val">${safeTotal}</div>
                    <div class="init-tie">.${safeTie}</div>
                </div>
                <div class="name-box">
                    <div class="name-main">${safeName}</div>
                    ${activeClass ? '<div class="name-meta name-meta-active">Taking Turn...</div>' : ''}
                </div>
                <div class="combat-actions">
                    ${hpHtml}
                    <button class="btn-del" data-onclick="delCombatant(${i})">&times;</button>
                </div>
            </div>
            `;
    }).join('');
}

function nextTurn() {
    if (gmData.combatants.length === 0) return;
    gmData.activeIdx++;
    if (gmData.activeIdx >= gmData.combatants.length) {
        gmData.activeIdx = 0;
        gmData.round++;
    }
    saveGM();
    renderCombat();
    setTimeout(() => {
        const activeEl = document.querySelector('.combat-item.active');
        if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

function prevTurn() {
    if (gmData.combatants.length === 0) return;
    gmData.activeIdx--;
    if (gmData.activeIdx < 0) {
        gmData.activeIdx = gmData.combatants.length - 1;
        gmData.round = Math.max(1, gmData.round - 1);
    }
    saveGM();
    renderCombat();
}

function clearCombat() {
    if (confirm("Clear Tracker?")) {
        gmData.combatants = [];
        gmData.round = 1;
        gmData.activeIdx = 0;
        saveGM();
        renderCombat();
    }
}

function delCombatant(i) {
    gmData.combatants.splice(i, 1);
    if (gmData.activeIdx >= gmData.combatants.length) gmData.activeIdx = 0;
    saveGM();
    renderCombat();
}

function modHP(i, delta) {
    if (gmData.combatants[i].hp !== null) {
        gmData.combatants[i].hp += delta;
        saveGM(); renderCombat();
    }
}

function setHP(i) {
    const val = prompt("Set HP:", gmData.combatants[i].hp);
    if (val !== null) {
        gmData.combatants[i].hp = parseInt(val);
        saveGM(); renderCombat();
    }
}

// --- REFERENCE & LOOT ---
function renderConditions() {
    const div = document.getElementById('conditionsList');
    div.innerHTML = Object.keys(conditions).map(k => `
            <div>
                <button class="accordion-btn" data-onclick="toggleConditionBody(this)">${k}</button>
                <div class="accordion-body">
                    <span class="cond-tag">${k.toUpperCase()}</span> ${conditions[k]}
                </div>
            </div>
        `).join('');
}

function toggleConditionBody(buttonEl) {
    const bodyEl = buttonEl ? buttonEl.nextElementSibling : null;
    if (bodyEl) bodyEl.classList.toggle('show');
}

function genLoot(type) {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const qtyInput = document.getElementById('lootQty');
    const qtyCount = qtyInput ? parseInt(qtyInput.value) : 1;
    const qty = Math.min(10, Math.max(1, qtyCount || 1));
    const multCheck = document.getElementById('valueMultiplier');
    const multiplier = multCheck ? multCheck.checked : false;
    let results = [];

    for (let i = 0; i < qty; i++) {
        let item = "";
        if (type === 'pocket') {
            const category = pick(lootTables.pocket);
            const adj = pick(category.adjs);
            const noun = pick(category.nouns);
            item = `${adj} ${noun} (Worthless)`;
        }
        else if (type === 'trinket') {
            const noun = pick(lootTables.trinket.nouns);
            const suffix = Math.random() > 0.5 ? " " + pick(lootTables.trinket.suffixes) : "";

            let material, value;
            if (multiplier) {
                const matType = pick(["Jade", "Silver", "Gold", "Platinum"]);
                material = `Masterwork ${matType}`;
                value = "50 gp";
            } else {
                const isFancy = Math.random() < 0.4;
                const tier = isFancy ? lootTables.trinket.fancy : lootTables.trinket.cheap;
                material = pick(tier.materials);
                value = pick(tier.values);
            }
            item = `${material} ${noun}${suffix} (${value})`;
        }
        results.push(item);
    }

    // Always show numbering if more than 1 item
    let resultText = "";
    if (results.length > 1) {
        resultText = results.map((res, idx) => `${idx + 1}. ${res}`).join('\n');
    } else if (results.length === 1) {
        resultText = results[0];
    } else {
        resultText = "No items generated.";
    }

    const el = document.getElementById('lootResult');
    if (el) {
        el.style.opacity = 0;
        setTimeout(() => {
            el.innerText = resultText;
            el.style.opacity = 1;
        }, 100);
    }
}

function switchTab(id, triggerEvent) {
    document.querySelectorAll('.container').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (triggerEvent && triggerEvent.currentTarget) {
        triggerEvent.currentTarget.classList.add('active');
    }
}

init();
