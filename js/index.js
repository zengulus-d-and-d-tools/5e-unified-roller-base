let isPopulating = false; // Guard to prevent saving during initial load
const stats = ['str',
    'dex',
    'con',
    'int',
    'wis',
    'cha'];

const skillsMap = {
    'acrobatics': 'dex', 'animal handling': 'wis', 'arcana': 'int', 'athletics': 'str',
    'deception': 'cha', 'history': 'int', 'insight': 'wis', 'intimidation': 'cha',
    'investigation': 'int', 'medicine': 'wis', 'nature': 'int', 'perception': 'wis',
    'performance': 'cha', 'persuasion': 'cha', 'religion': 'int', 'sleight of hand': 'dex',
    'stealth': 'dex', 'survival': 'wis'
}

    ;

const spellSlotTable = {
    full: [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
    [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]],
    pact: [[1], [2], [2], [2], [2], [2], [2], [2], [2], [2],
    [3], [3], [3], [3], [3], [3], [4], [4], [4], [4]]
}

    ;

let allData = {

    activeId: 'char_default',
    characters: {}
}

    ;

let data = {}

    ;

let consumeInspirationOnNextRoll = false;
let secretMode = false;
let rollerOffsetRaf = null;
const STORAGE_KEYS = {
    current: 'unifiedSheetData.json',
    legacy: ['unifiedSheetDataV3', 'unifiedSheetDataV2']
}

    ;

function updateRollerStickyOffset() {
    const hero = document.getElementById('rollerBar');
    const root = document.documentElement;
    if (!hero || !root) return;
    const styles = getComputedStyle(hero);
    const marginBottom = parseFloat(styles.marginBottom) || 0;
    const offset = hero.offsetHeight + marginBottom + 12;
    root.style.setProperty('--roller-stick-offset', `${offset}px`);
}

function queueRollerStickyOffset() {
    if (rollerOffsetRaf) cancelAnimationFrame(rollerOffsetRaf);
    rollerOffsetRaf = requestAnimationFrame(() => {
        rollerOffsetRaf = null;
        updateRollerStickyOffset();
    });
}

window.addEventListener('resize', queueRollerStickyOffset);
window.addEventListener('orientationchange', queueRollerStickyOffset);
window.addEventListener('load', queueRollerStickyOffset);
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', queueRollerStickyOffset);
    window.visualViewport.addEventListener('scroll', queueRollerStickyOffset);
}
queueRollerStickyOffset();

const delegatedHandlerEvents = [
    'click',
    'change',
    'input',
    'keydown',
    'dragstart',
    'dragend',
    'dragover',
    'dragleave',
    'drop'
];
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

function applySheetFlipState(isFlipped) {
    if (!data.uiState) data.uiState = {}

        ;
    const flipper = document.getElementById('sheetFlipper');
    const btn = document.getElementById('btnFlipSheet');
    const nextVal = !!isFlipped;
    if (flipper) flipper.classList.toggle('flipped', nextVal);
    if (btn) btn.setAttribute('aria-pressed', nextVal ? 'true' : 'false');
    data.uiState.isFlipped = nextVal;
}

function toggleSheetFlip() {
    const current = data && data.uiState ? !!data.uiState.isFlipped : false;
    applySheetFlipState(!current);
    save();
}

// --- ACCORDION LOGIC ---
function toggleSection(key) {
    const head = document.getElementById('head-' + key);
    const body = document.getElementById('body-' + key);
    const card = document.getElementById('card-' + key);
    const trigger = head ? head.querySelector('.accordion-trigger-abs') : null;

    if (head) head.classList.toggle('collapsed');
    if (body) body.classList.toggle('collapsed');
    if (trigger) trigger.classList.toggle('collapsed');

    const isOpen = !body.classList.contains('collapsed');

    if (isOpen) {
        if (card) card.classList.remove('card-collapsed');
    }

    else {
        if (card) card.classList.add('card-collapsed');
    }

    data.uiState[key] = isOpen;
    save();
}

function toggleAccordion(trigger) {
    trigger.classList.toggle('collapsed');
    const content = trigger.parentElement.nextElementSibling;

    if (content) {
        content.classList.toggle('collapsed');
        const card = trigger.closest('.card');

        if (card) {
            if (content.classList.contains('collapsed')) card.classList.add('card-collapsed');
            else card.classList.remove('card-collapsed');
        }
    }
}

function getDefaultInventory() {
    return {

        containers: {},
        items: {},
        looseItems: [],
        rootOrder: []
    }

        ;
}

function sanitizeInventoryToken(value, prefix = 'id') {
    const raw = String(value || '').trim();
    const cleaned = raw.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
    if (!cleaned || cleaned === '__proto__' || cleaned === 'prototype' || cleaned === 'constructor') {
        return generateInventoryId(prefix);
    }
    return cleaned;
}

function ensureInventoryStructure(charData) {
    if (!charData) return;
    if (!charData.inventory || typeof charData.inventory !== 'object' || Array.isArray(charData.inventory)) {
        charData.inventory = getDefaultInventory();
    }

    const inv = charData.inventory;
    if (!inv.containers || typeof inv.containers !== 'object' || Array.isArray(inv.containers)) inv.containers = {};
    if (!inv.items || typeof inv.items !== 'object' || Array.isArray(inv.items)) inv.items = {};
    if (!Array.isArray(inv.looseItems)) inv.looseItems = [];
    if (!Array.isArray(inv.rootOrder)) inv.rootOrder = [];

    const containerIdMap = Object.create(null);
    const itemIdMap = Object.create(null);
    const normalizedContainers = Object.create(null);
    const normalizedItems = Object.create(null);
    const usedContainerIds = new Set();
    const usedItemIds = new Set();

    const reserveUniqueId = (value, prefix, usedSet) => {
        const base = sanitizeInventoryToken(value, prefix);
        let candidate = base;
        let suffix = 1;
        while (usedSet.has(candidate)) {
            const suffixText = `_${suffix++}`;
            const maxBaseLen = Math.max(1, 80 - suffixText.length);
            candidate = `${base.slice(0, maxBaseLen)}${suffixText}`;
        }
        usedSet.add(candidate);
        return candidate;
    };

    Object.keys(inv.containers).forEach((key) => {
        const container = inv.containers[key];
        if (!container || typeof container !== 'object') return;
        const sourceId = container.id || key;
        const safeId = reserveUniqueId(sourceId, 'container', usedContainerIds);
        containerIdMap[String(key)] = safeId;
        containerIdMap[String(sourceId)] = safeId;
        normalizedContainers[safeId] = container;
    });
    inv.containers = normalizedContainers;

    Object.keys(inv.items).forEach((key) => {
        const item = inv.items[key];
        if (!item || typeof item !== 'object') return;
        const sourceId = item.id || key;
        const safeId = reserveUniqueId(sourceId, 'item', usedItemIds);
        itemIdMap[String(key)] = safeId;
        itemIdMap[String(sourceId)] = safeId;
        normalizedItems[safeId] = item;
    });
    inv.items = normalizedItems;

    Object.keys(inv.containers).forEach((id) => {
        const container = inv.containers[id];
        container.id = id;
        container.name = sanitizeString(container.name || 'Container', 'Container', 160);

        const rawParentId = container.parentId === null || container.parentId === undefined
            ? null
            : String(container.parentId);
        container.parentId = rawParentId ? (containerIdMap[rawParentId] || null) : null;

        const rawItems = Array.isArray(container.items) ? container.items : [];
        const rawChildren = Array.isArray(container.children) ? container.children : [];
        container.items = rawItems
            .map((itemId) => itemIdMap[String(itemId)] || null)
            .filter(Boolean);
        container.children = rawChildren
            .map((childId) => containerIdMap[String(childId)] || null)
            .filter((childId) => !!childId && childId !== id);
    });

    Object.keys(inv.items).forEach((id) => {
        const item = inv.items[id];
        item.id = id;
        item.name = sanitizeString(item.name || 'New Item', 'New Item', 160);
        const rawContainerId = item.containerId === null || item.containerId === undefined
            ? null
            : String(item.containerId);
        item.containerId = rawContainerId ? (containerIdMap[rawContainerId] || null) : null;
        const parsedQty = parseInt(item.quantity, 10);
        item.quantity = Number.isFinite(parsedQty) ? Math.max(0, parsedQty) : 1;
    });

    inv.rootOrder = inv.rootOrder
        .map((id) => containerIdMap[String(id)] || null)
        .filter(Boolean);
    inv.looseItems = inv.looseItems
        .map((id) => itemIdMap[String(id)] || null)
        .filter(Boolean);

    inv.rootOrder = inv.rootOrder.filter((id, idx, arr) => inv.containers[id] && !inv.containers[id].parentId && arr.indexOf(id) === idx);
    inv.looseItems = inv.looseItems.filter((id, idx, arr) => inv.items[id] && !inv.items[id].containerId && arr.indexOf(id) === idx);

    Object.values(inv.containers).forEach(container => {
        container.items = container.items.filter((itemId, idx, arr) => inv.items[itemId] && inv.items[itemId].containerId === container.id && arr.indexOf(itemId) === idx);
        container.children = container.children.filter((childId, idx, arr) => inv.containers[childId] && inv.containers[childId].parentId === container.id && arr.indexOf(childId) === idx);
    });

    Object.values(inv.containers).forEach(container => {
        if (!container.parentId && !inv.rootOrder.includes(container.id)) inv.rootOrder.push(container.id);
    });

    Object.values(inv.items).forEach(item => {
        if (item.containerId) {
            const parent = inv.containers[item.containerId];
            if (parent && !parent.items.includes(item.id)) parent.items.push(item.id);
        }

        else {
            item.containerId = null;
            if (!inv.looseItems.includes(item.id)) inv.looseItems.push(item.id);
        }
    });
}

// --- CHARACTER SWITCHING LOGIC ---
function getDefaultChar() {
    let char = {
        meta: {
            player: '', name: 'New Character', level: 1, casterType: 'none', webhook: '', discordActive: false, init: 0, speed: ''
        }

        ,
        vitals: {

            curr: '',
            max: '',
            temp: '',
            hdDie: 'd8',
            hdCurr: 1,
            hdMax: 1,
            inspiration: 0,
            ds: {
                s1: false, s2: false, s3: false, f1: false, f2: false, f3: false
            }
        }

        ,
        ac: {
            mode: 'std', dexCap: '100', base: 10, bonus: 0, customStat1: 'dex', customStat2: 'none', bonuses: []
        }

        ,
        stats: {
            str: {
                val: 10, save: false
            }

            ,
            dex: {
                val: 10, save: false
            }

            ,
            con: {
                val: 10, save: false
            }

            ,
            int: {
                val: 10, save: false
            }

            ,
            wis: {
                val: 10, save: false
            }

            ,
            cha: {
                val: 10, save: false
            }
        }

        ,
        skills: {}

        ,
        skillOverrides: {}

        ,
        skillMisc: {}

        ,
        // NEW: Store manual skill bonuses
        attacks: [],
        features: [],
        spells: [],
        resources: [],
        rollMode: 'norm',
        uiState: {
            cardOrder: []
        },
        inventory: getDefaultInventory()
    }

        ;
    Object.keys(skillsMap).forEach(s => char.skills[s] = 0);

    for (let i = 1; i <= 9; i++) char.spells.push({
        lvl: i, max: 0, used: 0
    });
    return char;
}

function createDefaultAllData() {
    const id = 'char_default';

    const base = {

        activeId: id,
        characters: {}
    }

        ;
    base.characters[id] = getDefaultChar();
    return base;
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeString(value, fallback = '', maxLen = 5000) {
    const text = typeof value === 'string' ? value : fallback;
    return text.slice(0, maxLen);
}

function sanitizeNumber(value, fallback = 0, min = -Infinity, max = Infinity) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function sanitizeBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    return fallback;
}

