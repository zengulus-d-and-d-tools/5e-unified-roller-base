export const Dice = {
    coreRoll(count, sides, mode = 'norm', mods = {}) {
        let rolls = [];
        let total = 0;
        let isCrit = false;
        let isFail = false;
        let formula = "";

        if (count === 1 && sides === 20 && mode !== 'norm') {
            const r1 = Math.floor(Math.random() * sides) + 1;
            const r2 = Math.floor(Math.random() * sides) + 1;
            rolls = [r1, r2];

            if (mode === 'adv') {
                total = Math.max(r1, r2);
                formula = `[${r1}, ${r2}] (High)`;
            } else {
                total = Math.min(r1, r2);
                formula = `[${r1}, ${r2}] (Low)`;
            }

            if (total === 20) isCrit = true;
            if (total === 1) isFail = true;
        } else {
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
                rollObjs.push({ val: r, dropped: false, originalIdx: i });
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
                valList.push(obj.dropped ? `~~${obj.val}~~` : obj.val);
            });

            if (count === 1 && sides === 20 && total === 20) isCrit = true;
            if (count === 1 && sides === 20 && total === 1) isFail = true;

            formula = `[${valList.join('+')}]`;
        }

        return { total, rolls, formula, isCrit, isFail };
    },

    parseRollModifiers(str) {
        let mods = { r: 0, dl: 0, kh: 0 };
        if (!str) return mods;
        const rMatch = str.match(/r(\d+)/);
        if (rMatch) mods.r = parseInt(rMatch[1]);
        const dlMatch = str.match(/d[l]?(\d+)/);
        if (dlMatch) mods.dl = parseInt(dlMatch[1]);
        const khMatch = str.match(/k[h]?(\d+)/);
        if (khMatch) mods.kh = parseInt(khMatch[1]);
        return mods;
    },

    parseComplexBonus(str) {
        if (!str) return { total: 0, text: '' };
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

            const mods = this.parseRollModifiers(modStr);
            const res = this.coreRoll(count, sides, 'norm', mods);

            total += (res.total * sign);
            const signStr = sign === -1 ? '-' : '+';
            let form = res.formula;
            if (modStr) form += modStr;
            parts.push(`${signStr}${form}`);
        });

        // Parse flat bonuses
        const flatRegex = /([+-]?)\s*(\d+)(?!\s*d)/gi;
        while ((match = flatRegex.exec(str)) !== null) {
            const sign = (match[1].trim() === '-') ? -1 : 1;
            const val = parseInt(match[2]);
            total += (val * sign);
            parts.push(`${sign === -1 ? '-' : '+'}${val}`);
        }

        return { total, text: parts.join(' ') };
    }
};
