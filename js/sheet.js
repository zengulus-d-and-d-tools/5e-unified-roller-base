import { Dice } from './dice.js';

export const Sheet = {
    getMod(score) {
        return Math.floor((score - 10) / 2);
    },

    getPB(level) {
        return Math.floor((level - 1) / 4) + 2;
    },

    getEffectiveCasterLevel(level, type) {
        if (type === 'full') return level;
        if (type === 'half') return Math.floor(level / 2);
        if (type === 'third') return Math.floor(level / 3);
        if (type === 'pact') return level;
        return 0;
    },

    getSaveBonus(stat, charData) {
        const mod = this.getMod(charData.stats[stat].val);
        const pb = this.getPB(charData.meta.level);
        const isProf = charData.stats[stat].save || false;
        return mod + (isProf ? pb : 0);
    },

    getSkillBonus(skillName, charData) {
        const stat = (charData.skillOverrides && charData.skillOverrides[skillName])
            ? charData.skillOverrides[skillName]
            : this.skillsMap[skillName];
        const mod = this.getMod(charData.stats[stat].val);
        const pb = this.getPB(charData.meta.level);
        const prof = charData.skills[skillName] || 0;

        let misc = 0;
        const miscVal = (charData.skillMisc && charData.skillMisc[skillName]) ? charData.skillMisc[skillName] : "";
        if (this.stats.includes(miscVal)) {
            misc = this.getMod(charData.stats[miscVal].val);
        } else {
            misc = parseInt(miscVal) || 0;
        }

        return mod + (prof * pb) + misc;
    },

    stats: ['str', 'dex', 'con', 'int', 'wis', 'cha'],

    skillsMap: {
        'acrobatics': 'dex', 'animal handling': 'wis', 'arcana': 'int', 'athletics': 'str',
        'deception': 'cha', 'history': 'int', 'insight': 'wis', 'intimidation': 'cha',
        'investigation': 'int', 'medicine': 'wis', 'nature': 'int', 'perception': 'wis',
        'performance': 'cha', 'persuasion': 'cha', 'religion': 'int', 'sleight of hand': 'dex',
        'stealth': 'dex', 'survival': 'wis'
    },

    spellSlotTable: {
        full: [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
        [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
        [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]],
        pact: [[1], [2], [2], [2], [2], [2], [2], [2], [2], [2],
        [3], [3], [3], [3], [3], [3], [4], [4], [4], [4]]
    },

    calculateStandardAC(base, dexMod, dexCap) {
        let effectiveDex = dexMod;
        if (dexCap !== null && dexCap !== 100) {
            effectiveDex = Math.min(dexMod, dexCap);
        }
        return base + effectiveDex;
    },

    getDefaultChar() {
        let char = {
            meta: { player: '', name: 'New Character', level: 1, casterType: 'none', webhook: '', discordActive: false, init: 0, speed: '' },
            vitals: { curr: '', max: '', temp: '', hdDie: 'd8', hdCurr: 1, hdMax: 1, inspiration: 0, ds: { s1: false, s2: false, s3: false, f1: false, f2: false, f3: false } },
            ac: { mode: 'std', dexCap: '100', base: 10, bonus: 0, customStat1: 'dex', customStat2: 'none', bonuses: [] },
            stats: {
                str: { val: 10, save: false },
                dex: { val: 10, save: false },
                con: { val: 10, save: false },
                int: { val: 10, save: false },
                wis: { val: 10, save: false },
                cha: { val: 10, save: false }
            },
            skills: {},
            skillOverrides: {},
            skillMisc: {},
            attacks: [],
            features: [],
            spells: [],
            resources: [],
            rollMode: 'norm',
            uiState: { cardOrder: [] }
        };
        Object.keys(this.skillsMap).forEach(s => char.skills[s] = 0);
        for (let i = 1; i <= 9; i++) char.spells.push({ lvl: i, max: 0, used: 0 });
        return char;
    }
};