function sanitizeCharacterData(rawChar) {
    const source = isPlainObject(rawChar) ? rawChar : {};
    const out = getDefaultChar();

    if (isPlainObject(source.meta)) {
        out.meta = { ...out.meta, ...source.meta };
    }
    out.meta.player = sanitizeString(out.meta.player, '', 120);
    out.meta.name = sanitizeString(out.meta.name, 'New Character', 120);
    out.meta.level = Math.round(sanitizeNumber(out.meta.level, 1, 1, 20));
    out.meta.casterType = ['none', 'full', 'half', 'third', 'pact'].includes(out.meta.casterType)
        ? out.meta.casterType
        : 'none';
    out.meta.webhook = sanitizeString(out.meta.webhook, '', 2000);
    out.meta.discordActive = sanitizeBoolean(out.meta.discordActive, false);
    out.meta.init = sanitizeString(String(out.meta.init ?? ''), '', 24);
    out.meta.speed = sanitizeString(String(out.meta.speed ?? ''), '', 24);

    if (isPlainObject(source.vitals)) out.vitals = { ...out.vitals, ...source.vitals };
    out.vitals.curr = sanitizeNumber(out.vitals.curr, 0, 0, 999999);
    out.vitals.max = sanitizeNumber(out.vitals.max, 0, 0, 999999);
    out.vitals.temp = sanitizeNumber(out.vitals.temp, 0, 0, 999999);
    out.vitals.hdDie = sanitizeString(out.vitals.hdDie || 'd8', 'd8', 12);
    out.vitals.hdCurr = sanitizeNumber(out.vitals.hdCurr, 1, 0, 999);
    out.vitals.hdMax = sanitizeNumber(out.vitals.hdMax, 1, 0, 999);
    out.vitals.inspiration = sanitizeNumber(out.vitals.inspiration, 0, 0, 99);
    if (!isPlainObject(out.vitals.ds)) out.vitals.ds = {};
    out.vitals.ds = {
        s1: sanitizeBoolean(out.vitals.ds.s1, false),
        s2: sanitizeBoolean(out.vitals.ds.s2, false),
        s3: sanitizeBoolean(out.vitals.ds.s3, false),
        f1: sanitizeBoolean(out.vitals.ds.f1, false),
        f2: sanitizeBoolean(out.vitals.ds.f2, false),
        f3: sanitizeBoolean(out.vitals.ds.f3, false)
    };
    if (!isPlainObject(out.vitals.hpAutoState)) out.vitals.hpAutoState = {};
    out.vitals.hpAutoState = {
        enabled: sanitizeBoolean(out.vitals.hpAutoState.enabled, false),
        bonus: sanitizeNumber(out.vitals.hpAutoState.bonus, 0, -100, 100)
    };

    if (isPlainObject(source.ac)) out.ac = { ...out.ac, ...source.ac };
    out.ac.mode = out.ac.mode === 'custom' ? 'custom' : 'std';
    out.ac.dexCap = sanitizeNumber(out.ac.dexCap, 100, 0, 100);
    out.ac.base = sanitizeNumber(out.ac.base, 10, 0, 99);
    out.ac.bonus = sanitizeNumber(out.ac.bonus, 0, -50, 50);
    out.ac.customStat1 = stats.includes(out.ac.customStat1) ? out.ac.customStat1 : 'dex';
    out.ac.customStat2 = (out.ac.customStat2 === 'none' || stats.includes(out.ac.customStat2)) ? out.ac.customStat2 : 'none';
    out.ac.bonuses = Array.isArray(out.ac.bonuses) ? out.ac.bonuses.slice(0, 40).map((entry, idx) => {
        const row = isPlainObject(entry) ? entry : {};
        return {
            id: sanitizeString(String(row.id ?? `bonus_${idx}`), `bonus_${idx}`, 80),
            name: sanitizeString(row.name || '', '', 120),
            val: sanitizeNumber(row.val, 0, -50, 50),
            active: sanitizeBoolean(row.active, true)
        };
    }) : [];

    if (isPlainObject(source.stats)) {
        stats.forEach((key) => {
            if (isPlainObject(source.stats[key])) {
                out.stats[key] = { ...out.stats[key], ...source.stats[key] };
            }
        });
    }
    stats.forEach((key) => {
        out.stats[key].val = sanitizeNumber(out.stats[key].val, 10, 1, 30);
        out.stats[key].save = sanitizeBoolean(out.stats[key].save, false);
    });

    if (isPlainObject(source.skills)) {
        Object.keys(skillsMap).forEach((skill) => {
            out.skills[skill] = sanitizeNumber(source.skills[skill], 0, 0, 2);
        });
    }
    if (isPlainObject(source.skillOverrides)) {
        out.skillOverrides = {};
        Object.keys(source.skillOverrides).forEach((skill) => {
            const override = source.skillOverrides[skill];
            if (!Object.prototype.hasOwnProperty.call(skillsMap, skill)) return;
            if (!stats.includes(override)) return;
            out.skillOverrides[skill] = override;
        });
    }
    if (isPlainObject(source.skillMisc)) {
        out.skillMisc = {};
        Object.keys(source.skillMisc).forEach((skill) => {
            if (!Object.prototype.hasOwnProperty.call(skillsMap, skill)) return;
            out.skillMisc[skill] = sanitizeString(source.skillMisc[skill], '', 24).toLowerCase();
        });
    }

    out.attacks = Array.isArray(source.attacks) ? source.attacks.slice(0, 100).map((entry) => {
        const row = isPlainObject(entry) ? entry : {};
        const stat = stats.includes(row.stat) ? row.stat : 'none';
        return {
            name: sanitizeString(row.name || '', '', 160),
            dmg: sanitizeString(row.dmg || '', '', 120),
            stat,
            desc: sanitizeString(row.desc || '', '', 5000)
        };
    }) : [];

    out.features = Array.isArray(source.features) ? source.features.slice(0, 200).map((entry) => {
        const row = isPlainObject(entry) ? entry : {};
        return {
            name: sanitizeString(row.name || '', '', 200),
            desc: sanitizeString(row.desc || '', '', 10000)
        };
    }) : [];

    const rawSpells = Array.isArray(source.spells) ? source.spells : [];
    out.spells = [];
    for (let i = 1; i <= 9; i += 1) {
        const row = isPlainObject(rawSpells[i - 1]) ? rawSpells[i - 1] : {};
        out.spells.push({
            lvl: i,
            max: sanitizeNumber(row.max, 0, 0, 99),
            used: sanitizeNumber(row.used, 0, 0, 99)
        });
    }

    out.resources = Array.isArray(source.resources) ? source.resources.slice(0, 200).map((entry) => {
        const row = isPlainObject(entry) ? entry : {};
        const display = ['none', 'bar', 'bubble'].includes(row.display) ? row.display : 'none';
        const rest = ['none', 'sr', 'lr'].includes(row.rest) ? row.rest : 'none';
        return {
            name: sanitizeString(row.name || '', '', 160),
            curr: sanitizeNumber(row.curr, 0, 0, 999999),
            max: sanitizeNumber(row.max, 0, 0, 999999),
            display,
            rest,
            rCheck: sanitizeBoolean(row.rCheck, false),
            rFormula: sanitizeString(row.rFormula || '1d6', '1d6', 120)
        };
    }) : [];

    out.rollMode = ['dis', 'norm', 'adv'].includes(source.rollMode) ? source.rollMode : 'norm';
    if (isPlainObject(source.uiState)) {
        out.uiState = { ...out.uiState, ...source.uiState };
    }
    out.uiState.isFlipped = sanitizeBoolean(out.uiState.isFlipped, false);
    out.uiState.cardOrder = Array.isArray(out.uiState.cardOrder) ? out.uiState.cardOrder.slice(0, 200).map((entry) => sanitizeString(entry, '', 120)).filter(Boolean) : [];

    if (isPlainObject(source.inventory)) {
        out.inventory = source.inventory;
    }
    ensureInventoryStructure(out);

    return out;
}

function sanitizeAllDataBundle(rawBundle) {
    const source = isPlainObject(rawBundle) ? rawBundle : {};
    const charsSource = isPlainObject(source.characters) ? source.characters : {};
    const sanitizedChars = Object.create(null);

    let fallbackIdx = 0;
    Object.keys(charsSource).forEach((rawId) => {
        let id = sanitizeString(rawId, '', 80).replace(/[^A-Za-z0-9_-]/g, '');
        if (!id) {
            fallbackIdx += 1;
            id = `char_imported_${fallbackIdx}`;
        }
        if (id === '__proto__' || id === 'prototype' || id === 'constructor') {
            fallbackIdx += 1;
            id = `char_imported_${fallbackIdx}`;
        }
        while (Object.prototype.hasOwnProperty.call(sanitizedChars, id)) {
            fallbackIdx += 1;
            id = `${id}_${fallbackIdx}`;
        }
        sanitizedChars[id] = sanitizeCharacterData(charsSource[rawId]);
    });

    if (!Object.keys(sanitizedChars).length) return createDefaultAllData();

    const requestedActive = sanitizeString(source.activeId || '', '', 80);
    const activeId = Object.prototype.hasOwnProperty.call(sanitizedChars, requestedActive)
        ? requestedActive
        : Object.keys(sanitizedChars)[0];

    return {
        activeId,
        characters: sanitizedChars
    };
}

function wrapSingleCharacterBundle(rawCharacter) {
    const id = `char_imported_${Date.now()}`;
    return {
        activeId: id,
        characters: {
            [id]: rawCharacter
        }
    };
}

function tryParseStoredAllData(raw) {
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        if (!parsed.characters || !parsed.activeId) return null;
        return sanitizeAllDataBundle(parsed);
    }

    catch (e) {
        console.error('Corrupted data payload', e);
        return null;
    }
}

function tryParseLegacyV2(raw) {
    if (!raw) return null;

    try {
        const oldChar = JSON.parse(raw);
        const id = 'char_imported';

        const bundle = {

            activeId: id,
            characters: {}
        }

            ;
        bundle.characters[id] = oldChar;
        return sanitizeAllDataBundle(bundle);
    }

    catch (e) {
        console.error('Corrupted V2 payload', e);
        return null;
    }
}

function refreshCharSelect() {
    const sel = document.getElementById('charSelect');
    sel.innerHTML = '';

    Object.keys(allData.characters).forEach(key => {
        const char = allData.characters[key];
        const opt = document.createElement('option');
        opt.value = key;
        opt.text = (char.meta && char.meta.name) ? char.meta.name : "Unnamed";
        if (key === allData.activeId) opt.selected = true;
        sel.appendChild(opt);
    });
}

function switchCharacter(id) {
    allData.characters[allData.activeId] = data;
    saveGlobal();
    allData.activeId = id;
    loadActiveChar();
}

function createNewCharacter() {
    allData.characters[allData.activeId] = data;
    const newId = 'char_' + Date.now();
    allData.characters[newId] = getDefaultChar();
    allData.activeId = newId;
    saveGlobal();
    loadActiveChar();
}

function deleteCharacter() {
    const ids = Object.keys(allData.characters);

    if (ids.length <= 1) {
        alert("Cannot delete the last character.");
        return;
    }

    if (!confirm("Delete this character permanently?")) return;
    delete allData.characters[allData.activeId];
    allData.activeId = Object.keys(allData.characters)[0];
    saveGlobal();
    loadActiveChar();
}

function loadActiveChar() {
    data = sanitizeCharacterData(allData.characters[allData.activeId]);
    allData.characters[allData.activeId] = data;
    refreshCharSelect();
    populateUI();
}

// --- INITIALIZATION ---
function init() {
    const existing = tryParseStoredAllData(localStorage.getItem(STORAGE_KEYS.current));

    if (existing) allData = existing;

    else {
        let loaded = false;

        for (const legacyKey of STORAGE_KEYS.legacy) {
            const raw = localStorage.getItem(legacyKey);
            if (!raw) continue;

            if (legacyKey === 'unifiedSheetDataV2') {
                const migrated = tryParseLegacyV2(raw);
                if (migrated) {
                    allData = migrated;
                    loaded = true;
                    break;
                }
            }

            else {
                const parsed = tryParseStoredAllData(raw);
                if (parsed) {
                    allData = parsed;
                    loaded = true;
                    break;
                }
            }
        }

        if (!loaded) allData = createDefaultAllData();
        saveGlobal();
    }

    if (!allData.characters[allData.activeId]) {
        const keys = Object.keys(allData.characters);

        if (keys.length > 0) allData.activeId = keys[0];

        else {
            allData = createDefaultAllData();
        }
    }

    loadActiveChar();
    setupDragAndDrop();
}

function populateUI() {
    isPopulating = true;

    if (!data.meta) data.meta = {}

        ;

    if (!data.vitals) data.vitals = {}

        ;

    if (!data.uiState) data.uiState = {}

        ;

    if (!data.skillMisc) data.skillMisc = {}

        ;

    if (!data.skillOverrides) data.skillOverrides = {}

        ;

    ensureInventoryStructure(data);
    applySheetFlipState(data.uiState && data.uiState.isFlipped);

    document.getElementById('playerName').value = data.meta.player || '';
    document.getElementById('charName').value = data.meta.name || '';
    document.getElementById('charLevel').value = data.meta.level || 1;
    document.getElementById('casterType').value = data.meta.casterType || 'none';
    document.getElementById('webhookUrl').value = data.meta.webhook || '';
    document.getElementById('sendToDiscord').checked = data.meta.discordActive || false;

    document.getElementById('initBonus').value = data.meta.init || "+0";
    document.getElementById('speedVal').value = data.meta.speed || '';

    toggleDiscord(data.meta.discordActive);

    // FIX: Use (val !== undefined) check instead of (|| '') to allow 0 to persist
    const safeDisplay = (val) => (val !== undefined && val !== null && !isNaN(val)) ? val : '';
    document.getElementById('hpCurr').value = safeDisplay(data.vitals.curr);
    document.getElementById('hpMax').value = safeDisplay(data.vitals.max);
    document.getElementById('hpTemp').value = safeDisplay(data.vitals.temp);
    document.getElementById('inspirationVal').value = data.vitals.inspiration || 0;

    document.getElementById('hdDie').value = data.vitals.hdDie || 'd8';
    document.getElementById('hdCurr').value = (data.vitals.hdCurr !== undefined) ? data.vitals.hdCurr : 1;
    document.getElementById('hdMax').value = (data.vitals.hdMax !== undefined) ? data.vitals.hdMax : 1;

    if (!data.vitals.ds) data.vitals.ds = {
        s1: false, s2: false, s3: false, f1: false, f2: false, f3: false
    }

        ;
    document.getElementById('ds-s1').checked = data.vitals.ds.s1;
    document.getElementById('ds-s2').checked = data.vitals.ds.s2;
    document.getElementById('ds-s3').checked = data.vitals.ds.s3;
    document.getElementById('ds-f1').checked = data.vitals.ds.f1;
    document.getElementById('ds-f2').checked = data.vitals.ds.f2;
    document.getElementById('ds-f3').checked = data.vitals.ds.f3;

    document.getElementById('acBase').value = data.ac.base || 10;
    document.getElementById('acDexCap').value = data.ac.dexCap || 100;
    document.getElementById('acCustomToggle').checked = (data.ac.mode === 'custom');

    populateStatSelects();
    document.getElementById('acStat1').value = data.ac.customStat1 || 'dex';
    document.getElementById('acStat2').value = data.ac.customStat2 || 'none';

    toggleACMode();
    renderAcList();

    if (data.uiState.cardOrder && data.uiState.cardOrder.length > 0) {
        const container = document.querySelector('.sheet-container');
        const sortedFrag = document.createDocumentFragment();

        data.uiState.cardOrder.forEach(id => {
            const el = document.getElementById(id);
            if (el) sortedFrag.appendChild(el);
        });

        Array.from(container.children).forEach(child => {
            if (child.classList.contains('card') && !data.uiState.cardOrder.includes(child.id)) {
                sortedFrag.appendChild(child);
            }
        });
        container.appendChild(sortedFrag);
    }

    const accKeys = ['combat',
        'attr',
        'atk',
        'feats',
        'spells',
        'skills',
        'roller',
        'io'];

    accKeys.forEach(key => {
        const isClosed = data.uiState[key] === false;
        const card = document.getElementById('card-' + key);

        if (isClosed) {
            document.getElementById('head-' + key).classList.add('collapsed');
            document.getElementById('body-' + key).classList.add('collapsed');
            if (card) card.classList.add('card-collapsed');
        }

        else {
            if (card) card.classList.remove('card-collapsed');
            document.getElementById('head-' + key).classList.remove('collapsed');
            document.getElementById('body-' + key).classList.remove('collapsed');
        }
    });

    updateHP();
    renderStats();
    renderSkills();
    renderAttacks();
    renderFeatures();
    renderSpells();
    renderResources();
    refreshBuffsUI();
    renderInventory();
    updateAll();
    setMode(data.rollMode || 'norm');
    isPopulating = false;
}

