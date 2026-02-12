(() => {
    const FALLBACK_GROUP = 'General';

    const getStoreGroupNames = () => {
        const rep = window.RTF_STORE
            && window.RTF_STORE.state
            && window.RTF_STORE.state.campaign
            && window.RTF_STORE.state.campaign.rep
            && typeof window.RTF_STORE.state.campaign.rep === 'object'
            ? window.RTF_STORE.state.campaign.rep
            : null;
        const names = rep ? Object.keys(rep).filter(Boolean) : [];
        return names.length ? names : [FALLBACK_GROUP];
    };

    const slugify = (value) => String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'group';

    const iconForName = (name) => {
        const clean = String(name || '').trim();
        if (!clean) return 'G';
        const letter = clean[0].toUpperCase();
        return /[A-Z]/.test(letter) ? letter : 'G';
    };

    const toTrimmedString = (value, maxLen = 240) => String(value || '').trim().slice(0, maxLen);

    const asObject = (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
        return value;
    };

    const asStringList = (value, fallback = []) => {
        const list = Array.isArray(value) ? value : [];
        const out = list
            .map((entry) => toTrimmedString(entry, 240))
            .filter(Boolean);
        if (out.length) return out;
        return Array.isArray(fallback) ? fallback.slice() : [];
    };

    const asClueEntryList = (value, fallbackEntry) => {
        const list = Array.isArray(value) ? value : [];
        const out = list
            .filter((entry) => entry && typeof entry === 'object')
            .map((entry) => {
                const core = toTrimmedString(entry.core, 240);
                const surf = toTrimmedString(entry.surf, 240);
                if (!core && !surf) return null;
                return { core, surf };
            })
            .filter(Boolean);
        if (out.length) return out;
        return [{ ...fallbackEntry }];
    };

    const mergeFlavorMaps = (...maps) => {
        const out = Object.create(null);
        maps.forEach((map) => {
            const source = asObject(map);
            Object.keys(source).forEach((key) => {
                const name = toTrimmedString(key, 120);
                if (!name) return;
                out[name] = source[key];
            });
        });
        return out;
    };

    const getFlavorForGroup = (flavorMap, groupName) => {
        const source = asObject(flavorMap);
        if (!groupName) return null;
        if (source[groupName] && typeof source[groupName] === 'object') return source[groupName];
        const key = String(groupName).toLowerCase();
        const match = Object.keys(source).find((name) => String(name).toLowerCase() === key);
        if (!match) return null;
        const row = source[match];
        return row && typeof row === 'object' ? row : null;
    };

    const GROUP_ENTRY_TEMPLATES = {
        phys: [
            { core: 'a stamped warrant tube', surf: 'sealed with blue wax from the keep' },
            { core: 'a tally-stick bundle', surf: 'bound with twine from the counting house' },
            { core: 'a votive ash pattern', surf: 'disturbed by muddy bootprints' },
            { core: 'a black-feather fletching', surf: 'from arrows used beyond the city road' }
        ],
        soc: [
            { core: 'a guards sworn statement', surf: 'echoing the same rehearsed phrasing' },
            { core: 'a caravan masters rumor', surf: 'mapping who moved goods after dusk' },
            { core: 'a novices confession', surf: 'careful about naming a patron' },
            { core: 'a trappers warning', surf: 'about strangers near old standing stones' }
        ],
        arc: [
            { core: 'a lawful ward sigil', surf: 'still humming around the threshold' },
            { core: 'an artificers etching', surf: 'fading from a recently activated charm' },
            { core: 'a consecration ripple', surf: 'warped by a profane interruption' },
            { core: 'a feral ley scar', surf: 'flaring briefly at moonrise' }
        ]
    };

    const buildDynamicGroups = (groupNames, flavorMap = {}) => {
        const names = Array.isArray(groupNames) && groupNames.length ? groupNames : [FALLBACK_GROUP];
        return names.map((name, idx) => {
            const flavor = getFlavorForGroup(flavorMap, name);
            const clueFlavor = asObject(flavor && flavor.clues);
            const fallbackPhys = GROUP_ENTRY_TEMPLATES.phys[idx % GROUP_ENTRY_TEMPLATES.phys.length];
            const fallbackSoc = GROUP_ENTRY_TEMPLATES.soc[idx % GROUP_ENTRY_TEMPLATES.soc.length];
            const fallbackArc = GROUP_ENTRY_TEMPLATES.arc[idx % GROUP_ENTRY_TEMPLATES.arc.length];
            const iconOverride = toTrimmedString(flavor && flavor.icon, 8);
            return {
                id: `group-${slugify(name)}-${idx}`,
                name,
                icon: iconOverride || iconForName(name),
                phys: asClueEntryList(clueFlavor.phys, fallbackPhys),
                soc: asClueEntryList(clueFlavor.soc, fallbackSoc),
                arc: asClueEntryList(clueFlavor.arc, fallbackArc)
            };
        });
    };

    const DEFAULT_CLUE_DATA = {
        guilds: buildDynamicGroups([FALLBACK_GROUP]),
        frictions: [
            'Barred',
            'Tainted',
            'Misfiled',
            'Actively Watched',
            'Partially Burned',
            'Hidden in a Shrine'
        ],
        costs: [
            'Lose Time',
            'Spend Coin',
            'Draw Attention',
            'Take a Setback',
            'Suffer Temporary Disadvantage'
        ]
    };

    const state = {
        data: null,
        guildStatus: [],
        dom: {},
        cardVisible: false
    };
    const delegatedHandlerEvents = ['click', 'change', 'input'];
    const delegatedHandlerCache = new Map();
    let delegatedHandlersBound = false;

    const getDelegatedHandlerFn = (code) => {
        if (!delegatedHandlerCache.has(code)) {
            delegatedHandlerCache.set(code, window.RTF_DELEGATED_HANDLER.compile(code));
        }
        return delegatedHandlerCache.get(code);
    };

    const runDelegatedHandler = (el, attrName, event) => {
        const code = el.getAttribute(attrName);
        if (!code) return;

        try {
            const result = getDelegatedHandlerFn(code).call(el, event);
            if (result === false) {
                event.preventDefault();
                event.stopPropagation();
            }
        } catch (err) {
            console.error(`Delegated handler failed for ${attrName}:`, code, err);
        }
    };

    const handleDelegatedDataEvent = (event) => {
        const attrName = `data-on${event.type}`;
        let node = event.target instanceof Element ? event.target : null;

        while (node) {
            if (node.hasAttribute(attrName)) {
                runDelegatedHandler(node, attrName, event);
                if (event.cancelBubble) break;
            }
            node = node.parentElement;
        }
    };

    const bindDelegatedDataHandlers = () => {
        if (delegatedHandlersBound) return;
        delegatedHandlersBound = true;
        delegatedHandlerEvents.forEach((eventName) => {
            document.addEventListener(eventName, handleDelegatedDataEvent);
        });
    };

    const cacheDom = () => {
        const dom = state.dom;
        dom.grid = document.getElementById('guildGrid');
        dom.modeSel = document.getElementById('modeSel');
        dom.card = document.getElementById('resultCard');
        dom.objectBlock = document.getElementById('objectBlock');
        dom.objectLabel = document.getElementById('objectLabel');
        dom.objectGuild = document.getElementById('objectGuild');
        dom.objectVal = document.getElementById('objectVal');
        dom.contextBlock = document.getElementById('contextBlock');
        dom.contextLabel = document.getElementById('contextLabel');
        dom.contextGuild = document.getElementById('contextGuild');
        dom.contextVal = document.getElementById('contextVal');
        dom.outFric = document.getElementById('outFric');
        dom.outCost = document.getElementById('outCost');
        dom.outType = document.getElementById('outType');
        dom.generateBtn = document.querySelector('.gen-btn');
        if (dom.generateBtn) dom.generateBtn.disabled = true;
    };

    const randIndex = (len) => {
        if (len <= 0) return 0;
        if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
            const buf = new Uint32Array(1);
            window.crypto.getRandomValues(buf);
            return buf[0] % len;
        }
        return Math.floor(Math.random() * len);
    };

    const pickEntry = (group, mode) => {
        const list = group[mode] || [];
        return list[randIndex(list.length)] || { core: '', surf: '' };
    };

    const getClueData = () => {
        if (state.data) return state.data;
        const inline = asObject(window.CLUEDATA);
        const root = asObject(window.RTF_DATA);
        const rootFlavor = asObject(root.groupFlavor);
        const inlineFlavor = asObject(inline.groupFlavor);
        const flavorMap = mergeFlavorMaps(rootFlavor, inlineFlavor);
        const groupNames = getStoreGroupNames();
        state.data = {
            guilds: buildDynamicGroups(groupNames, flavorMap),
            frictions: asStringList(inline.frictions, DEFAULT_CLUE_DATA.frictions),
            costs: asStringList(inline.costs, DEFAULT_CLUE_DATA.costs)
        };
        state.guildStatus = new Array(state.data.guilds.length).fill(0);
        return state.data;
    };

    const buildGuildGrid = () => {
        const { grid } = state.dom;
        const data = state.data;
        if (!grid || !data) return;
        grid.innerHTML = '';
        data.guilds.forEach((group, idx) => {
            const btn = document.createElement('div');
            btn.className = 'guild-btn st-0';
            const badgeEl = document.createElement('span');
            badgeEl.className = 'status-badge';
            const iconEl = document.createElement('span');
            iconEl.className = 'g-icon';
            iconEl.textContent = String(group.icon || '');
            const nameEl = document.createElement('span');
            nameEl.className = 'g-name';
            nameEl.textContent = String(group.name || '');
            btn.appendChild(badgeEl);
            btn.appendChild(iconEl);
            btn.appendChild(nameEl);
            btn.addEventListener('click', () => toggleStatus(idx, btn));
            grid.appendChild(btn);
        });
        if (state.dom.generateBtn) state.dom.generateBtn.disabled = false;
    };

    const toggleStatus = (idx, btn) => {
        state.guildStatus[idx] = (state.guildStatus[idx] + 1) % 3;
        btn.className = `guild-btn st-${state.guildStatus[idx]}`;
        const badge = btn.querySelector('.status-badge');
        if (!badge) return;
        if (state.guildStatus[idx] === 1) badge.innerText = 'FALSE LEAD';
        else if (state.guildStatus[idx] === 2) badge.innerText = 'TRUE CLUE';
        else badge.innerText = '';
    };

    const ensureCardVisible = () => {
        const { card } = state.dom;
        if (!card || state.cardVisible) return;
        card.style.display = 'block';
        state.cardVisible = true;
    };

    const pulseCard = () => {
        ensureCardVisible();
        const { card } = state.dom;
        if (!card || typeof card.animate !== 'function') return;
        card.animate([
            { transform: 'scale(0.97)', opacity: 0.8 },
            { transform: 'scale(1.02)', opacity: 1, offset: 0.65 },
            { transform: 'scale(1)', opacity: 1 }
        ], {
            duration: 360,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
        });
    };

    const capitalize = (text) => {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1);
    };

    const renderResult = (mode, objectData, contextData, friction, cost) => {
        const dom = state.dom;
        ensureCardVisible();

        dom.outType.innerText = mode.toUpperCase() + ' EVIDENCE';

        const objectIsSignal = objectData.role === 'signal';
        dom.objectBlock.classList.toggle('signal', objectIsSignal);
        dom.objectBlock.classList.toggle('noise', !objectIsSignal);
        dom.objectLabel.innerText = `${objectIsSignal ? 'True Clue' : 'False Lead'} (Object)`;
        dom.objectLabel.style.color = objectIsSignal ? 'var(--st-green)' : 'var(--st-orange)';
        dom.objectGuild.innerText = objectData.guild;
        dom.objectVal.innerText = capitalize(objectData.text);

        const contextIsSignal = contextData.role === 'signal';
        dom.contextBlock.classList.toggle('signal', contextIsSignal);
        dom.contextBlock.classList.toggle('noise', !contextIsSignal);
        dom.contextLabel.innerText = `${contextIsSignal ? 'True Clue' : 'False Lead'} (Context)`;
        dom.contextLabel.style.color = contextIsSignal ? 'var(--st-green)' : 'var(--st-orange)';
        dom.contextGuild.innerText = contextData.guild;
        dom.contextVal.innerText = capitalize(contextData.text);

        dom.outFric.innerText = friction;
        dom.outCost.innerText = cost;

        pulseCard();
    };

    const generateClue = () => {
        const data = getClueData();
        if (!data) {
            alert('Clue data is still loading.');
            return;
        }

        const mode = state.dom.modeSel ? state.dom.modeSel.value : 'phys';
        const involvedIndices = state.guildStatus
            .map((status, idx) => (status === 2 ? idx : -1))
            .filter(idx => idx !== -1);
        const herringIndices = state.guildStatus
            .map((status, idx) => (status === 1 ? idx : -1))
            .filter(idx => idx !== -1);

        if (involvedIndices.length === 0) {
            alert('Please mark at least one group as TRUE CLUE (green).');
            return;
        }

        const signalIdx = involvedIndices[randIndex(involvedIndices.length)];
        const signalGroup = data.guilds[signalIdx];

        let noiseIdx;
        if (herringIndices.length > 0) {
            noiseIdx = herringIndices[randIndex(herringIndices.length)];
        } else {
            const available = data.guilds.map((_, i) => i).filter(i => i !== signalIdx);
            noiseIdx = available[randIndex(available.length)];
        }
        const noiseGroup = data.guilds[noiseIdx];

        const signalEntry = pickEntry(signalGroup, mode);
        const noiseEntry = pickEntry(noiseGroup, mode);
        const objectIsSignal = Math.random() < 0.5;

        const objectData = objectIsSignal
            ? { text: signalEntry.core, guild: signalGroup.name, role: 'signal', kind: 'Object' }
            : { text: noiseEntry.core, guild: noiseGroup.name, role: 'noise', kind: 'Object' };

        const contextData = objectIsSignal
            ? { text: noiseEntry.surf, guild: noiseGroup.name, role: 'noise', kind: 'Context' }
            : { text: signalEntry.surf, guild: signalGroup.name, role: 'signal', kind: 'Context' };

        const friction = data.frictions[randIndex(data.frictions.length)];
        const cost = data.costs[randIndex(data.costs.length)];

        renderResult(mode, objectData, contextData, friction, cost);
    };

    const init = () => {
        bindDelegatedDataHandlers();
        cacheDom();
        if (!getClueData()) return;
        buildGuildGrid();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.generateClue = generateClue;
})();
