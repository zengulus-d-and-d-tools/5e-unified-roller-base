(function (global) {
    const FACTIONS = [
        'Sentinel Order',
        'Wildborne Clans',
        'Aether Collegium'
    ];

    const CLUE_THEME = {
        'Sentinel Order': {
            icon: '🛡️',
            phys: ['signed patrol warrants', 'iron badge fragments'],
            soc: ['watch captains reciting procedure', 'court clerks protecting records'],
            arc: ['warded checkpoint sigils', 'oath-bond residue']
        },
        'Wildborne Clans': {
            icon: '🌲',
            phys: ['totem carvings', 'mud-tracked hide wrappings'],
            soc: ['scouts challenging outsiders', 'camp elders bargaining for territory'],
            arc: ['primal rite scorch marks', 'beast-bond echoes']
        },
        'Aether Collegium': {
            icon: '🔮',
            phys: ['etched crystal conduits', 'alchemical ampoules'],
            soc: ['apprentices debating formulas', 'scholars guarding prototypes'],
            arc: ['unstable mana traces', 'containment circles still humming']
        }
    };

    const actions = {
        'Sentinel Order': [
            'setting up cordons',
            'cross-checking witness statements',
            'escorting a magistrate',
            'sealing an evidence locker',
            'posting emergency decrees'
        ],
        'Wildborne Clans': [
            'marking territorial trails',
            'scouting rooftops and ridgelines',
            'breaking abandoned barricades',
            'staging a bonfire moot',
            'tracking quarry through alleys'
        ],
        'Aether Collegium': [
            'calibrating ley relays',
            'repairing arc conduits',
            'testing volatile reagents',
            'quarantining a lab bay',
            'mapping magical interference'
        ],
        Env: [
            'a scaffold collapse blocks transit',
            'storm runoff floods a narrow passage',
            'dense fog cuts visibility to a few strides',
            'a ward blackout disrupts lighting',
            'market panic causes a stampede'
        ]
    };

    const clueSigs = FACTIONS.map((name) => ({
        g: name,
        p: CLUE_THEME[name].phys[0],
        s: CLUE_THEME[name].soc[0],
        a: CLUE_THEME[name].arc[0]
    }));

    const guildRefs = [
        { n: 'Sentinel Order', j: 'Courts, barracks, civic law zones', b: 'Can clear legal barriers and secure routes' },
        { n: 'Wildborne Clans', j: 'Ruins, overgrowth belts, rough outskirts', b: 'Can bypass terrain and spot ambush lanes' },
        { n: 'Aether Collegium', j: 'Labs, observatories, arc infrastructure', b: 'Can analyze magical residue and hazards fast' }
    ];

    const clueGuilds = FACTIONS.map((name) => {
        const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const theme = CLUE_THEME[name];
        return {
            id: slug,
            name,
            icon: theme.icon,
            phys: [
                { core: theme.phys[0], surf: 'left behind during a rushed withdrawal' },
                { core: theme.phys[1], surf: 'tagged with local handling marks' },
                { core: 'an inventory discrepancy', surf: `pointing back to ${name.toLowerCase()}` }
            ],
            soc: [
                { core: theme.soc[0], surf: 'careful not to reveal their sponsor' },
                { core: theme.soc[1], surf: 'controlling the story before dawn' },
                { core: 'a rumor chain', surf: `naming ${name.toLowerCase()} intermediaries` }
            ],
            arc: [
                { core: theme.arc[0], surf: 'detectable with basic arcane checks' },
                { core: theme.arc[1], surf: 'strongest near doors and chokepoints' },
                { core: 'a disrupted ward lattice', surf: `overwritten by ${name.toLowerCase()} methods` }
            ]
        };
    });

    global.PRELOADED_SETTING_PROFILE = {
        dm: {
            actions,
            whatsHappening: [
                'A hard deadline is hours away',
                'Public pressure is escalating rapidly',
                'Key evidence is being moved right now',
                'A rival crew arrives ahead of the party',
                'Command authority is disputed on-site',
                'Rumors are outpacing verified facts'
            ],
            textures: {
                struct: {
                    a: ['A cracked support arch', 'A chained service gate', 'A leaning watch parapet'],
                    b: ['built from old stone and iron', 'patched with scavenged timber', 'reinforced with fresh rivets'],
                    c: ['groaning under stress', 'freshly braced after impact', 'slowly failing at key joints']
                },
                guts: {
                    a: ['A pressure conduit line', 'A rune relay panel', 'A bell-wire signal track'],
                    b: ['moving heat and water', 'routing district ward signals', 'linking nearby watch posts'],
                    c: ['hissing unpredictably', 'sparking at bad intervals', 'ringing with delayed echoes']
                },
                debris: {
                    a: ['A broken signet', 'A blood-flecked map scrap', 'A dropped lockpick roll'],
                    b: ['half-hidden in mud', 'wedged below a bench', 'trampled at an alley fork'],
                    c: ['implying a hurried retreat', 'suggesting a staged struggle', 'showing multiple teams crossed paths']
                },
                atmos: {
                    a: ['Torchlight in iron sconces', 'Moonlight through torn canvas', 'Lantern glow in dense fog'],
                    b: ['fighting strong crosswinds', 'diffused through smoke and dust', 'casting long uneven shadows'],
                    c: ['obscuring range and depth', 'making silhouettes deceptive', 'hiding movement at the edges']
                }
            },
            clueSigs,
            npcs: [
                { w: 'Promotion inside their faction', l: 'Witnesses place them at the wrong scene' },
                { w: 'Debt relief before winter', l: 'A hidden ledger names them directly' },
                { w: 'Transfer away from dangerous duty', l: 'They forged one critical signature' },
                { w: 'Protection for their family', l: 'A courier satchel links them to smugglers' },
                { w: 'Control over the public narrative', l: 'Their statements conflict twice' },
                { w: 'Approval for an unsanctioned plan', l: 'A seized prototype proves negligence' },
                { w: 'Revenge on a rival commander', l: 'Their agent was seen planting evidence' },
                { w: 'Access to restricted archives', l: 'They stole an official seal' },
                { w: 'District stability at all costs', l: 'They buried a warning to avoid panic' },
                { w: 'Exclusive trade privileges', l: 'They bribed a gate inspector' },
                { w: 'Chaos to mask a second objective', l: 'A failsafe charge is still primed' }
            ],
            hazards: [
                { roll: 2, name: 'Arc Discharge', eff: 'DC 13 Dex save or take 1d6 lightning damage.' },
                { roll: 3, name: 'Broken Ground', eff: 'Area counts as difficult terrain.' },
                { roll: 4, name: 'Reinforced Checkpoint', eff: 'Requires payment, permit, or alternate route.' },
                { roll: 5, name: 'Crowd Surge', eff: 'DC 13 Str save or be pushed 10 feet.' },
                { roll: 6, name: 'Dense Fog', eff: 'Heavily obscured beyond 10 feet.' },
                { roll: 7, name: 'Crumbling Floor', eff: 'Heavy impact risks a 20-foot fall.' },
                { roll: 8, name: 'Toxic Fumes', eff: 'DC 12 Con save or poisoned for 1 round.' },
                { roll: 9, name: 'Suppression Ward', eff: 'Casting requires a DC 12 concentration check.' },
                { roll: 10, name: 'Loose Masonry', eff: 'Cover may collapse under pressure.' },
                { roll: 11, name: 'Dread Pulse', eff: 'DC 12 Wis save or lose movement this turn.' },
                { roll: 12, name: 'Signal Horn', eff: 'Nearby defenders are alerted and reinforce.' }
            ],
            snags: {
                2: { n: 'District Lockdown', e: 'Entry requires credentials, favors, or force.' },
                10: { n: 'Mandatory Toll', e: 'Pay resources or lose time rerouting.' },
                21: { n: 'Routine Bureaucracy', e: 'Paperwork delay slows progress.' },
                30: { n: 'Flooded Access', e: 'Movement becomes noisy and difficult.' },
                40: { n: 'Sanctified Ground', e: 'Violence risks heavy social backlash.' }
            },
            papers: [
                { n: 'District Chronicle', t: 'Sensationalist', e: 'Heat +1 (public alarm)' },
                { n: 'Civic Gazette', t: 'Legal', e: 'Heat +1 (internal attention)' },
                { n: 'Frontier Circular', t: 'Defiant', e: 'No immediate change' },
                { n: 'Scholars Bulletin', t: 'Technical', e: 'Heat -1 if resolved quickly' },
                { n: 'Public Banner', t: 'Heroic', e: 'Heat -1 if collateral stays low' },
                { n: 'Market Ledger', t: 'Financial', e: 'No immediate change' }
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
                'Buried in Debris',
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
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