function saveGlobal() {
    localStorage.setItem(STORAGE_KEYS.current, JSON.stringify(allData));
}

function save() {
    if (isPopulating) return;
    data.meta.player = document.getElementById('playerName').value;
    data.meta.name = document.getElementById('charName').value;
    data.meta.webhook = document.getElementById('webhookUrl').value;

    // FIX: Convert HP to numbers during save to ensure clean data
    data.vitals.curr = parseInt(document.getElementById('hpCurr').value);
    data.vitals.max = parseInt(document.getElementById('hpMax').value);
    data.vitals.temp = parseInt(document.getElementById('hpTemp').value) || 0;

    data.vitals.inspiration = parseInt(document.getElementById('inspirationVal').value) || 0;
    data.meta.speed = document.getElementById('speedVal').value;
    data.vitals.hdDie = document.getElementById('hdDie').value;
    data.vitals.hdCurr = parseInt(document.getElementById('hdCurr').value) || 0;
    data.vitals.hdMax = parseInt(document.getElementById('hdMax').value) || 0;
    data.meta.casterType = document.getElementById('casterType').value;

    if (document.getElementById('ds-s1')) {
        data.vitals.ds = {
            s1: document.getElementById('ds-s1').checked,
            s2: document.getElementById('ds-s2').checked,
            s3: document.getElementById('ds-s3').checked,
            f1: document.getElementById('ds-f1').checked,
            f2: document.getElementById('ds-f2').checked,
            f3: document.getElementById('ds-f3').checked,
        }

            ;
    }

    const sel = document.getElementById('charSelect');
    const activeOpt = sel.querySelector(`option[value="${allData.activeId}"]`);

    if (activeOpt && activeOpt.text !== data.meta.name) {
        activeOpt.text = data.meta.name || "Unnamed";
    }

    allData.characters[allData.activeId] = data;
    saveGlobal();
}

// --- DICE & LOGIC ---
function toggleSecret() {
    secretMode = !secretMode;
    const btn = document.getElementById('btnSecret');

    if (secretMode) {
        btn.classList.add('active');
        btn.innerHTML = '🙈';
    }

    else {
        btn.classList.remove('active');
        btn.innerHTML = '👁️';
    }
}

function parseRollModifiers(str) {
    let mods = {
        r: 0, dl: 0, kh: 0
    }

        ;
    if (!str) return mods;
    const rMatch = str.match(/r(\d+)/);
    if (rMatch) mods.r = parseInt(rMatch[1]);
    const dlMatch = str.match(/d[l]?(\d+)/);
    if (dlMatch) mods.dl = parseInt(dlMatch[1]);
    const khMatch = str.match(/k[h]?(\d+)/);
    if (khMatch) mods.kh = parseInt(khMatch[1]);
    return mods;
}

// --- BUFFS & VISIBILITY ---
function updateBuffs() {
    data.buffs = {
        bless: document.getElementById('buffBless').checked,
        guidance: document.getElementById('buffGuidance').checked,
        global: document.getElementById('buffGlobal').value
    };
    save();
}

function refreshBuffsUI() {
    if (!data.buffs) data.buffs = { bless: false, guidance: false, global: "" };
    if (document.getElementById('buffBless')) document.getElementById('buffBless').checked = !!data.buffs.bless;
    if (document.getElementById('buffGuidance')) document.getElementById('buffGuidance').checked = !!data.buffs.guidance;
    if (document.getElementById('buffGlobal')) document.getElementById('buffGlobal').value = data.buffs.global || "";
}

function toggleHide(cardId) {
    if (!data.uiState.hidden) data.uiState.hidden = {}

        ;
    const key = 'card-' + cardId;
    data.uiState.hidden[key] = !data.uiState.hidden[key];
    save();
    applyVisibility();
}

function toggleShowHidden(show) {
    data.uiState.showHidden = show;
    save();
    applyVisibility();
}

function applyVisibility() {
    const showAll = document.getElementById('showHiddenCards').checked;
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
        if (card.id === 'card-settings') return;
        // Ensure card has ID to hide
        if (!card.id) return;

        const isHidden = data.uiState.hidden && data.uiState.hidden[card.id];

        if (isHidden && !showAll) {
            card.style.display = 'none';
        }

        else {
            card.style.display = 'flex';
            if (isHidden) card.style.opacity = '0.6';
            else card.style.opacity = '1';

            // Add Eye toggle if missing (except specific cards)
            let header = card.querySelector('.section-title');

            if (header && !header.querySelector('.prof-toggle-abs')) {
                const cleanId = card.id.replace('card-', '');
                const eye = document.createElement('span');
                eye.className = 'prof-toggle-abs';
                eye.innerText = '👁️';

                eye.onclick = (e) => {
                    e.stopPropagation();
                    toggleHide(cleanId);
                };

                header.insertBefore(eye, header.firstChild);
            }
        }
    });

    document.getElementById('showHiddenCards').checked = ! !data.uiState.showHidden;
}

function coreRoll(count, sides, mode = 'norm', mods = {}) {
    let rolls = [];
    let total = 0;
    let isCrit = false;
    let isFail = false;
    let formula = "";

    if (count === 1 && sides === 20 && mode !== 'norm') {
        const r1 = Math.floor(Math.random() * sides) + 1;
        const r2 = Math.floor(Math.random() * sides) + 1;
        rolls = [r1,
            r2];

        if (mode === 'adv') {
            total = Math.max(r1, r2);

            formula = `[${r1
                }

                    ,
                    ${r2
                }

                    ] (High)`;
        }

        else {
            total = Math.min(r1, r2);

            formula = `[${r1
                }

                    ,
                    ${r2
                }

                    ] (Low)`;
        }

        if (total === 20) isCrit = true;
        if (total === 1) isFail = true;
    }

    else {
        let rollObjs = [];

        for (let i = 0; i < count; i++) {
            let r = Math.floor(Math.random() * sides) + 1;

            if (mods.r > 0) {
                let safety = 0;

                while (r <= mods.r && safety < 50) {
                    r = Math.floor(Math.random() * sides) + 1;
                    safety++;
                }
            }

            rollObjs.push({
                val: r, dropped: false, originalIdx: i
            });
        }

        if (mods.dl > 0 || mods.kh > 0) {
            let sorted = [...rollObjs].sort((a, b) => a.val - b.val);
            let dropCount = mods.dl;

            if (mods.kh > 0) {
                let calculatedDrop = count - mods.kh;
                if (calculatedDrop > dropCount) dropCount = calculatedDrop;
            }

            for (let i = 0; i < dropCount; i++) {
                if (sorted[i]) sorted[i].dropped = true;
            }
        }

        let valList = [];

        rollObjs.forEach(obj => {
            if (!obj.dropped) total += obj.val;

            valList.push(obj.dropped ? `~~${obj.val
                }

                        ~~` : obj.val);
        });

        if (count === 1 && sides === 20 && total === 20) isCrit = true;
        if (count === 1 && sides === 20 && total === 1) isFail = true;

        formula = `[${valList.join('+')
            }

            ]`;
    }

    return {
        total,
        rolls: rolls, formula, isCrit, isFail
    }

        ;
}

function rollDie(sides, bonus, label, allowAdvantage = true, type = 'check', customDesc = '') {
    const miscStr = document.getElementById('globalMisc').value.trim();
    const parsedMisc = parseComplexBonus(miscStr);
    let effectiveMode = data.rollMode;
    let consumedInsp = false;

    if (allowAdvantage && consumeInspirationOnNextRoll) {
        effectiveMode = 'adv';
        consumedInsp = true;
    }

    const result = coreRoll(1, sides, allowAdvantage ? effectiveMode : 'norm');

    // --- BUFF LOGIC ---
    let buffTotal = 0;
    let buffText = "";

    if (data.buffs) {
        if (data.buffs.bless && (type === 'atk' || type === 'save')) {
            const r = Math.floor(Math.random() * 4) + 1;
            buffTotal += r;
            buffText += ` +${r}(Bless)`;
        }
        if (data.buffs.guidance && type === 'check') {
            const r = Math.floor(Math.random() * 4) + 1;
            buffTotal += r;
            buffText += ` +${r}(Guidance)`;
        }
        if (data.buffs.global) {
            const parsed = parseComplexBonus(data.buffs.global);
            buffTotal += parsed.total;
            if (parsed.text) buffText += ` +${parsed.text}(Global)`;
        }
    }

    const total = result.total + bonus + parsedMisc.total + buffTotal;
    let formulaText = result.formula;

    if (bonus !== 0) formulaText += ` ${bonus >= 0 ? '+' : ''}${bonus}`;
    if (parsedMisc.total !== 0) formulaText += ` +${parsedMisc.text}(Misc)`;
    formulaText += buffText;

    if (allowAdvantage && effectiveMode !== 'norm') formulaText += ` (${effectiveMode.toUpperCase()})`;

    showLog(formulaText, total, result.isCrit, result.isFail);

    sendToDiscord(label + (effectiveMode !== 'norm' && allowAdvantage ? ` (${effectiveMode.toUpperCase()})` : ''),
        `Dice: ${formulaText}`, `**${total}**`, type, customDesc);

    if (consumedInsp) consumeInspiration();
}

function parseComplexBonus(str) {
    if (!str) return {
        total: 0, text: ''
    }

        ;
    let total = 0;
    let parts = [];
    const diceRegex = /([+-]?)\s*(\d+)d(\d+)\s*([a-z0-9]*)/gi;
    let match;
    let diceMatches = [];

    while ((match = diceRegex.exec(str)) !== null) {
        diceMatches.push(match);
    }

    diceMatches.forEach(m => {
        const sign = (m[1].trim() === '-') ? -1 : 1;
        const count = parseInt(m[2]);
        const sides = parseInt(m[3]);
        const modStr = m[4] || "";

        const mods = parseRollModifiers(modStr);
        const res = coreRoll(count, sides, 'norm', mods);

        total += (res.total * sign);
        const signStr = sign === -1 ? '-' : '+';
        let form = res.formula;

        if (modStr) form += `${modStr
            }

                    `;

        parts.push(`${signStr
            }

                        ${form
            }

                        `);
    });

    let cleanStr = str.replace(diceRegex, '');
    const staticRegex = /([+-]?)\s*(\d+)/gi;

    while ((match = staticRegex.exec(cleanStr)) !== null) {
        const sign = (match[1].trim() === '-') ? -1 : 1;
        const val = parseInt(match[2]);
        total += (val * sign);

        parts.push(`${sign === -1 ? '-' : '+'
            }

                    ${val
            }

                    `);
    }

    return {
        total,
        text: parts.join(' ')
    }

        ;
}

// --- CALCULATION LOGIC ---
function getMod(score) {
    return Math.floor((score - 10) / 2);
}

function getPB(level) {
    return Math.ceil(level / 4) + 1;
}

function updateLevel(val) {
    data.meta.level = Math.min(20, Math.max(1, parseInt(val)));
    save();
    updateAll();
}

function updateAll() {
    const pb = getPB(data.meta.level);

    stats.forEach(s => {
        const mod = getMod(data.stats[s].val);
        const saveBonus = mod + (data.stats[s].save ? pb : 0);

        document.getElementById(`mod-${s}`).innerText = (mod >= 0 ? "+" : "") + mod;

        document.getElementById(`def-${s}`).innerText = 11 + saveBonus;
    });

    Object.keys(skillsMap).forEach(s => {
        const defaultStat = skillsMap[s];
        const activeStat = (data.skillOverrides && data.skillOverrides[s]) ? data.skillOverrides[s] : defaultStat;

        const mod = getMod(data.stats[activeStat].val);
        const profLevel = data.skills[s] || 0;

        // NEW: Add Misc Bonus
        const misc = getSkillMiscBonus(s);

        const bonus = mod + (profLevel * pb) + misc;

        document.getElementById(`skill-bonus-${s}`).innerText = (bonus >= 0 ? "+" : "") + bonus;
    });

    const statsArr = ['int',
        'wis',
        'cha'];
    let maxMod = -5;

    statsArr.forEach(s => {
        const m = getMod(data.stats[s].val); if (m > maxMod) maxMod = m;
    });
    document.getElementById('globalDC').innerText = 8 + pb + maxMod;

    updateAC();
    if (data.vitals && data.vitals.hpAutoState && data.vitals.hpAutoState.enabled) updateHP();
    if (data.vitals.hpAuto) updateHP();
}

// --- AC LOGIC ---
function populateStatSelects() {
    const s1 = document.getElementById('acStat1');
    const s2 = document.getElementById('acStat2');

    const ops = stats.map(s => `<option value="${s}" >${s.toUpperCase()
        }

                </option>`).join('');
    const opsNone = `<option value="none">None</option>` + ops;
    s1.innerHTML = ops;
    s2.innerHTML = opsNone;
}

function toggleACMode() {
    const isCustom = document.getElementById('acCustomToggle').checked;
    data.ac.mode = isCustom ? 'custom' : 'std';
    document.getElementById('acStdControls').style.display = isCustom ? 'none' : 'grid';
    document.getElementById('acCustomControls').style.display = isCustom ? 'grid' : 'none';
    save();
    updateAC();
}

function updateAC() {
    data.ac.base = parseInt(document.getElementById('acBase').value) || 10;
    data.ac.dexCap = parseInt(document.getElementById('acDexCap').value);
    data.ac.customStat1 = document.getElementById('acStat1').value;
    data.ac.customStat2 = document.getElementById('acStat2').value;

    let bonusTotal = 0;

    data.ac.bonuses.forEach(b => {
        if (b.active) bonusTotal += (parseInt(b.val) || 0);
    });

    let total = 0;

    if (data.ac.mode === 'std') {
        const rawDex = getMod(data.stats.dex.val);
        let effectiveDex = rawDex;

        if (data.ac.dexCap !== 100) {
            if (data.ac.dexCap === 0) effectiveDex = 0;
            else effectiveDex = Math.min(rawDex, data.ac.dexCap);
        }

        document.getElementById('acDexModDisp').innerText = (effectiveDex >= 0 ? "+" : "") + effectiveDex;
        total = data.ac.base + effectiveDex + bonusTotal;
    }

    else {
        const m1 = getMod(data.stats[data.ac.customStat1].val);
        let m2 = 0;

        if (data.ac.customStat2 !== 'none') {
            m2 = getMod(data.stats[data.ac.customStat2].val);
        }

        total = 10 + m1 + m2 + bonusTotal;
    }

    document.getElementById('acTotalDisplay').innerText = total;
    save();
}

