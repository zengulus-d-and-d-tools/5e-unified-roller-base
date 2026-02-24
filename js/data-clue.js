(function (global) {
    const FACTION_PROFILES = [
        {
            id: 'sentinel-order',
            name: 'Sentinel Order',
            icon: '🛡️',
            phys: ['a stamped warrant fragment', 'an iron badge shard'],
            soc: ['a watch captain citing procedure', 'a clerk guarding sealed archives'],
            arc: ['a checkpoint ward lattice', 'an oath-binding residue']
        },
        {
            id: 'wildborne-clans',
            name: 'Wildborne Clans',
            icon: '🌲',
            phys: ['a carved totem sliver', 'a hide-wrapped trail marker'],
            soc: ['a clan scout testing outsiders', 'an elder brokering passage rights'],
            arc: ['a primal rite scorch ring', 'a lingering beast-bond echo']
        },
        {
            id: 'aether-collegium',
            name: 'Aether Collegium',
            icon: '🔮',
            phys: ['a cracked crystal conduit', 'an alchemical vial with sigils'],
            soc: ['an apprentice arguing runes', 'a scholar protecting a prototype'],
            arc: ['a volatile mana trace', 'a containment circle hum']
        }
    ];

    function toEntries(list, contextA, contextB) {
        const first = list && list[0] ? String(list[0]) : 'an uncertain clue';
        const second = list && list[1] ? String(list[1]) : first;
        return [
            { core: first, surf: contextA },
            { core: second, surf: contextB },
            { core: 'a corroborating witness note', surf: 'matching details from two independent reports' }
        ];
    }

    const guilds = FACTION_PROFILES.map((row) => ({
        id: row.id,
        name: row.name,
        icon: row.icon,
        phys: toEntries(row.phys, 'left behind during a rushed withdrawal', 'tagged with local handling marks'),
        soc: toEntries(row.soc, 'careful not to reveal sponsors', 'echoed by rumor chains in nearby taverns'),
        arc: toEntries(row.arc, 'detectable with basic arcane checks', 'strongest around doors and chokepoints')
    }));

    global.CLUEDATA = {
        guilds,
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
    };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
