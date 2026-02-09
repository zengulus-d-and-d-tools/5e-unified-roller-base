(function (global) {
    const DEFAULT_GUILDS = [
        "Azorius",
        "Boros",
        "Dimir",
        "Golgari",
        "Gruul",
        "Izzet",
        "Orzhov",
        "Rakdos",
        "Selesnya",
        "Simic",
        "Guildless"
    ];

    const ACTIVE_GUILDS = (typeof global.getRTFGuilds === 'function')
        ? global.getRTFGuilds({ includeGuildless: true })
        : ((Array.isArray(global.PRELOADED_GUILDS) && global.PRELOADED_GUILDS.length)
            ? global.PRELOADED_GUILDS.slice()
            : DEFAULT_GUILDS.slice());

    function toPlainObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function toArray(value, fallback) {
        return Array.isArray(value) && value.length ? value.slice() : fallback.slice();
    }

    function slugifyGuildName(name) {
        return String(name || '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'faction';
    }

    function buildFallbackSettingProfile(guilds) {
        const activeGuilds = Array.isArray(guilds) && guilds.length ? guilds.slice() : DEFAULT_GUILDS.slice();
        const factionGuilds = activeGuilds.filter((name) => String(name || '').toLowerCase() !== 'guildless');

        const actions = {};
        activeGuilds.forEach((name) => {
            actions[name] = [`${name} operatives maintaining routine operations`];
        });
        if (!actions.Guildless) {
            actions.Guildless = ['Independent locals navigating guild pressure'];
        }
        actions.Env = ['A sudden environmental disruption reshapes the scene'];

        const clueSigs = factionGuilds.map((name) => ({
            g: name,
            p: `${name} insignia or material residue`,
            s: `${name} contacts acting cautiously`,
            a: `${name} magical or technical trace`
        }));

        const guildRefs = factionGuilds.map((name) => ({
            n: name,
            j: 'Jurisdiction varies by district',
            b: 'Operational support if relations are positive'
        }));

        const clueGuilds = factionGuilds.map((name) => ({
            id: slugifyGuildName(name),
            name,
            icon: '?',
            phys: [{ core: `${name} material evidence`, surf: 'left behind during activity' }],
            soc: [{ core: `${name} witness network`, surf: 'careful about speaking openly' }],
            arc: [{ core: `${name} arcane/technical residue`, surf: 'fading but still detectable' }]
        }));

        return {
            dm: {
                actions,
                whatsHappening: [
                    'A hard deadline is approaching',
                    'Public attention is rising',
                    'Collateral risk is increasing',
                    'A bureaucratic obstacle appears',
                    'Tensions are about to boil over',
                    'Sensitive information is leaking'
                ],
                textures: {
                    struct: {
                        a: ['A major structural element'],
                        b: ['built from utilitarian materials'],
                        c: ['showing visible stress and wear']
                    },
                    guts: {
                        a: ['A critical service component'],
                        b: ['supporting city operations'],
                        c: ['making unstable noises']
                    },
                    debris: {
                        a: ['Discarded scene debris'],
                        b: ['scattered near the incident'],
                        c: ['suggesting hurried movement']
                    },
                    atmos: {
                        a: ['Mixed ambient lighting'],
                        b: ['filtered through city haze'],
                        c: ['casting long, uneven shadows']
                    }
                },
                clueSigs,
                npcs: [
                    { w: 'Promotion inside their faction', l: 'Documented wrongdoing' },
                    { w: 'Anonymity and safety', l: 'A key to a secure location' },
                    { w: 'Debt relief', l: 'Encrypted correspondence' },
                    { w: 'Transfer out of current assignment', l: 'Smuggling evidence' },
                    { w: 'Protection from retaliation', l: 'Eyewitness testimony' },
                    { w: 'Access to insider plans', l: 'A stolen seal or signet' },
                    { w: 'Revenge against a rival', l: 'Compromising records' },
                    { w: 'Rare permit or authorization', l: 'Restricted access codes' },
                    { w: 'Family safety guarantees', l: 'Courier route intelligence' },
                    { w: 'Political cover from blame', l: 'Specialist process knowledge' },
                    { w: 'Chaos to hide another goal', l: 'A hazardous failsafe' }
                ],
                hazards: [
                    { roll: 2, name: 'Arc Discharge Zone', eff: 'DC 13 Dex save or take 1d6 lightning damage.' },
                    { roll: 3, name: 'Overgrown Passage', eff: 'Difficult terrain; fast movement risks going prone.' },
                    { roll: 4, name: 'Reinforced Checkpoint', eff: 'Requires payment or alternative route.' },
                    { roll: 5, name: 'Crowd Surge', eff: 'DC 13 Str save or be pushed 10 feet.' },
                    { roll: 6, name: 'Dense Obscuring Fog', eff: 'Heavily obscured beyond 10 feet.' },
                    { roll: 7, name: 'Crumbling Elevation', eff: 'Heavy impact may trigger a 20-foot fall.' },
                    { roll: 8, name: 'Toxic Spores', eff: 'DC 12 Con save or poisoned for 1 round.' },
                    { roll: 9, name: 'Suppression Field', eff: 'Casting may fail without a concentration check.' },
                    { roll: 10, name: 'Unstable Rubble', eff: 'Provides advantage and risk as priority target.' },
                    { roll: 11, name: 'Pollen Burst', eff: 'DC 12 Wis save or lose aggressive options.' },
                    { roll: 12, name: 'Alarm Beacon', eff: 'Escalates clock pressure and local response.' }
                ],
                snags: {
                    2: { n: 'District Lockdown', e: 'Entry requires local liaison support.' },
                    10: { n: 'Mandatory Entry Toll', e: 'Pay resources or spend time finding alternate access.' },
                    21: { n: 'Standard Bureaucracy', e: 'Forms and verification slow progress.' },
                    30: { n: 'Flooded Access Route', e: 'Movement becomes difficult and noisy.' },
                    40: { n: 'Sacred Restrictions', e: 'Violence or deception is constrained in this area.' }
                },
                papers: [
                    { n: 'District Chronicle', t: 'Sensationalist', e: 'Heat +1 (Alarm)' },
                    { n: 'Civic Gazette', t: 'Legalistic', e: 'Heat +1 (Internal Attention)' },
                    { n: 'Rubble-Rant Circular', t: 'Anarchic', e: 'No Change (Ignored)' },
                    { n: 'Inquiry Bulletin', t: 'Technical', e: 'Heat -1 (If handled quickly)' },
                    { n: 'Public Banner', t: 'Heroic', e: 'Heat -1 (Public Trust)' },
                    { n: 'Ledger Dispatch', t: 'Financial', e: 'Heat -1 (If costs controlled)' }
                ],
                guildRefs
            },
            clue: {
                guilds: clueGuilds,
                frictions: [
                    'Water-Damaged',
                    'Booby-Trapped',
                    'Locked / Encrypted',
                    'Contaminated',
                    'Heavily Guarded',
                    'Culturally Taboo',
                    'Physically Stuck',
                    'Magically Warded',
                    'Currently Burning',
                    'Moving Target',
                    'Buried in Trash',
                    'Incomplete'
                ],
                costs: [
                    'Clock +1',
                    'Heat +1',
                    'Resource Cost',
                    'Reputation -1',
                    'Minor Injury',
                    'Exhaustion',
                    'Info Leak',
                    'Set-Piece Trigger',
                    'Disadvantage',
                    'Spell Slot Drain'
                ]
            }
        };
    }

    function normalizeDmProfile(rawDm, fallbackDm, guilds) {
        const dm = toPlainObject(rawDm);
        const out = {};

        const rawActions = toPlainObject(dm.actions);
        out.actions = { ...fallbackDm.actions, ...rawActions };
        const guildList = Array.isArray(guilds) ? guilds : [];
        guildList.forEach((guildName) => {
            if (!Array.isArray(out.actions[guildName]) || !out.actions[guildName].length) {
                out.actions[guildName] = [`${guildName} operatives maintaining routine operations`];
            }
        });
        out.actions.Env = toArray(out.actions.Env, fallbackDm.actions.Env);
        out.actions.Guildless = toArray(out.actions.Guildless, fallbackDm.actions.Guildless);

        out.whatsHappening = toArray(dm.whatsHappening, fallbackDm.whatsHappening);

        const rawTextures = toPlainObject(dm.textures);
        out.textures = {};
        ['struct', 'guts', 'debris', 'atmos'].forEach((section) => {
            const sectionFallback = toPlainObject(fallbackDm.textures[section]);
            const sectionRaw = toPlainObject(rawTextures[section]);
            out.textures[section] = {
                a: toArray(sectionRaw.a, sectionFallback.a || ['Notable feature']),
                b: toArray(sectionRaw.b, sectionFallback.b || ['Context clue']),
                c: toArray(sectionRaw.c, sectionFallback.c || ['Current state'])
            };
        });

        out.clueSigs = toArray(dm.clueSigs, fallbackDm.clueSigs);

        const rawNpcs = Array.isArray(dm.npcs) ? dm.npcs.slice() : [];
        out.npcs = rawNpcs.length ? rawNpcs : fallbackDm.npcs.slice();
        while (out.npcs.length < fallbackDm.npcs.length) {
            out.npcs.push(fallbackDm.npcs[out.npcs.length]);
        }

        const hazardByRoll = new Map();
        fallbackDm.hazards.forEach((entry) => {
            if (entry && Number.isFinite(entry.roll)) hazardByRoll.set(entry.roll, entry);
        });
        if (Array.isArray(dm.hazards)) {
            dm.hazards.forEach((entry) => {
                if (entry && Number.isFinite(entry.roll)) hazardByRoll.set(entry.roll, entry);
            });
        }
        out.hazards = [];
        for (let roll = 2; roll <= 12; roll += 1) {
            out.hazards.push(hazardByRoll.get(roll) || fallbackDm.hazards[roll - 2]);
        }

        out.snags = { ...fallbackDm.snags, ...toPlainObject(dm.snags) };
        if (!out.snags[21]) out.snags[21] = fallbackDm.snags[21];

        out.papers = toArray(dm.papers, fallbackDm.papers);
        while (out.papers.length < fallbackDm.papers.length) {
            out.papers.push(fallbackDm.papers[out.papers.length]);
        }

        out.guildRefs = toArray(dm.guildRefs, fallbackDm.guildRefs);
        return out;
    }

    function normalizeClueProfile(rawClue, fallbackClue) {
        const clue = toPlainObject(rawClue);
        const out = {};

        out.guilds = toArray(clue.guilds, fallbackClue.guilds);
        if (!out.guilds.length) out.guilds = fallbackClue.guilds.slice();

        out.frictions = toArray(clue.frictions, fallbackClue.frictions);
        out.costs = toArray(clue.costs, fallbackClue.costs);

        return out;
    }

    const fallbackSetting = buildFallbackSettingProfile(ACTIVE_GUILDS);
    const preloadedSetting = toPlainObject(global.PRELOADED_SETTING_PROFILE);

    const activeSetting = {
        dm: normalizeDmProfile(preloadedSetting.dm, fallbackSetting.dm, ACTIVE_GUILDS),
        clue: normalizeClueProfile(preloadedSetting.clue, fallbackSetting.clue)
    };

    const DATA = {
        guilds: ACTIVE_GUILDS,

        conditions: [
            { name: 'Blinded', desc: 'Disadv on attacks. Attacks vs have Adv.' },
            { name: 'Charmed', desc: "Can't attack charmer. Charmer has Adv on social." },
            { name: 'Deafened', desc: 'Fail checks involving hearing.' },
            { name: 'Frightened', desc: "Disadv on checks/attacks while source is in sight. Can't move closer." },
            { name: 'Grappled', desc: 'Speed 0. Ends if grappler is incapacitated or effect removes.' },
            { name: 'Incapacitated', desc: "Can't take actions or reactions." },
            { name: 'Paralyzed', desc: 'Incapacitated. Fail Dex/Str saves. Crits within 5ft.' },
            { name: 'Petrified', desc: 'Transformed to stone. Resistance to all damage.' },
            { name: 'Poisoned', desc: 'Disadv on attacks and ability checks.' },
            { name: 'Prone', desc: 'Disadv on attacks. Attacks within 5ft have Adv.' },
            { name: 'Restrained', desc: 'Speed 0. Disadv on Dex saves and attacks.' },
            { name: 'Stunned', desc: 'Incapacitated. Fail Str/Dex saves. Attacks vs have Adv.' },
            { name: 'Unconscious', desc: 'Incapacitated. Drop everything. Fall prone. Fail saves.' }
        ],

        loot: {
            trash: ['A handful of copper (1d10cp)', 'A half-eaten skewer', 'A dented tin cup', 'A small pouch of foul-smelling moss', 'A bent iron nail', 'A scrap of bloodstained velvet'],
            common: ['1d8 gp', 'A silver ring (10gp)', 'A minor health potion', 'A scroll of a 1st level spell', 'A small gemstone (25gp)', 'A well-crafted dagger'],
            rare: ['A bag of holding', 'A +1 weapon', 'A powerful health potion', 'A rare reagent (100gp)', 'An official law sigil', 'An unstable arcane gauntlet']
        },

        dm: activeSetting.dm,
        clue: activeSetting.clue
    };

    global.RTF_DATA = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