function renderAcList() {
    const list = document.getElementById('acBonusList');
    list.innerHTML = data.ac.bonuses.map((bonus, i) => {
        const safeName = escapeHtml(bonus && bonus.name ? bonus.name : '');
        const safeVal = Number.isFinite(Number(bonus && bonus.val)) ? Number(bonus.val) : 0;
        const isActive = !!(bonus && bonus.active);
        return ` <div class="ac-row ${isActive ? '' : 'inactive'}" > <label class="toggle-switch" ><input type="checkbox"${isActive ? 'checked' : ''
            }

                data-onchange="toggleAcBonus(${i})" ><span class="slider" ></span></label> <input type="text" value="${safeName}" placeholder="Source (Shield)" data-onchange="updateAcBonus(${i}, 'name', this.value)" > <input type="number" class="ac-val-input" value="${safeVal}" placeholder="+0" data-onchange="updateAcBonus(${i}, 'val', this.value)" > <button class="btn-del js-ml-auto" data-onclick="delAcBonus(${i})" >&times; </button> </div> `;
    }).join('');
}

function addAcBonus() {
    data.ac.bonuses.push({
        id: Date.now(), name: '', val: 1, active: true
    });
    renderAcList();
    updateAC();
}

function toggleAcBonus(i) {
    if (!Array.isArray(data.ac.bonuses) || !data.ac.bonuses[i]) return;
    data.ac.bonuses[i].active = !data.ac.bonuses[i].active;
    renderAcList();
    updateAC();
}

function updateAcBonus(i, field, val) {
    if (!Array.isArray(data.ac.bonuses) || !data.ac.bonuses[i]) return;
    if (field !== 'name' && field !== 'val') return;
    data.ac.bonuses[i][field] = (field === 'val') ? (parseInt(val, 10) || 0) : String(val || '').slice(0, 120);
    updateAC();
}

function delAcBonus(i) {
    data.ac.bonuses.splice(i, 1);
    renderAcList();
    updateAC();
}

// --- HP LOGIC ---
function toggleAutoHP() {
    const el = document.getElementById('hpAutoToggle');
    const cont = document.getElementById('hpBonusContainer');

    if (el && el.checked) {
        if (cont) cont.style.display = 'block';
        updateHP();
    }

    else {
        if (cont) cont.style.display = 'none';

        if (document.getElementById('hpMax')) {
            document.getElementById('hpMax').readOnly = false;
            document.getElementById('hpMax').style.opacity = "1";
        }
    }
}

function updateHP() {
    let curr = parseInt(document.getElementById('hpCurr').value) || 0;
    let maxVal = parseInt(document.getElementById('hpMax').value) || 0;
    const temp = parseInt(document.getElementById('hpTemp').value) || 0;

    // Auto HP
    const autoToggle = document.getElementById('hpAutoToggle');
    const isAuto = autoToggle ? autoToggle.checked : false;

    // Save state
    if (!data.vitals) data.vitals = {}

        ;

    if (!data.vitals.hpAutoState) data.vitals.hpAutoState = {}

        ;
    data.vitals.hpAutoState.enabled = isAuto;
    data.vitals.hpAutoState.bonus = parseInt(document.getElementById('hpBonusPerLevel').value) || 0;

    let calcMax = 0;

    if (isAuto) {
        const lvl = parseInt(data.meta.level) || 1;
        const conVal = parseInt(data.stats.con.val) || 10;
        const conMod = Math.floor((conVal - 10) / 2);

        // Get Die Side from input
        let sides = 8;

        if (document.getElementById('hdDie')) {
            const hdStr = document.getElementById('hdDie').value || "d8";
            sides = parseInt(hdStr.replace(/\D/g, '')) || 8;
        }

        const bonus = data.vitals.hpAutoState.bonus;

        // Avg = sides/2 + 1
        const avg = (sides / 2) + 1;

        // Lvl 1 is Max, others Avg
        calcMax = (sides + conMod + bonus) + ((lvl - 1) * (avg + conMod + bonus));
        calcMax = Math.max(1, calcMax);

        // Update the input if auto is on
        maxVal = calcMax;
        if (document.getElementById('hpMax')) {
            document.getElementById('hpMax').value = maxVal;
        }
    }

    // --- VISUAL BAR UPDATES ---
    let currPct = 0;
    if (maxVal > 0) currPct = (curr / maxVal) * 100;
    if (currPct > 100) currPct = 100;
    if (currPct < 0) currPct = 0;

    let tempPct = 0;
    if (maxVal > 0) tempPct = (temp / maxVal) * 100;
    if (tempPct > 100) tempPct = 100; // Cap temp bar? Or let it overflow? Usually cap for UI.

    if (document.getElementById('barCurr')) document.getElementById('barCurr').style.width = currPct + "%";
    if (document.getElementById('barTemp')) document.getElementById('barTemp').style.width = tempPct + "%";

    if (document.getElementById('barText')) document.getElementById('barText').innerText = `${curr} / ${maxVal}` + (temp > 0 ? ` (+${temp})` : "");

    const dsRow = document.getElementById('deathSaveRow');

    if (dsRow) {
        if (curr <= 0 && maxVal > 0) dsRow.style.display = 'grid';
        else dsRow.style.display = 'none';
    }

    save();
}

// --- HP LOGIC ---


function modifyHP(isDamage, fixedAmt = null) {
    const interactInput = document.getElementById('hpInteractVal');
    let amt = 0;
    if (fixedAmt !== null) amt = fixedAmt;
    else amt = parseInt(interactInput.value) || 0;
    if (amt <= 0) return;

    let curr = parseInt(document.getElementById('hpCurr').value) || 0;
    let max = parseInt(document.getElementById('hpMax').value) || 0;
    let temp = parseInt(document.getElementById('hpTemp').value) || 0;

    if (isDamage) {
        if (temp > 0) {
            if (amt >= temp) {
                amt -= temp;
                temp = 0;
            }

            else {
                temp -= amt;
                amt = 0;
            }
        }

        curr = Math.max(0, curr - amt);
    }

    else {
        curr += amt;
        if (max > 0 && curr > max) curr = max;
    }

    document.getElementById('hpTemp').value = temp;
    document.getElementById('hpCurr').value = curr;
    if (fixedAmt === null) interactInput.value = '';
    updateHP();
}

// --- ROLLING / INSPIRATION / REST ---
function rollHitDie() {
    let currHD = parseInt(document.getElementById('hdCurr').value) || 0;
    const maxHD = parseInt(document.getElementById('hdMax').value) || 0;

    if (currHD <= 0) {
        alert("No Hit Dice remaining!");
        return;
    }

    const dieStr = document.getElementById('hdDie').value || "d8";
    const sides = parseInt(dieStr.replace(/\D/g, '')) || 8;
    const conMod = getMod(data.stats.con.val);

    const result = coreRoll(1, sides);
    const rollVal = result.rolls[0].val;
    const total = Math.max(0, rollVal + conMod);

    let hpCurr = parseInt(document.getElementById('hpCurr').value) || 0;
    const hpMax = parseInt(document.getElementById('hpMax').value) || 0;
    const oldHp = hpCurr;

    hpCurr += total;
    if (hpMax > 0 && hpCurr > hpMax) hpCurr = hpMax;

    currHD--;
    document.getElementById('hpCurr').value = hpCurr;
    document.getElementById('hdCurr').value = currHD;

    updateHP();
    save();

    const formula = `[${rollVal
        }

            ] ${conMod >= 0 ? '+' : ''
        }

            ${conMod
        }

            (Con)`;
    showLog(formula, total);

    sendToDiscord("Short Rest", `Used 1${dieStr
        }

                . Formula: ${formula
        }

                `, `**Healed ${hpCurr - oldHp
    }

                HP**`, 'check');
}

function shortRest() {
    if (!confirm("SHORT REST\n\n- Reset SR Counters?\n(Hit Dice must be rolled manually)")) return;

    data.resources.forEach(r => {
        if (r.rest === 'sr') r.curr = r.max;
    });
    const type = data.meta.casterType || 'none';

    if (type === 'pact') {
        data.spells.forEach(s => s.used = 0);
        showLog("Pact Magic", "Slots Reset");
    }

    save();
    renderResources();
    renderSpells();
    showLog("Short Rest", "Counters Reset");
}

function longRest() {
    if (!confirm("LONG REST\n\n- Reset HP to Max\n- Reset Spell Slots\n- Regain ½ Max Hit Dice\n- Reset Death Saves\n- Reset SR/LR Counters")) return;
    document.getElementById('hpCurr').value = document.getElementById('hpMax').value;
    document.getElementById('hpTemp').value = 0;
    data.spells.forEach(s => s.used = 0);
    let hdCurr = parseInt(document.getElementById('hdCurr').value) || 0;
    const hdMax = parseInt(document.getElementById('hdMax').value) || 0;
    hdCurr = Math.min(hdMax, hdCurr + Math.max(1, Math.floor(hdMax / 2)));
    document.getElementById('hdCurr').value = hdCurr;

    data.vitals.ds = {
        s1: false, s2: false, s3: false, f1: false, f2: false, f3: false
    }

        ;

    data.resources.forEach(r => {
        if (r.rest === 'sr' || r.rest === 'lr') r.curr = r.max;
    });
    save();
    init();
    showLog("Long Rest", "Completed");
}

function useInspiration() {
    let val = parseInt(document.getElementById('inspirationVal').value) || 0;

    if (val <= 0) {
        showLog("No Insp!", "0");
        return;
    }

    val--;
    document.getElementById('inspirationVal').value = val;
    data.vitals.inspiration = val;
    save();
    consumeInspirationOnNextRoll = true;
    setMode('adv');
    document.getElementById('rollerBar').classList.add('insp-active');
    showLog("Inspiration!", "Active");
}

function consumeInspiration() {
    if (consumeInspirationOnNextRoll) {
        consumeInspirationOnNextRoll = false;
        setMode('norm');
        document.getElementById('rollerBar').classList.remove('insp-active');
    }
}

function setMode(mode) {
    data.rollMode = mode;
    save();
    document.querySelectorAll('.mini-btn').forEach(b => {
        if (b.dataset.mode) b.classList.remove('active');
    });
    const target = document.querySelector(`.mini-btn[data-mode="${mode}"]`);
    if (target) target.classList.add('active');
}

function showLog(formula, result, isCrit = false, isFail = false) {
    const logArea = document.querySelector('.mini-log-display');
    if (!logArea) return;
    const formulaEl = logArea.querySelector('.log-formula');
    const resultEl = logArea.querySelector('.log-result');

    if (formulaEl) formulaEl.textContent = formula;
    if (resultEl) {
        resultEl.textContent = result;
        resultEl.className = 'log-result';
        if (isCrit) resultEl.classList.add('crit-text');
        if (isFail) resultEl.classList.add('fail-text');

        resultEl.style.animation = 'none';
        // Force reflow to restart animation
        resultEl.offsetHeight;
        resultEl.style.animation = 'fadeIn 0.2s ease-out';
    }
}


function rollCustom() {
    const formula = document.getElementById('customFormula').value.trim();
    const label = document.getElementById('customLabel').value.trim() || 'Custom Roll';
    const parsed = parseComplexBonus(formula);

    if (parsed.text === '') {
        showLog("Error", "Invalid");
        return;
    }

    showLog(parsed.text, parsed.total);

    sendToDiscord(label + ": " + formula, `Dice: ${parsed.text
        }

                `, `**${parsed.total
    }

                **`, 'dmg');
}

function rollDamage(idx) {
    const atk = data.attacks[idx];
    let mod = 0;

    if (atk.stat !== 'none') {
        mod = getMod(data.stats[atk.stat].val);
    }

    const miscStr = document.getElementById('globalMisc').value.trim();
    const dmgStr = (atk.dmg || "") + " " + miscStr;
    const parsed = parseComplexBonus(dmgStr);
    if (parsed.text === '') return;
    let total = parsed.total + mod;
    let formulaText = parsed.text;

    if (mod !== 0) {
        formulaText += ` ${mod >= 0 ? '+' : ''
            }

                ${mod
            }

                (${atk.stat.toUpperCase()
            })`;
    }

    showLog(formulaText, total);

    sendToDiscord((atk.name || 'Weapon') + " Damage", `Dice: ${formulaText
        }

                `, `**${total
    }

                **`, 'dmg', atk.desc);
}

function rollInitiative() {
    const initStr = document.getElementById('initBonus').value.trim();
    const miscStr = document.getElementById('globalMisc').value.trim();
    data.meta.init = initStr;
    save();

    const dexMod = getMod(data.stats.dex.val);
    const parsedInit = parseComplexBonus(initStr);
    const parsedMisc = parseComplexBonus(miscStr);
    const tieBreaker = data.stats.dex.val / 100;

    let effectiveMode = data.rollMode;
    let consumedInsp = false;

    if (consumeInspirationOnNextRoll) {
        effectiveMode = 'adv';
        consumedInsp = true;
    }

    const result = coreRoll(1, 20, effectiveMode);
    const total = result.total + dexMod + parsedInit.total + parsedMisc.total;
    const finalScore = (total + tieBreaker).toFixed(2);

    let formulaText = `${result.formula
        }

            ${dexMod >= 0 ? '+' : ''
        }

            ${dexMod
        }

            (Dex)`;

    if (parsedInit.total !== 0) formulaText += ` ${parsedInit.text
        }

            (Init)`;

    if (parsedMisc.total !== 0) formulaText += ` ${parsedMisc.text
        }

            (Misc)`;

    if (effectiveMode !== 'norm') formulaText += ` (${effectiveMode.toUpperCase()
        })`;

    showLog(`Init`, finalScore);

    sendToDiscord("Initiative", `Dice: ${formulaText
        }

                `, `**${finalScore
    }

                **`, 'check');
    if (consumedInsp) consumeInspiration();
}

