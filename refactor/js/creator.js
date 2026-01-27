export const Creator = {
    methods: {
        standardArray: [15, 14, 13, 12, 10, 8],
        roll4d6() {
            let pools = [];
            for (let i = 0; i < 6; i++) {
                let rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
                rolls.sort((a, b) => b - a);
                pools.push(rolls[0] + rolls[1] + rolls[2]);
            }
            return pools.sort((a, b) => b - a);
        }
    },

    races: {
        "Human": { features: ["Versatile: +1 to all stats"], stats: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 } },
        "Elf": { features: ["Darkvision", "Fey Ancestry"], stats: { dex: 2 } },
        "Dwarf": { features: ["Darkvision", "Dwarven Resilience"], stats: { con: 2 } }
        // ... add more from original or keep it flexible
    },

    classes: {
        "Fighter": { hd: 'd10', skills: 2, features: ["Fighting Style", "Second Wind"] },
        "Wizard": { hd: 'd6', skills: 2, features: ["Arcane Recovery", "Spellcasting"], casterType: 'full' },
        "Rogue": { hd: 'd8', skills: 4, features: ["Expertise", "Sneak Attack"] }
    }
};
