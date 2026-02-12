(function () {
    const FALLBACK_GROUP = 'General';
    const DEFAULT_SIGNATURES = {
        phys: 'Distinct mud, wax seals, and tool marks',
        soc: 'Witnesses avoiding specific names',
        arc: 'Lingering conjuration shimmer and ash'
    };
    const DEFAULT_COVERAGE = {
        jurisdiction: 'Customary authority varies by town and lordship',
        perk: 'Reliable aid when trust is maintained'
    };

    function getStoreGroupNames() {
        const rep = window.RTF_STORE
            && window.RTF_STORE.state
            && window.RTF_STORE.state.campaign
            && window.RTF_STORE.state.campaign.rep
            && typeof window.RTF_STORE.state.campaign.rep === 'object'
            ? window.RTF_STORE.state.campaign.rep
            : null;
        const names = rep ? Object.keys(rep).filter(Boolean) : [];
        return names.length ? names : [FALLBACK_GROUP];
    }

    function asObject(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
        return value;
    }

    function toTrimmedString(value, maxLen = 240) {
        return String(value || '').trim().slice(0, maxLen);
    }

    function asStringList(value, fallback = []) {
        const list = Array.isArray(value) ? value : [];
        const out = list
            .map((entry) => toTrimmedString(entry, 280))
            .filter(Boolean);
        if (out.length) return out;
        return Array.isArray(fallback) ? fallback.slice() : [];
    }

    function getFlavorForGroup(flavorMap, groupName) {
        const source = asObject(flavorMap);
        if (!groupName) return null;
        if (source[groupName] && typeof source[groupName] === 'object') return source[groupName];
        const key = String(groupName).toLowerCase();
        const match = Object.keys(source).find((name) => String(name).toLowerCase() === key);
        if (!match) return null;
        const row = source[match];
        return row && typeof row === 'object' ? row : null;
    }

    function buildActionsWithFlavor(baseActions, groupNames, flavorMap) {
        const source = asObject(baseActions);
        const out = Object.create(null);
        Object.keys(source).forEach((key) => {
            out[key] = asStringList(source[key], []);
        });
        (Array.isArray(groupNames) ? groupNames : []).forEach((groupName) => {
            const flavor = getFlavorForGroup(flavorMap, groupName);
            if (!flavor) return;
            const beats = asStringList(flavor.beats, []);
            if (beats.length) out[groupName] = beats;
        });
        return out;
    }

    function normalizeHazardEntry(entry) {
        if (!entry || typeof entry !== 'object') return null;
        const name = toTrimmedString(entry.name || entry.n, 160);
        const eff = toTrimmedString(entry.eff || entry.e, 400);
        if (!name && !eff) return null;
        const rawRoll = Number.parseInt(entry.roll, 10);
        const roll = Number.isFinite(rawRoll) && rawRoll >= 2 && rawRoll <= 12 ? rawRoll : null;
        return { roll, name, eff };
    }

    function normalizeSnagEntry(entry) {
        if (!entry || typeof entry !== 'object') return null;
        const n = toTrimmedString(entry.n || entry.name, 160);
        const e = toTrimmedString(entry.e || entry.eff, 400);
        if (!n && !e) return null;
        const rawRoll = Number.parseInt(entry.roll, 10);
        const roll = Number.isFinite(rawRoll) && rawRoll >= 2 && rawRoll <= 40 ? rawRoll : null;
        return { roll, n, e };
    }

    function buildHazardFlavorByGroup(groupNames, flavorMap) {
        const out = Object.create(null);
        (Array.isArray(groupNames) ? groupNames : []).forEach((groupName) => {
            const flavor = getFlavorForGroup(flavorMap, groupName);
            if (!flavor) return;
            const list = Array.isArray(flavor.hazards) ? flavor.hazards : [];
            const rows = list
                .map(normalizeHazardEntry)
                .filter(Boolean);
            if (rows.length) out[groupName] = rows;
        });
        return out;
    }

    function buildSnagFlavorByGroup(groupNames, flavorMap) {
        const out = Object.create(null);
        (Array.isArray(groupNames) ? groupNames : []).forEach((groupName) => {
            const flavor = getFlavorForGroup(flavorMap, groupName);
            if (!flavor) return;
            const list = Array.isArray(flavor.snags) ? flavor.snags : [];
            const rows = list
                .map(normalizeSnagEntry)
                .filter(Boolean);
            if (rows.length) out[groupName] = rows;
        });
        return out;
    }

    function makeGroupSignatureRows(groupNames, flavorMap) {
        const names = Array.isArray(groupNames) && groupNames.length ? groupNames : [FALLBACK_GROUP];
        return names.map((name) => ({
            g: name,
            p: (() => {
                const flavor = getFlavorForGroup(flavorMap, name);
                const sig = asObject(asObject(asObject(flavor).clues).signatures);
                return toTrimmedString(sig.phys || sig.p, 240) || DEFAULT_SIGNATURES.phys;
            })(),
            s: (() => {
                const flavor = getFlavorForGroup(flavorMap, name);
                const sig = asObject(asObject(asObject(flavor).clues).signatures);
                return toTrimmedString(sig.social || sig.s, 240) || DEFAULT_SIGNATURES.soc;
            })(),
            a: (() => {
                const flavor = getFlavorForGroup(flavorMap, name);
                const sig = asObject(asObject(asObject(flavor).clues).signatures);
                return toTrimmedString(sig.arcane || sig.a, 240) || DEFAULT_SIGNATURES.arc;
            })()
        }));
    }

    function makeGroupRefRows(groupNames, flavorMap) {
        const names = Array.isArray(groupNames) && groupNames.length ? groupNames : [FALLBACK_GROUP];
        return names.map((name) => ({
            n: name,
            j: (() => {
                const flavor = getFlavorForGroup(flavorMap, name);
                const coverage = asObject(asObject(flavor).coverage);
                return toTrimmedString(coverage.jurisdiction || coverage.j, 240) || DEFAULT_COVERAGE.jurisdiction;
            })(),
            b: (() => {
                const flavor = getFlavorForGroup(flavorMap, name);
                const coverage = asObject(asObject(flavor).coverage);
                return toTrimmedString(coverage.perk || coverage.b, 240) || DEFAULT_COVERAGE.perk;
            })()
        }));
    }

    const DEFAULT_DM_DATA = {
        guilds: [FALLBACK_GROUP],
        dm: {
            actions: {
                General: [
                    'inspecting fresh wagon tracks near a crossroads',
                    'questioning a nervous innkeeper after curfew',
                    'scouting rooftops for signs of a hidden lookout'
                ],
                Independent: [
                    'peddling suspect relics from a tarp-covered cart',
                    'shadowing travelers from alley to alley',
                    'offering directions that may hide an agenda'
                ],
                Env: [
                    'cold rain turns roads into sucking mud',
                    'festival crowds choke every narrow lane',
                    'low marsh-fog cuts visibility to a few strides'
                ]
            },
            whatsHappening: [
                'A ritual deadline is rapidly approaching',
                'Rumors are spreading faster than facts',
                'Old loyalties are starting to fracture',
                'An unseen patron is quietly raising the stakes'
            ],
            textures: {
                struct: {
                    a: ['A braced oak gate', 'A narrow stone corridor', 'A cracked watchtower support'],
                    b: ['built from old stone and heavy timber', 'patched with scavenged planks', 'lined with soot-dark iron braces'],
                    c: ['groaning under weight', 'recently shored up', 'barely holding together']
                },
                guts: {
                    a: ['A rune-etched wardstone', 'A pressure-fed alchemy still', 'A bell-pull signal line'],
                    b: ['protecting the hall from intrusion', 'feeding lamps and burners', 'warning nearby sentries'],
                    c: ['flickering unpredictably', 'hissing and overheating', 'failing in short bursts']
                },
                debris: {
                    a: ['A snapped signet ring', 'A blood-specked writ', 'A dropped pouch of lockpicks'],
                    b: ['beside a servants door', 'in a shadowed alcove', 'scattered across trampled straw'],
                    c: ['suggesting a rushed escape', 'showing an interrupted exchange', 'hinting that more than two parties were involved']
                },
                atmos: {
                    a: ['Torchlight from iron sconces', 'Moonlight through broken shutters', 'Lantern-glow from a foggy lane'],
                    b: ['faltering in the draft', 'diffused through smoke', 'casting long angular shadows'],
                    c: ['hiding depth and distance', 'creating blind corners', 'making motion hard to follow']
                }
            },
            clueSigs: [],
            npcs: [
                { w: 'Keep their sworn oath hidden', l: 'A witness saw them break a temple vow' },
                { w: 'Avoid being named before the reeve', l: 'A marked key they cannot explain' },
                { w: 'Secure coin for a private debt', l: 'A ledger page tying them to smugglers' },
                { w: 'Shift suspicion onto a rival house', l: 'Conflicting testimony about their whereabouts' },
                { w: 'Win a transfer to safer duty', l: 'Unlogged gaps in their watch rota' },
                { w: 'Keep the village calm at all costs', l: 'A firsthand account they tried to bury' },
                { w: 'Expand influence within the guard', l: 'A stolen seal used on forged orders' },
                { w: 'Protect family from retaliation', l: 'A ransom note with their private mark' },
                { w: 'Hide a forbidden romance', l: 'Recovered letters in their own hand' },
                { w: 'Control how the tale is remembered', l: 'Multiple statements that contradict each other' },
                { w: 'Stir chaos to mask another theft', l: 'A hidden route only they knew' }
            ],
            hazards: [
                { roll: 2, name: 'Wild Arc', eff: 'DC 13 Dex save or take 1d6 lightning damage.' },
                { roll: 3, name: 'Broken Ground', eff: 'Area counts as difficult terrain.' },
                { roll: 4, name: 'Barred Door', eff: 'Requires force, tools, or another route.' },
                { roll: 5, name: 'Panicked Crowd', eff: 'DC 13 Str save or be shoved 10 feet.' },
                { roll: 6, name: 'Thick Fog', eff: 'Heavily obscured beyond 10 feet.' },
                { roll: 7, name: 'Rotten Planks', eff: 'Heavy impact may break through the floor.' },
                { roll: 8, name: 'Alchemical Fumes', eff: 'DC 12 Con save or poisoned until end of next turn.' },
                { roll: 9, name: 'Null Ward', eff: 'Spellcasting here requires a DC 12 concentration check.' },
                { roll: 10, name: 'Loose Masonry', eff: 'Taking cover risks a minor cave-in.' },
                { roll: 11, name: 'Dread Whisper', eff: 'DC 12 Wis save or lose movement this turn.' },
                { roll: 12, name: 'Watch Bell', eff: 'Nearby defenders are alerted and reinforce.' }
            ],
            snags: {
                21: { n: 'Travel Delay', e: 'A blocked road or closed gate costs precious time.' }
            },
            papers: [
                { n: 'Town Crier Broadside', t: 'Neutral', e: 'No immediate impact' },
                { n: 'Temple Circular', t: 'Concerned', e: 'Heat +1 (public scrutiny)' },
                { n: 'Mercantile Ledger Notes', t: 'Practical', e: 'Heat -1 (if resolved swiftly)' },
                { n: 'Scribes Almanac', t: 'Analytical', e: 'No immediate impact' },
                { n: 'Garrison Notice', t: 'Summary', e: 'No immediate impact' },
                { n: 'Street Pamphlet', t: 'Speculative', e: 'Heat +1 (rumors spread)' }
            ],
            guildRefs: []
        }
    };

    // Sparse built-in mode by default.
    const data = DEFAULT_DM_DATA;
    const runtimeRoot = asObject(window.RTF_DATA);
    const groupFlavorMap = asObject(runtimeRoot.groupFlavor);
    const runtimeDm = asObject(runtimeRoot.dm);

    const storeGuilds = getStoreGroupNames();
    const guilds = storeGuilds.length
        ? storeGuilds
        : (Array.isArray(data.guilds) ? data.guilds.filter(Boolean) : [FALLBACK_GROUP]);
    const actions = buildActionsWithFlavor(data.dm.actions, guilds, groupFlavorMap);
    const whatsHappening = asStringList(runtimeDm.whatsHappening, data.dm.whatsHappening);
    const { struct: txtStruct, guts: txtGuts, debris: txtDebris, atmos: txtAtmos } = data.dm.textures;
    const clueSigs = makeGroupSignatureRows(guilds, groupFlavorMap);
    const npcs = data.dm.npcs;
    const hazards = data.dm.hazards;
    const hazardFlavorByGroup = buildHazardFlavorByGroup(guilds, groupFlavorMap);
    const snags = data.dm.snags;
    const snagFlavorByGroup = buildSnagFlavorByGroup(guilds, groupFlavorMap);
    const papers = data.dm.papers;
    const guildRefs = makeGroupRefRows(guilds, groupFlavorMap);

    const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const d = (n) => Math.floor(Math.random() * n) + 1;
    const escapeHtml = (value = '') => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const escapeMultiline = (value = '') => escapeHtml(value).replace(/\n/g, '<br>');
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

    function setText(id, html) {
        const box = document.getElementById(id);
        if (!box) {
            console.error("box element not found:", id);
            return;
        }
        const selector = id.includes('texture') ? '.texture-out' : '.text-output';
        const content = box.querySelector(selector);
        if (!content) {
            console.error("content element not found using selector:", selector, "inside box:", id);
            return;
        }
        content.innerHTML = html;
        box.classList.add('active');
    }

    function genStreetScene() {
        const fallbackGuilds = Object.keys(actions || {}).filter((key) => key !== 'Env' && key !== 'Independent');
        const activeGuilds = guilds.length ? guilds : fallbackGuilds;
        const actorPool = [...activeGuilds, 'Environment', 'Independent'];
        const actorName = rand(actorPool);

        let actionList = [];
        if (actorName === 'Environment') {
            actionList = actions.Env || [];
        } else if (actorName === 'Independent') {
            actionList = actions.Independent || [];
        } else {
            actionList = actions[actorName] || actions.General || actions.Env || actions.Independent || [];
        }
        if (!actionList.length) actionList = ['Holding position'];

        const action = rand(actionList);
        const compl = rand(whatsHappening);
        const sourcePool = [...activeGuilds, 'Hazard', 'Gang'];
        const sourceName = rand(sourcePool);
        const safeActorName = escapeHtml(actorName);
        const safeAction = escapeMultiline(action);
        const safeConflict = escapeMultiline(compl);
        const safeSource = escapeHtml(sourceName);

        const box = document.getElementById('out-street');
        if (box) {
            box.classList.add('active');
        }
        const content = document.getElementById('dispatch-content');
        if (!content) {
            console.error("dispatch-content element not found");
            return;
        }
        content.innerHTML = `
            <div class="dispatch-row"><div class="dispatch-label">Actor</div><div class="dispatch-val highlight">${safeActorName}</div></div>
            <div class="dispatch-row"><div class="dispatch-label">Activity</div><div class="dispatch-val">${safeAction}</div></div>
            <div class="dispatch-row"><div class="dispatch-label">Conflict</div><div class="dispatch-val alert">${safeConflict}</div></div>
            <div class="dispatch-row"><div class="dispatch-label">Source</div><div class="dispatch-val">${safeSource}</div></div>
        `;
    }

    function genTexture(type) {
        let html = '';
        if (type === 'struct') {
            html = `<span class="hl-txt">${escapeHtml(rand(txtStruct.a))}</span>, made of <span class="hl-ctx">${escapeHtml(rand(txtStruct.b))}</span>, currently <span class="hl-state">${escapeHtml(rand(txtStruct.c))}</span>.`;
        } else if (type === 'guts') {
            html = `<span class="hl-txt">${escapeHtml(rand(txtGuts.a))}</span>, for <span class="hl-ctx">${escapeHtml(rand(txtGuts.b))}</span>, currently <span class="hl-state">${escapeHtml(rand(txtGuts.c))}</span>.`;
        } else if (type === 'debris') {
            html = `<span class="hl-txt">${escapeHtml(rand(txtDebris.a))}</span>, found <span class="hl-ctx">${escapeHtml(rand(txtDebris.b))}</span>, <span class="hl-state">${escapeHtml(rand(txtDebris.c))}</span>.`;
        } else if (type === 'atmos') {
            html = `Light from <span class="hl-txt">${escapeHtml(rand(txtAtmos.a))}</span>, which is <span class="hl-ctx">${escapeHtml(rand(txtAtmos.b))}</span>, <span class="hl-state">${escapeHtml(rand(txtAtmos.c))}</span>.`;
        }
        setText('out-texture', html);
    }

    function genNPC() {
        const roll = d(6) + d(6) - 2;
        const res = npcs[roll] || { w: '', l: '' };
        const g = rand(guilds.length ? guilds : [FALLBACK_GROUP]);
        const safeGuild = escapeHtml(g);
        const safeWants = escapeMultiline(res.w || '');
        const safeLeverage = escapeMultiline(res.l || '');
        setText('out-npc', `
            <div class="out-main"><span class="dm-npc-guild">${safeGuild}</span> NPC</div>
            <div class="dm-sub-line dm-sub-line-wants"><strong>Wants:</strong> ${safeWants}</div>
            <div class="dm-sub-line"><strong>Leverage:</strong> ${safeLeverage}</div>
        `);
    }

    function genHazard() {
        const roll = d(6) + d(6);
        const activeGroups = guilds.length ? guilds : [FALLBACK_GROUP];
        const focusGroup = rand(activeGroups);
        const flavorPool = (hazardFlavorByGroup[focusGroup] || []).filter((row) => row.roll === null || row.roll === roll);
        const flavorHit = flavorPool.length ? rand(flavorPool) : null;
        const h = flavorHit || hazards.find(x => x.roll === roll) || hazards[0];
        if (!h) {
            console.error("No hazard found for roll:", roll);
            return;
        }
        const flavorLine = flavorHit ? `<div class="out-sub"><strong>Group Lens:</strong> ${escapeHtml(focusGroup)}</div>` : '';
        setText('out-hazard', `
            <div class="out-main out-heat">${escapeHtml(h.name || '')}</div>
            <div class="out-sub">${escapeMultiline(h.eff || '')}</div>
            ${flavorLine}
        `);
    }

    function genSnag() {
        const roll = d(20) + d(20);
        const activeGroups = guilds.length ? guilds : [FALLBACK_GROUP];
        const focusGroup = rand(activeGroups);
        const flavorPool = (snagFlavorByGroup[focusGroup] || []).filter((row) => row.roll === null || row.roll === roll);
        const flavorHit = flavorPool.length ? rand(flavorPool) : null;
        const s = flavorHit || snags[roll] || snags[21];
        const flavorLine = flavorHit ? `<div class="out-sub"><strong>Group Lens:</strong> ${escapeHtml(focusGroup)}</div>` : '';
        setText('out-hazard', `
            <div class="out-main out-heat">${escapeHtml((s && s.n) || '')}</div>
            <div class="out-sub">${escapeMultiline((s && s.e) || '')}</div>
            ${flavorLine}
            <div class="out-sub dm-roll-line">Roll: ${roll}</div>
        `);
    }

    function genBroadsheet() {
        const roll = d(6) - 1;
        const p = papers[roll];
        if (!p) {
            console.error("No broadsheet found for roll:", roll);
            return;
        }
        const effectText = typeof p.e === 'string' ? p.e : '';
        const cls = effectText.includes('Heat +') ? 'out-heat' : 'out-good';
        setText('out-paper', `
            <div class="out-main">${escapeHtml(p.n || '')}</div>
            <div class="out-sub">Tone: ${escapeHtml(p.t || '')}</div>
            <div class="${cls} dm-paper-effect">${escapeMultiline(effectText)}</div>
        `);
    }

    function toggleRef(id) {
        const el = document.getElementById(id);
        if (!el) {
            console.error("Element not found:", id);
            return;
        }
        const body = el.querySelector('tbody');
        if (!body) {
            console.error("Tbody not found in element:", id);
            return;
        }

        if (body.innerHTML.trim() === '') {
            if (id === 'clue-ref') {
                body.innerHTML = clueSigs.map(c => `
                    <tr><td class="ref-hl">${escapeHtml(c.g || '')}</td><td><span class="clue-type">PHYSICAL:</span> ${escapeHtml(c.p || '')}<br><span class="clue-type dm-clue-type-gap">SOCIAL:</span> ${escapeHtml(c.s || '')}<br><span class="clue-type dm-clue-type-arcane">ARCANE:</span> ${escapeHtml(c.a || '')}</td></tr>
                `).join('');
            } else if (id === 'guild-ref') {
                body.innerHTML = guildRefs.map(g => `<tr><td class="ref-hl">${escapeHtml(g.n || '')}</td><td>${escapeHtml(g.j || '')}</td><td class="dm-guild-perk">${escapeHtml(g.b || '')}</td></tr>`).join('');
            }
        }
        el.classList.toggle('open');
    }

    bindDelegatedDataHandlers();

    // Expose to window explicitly
    window.genStreetScene = genStreetScene;
    window.genTexture = genTexture;
    window.genNPC = genNPC;
    window.genHazard = genHazard;
    window.genSnag = genSnag;
    window.genBroadsheet = genBroadsheet;
    window.toggleRef = toggleRef;
})();