function rollDeathSave() {
    const r = Math.floor(Math.random() * 20) + 1;
    let msg = "Failure";
    let isCrit = false;
    let isFail = false;

    if (r === 20) {
        msg = "Regain 1 HP!";
        isCrit = true;
        document.getElementById('hpCurr').value = 1;
        updateHP();
    }

    else if (r === 1) {
        msg = "2 Failures";
        isFail = true;
        updateDS('f');
        updateDS('f');
    }

    else if (r >= 10) {
        msg = "Success";
        isCrit = true;
        updateDS('s');
    }

    else {
        msg = "Failure";
        isFail = true;
        updateDS('f');
    }

    showLog("Death Save", r, isCrit, isFail);

    sendToDiscord("Death Save", `Rolled: ${r
        }

                `, `**${msg
    }

                **`, 'save');
}

function updateDS(type) {
    const d = data.vitals.ds;

    for (let i = 1; i <= 3; i++) {
        if (!d[type + i]) {
            d[type + i] = true;
            break;
        }
    }

    save();
    init();
}

// --- RENDERERS ---
function renderStats() {
    document.getElementById('statsGrid').innerHTML = stats.map(s => ` <div class="stat-card" > <h3>${s.toUpperCase()
        }

                </h3> <input type="number" class="score-input" value="${data.stats[s].val}" data-onchange="updateStat('${s}', this.value)" > <div class="mod-display" id="mod-${s}" >+0</div> <div class="save-prof" data-onclick="toggleSave('${s}', event)" ><input type="checkbox"${data.stats[s].save ? 'checked' : ''
        }

                > Def Prof</div> <div class="defense-box" ><div class="defense-val" id="def-${s}" >11</div></div> <div class="stat-btn-row" > <button class="btn-sm-roll" data-onclick="rollCheck('${s}')" >Check</button> <button class="btn-sm-save" data-onclick="rollSave('${s}')" >Save</button> </div> </div> `).join('');
}

function renderSkills() {
    document.getElementById('skillGrid').innerHTML = Object.keys(skillsMap).map(s => {
        const state = data.skills[s] || 0;
        const icon = state === 2 ? '◈' : (state === 1 ? '◆' : '◇');
        const cls = state === 2 ? 'exp' : (state === 1 ? 'prof' : '');

        const defaultStat = skillsMap[s];
        const activeStat = (data.skillOverrides && data.skillOverrides[s]) ? data.skillOverrides[s] : defaultStat;
        const isOverridden = (activeStat !== defaultStat);

        // NEW: Get saved misc value
        const miscVal = (data.skillMisc && data.skillMisc[s]) ? data.skillMisc[s] : "";
        const safeMiscVal = escapeHtml(miscVal);

        return ` <div class="skill-row" > <span class="prof-toggle ${cls}" data-onclick="cycleSkill('${s}')" >${icon
            }

                    </span> <span class="skill-attr ${isOverridden ? 'overridden' : ''}" data-onclick="cycleSkillAttr('${s}')" title="Click to change Attribute" >${activeStat.toUpperCase().substr(0, 3)
            }

                    </span> <span class="skill-name" >${s.charAt(0).toUpperCase() + s.slice(1)
            }

                    </span> <span class="skill-bonus" id="skill-bonus-${s}" >+0</span> <input type="text" class="skill-misc" placeholder="+0" value="${safeMiscVal}" data-onchange="updateSkillMisc('${s}', this.value)" title="Enter flat bonus (2) or stat name (cha)" > <button class="btn-roll-skill" data-onclick="rollSkill('${s}')" >🎲</button> </div>`;
    }).join('');
}

function updateSkillMisc(skill, val) {
    if (!data.skillMisc) data.skillMisc = {}

        ;
    data.skillMisc[skill] = val.toLowerCase().trim();
    save();
    updateAll();
}

function getSkillMiscBonus(skill) {
    if (!data.skillMisc || !data.skillMisc[skill]) return 0;
    const val = data.skillMisc[skill];

    // Check if it's a stat name (e.g. "cha", "int")
    if (stats.includes(val)) {
        return getMod(data.stats[val].val);
    }

    // Otherwise parse as number
    return parseInt(val) || 0;
}

function renderAttacks() {
    document.getElementById('attackList').innerHTML = data.attacks.map((atk, i) => {
        const safeName = escapeHtml(atk && atk.name ? atk.name : '');
        const safeDmg = escapeHtml(atk && atk.dmg ? atk.dmg : '');
        const safeDesc = escapeHtml(atk && atk.desc ? atk.desc : '');
        const safeStat = (atk && typeof atk.stat === 'string') ? atk.stat : 'none';
        return ` <div class="atk-row" > <input class="atk-name-input" type="text" placeholder="Weapon Name" value="${safeName}" data-onchange="updateAttack(${i}, 'name', this.value)" > <div class="atk-stats-line" > <input type="text" placeholder="1d8" value="${safeDmg}" data-onchange="updateAttack(${i}, 'dmg', this.value)" > <select data-onchange="updateAttack(${i}, 'stat', this.value)" > <option value="none"${safeStat === 'none' ? 'selected' : ''
        }

                >NONE</option> ${stats.map(s => `<option value="${s}"${safeStat === s ? 'selected' : ''
            }

                        >${s.toUpperCase()
            }

                        </option>`).join('')
        }

                </select> </div> <textarea class="atk-desc" placeholder="Attack description / effect..." data-onchange="updateAttack(${i}, 'desc', this.value)" >${safeDesc
        }

                </textarea> <div class="atk-controls" > <button class="atk-btn-atk" data-onclick="rollAttack(${i})" >Atk</button> <button class="atk-btn-dmg" data-onclick="rollDamage(${i})" >Dmg</button> <button class="atk-btn-del" data-onclick="delAttack(${i})" >&times; </button> </div> </div> `;
    }).join('');
}

function renderFeatures() {
    document.getElementById('featureList').innerHTML = data.features.map((feat, i) => {
        const safeName = escapeHtml(feat && feat.name ? feat.name : '');
        const safeDesc = escapeHtml(feat && feat.desc ? feat.desc : '');
        return ` <div class="atk-row" > <input class="atk-name-input" type="text" placeholder="Feature Name" value="${safeName}" data-onchange="updateFeature(${i}, 'name', this.value)" > <textarea class="atk-desc feat-desc" placeholder="Feature description..." data-onchange="updateFeature(${i}, 'desc', this.value)" >${safeDesc
        }

                </textarea> <div class="atk-controls feat-controls" > <button class="feat-post-btn" data-onclick="postFeature(${i})" >📢 Post to Chat</button> <button class="atk-btn-del" data-onclick="delFeature(${i})" >&times; </button> </div> </div> `;
    }).join('');
}

function renderSpells() {
    const list = document.getElementById('spellSlotsList');
    list.innerHTML = '';

    data.spells.forEach((slot, idx) => {
        let bubblesHtml = '';

        for (let i = 0; i < slot.max; i++) {
            const isUsed = i < slot.used;
            bubblesHtml += `<div class="bubble ${isUsed ? 'used' : ''}" data-onclick="toggleSpellSlot(${idx}, ${i})" ></div>`;
        }

        const div = document.createElement('div');
        div.className = 'spell-row';

        div.innerHTML = ` <div class="spell-lvl" >Lvl ${slot.lvl
            }

                    </div> <input type="number" class="spell-max" value="${slot.max}" placeholder="0" data-onchange="updateSpellMax(${idx}, this.value)" > <div class="spell-bubbles" >${bubblesHtml
            }

                    </div> `;
        list.appendChild(div);
    });
}

function calcSpellSlots() {
    const type = document.getElementById('casterType').value;
    const lvl = parseInt(document.getElementById('charLevel').value) || 1;

    if (type === 'none') {
        if (!confirm("Clear all spell slots?")) return;
        data.spells.forEach(s => s.max = 0);
        save();
        renderSpells();
        return;
    }

    let effectiveLvl = 0;
    let tableToUse = spellSlotTable.full;

    if (type === 'full') effectiveLvl = lvl;
    else if (type === 'half') effectiveLvl = Math.floor(lvl / 2);
    else if (type === 'third') effectiveLvl = Math.ceil(lvl / 3);

    else if (type === 'pact') {
        effectiveLvl = lvl;
        tableToUse = spellSlotTable.pact;
    }

    effectiveLvl = Math.max(0, Math.min(20, effectiveLvl));

    if (effectiveLvl === 0) {
        data.spells.forEach(s => s.max = 0);
    }

    else {
        const slots = tableToUse[effectiveLvl - 1] || [];

        if (type === 'pact') {
            let slotLvl = 1;
            if (lvl >= 3) slotLvl = 2;
            if (lvl >= 5) slotLvl = 3;
            if (lvl >= 7) slotLvl = 4;
            if (lvl >= 9) slotLvl = 5;
            const slotCount = slots[0];
            data.spells.forEach(s => s.max = 0);
            if (data.spells[slotLvl - 1]) data.spells[slotLvl - 1].max = slotCount;
        }

        else {
            data.spells.forEach((s, i) => {
                s.max = slots[i] || 0;
            });
        }
    }

    save();
    renderSpells();
    showLog("Slots", "Updated");
}

function renderResources() {
    const list = document.getElementById('resourceList');

    list.innerHTML = data.resources.map((res, i) => {
        const display = res.display || 'none';
        const rest = res.rest || 'none';
        const safeName = escapeHtml(res.name || '');
        const safeCurr = Number.isFinite(Number(res.curr)) ? Number(res.curr) : 0;
        const safeMax = Number.isFinite(Number(res.max)) ? Math.max(0, Number(res.max)) : 0;
        const safeFormula = escapeHtml(res.rFormula || '1d6');
        let vizHtml = '';

        if (display === 'bar') {
            let pct = 0; if (safeMax > 0) pct = (safeCurr / safeMax) * 100;
            if (pct > 100) pct = 100;
            vizHtml = `<div class="res-viz-bar" data-onclick="setResValue(${i})" ><div class="res-bar-fill" data-res-fill="${pct}" ></div></div>`;
        }

        else if (display === 'bubble') {
            let bubbles = '';

            for (let b = 0; b < safeMax; b++) {
                const filled = b < safeCurr ? 'filled' : '';
                bubbles += `<div class="res-bubble-item ${filled}" data-onclick="toggleResBubble(${i}, ${b})" ></div>`;
            }

            vizHtml = `<div class="res-viz-bubbles" >${bubbles
                }

                        </div>`;
        }

        return ` <div class="resource-row" > <div class="res-top" > <input type="text" class="res-name" placeholder="Resource Name" value="${safeName}" data-onchange="updateRes(${i}, 'name', this.value)" > <select class="res-style-select" data-onchange="updateRes(${i}, 'display', this.value)" > <option value="none"${display === 'none' ? 'selected' : ''
            }

                    >None</option> <option value="bubble"${display === 'bubble' ? 'selected' : ''
            }

                    >Bubbles</option> <option value="bar"${display === 'bar' ? 'selected' : ''
            }

                    >Bar</option> </select> <button class="btn-del-res" data-onclick="delRes(${i})" >&times; </button> </div> <div class="res-controls-row" > <button class="btn-res-mod btn-res-minus" data-onclick="modifyRes(${i}, -1)" >-</button> <input type="number" class="res-val" value="${safeCurr}" data-onchange="updateRes(${i}, 'curr', this.value)" > <span class="res-sep" >/</span> <input type="number" class="res-val" value="${safeMax}" data-onchange="updateRes(${i}, 'max', this.value)" > <button class="btn-res-mod btn-res-plus" data-onclick="modifyRes(${i}, 1)" >+</button> </div> ${vizHtml
            }

                    <div class="res-bottom" > <select class="res-reset-select" data-onchange="updateRes(${i}, 'rest', this.value)" > <option value="none"${rest === 'none' ? 'selected' : ''
            }

                    >Manual Reset</option> <option value="sr"${rest === 'sr' ? 'selected' : ''
            }

                    >Reset: Short Rest</option> <option value="lr"${rest === 'lr' ? 'selected' : ''
            }

                    >Reset: Long Rest</option> </select> <label class="res-recharge-toggle" title="Enable Dice Recharge" > 🎲 <input type="checkbox"${res.rCheck ? 'checked' : ''
            }

                    data-onchange="updateRes(${i}, 'rCheck', this.checked)" > </label> ${res.rCheck ? ` <input type="text" class="res-recharge-input" placeholder="1d6" value="${safeFormula}" data-onchange="updateRes(${i}, 'rFormula', this.value)" > <button class="btn-res-roll" data-onclick="rollResRecharge(${i})" >Recharge</button> ` : ''
            }

                    </div> </div> `
    }).join('');

    list.querySelectorAll('.res-bar-fill[data-res-fill]').forEach((fillEl) => {
        const pct = parseFloat(fillEl.getAttribute('data-res-fill') || '0');
        const safePct = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
        fillEl.style.width = `${safePct}%`;
    });
}

// --- INVENTORY MANAGEMENT ---
function renderInventory() {
    if (!data || !data.inventory) return;
    const root = document.getElementById('inventoryContainers');
    const looseList = document.getElementById('inventoryLooseItems');
    if (!root || !looseList) return;

    ensureInventoryStructure(data);
    const inv = data.inventory;
    root.innerHTML = renderContainerList(inv.rootOrder, null);

    if (inv.rootOrder.length === 0) {
        root.insertAdjacentHTML('beforeend', '<div class="inventory-empty">No containers yet. Create one to start organizing your gear.</div>');
    }

    const looseMarkup = inv.looseItems.map(id => renderInventoryItem(inv.items[id])).join('');
    looseList.innerHTML = looseMarkup;
    const looseArea = looseList.closest('.inventory-loose-area');
    if (looseArea) looseArea.setAttribute('data-empty', looseMarkup ? 'false' : 'true');
}

function renderContainerList(ids = [], parentId = null) {
    if (!data || !data.inventory) return '';
    const inv = data.inventory;
    const targetParent = parentId === null ? 'null' : parentId;
    let markup = '';

    ids.forEach((containerId, idx) => {
        markup += renderContainerDropSlot(targetParent, idx);
        const container = inv.containers[containerId];
        if (container) markup += renderInventoryContainerCard(container);
    });

    markup += renderContainerDropSlot(targetParent, ids.length);
    return markup;
}

function renderInventoryContainerCard(container) {
    const inv = data.inventory;
    const validItems = (container.items || []).filter(id => inv.items[id]);
    const itemsHtml = validItems.map(id => renderInventoryItem(inv.items[id])).join('');
    const childHtml = renderContainerList(container.children || [], container.id);
    const childEmpty = !container.children || container.children.length === 0;
    const safeName = escapeHtml(container.name || 'Container');
    const containerId = String(container.id || '');
    const safeContainerIdAttr = escapeHtml(containerId);
    const safeContainerIdJs = escapeJsString(containerId);

    return `<div class="inventory-container-card" data-container-id="${safeContainerIdAttr}">
        <div class="inventory-card-header">
            <div class="inventory-card-title-row">
                <span class="inventory-drag-handle" draggable="true" data-ondragstart="onInventoryContainerDragStart(event, '${safeContainerIdJs}')" data-ondragend="onInventoryDragEnd()">⠿</span>
                <input type="text" value="${safeName}" placeholder="Container Name" data-oninput="renameContainer('${safeContainerIdJs}', this.value)">
            </div>
            <div class="inventory-card-controls">
                <button type="button" class="inventory-delete-btn" data-onclick="deleteContainer('${safeContainerIdJs}')">&times;</button>
            </div>
        </div>
        <div class="inventory-card-body">
            <div class="inventory-items" data-empty="${validItems.length === 0 ? 'true' : 'false'}" data-ondragover="allowInventoryItemDrop(event)" data-ondragleave="onInventoryDropLeave(event)" data-ondrop="onInventoryItemDrop(event, '${safeContainerIdJs}')">
                ${itemsHtml}
                <div class="inventory-add-item">
                    <input type="text" id="addItemInput-${safeContainerIdAttr}" placeholder="Add item" data-onkeydown="handleInventoryInputEnter(event, '${safeContainerIdJs}')">
                    <button type="button" data-onclick="handleContainerAddItem('${safeContainerIdJs}')">Add</button>
                </div>
            </div>
            <div class="inventory-children" data-empty="${childEmpty ? 'true' : 'false'}" data-ondragover="allowInventoryContainerDrop(event)" data-ondragleave="onInventoryDropLeave(event)" data-ondrop="onInventoryContainerNest(event, '${safeContainerIdJs}')">
                ${childHtml}
            </div>
        </div>
    </div>`;
}

function renderInventoryItem(item) {
    if (!item) return '';
    const safeName = escapeHtml(item.name || 'Item');
    const qty = Math.max(0, parseInt(item.quantity, 10) || 0);
    const itemId = String(item.id || '');
    const safeItemIdAttr = escapeHtml(itemId);
    const safeItemIdJs = escapeJsString(itemId);
    return `<div class="inventory-item" data-item-id="${safeItemIdAttr}">
        <span class="inventory-drag-handle" draggable="true" data-ondragstart="onInventoryItemDragStart(event, '${safeItemIdJs}')" data-ondragend="onInventoryDragEnd()">⠿</span>
        <input type="text" value="${safeName}" placeholder="Item Name" data-oninput="renameItem('${safeItemIdJs}', this.value)">
        <div class="inventory-qty-control">
            <button type="button" class="inventory-qty-btn" data-onclick="adjustItemQuantity('${safeItemIdJs}', -1)" aria-label="Decrease quantity">-</button>
            <input type="number" class="inventory-qty-input" min="0" value="${qty}" data-onchange="setItemQuantity('${safeItemIdJs}', this.value)" aria-label="Item quantity">
            <button type="button" class="inventory-qty-btn" data-onclick="adjustItemQuantity('${safeItemIdJs}', 1)" aria-label="Increase quantity">+</button>
        </div>
        <button type="button" class="inventory-delete-btn" data-onclick="deleteItem('${safeItemIdJs}')">&times;</button>
    </div>`;
}

function renderContainerDropSlot(parentId, index) {
    const parent = String(parentId ?? 'null');
    const safeParentAttr = escapeHtml(parent);
    const safeParentJs = escapeJsString(parent);
    const safeIndex = Number.isFinite(Number(index)) ? Number(index) : 0;
    return `<div class="inventory-drop-slot" data-parent-id="${safeParentAttr}" data-drop-index="${safeIndex}" data-ondragover="allowInventoryContainerDrop(event)" data-ondragleave="onInventoryDropLeave(event)" data-ondrop="onInventoryContainerDrop(event, '${safeParentJs}', '${safeIndex}')"></div>`;
}

function createContainer(parentId = null) {
    ensureInventoryStructure(data);
    const inv = data.inventory;
    const normalizedParent = (parentId && inv.containers[parentId]) ? parentId : null;
    const id = generateInventoryId('container');
    inv.containers[id] = {
        id,
        name: 'New Container',
        parentId: normalizedParent,
        items: [],
        children: []
    }

        ;
    findContainerList(normalizedParent).push(id);
    renderInventory();
    saveGlobal();
    return id;
}

function handleContainerAddItem(containerId) {
    const input = document.getElementById(`addItemInput-${containerId}`);
    if (!input) return;
    const value = input.value.trim();
    createItem(containerId, value);
    input.value = '';
}

function handleLooseItemAdd() {
    const input = document.getElementById('looseItemInput');
    if (!input) return;
    const value = input.value.trim();
    createItem(null, value);
    input.value = '';
}

function handleInventoryInputEnter(event, containerId) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (containerId === 'null') handleLooseItemAdd();

    else handleContainerAddItem(containerId);
}

function createItem(containerId = null, label = '') {
    ensureInventoryStructure(data);
    const inv = data.inventory;
    const normalized = (containerId && inv.containers[containerId]) ? containerId : null;
    const id = generateInventoryId('item');
    inv.items[id] = {
        id,
        name: label || 'New Item',
        containerId: normalized,
        quantity: 1
    }

        ;

    if (normalized) inv.containers[normalized].items.push(id);

    else inv.looseItems.push(id);

    renderInventory();
    saveGlobal();
    return id;
}

function renameContainer(containerId, name) {
    if (!data.inventory || !data.inventory.containers[containerId]) return;
    data.inventory.containers[containerId].name = name;
    saveGlobal();
}

function renameItem(itemId, name) {
    if (!data.inventory || !data.inventory.items[itemId]) return;
    data.inventory.items[itemId].name = name;
    saveGlobal();
}

function applyItemQuantity(itemId, quantity) {
    if (!data.inventory || !data.inventory.items[itemId]) return;
    const item = data.inventory.items[itemId];
    const next = Math.max(0, parseInt(quantity, 10) || 0);
    item.quantity = next;
    renderInventory();
    saveGlobal();
}

function setItemQuantity(itemId, quantity) {
    applyItemQuantity(itemId, quantity);
}

function adjustItemQuantity(itemId, delta) {
    if (!data.inventory || !data.inventory.items[itemId]) return;
    const current = parseInt(data.inventory.items[itemId].quantity, 10) || 0;
    applyItemQuantity(itemId, current + delta);
}

function deleteContainer(containerId) {
    if (!data.inventory || !data.inventory.containers[containerId]) return;
    const inv = data.inventory;
    const targets = [containerId];

    while (targets.length) {
        const current = targets.pop();
        const container = inv.containers[current];
        if (!container) continue;

        [...container.items].forEach(itemId => deleteItem(itemId, { silent: true }));
        targets.push(...container.children);
        const list = findContainerList(container.parentId || null);
        removeIdFromArray(list, current);
        delete inv.containers[current];
    }

    renderInventory();
    saveGlobal();
}

function deleteItem(itemId, options = {}) {
    if (!data.inventory || !data.inventory.items[itemId]) return;
    const inv = data.inventory;
    const item = inv.items[itemId];
    if (item.containerId && inv.containers[item.containerId]) {
        removeIdFromArray(inv.containers[item.containerId].items, itemId);
    }

    else removeIdFromArray(inv.looseItems, itemId);

    delete inv.items[itemId];
    if (!options.silent) {
        renderInventory();
        saveGlobal();
    }
}

function moveItem(itemId, targetContainerId = null) {
    if (!data.inventory || !data.inventory.items[itemId]) return;
    const inv = data.inventory;
    const item = inv.items[itemId];
    const normalizedTarget = (targetContainerId && inv.containers[targetContainerId]) ? targetContainerId : null;

    if (item.containerId && inv.containers[item.containerId]) {
        removeIdFromArray(inv.containers[item.containerId].items, itemId);
    }

    else removeIdFromArray(inv.looseItems, itemId);

    item.containerId = normalizedTarget;

    if (normalizedTarget) inv.containers[normalizedTarget].items.push(itemId);

    else inv.looseItems.push(itemId);

    renderInventory();
    saveGlobal();
}

function nestContainer(containerId, parentId = null, dropIndex = null) {
    if (!data.inventory || !data.inventory.containers[containerId]) return;
    if (containerId === parentId) return;
    const inv = data.inventory;
    const normalizedParent = (parentId && inv.containers[parentId]) ? parentId : null;
    if (normalizedParent && isInvalidContainerNest(containerId, normalizedParent)) return;

    const currentParent = inv.containers[containerId].parentId || null;
    const currentList = findContainerList(currentParent);
    removeIdFromArray(currentList, containerId);

    inv.containers[containerId].parentId = normalizedParent;
    const targetList = findContainerList(normalizedParent);
    let index = dropIndex;
    if (typeof index !== 'number' || Number.isNaN(index)) index = targetList.length;
    index = Math.max(0, Math.min(targetList.length, index));
    targetList.splice(index, 0, containerId);

    renderInventory();
    saveGlobal();
}

function isInvalidContainerNest(childId, proposedParentId) {
    if (childId === proposedParentId) return true;
    let current = proposedParentId;
    const inv = data.inventory;

    while (current) {
        if (current === childId) return true;
        const ref = inv.containers[current];
        current = ref ? (ref.parentId || null) : null;
    }

    return false;
}

function findContainerList(parentId) {
    const inv = data.inventory;
    if (!inv) return [];
    if (!parentId) return inv.rootOrder;
    const parent = inv.containers[parentId];
    if (!parent) return inv.rootOrder;
    if (!Array.isArray(parent.children)) parent.children = [];
    return parent.children;
}

function removeIdFromArray(arr, id) {
    if (!Array.isArray(arr)) return;
    const idx = arr.indexOf(id);
    if (idx > -1) arr.splice(idx, 1);
}

function generateInventoryId(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function escapeHtml(str = '') {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeJsString(str = '') {
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

let inventoryDragPayload = null;

function onInventoryItemDragStart(event, itemId) {
    setInventoryDragPayload(event, { type: 'item', id: itemId });
}

function onInventoryContainerDragStart(event, containerId) {
    setInventoryDragPayload(event, { type: 'container', id: containerId });
}

function setInventoryDragPayload(event, payload) {
    inventoryDragPayload = payload;
    if (event && event.dataTransfer) {
        event.dataTransfer.setData('text/plain', JSON.stringify(payload));
        event.dataTransfer.effectAllowed = 'move';
    }
}

function onInventoryDragEnd() {
    inventoryDragPayload = null;
}

function allowInventoryItemDrop(event) {
    const payload = getInventoryDragPayload(event);
    if (!payload || payload.type !== 'item') return;
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

function onInventoryDropLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

function onInventoryItemDrop(event, targetId) {
    const payload = getInventoryDragPayload(event);
    event.currentTarget.classList.remove('drag-over');
    if (!payload || payload.type !== 'item') return;
    event.preventDefault();
    moveItem(payload.id, targetId === 'null' ? null : targetId);
    inventoryDragPayload = null;
}

function allowInventoryContainerDrop(event) {
    const payload = getInventoryDragPayload(event);
    if (!payload || payload.type !== 'container') return;
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

function onInventoryContainerDrop(event, parentId, index) {
    const payload = getInventoryDragPayload(event);
    event.currentTarget.classList.remove('drag-over');
    if (!payload || payload.type !== 'container') return;
    event.preventDefault();
    nestContainer(payload.id, parentId === 'null' ? null : parentId, parseInt(index, 10));
    inventoryDragPayload = null;
}

function onInventoryContainerNest(event, parentId) {
    const payload = getInventoryDragPayload(event);
    event.currentTarget.classList.remove('drag-over');
    if (!payload || payload.type !== 'container') return;
    event.preventDefault();
    nestContainer(payload.id, parentId === 'null' ? null : parentId);
    inventoryDragPayload = null;
}

function getInventoryDragPayload(event) {
    if (inventoryDragPayload) return inventoryDragPayload;

    try {
        const raw = event && event.dataTransfer ? event.dataTransfer.getData('text/plain') : '';
        if (!raw) return null;
        return JSON.parse(raw);
    }

    catch (e) {
        return null;
    }
}

// --- DATA HELPERS ---
function rollCheck(stat) {
    rollDie(20, getMod(data.stats[stat].val), stat.toUpperCase() + " Check", true, 'check');
}

function rollSave(stat) {
    const pb = getPB(data.meta.level);
    const mod = getMod(data.stats[stat].val);
    const totalBonus = mod + (data.stats[stat].save ? pb : 0);
    rollDie(20, totalBonus, stat.toUpperCase() + " Save", true, 'save');
}

// UPDATED: Roll Skill with Overrides
function rollSkill(skill) {
    const defaultStat = skillsMap[skill];
    const activeStat = (data.skillOverrides && data.skillOverrides[skill]) ? data.skillOverrides[skill] : defaultStat;

    const pb = getPB(data.meta.level);
    const mod = getMod(data.stats[activeStat].val);
    const profLevel = data.skills[skill] || 0;

    // NEW: Add Misc Bonus
    const misc = getSkillMiscBonus(skill);
    const miscRaw = (data.skillMisc && data.skillMisc[skill]) ? data.skillMisc[skill] : "";

    let label = `${skill.charAt(0).toUpperCase() + skill.slice(1)
        }

            (${activeStat.toUpperCase()
        })`;

    if (misc !== 0) {

        // If it's a stat name, add that to label
        if (stats.includes(miscRaw)) label += `+${miscRaw.toUpperCase()
            }

                `;
        else label += `+Bonus`;
    }

    rollDie(20, mod + (profLevel * pb) + misc, label, true, 'check');
}

function rollAttack(idx) {
    const atk = data.attacks[idx];
    const pb = getPB(data.meta.level);
    let mod = 0;

    if (atk.stat !== 'none') {
        mod = getMod(data.stats[atk.stat].val);
    }

    rollDie(20, mod + pb, (atk.name || 'Weapon') + " Atk", true, 'atk', atk.desc);
}

function updateStat(stat, val) {
    data.stats[stat].val = parseInt(val) || 0;
    save();
    updateAll();
}

function toggleSave(stat, e) {
    if (e.target.tagName !== 'INPUT') {
        data.stats[stat].save = !data.stats[stat].save;
        save();
        renderStats();
        updateAll();
    }

    else {
        data.stats[stat].save = e.target.checked;
        save();
        updateAll();
    }
}

function cycleSkill(skill) {
    data.skills[skill] = ((data.skills[skill] || 0) + 1) % 3;
    save();
    renderSkills();
    updateAll();
}

// UPDATED: Cycle Skill Attribute
function cycleSkillAttr(skill) {
    if (!data.skillOverrides) data.skillOverrides = {}

        ;

    // Get current stat
    const defaultStat = skillsMap[skill];
    const current = data.skillOverrides[skill] || defaultStat;

    // Find next stat in the list
    const idx = stats.indexOf(current);
    const nextIdx = (idx + 1) % stats.length;
    const nextStat = stats[nextIdx];

    // If next is the default, remove the override to save data space
    if (nextStat === defaultStat) {
        delete data.skillOverrides[skill];
    }

    else {
        data.skillOverrides[skill] = nextStat;
    }

    save();
    renderSkills();
    updateAll(); // Recalculate bonuses
}

function updateSpellMax(idx, val) {
    data.spells[idx].max = parseInt(val) || 0;
    if (data.spells[idx].used > data.spells[idx].max) data.spells[idx].used = data.spells[idx].max;
    save();
    renderSpells();
}

function toggleSpellSlot(idx, bubbleIdx) {
    const currentUsed = data.spells[idx].used;

    if (bubbleIdx + 1 === currentUsed) {
        data.spells[idx].used = bubbleIdx;
    }

    else {
        data.spells[idx].used = bubbleIdx + 1;
    }

    save();
    renderSpells();
}

function addAttack() {
    data.attacks.push({
        name: '', stat: 'str', dmg: '1d8', desc: ''
    });
    save();
    renderAttacks();
}

function updateAttack(idx, field, val) {
    if (!Array.isArray(data.attacks) || !data.attacks[idx]) return;
    if (!['name', 'stat', 'dmg', 'desc'].includes(field)) return;
    if (field === 'stat') {
        const stat = String(val || '').toLowerCase();
        data.attacks[idx][field] = ['none', 'str', 'dex', 'con', 'int', 'wis', 'cha'].includes(stat) ? stat : 'str';
    } else {
        data.attacks[idx][field] = String(val || '').slice(0, field === 'desc' ? 4000 : 240);
    }
    save();
}

function delAttack(idx) {
    data.attacks.splice(idx, 1);
    save();
    renderAttacks();
}

function addFeature() {
    data.features.push({
        name: '', desc: ''
    });
    save();
    renderFeatures();
}

function updateFeature(idx, field, val) {
    if (!Array.isArray(data.features) || !data.features[idx]) return;
    if (field !== 'name' && field !== 'desc') return;
    data.features[idx][field] = String(val || '').slice(0, field === 'desc' ? 4000 : 240);
    save();
}

function delFeature(idx) {
    data.features.splice(idx, 1);
    save();
    renderFeatures();
}

function postFeature(idx) {
    const feat = data.features[idx];
    const name = feat.name || "Unnamed Feature";
    const desc = feat.desc || "";
    showLog(name.substr(0, 10), "Posted");
    sendToDiscord(name, desc, "Feature", 'feature');
}

function addResource() {
    data.resources.push({
        name: '', curr: 0, max: 0, rest: 'none', display: 'none', rCheck: false, rFormula: '1d6'
    });
    save();
    renderResources();
}

function updateRes(i, field, val) {
    if (!Array.isArray(data.resources) || !data.resources[i]) return;
    if (!['name', 'curr', 'max', 'rest', 'display', 'rCheck', 'rFormula'].includes(field)) return;
    if (field === 'curr' || field === 'max') val = parseInt(val, 10) || 0;
    if (field === 'rCheck') val = !!val;
    if (field === 'name') val = String(val || '').slice(0, 160);
    if (field === 'rFormula') val = String(val || '').slice(0, 80);
    if (field === 'rest') {
        const allowed = ['none', 'sr', 'lr'];
        val = allowed.includes(String(val)) ? String(val) : 'none';
    }
    if (field === 'display') {
        const allowed = ['none', 'bubble', 'bar'];
        val = allowed.includes(String(val)) ? String(val) : 'none';
    }
    data.resources[i][field] = val;
    save();
    renderResources();
}

function modifyRes(i, delta) {
    const res = data.resources[i];
    if (!res) return;
    const newVal = res.curr + delta;
    res.curr = Math.max(0, Math.min(res.max, newVal));
    save();
    renderResources();
}

function setResValue(i) {
    const res = data.resources[i];
    if (!res) return;
    const val = prompt("Set value for " + (res.name || 'Resource') + ":", res.curr);

    if (val !== null) {
        const parsed = parseInt(val);

        if (!isNaN(parsed)) {
            res.curr = Math.max(0, Math.min(res.max, parsed));
            save();
            renderResources();
        }
    }
}

function delRes(i) {
    if (!Array.isArray(data.resources) || i < 0 || i >= data.resources.length) return;
    data.resources.splice(i, 1);
    save();
    renderResources();
}

function toggleResBubble(i, bubbleIdx) {
    if (!Array.isArray(data.resources) || !data.resources[i]) return;
    const currentUsed = data.resources[i].curr;

    if (bubbleIdx + 1 === currentUsed) {
        data.resources[i].curr = bubbleIdx;
    }

    else {
        data.resources[i].curr = bubbleIdx + 1;
    }

    save();
    renderResources();
}

function rollResRecharge(i) {
    const res = data.resources[i];
    const formula = res.rFormula || '1d6';
    const regex = /^(\d+)?d(\d+)\s*([+-]\s*\d+)?$/i;
    const match = formula.match(regex);

    if (!match) {
        showLog("Err", "Formula");
        return;
    }

    const count = parseInt(match[1]) || 1;
    const sides = parseInt(match[2]);
    const modStr = match[3] ? match[3].replace(/\s/g, '') : "+0";
    const mod = parseInt(modStr);
    const result = coreRoll(count, sides);
    const total = result.total + mod;
    res.curr = Math.min(res.max, res.curr + total);
    save();
    renderResources();

    showLog(`Recharge ${formula
        }

                `, total);

    sendToDiscord(`Recharge: ${res.name
        }

                `, `Rolled ${formula
    }

                : ${result.formula
    }

                ${modStr
    }

                `, `**+${total
    }

                ** (Curr: ${res.curr
    })`, 'check');
}

function toggleDiscord(active) {
    data.meta.discordActive = active;
    const label = document.getElementById('discordLabel');
    if (active) label.classList.add('discord-active');
    else label.classList.remove('discord-active');
    save();
}

function sendToDiscord(label, formulaStr, result, type = 'check', customDesc = '') {
    if (!data.meta.discordActive || !data.meta.webhook) return;
    let color = 5164484;
    if (type === 'atk') color = 16739179;
    if (type === 'dmg') color = 9807270;
    if (type === 'save') color = 3066993;
    if (type === 'feature') color = 3447003;

    let descText = "";

    if (type === 'feature') {
        descText = formulaStr;
    }

    else {
        descText = `**Result:** ${result
            }

                \n\n${formulaStr
            }

                `;

        if (customDesc) descText = `*${customDesc
            }

                *\n\n`+ descText;
    }

    const isDeathSave = (label === "Death Save");

    if (secretMode || isDeathSave) {
        descText = `|| ${descText
            }

                ||`;
    }

    const payload = {
        embeds: [{
            author: {
                name: data.meta.name || "Character"
            }

            ,
            title: label,
            description: descText,
            color: color,
            footer: {
                text: `Player: ${data.meta.player
                    }

                        `
            }
        }

        ]
    }

        ;

    fetch(data.meta.webhook, {
        method: 'POST', headers: {
            'Content-Type': 'application/json'
        }

        , body: JSON.stringify(payload)
    }).catch(err => console.error(err));
}

function showIoMsg(txt) {
    const msg = document.getElementById('ioMsg');
    msg.innerText = txt;
    setTimeout(() => msg.innerText = "", 3000);
}

async function exportData() {
    save();

    try {
        const jsonStr = JSON.stringify(allData);
        const stream = new Blob([jsonStr]).stream();
        const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));
        const compressedResponse = new Response(compressedStream);
        const blob = await compressedResponse.blob();
        const reader = new FileReader();

        reader.onload = function (e) {
            const base64 = e.target.result.split(',')[1];
            const field = document.getElementById('ioField');
            field.value = base64;
            field.select();
            field.setSelectionRange(0, 99999);
            navigator.clipboard.writeText(base64).then(() => showIoMsg("Compressed & Copied!"));
        }

            ;
        reader.readAsDataURL(blob);
    }

    catch (e) {
        console.error(e);
        showIoMsg("Export Failed");
    }
}

async function importData() {
    if (!confirm("Load data? This overwrites ALL characters.")) return;
    const field = document.getElementById('ioField');
    const b64 = field.value.trim();
    if (!b64) return showIoMsg("Empty!");

    try {
        const binString = atob(b64);
        const bytes = Uint8Array.from(binString, c => c.charCodeAt(0));
        const stream = new Blob([bytes]).stream();
        const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));
        const resp = new Response(decompressedStream);
        const json = await resp.json();

        allData = sanitizeAllDataBundle(
            (json && typeof json === 'object' && json.activeId && json.characters)
                ? json
                : wrapSingleCharacterBundle(json)
        );

        saveGlobal();
        loadActiveChar();
        field.value = "";
        showIoMsg("Data Loaded!");

    }

    catch (e) {
        console.error(e);

        try {
            const oldJson = decodeURIComponent(atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
            const parsed = JSON.parse(oldJson);

            allData = sanitizeAllDataBundle(
                (parsed && typeof parsed === 'object' && parsed.activeId && parsed.characters)
                    ? parsed
                    : wrapSingleCharacterBundle(parsed)
            );

            saveGlobal();
            loadActiveChar();
            field.value = "";
            showIoMsg("Restored Old Save");
        }

        catch (err2) {
            showIoMsg("Invalid Data");
        }
    }
}

// --- CHARACTER CREATOR ---
let ccStep = 1;
let ccPool = [];
let ccRaceFeats = [];
let ccClassFeats = [];
let ccSelectedSkills = new Set();

let ccAssigned = {
    str: null, dex: null, con: null, int: null, wis: null, cha: null
};

;

function openCharCreator() {
    document.getElementById('charCreatorModal').style.display = 'flex';
    ccStep = 1;
    ccPool = [];
    ccRaceFeats = [];
    ccClassFeats = [];
    ccSelectedSkills = new Set();

    ccAssigned = {
        str: null, dex: null, con: null, int: null, wis: null, cha: null
    };

    document.getElementById('statAssignment').style.display = 'none';
    document.getElementById('methodSelection').style.display = 'block';
    document.getElementById('ccReviewSummary').innerHTML = '';

    // Clear Inputs
    if (document.getElementById('ccRace')) document.getElementById('ccRace').value = "";
    if (document.getElementById('ccSubrace')) document.getElementById('ccSubrace').value = "";
    if (document.getElementById('ccClass')) document.getElementById('ccClass').value = "";
    if (document.getElementById('ccLevel')) document.getElementById('ccLevel').value = "1";

    renderCCRaceFeats();
    renderCCClassFeats();
    renderCCSkills();
    updateWizard();
}

function closeCharCreator() {
    document.getElementById('charCreatorModal').style.display = 'none';
}

function updateWizard() {
    for (let i = 1; i <= 5; i++) {
        const div = document.getElementById(`step${i}`);
        if (div) div.classList.remove('active');
    }

    document.getElementById(`step${ccStep}`).classList.add('active');

    document.getElementById('btnPrev').style.display = ccStep === 1 ? 'none' : 'block';
    document.getElementById('btnNext').style.display = ccStep === 5 ? 'none' : 'block';
    document.getElementById('btnFinish').style.display = ccStep === 5 ? 'block' : 'none';

    if (ccStep === 3) ccUpdateHPPreview();
    if (ccStep === 5) generateReview();
}

function ccNext() {
    if (ccStep === 1) {

        // Check if method selected and stats assigned
        if (document.getElementById('statAssignment').style.display !== 'block') {
            alert("Please select a generation method!");
            return;
        }

        const missing = Object.keys(ccAssigned).filter(k => ccAssigned[k] === null);

        if (missing.length > 0) {
            alert("Please assign all ability scores!");
            return;
        }
    }

    ccStep++;
    updateWizard();
}

function ccPrev() {
    ccStep--;
    updateWizard();
}

function selectGenMethod(method) {
    document.getElementById('methodSelection').style.display = 'none';
    document.getElementById('statAssignment').style.display = 'block';

    if (method === 'elite') ccPool = [15,
        14,
        13,
        12,
        10,
        8];

    else {
        ccPool = [];

        for (let i = 0; i < 6; i++) {
            // 4d6 drop lowest reroll 1s
            let rolls = [];

            for (let r = 0; r < 4; r++) {
                let val = Math.floor(Math.random() * 6) + 1;
                if (val === 1) val = Math.floor(Math.random() * 6) + 1; // Reroll 1 once
                rolls.push(val);
            }

            rolls.sort((a, b) => a - b);
            ccPool.push(rolls[1] + rolls[2] + rolls[3]); // Drop lowest (index 0)
        }

        ccPool.sort((a, b) => b - a);
    }

    renderStatPool();
    renderAssignRows();
}

function resetStep1() {
    ccPool = [];

    ccAssigned = {
        str: null, dex: null, con: null, int: null, wis: null, cha: null
    }

        ;
    document.getElementById('statAssignment').style.display = 'none';
    document.getElementById('methodSelection').style.display = 'block';
}

let ccSelectedValIdx = -1;

function renderStatPool() {
    const poolDiv = document.getElementById('statPool');

    poolDiv.innerHTML = ccPool.map((val, i) => {
        // Check if assigned
        const isAssigned = Object.values(ccAssigned).includes(i); // We store index in assigned
        return `<div class="stat-val-chip ${isAssigned ? 'assigned' : ''} ${ccSelectedValIdx === i ? 'selected' : ''}"

                    data-onclick="selectPoolVal(${i})" >${val
            }

                    </div>`;
    }).join('');
}

function selectPoolVal(idx) {
    if (Object.values(ccAssigned).includes(idx)) return; // Already used
    ccSelectedValIdx = idx;
    renderStatPool();
}

function renderAssignRows() {
    const container = document.getElementById('statAssignRows');
    const statsList = ['str',
        'dex',
        'con',
        'int',
        'wis',
        'cha'];

    container.innerHTML = statsList.map(s => {
        const assignedIdx = ccAssigned[s];
        const displayVal = assignedIdx !== null ? ccPool[assignedIdx] : "--";

        return ` <div class="assign-row" > <span class="assign-stat-label" >${s.toUpperCase()
            }

                    </span> <div class="assign-target ${assignedIdx !== null ? 'filled' : ''}" data-onclick="assignToStat('${s}')" > ${displayVal
            }

                    </div> </div>`;
    }).join('');
}

function assignToStat(stat) {

    // If already has value, unassign it first
    if (ccAssigned[stat] !== null) {
        ccAssigned[stat] = null;
    }

    if (ccSelectedValIdx !== -1) {
        ccAssigned[stat] = ccSelectedValIdx;
        ccSelectedValIdx = -1; // Deselect
    }

    renderStatPool();
    renderAssignRows();
}

function ccUpdateHPPreview() {
    const isAuto = document.getElementById('ccAutoHP').checked;

    if (!isAuto) {
        document.getElementById('ccHpPreview').innerHTML = 'Calculated Max HP: <span class="cc-hp-manual">Manual</span>';
        return;
    }

    const lvl = parseInt(document.getElementById('ccLevel').value) || 1;
    const hd = parseInt(document.getElementById('ccHitDie').value) || 10;
    const bonus = parseInt(document.getElementById('ccBonusHP').value) || 0;

    // Get CON from Step 1 + Step 2
    let baseCon = 10;
    if (ccAssigned.con !== null) baseCon = ccPool[ccAssigned.con];

    const raceMod = parseInt(document.getElementById('ccModCon').value) || 0;
    const totalCon = baseCon + raceMod;
    const conMod = Math.floor((totalCon - 10) / 2);

    const avg = (hd / 2) + 1;
    let max = (hd + conMod + bonus) + ((lvl - 1) * (avg + conMod + bonus));
    max = Math.max(1, max);

    document.getElementById('ccHpPreview').innerHTML = `Calculated Max HP: <span class="cc-hp-max">${max
        }</span> (Con Mod: ${conMod >= 0 ? '+' : ''}${conMod})`;
}

// --- NEW CC LOGIC REDIRECTS ---
function renderCCRaceFeats() {
    const list = document.getElementById('ccRaceFeatsList');
    if (ccRaceFeats.length === 0) {
        list.innerHTML = '<div class="cc-empty">No traits added.</div>';
        return;
    }
    list.innerHTML = ccRaceFeats.map((f, i) => `
                <div class="cc-feat-item">
                    <div>
                        <strong>${escapeHtml(f.name || '')}</strong>
                        <div class="cc-feat-desc">${escapeHtml(f.desc || '')}</div>
                    </div>
                    <button class="cc-feat-btn" data-onclick="removeCcFeat('race', ${i})">&times;</button>
                </div>
            `).join('');
}

function addCcFeat(type) {
    let nameEl, descEl;
    if (type === 'race') {
        nameEl = document.getElementById('ccRFeatName');
        descEl = document.getElementById('ccRFeatDesc');
    } else {
        nameEl = document.getElementById('ccCFeatName');
        descEl = document.getElementById('ccCFeatDesc');
    }

    const name = nameEl.value.trim();
    const desc = descEl.value.trim();

    if (!name) return alert("Please enter a name.");

    if (type === 'race') {
        ccRaceFeats.push({ name, desc });
        renderCCRaceFeats();
    } else {
        ccClassFeats.push({ name, desc });
        renderCCClassFeats();
    }

    nameEl.value = '';
    descEl.value = '';
}

function removeCcFeat(type, idx) {
    if (type === 'race') {
        ccRaceFeats.splice(idx, 1);
        renderCCRaceFeats();
    } else {
        ccClassFeats.splice(idx, 1);
        renderCCClassFeats();
    }
}

function renderCCClassFeats() {
    const list = document.getElementById('ccClassFeatsList');
    if (ccClassFeats.length === 0) {
        list.innerHTML = '<div class="cc-empty">No features added.</div>';
        return;
    }
    list.innerHTML = ccClassFeats.map((f, i) => `
                <div class="cc-feat-item">
                    <div>
                        <strong>${escapeHtml(f.name || '')}</strong>
                        <div class="cc-feat-desc">${escapeHtml(f.desc || '')}</div>
                    </div>
                    <button class="cc-feat-btn" data-onclick="removeCcFeat('class', ${i})">&times;</button>
                </div>
            `).join('');
}

function renderCCSkills() {
    const container = document.getElementById('ccValidSkills');
    container.innerHTML = Object.keys(skillsMap).map(s => {
        const isSel = ccSelectedSkills.has(s);
        return `<div class="skill-select-item ${isSel ? 'selected' : ''}" data-onclick="toggleCCSkill('${s}')">
                    <span>${s.charAt(0).toUpperCase() + s.slice(1)}</span>
                    <span class="cc-skill-attr">(${skillsMap[s].toUpperCase()})</span>
                </div>`;
    }).join('');
}

function toggleCCSkill(skill) {
    if (ccSelectedSkills.has(skill)) ccSelectedSkills.delete(skill);
    else ccSelectedSkills.add(skill);
    renderCCSkills();
}

function generateReview() {
    const race = document.getElementById('ccRace').value || "Unknown";
    const cls = document.getElementById('ccClass').value || "Unknown";
    const lvl = document.getElementById('ccLevel').value;
    const safeRace = escapeHtml(race);
    const safeClass = escapeHtml(cls);
    const safeLevel = escapeHtml(lvl);

    let summary = `<strong>${safeRace
        }

            ${safeClass
        }

            (Lvl ${safeLevel
        })</strong><br><br>`;
    summary += "<strong>Attributes:</strong><br>";

    ['str',
        'dex',
        'con',
        'int',
        'wis',
        'cha'].forEach(s => {
            const base = ccAssigned[s] !== null ? ccPool[ccAssigned[s]] : 10;
            const mod = parseInt(document.getElementById('ccMod' + s.charAt(0).toUpperCase() + s.slice(1)).value) || 0;
            const final = base + mod;
            const m = Math.floor((final - 10) / 2);

            summary += `${s.toUpperCase()
                }

                    : <strong>${final
                }

                    </strong> (${m >= 0 ? '+' : ''
                }

                        ${m

                }) <span class="cc-review-meta" >(Base ${base
                }

                        + ${mod
                })</span><br>`;
        });

    const sList = Array.from(ccSelectedSkills).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');
    if (sList) {
        summary += `<br><strong>Skills:</strong><br><span class="cc-review-skills">${escapeHtml(sList)}</span><br>`;
    }

    const rfCount = ccRaceFeats.length;
    const cfCount = ccClassFeats.length;

    summary += `<br><strong>Features:</strong><br>
            Racial Traits: ${rfCount}<br>
            Class Features: ${cfCount}<br>`;

    document.getElementById('ccReviewSummary').innerHTML = summary;
}

function ccFinish() {
    // Apply all data
    if (!confirm("Overwrite current character with this new one?")) return;

    // 1. Meta
    data.meta.name = "New Character"; // Maybe add name input to step 2? It's in main sheet anyway
    data.meta.class = document.getElementById('ccClass').value;
    data.meta.race = document.getElementById('ccRace').value;
    data.meta.subrace = document.getElementById('ccSubrace').value;
    data.meta.level = parseInt(document.getElementById('ccLevel').value) || 1;
    data.meta.casterType = document.getElementById('ccCaster').value;

    // 2. Stats
    ['str',
        'dex',
        'con',
        'int',
        'wis',
        'cha'].forEach(s => {
            const base = ccAssigned[s] !== null ? ccPool[ccAssigned[s]] : 10;
            const rMod = parseInt(document.getElementById('ccMod' + s.charAt(0).toUpperCase() + s.slice(1)).value) || 0;
            data.stats[s].val = base + rMod;
        });

    // 3. HP
    const isAuto = document.getElementById('ccAutoHP').checked;
    const bonus = parseInt(document.getElementById('ccBonusHP').value) || 0;

    data.vitals.hpAutoState = {
        enabled: isAuto, bonus: bonus
    }

        ;

    // Set Hit Die for main sheet
    const hdVal = document.getElementById('ccHitDie').value;
    document.getElementById('hdDie').value = "d" + hdVal;

    // 4. Features
    data.features = []; // Clear old

    // Add Racial Traits
    ccRaceFeats.forEach(f => {
        data.features.push({ name: f.name, desc: f.desc });
    });

    // Add Class Features
    ccClassFeats.forEach(f => {
        data.features.push({ name: f.name, desc: f.desc });
    });

    // 5. Skills
    // Reset all first
    Object.keys(data.skills).forEach(k => data.skills[k] = 0);
    // Apply selected
    ccSelectedSkills.forEach(s => {
        data.skills[s] = 1; // Mark as Proficient
    });

    closeCharCreator();
    save();

    // Refresh UI
    document.getElementById('charName').value = data.meta.name; // Though we didn't ask for name
    document.getElementById('charLevel').value = data.meta.level;
    document.getElementById('casterType').value = data.meta.casterType;

    // Update inputs dependent on save
    init();
    // Update HP specifically since init might not trigger auto calc immediately
    setTimeout(updateHP, 100);

    showLog("Character", "Created!");
}

// --- DRAG AND DROP ---
let swapSourceCard = null;

function setupDragAndDrop() {
    const grips = document.querySelectorAll('.drag-grip');
    let draggedCard = null;
    let initialY = 0;
    let initialRect = null;
    let placeholder = null;

    grips.forEach(grip => {
        grip.addEventListener('dblclick', (e) => {
            e.preventDefault(); e.stopPropagation(); handleSwapInteraction(grip.closest('.card'));
        });

        grip.addEventListener('pointerdown', (e) => {
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            const card = grip.parentElement; draggedCard = card;
            placeholder = document.createElement('div'); placeholder.className = 'card placeholder';
            placeholder.style.height = card.offsetHeight + 'px'; placeholder.style.background = 'transparent'; placeholder.style.border = '2px dashed #333';
            initialRect = card.getBoundingClientRect(); initialY = e.clientY;
            card.style.width = initialRect.width + 'px'; card.classList.add('dragging');
            card.parentNode.insertBefore(placeholder, card);
            card.style.position = 'fixed'; card.style.top = initialRect.top + 'px'; card.style.left = initialRect.left + 'px';
            grip.setPointerCapture(e.pointerId);
            grip.addEventListener('pointermove', onPointerMove); grip.addEventListener('pointerup', onPointerUp); grip.addEventListener('pointercancel', onPointerUp);
        });

        function onPointerMove(e) {
            if (!draggedCard) return; e.preventDefault();

            const dy = e.clientY - initialY; draggedCard.style.transform = `translateY(${dy
                }

                            px)`;
            const container = document.querySelector('.sheet-container');
            const siblings = [...container.querySelectorAll('.card:not(.dragging)')];

            const nextSibling = siblings.find(sibling => {
                const rect = sibling.getBoundingClientRect(); const midY = rect.top + rect.height / 2; return e.clientY < midY;
            });
            container.insertBefore(placeholder, nextSibling);
        }

        function onPointerUp(e) {
            if (!draggedCard) return;
            grip.removeEventListener('pointermove', onPointerMove); grip.removeEventListener('pointerup', onPointerUp); grip.removeEventListener('pointercancel', onPointerUp);
            grip.releasePointerCapture(e.pointerId);
            draggedCard.classList.remove('dragging'); draggedCard.style.position = ''; draggedCard.style.top = ''; draggedCard.style.left = ''; draggedCard.style.width = ''; draggedCard.style.transform = '';

            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.insertBefore(draggedCard, placeholder); placeholder.remove();
            }

            draggedCard = null; placeholder = null; saveCardOrder();
        }
    });
}

function handleSwapInteraction(card) {
    if (swapSourceCard === null) {
        swapSourceCard = card;
        card.classList.add('swap-active');
        showLog("Swap Mode", "Select Another");
    }

    else if (swapSourceCard === card) {
        swapSourceCard.classList.remove('swap-active');
        swapSourceCard = null;
        showLog("Swap Mode", "Cancelled");
    }

    else {
        const container = document.querySelector('.sheet-container');
        const placeholderA = document.createElement('div');
        const placeholderB = document.createElement('div');
        container.insertBefore(placeholderA, swapSourceCard);
        container.insertBefore(placeholderB, card);
        container.insertBefore(swapSourceCard, placeholderB);
        container.insertBefore(card, placeholderA);
        placeholderA.remove();
        placeholderB.remove();
        swapSourceCard.classList.remove('swap-active');
        swapSourceCard = null;
        saveCardOrder();
        showLog("Layout", "Swapped");
    }
}

function saveCardOrder() {
    const container = document.querySelector('.sheet-container');
    const order = Array.from(container.children).filter(c => c.id && c.classList.contains('card')).map(c => c.id);
    data.uiState.cardOrder = order;
    save();
}

try {
    init();

    // Post-Init Hook for Buffs & Visibility
    refreshBuffsUI();

    if (data.uiState.showHidden !== undefined && document.getElementById('showHiddenCards')) {
        document.getElementById('showHiddenCards').checked = data.uiState.showHidden;
    }

    // Auto HP Load
    if (data.vitals && data.vitals.hpAutoState) {
        if (document.getElementById('hpAutoToggle')) {
            document.getElementById('hpAutoToggle').checked = ! !data.vitals.hpAutoState.enabled;
            toggleAutoHP();
        }

        if (document.getElementById('hpBonusPerLevel')) {
            document.getElementById('hpBonusPerLevel').value = data.vitals.hpAutoState.bonus || 0;
        }
    }

    if (typeof applyVisibility === 'function') applyVisibility();

}

catch (e) {
    console.error("Init failed", e);
    alert("Error loading character data. Check console or clear data.");
}

// Expose to window for Importer
Object.defineProperty(window, 'data', { get: () => data });
Object.defineProperty(window, 'allData', { get: () => allData });
window.save = save;
window.populateUI = populateUI;
window.init = init;
