(() => {
    const data = window.RTF_DATA;
    if (!data || !data.clue) {
        console.error('Clue data unavailable');
        return;
    }

    const { guilds: GUILDS, frictions: FRICTIONS, costs: COSTS } = data.clue;

    // Status: 0 = Grey, 1 = Herring (Orange), 2 = Involved (Green)
    let guildStatus = new Array(10).fill(0);

    // --- INITIALIZATION ---
    function init() {
        const grid = document.getElementById('guildGrid');
        GUILDS.forEach((g, idx) => {
            const btn = document.createElement('div');
            btn.className = 'guild-btn st-0';
            btn.innerHTML = `
                <span class="status-badge"></span>
                <span class="g-icon">${g.icon}</span>
                <span class="g-name">${g.name}</span>
            `;
            btn.onclick = () => toggleStatus(idx, btn);
            grid.appendChild(btn);
        });
    }

    function toggleStatus(idx, btn) {
        guildStatus[idx] = (guildStatus[idx] + 1) % 3;
        btn.className = `guild-btn st-${guildStatus[idx]}`;
        const badge = btn.querySelector('.status-badge');
        if (guildStatus[idx] === 1) badge.innerText = 'NOISE';
        if (guildStatus[idx] === 2) badge.innerText = 'SIGNAL';
        if (guildStatus[idx] === 0) badge.innerText = '';
    }

        // --- GENERATOR LOGIC ---
    function generateClue() {
        const mode = document.getElementById('modeSel').value;
        const involvedIndices = guildStatus.map((s, i) => (s === 2 ? i : -1)).filter(i => i !== -1);
        const herringIndices = guildStatus.map((s, i) => (s === 1 ? i : -1)).filter(i => i !== -1);

        if (involvedIndices.length === 0) {
            alert('Please select at least one INVOLVED (Green) guild.');
            return;
        }

        const signalIdx = involvedIndices[Math.floor(Math.random() * involvedIndices.length)];
        const signalGuild = GUILDS[signalIdx];

        let noiseIdx = -1;
        if (herringIndices.length > 0) {
            noiseIdx = herringIndices[Math.floor(Math.random() * herringIndices.length)];
        } else {
            const available = GUILDS.map((_, i) => i).filter(i => i !== signalIdx);
            noiseIdx = available[Math.floor(Math.random() * available.length)];
        }
        const noiseGuild = GUILDS[noiseIdx];

        const coreItem = signalGuild[mode][Math.floor(Math.random() * signalGuild[mode].length)];
        const surfItem = noiseGuild[mode][Math.floor(Math.random() * noiseGuild[mode].length)];

        const signalIsCore = Math.random() < 0.5;
        const signalBlock = signalIsCore
            ? { text: coreItem.core, guild: signalGuild.name, type: 'Core' }
            : { text: surfItem.surf, guild: noiseGuild.name, type: 'Surface' };
        const noiseBlock = signalIsCore
            ? { text: surfItem.surf, guild: noiseGuild.name, type: 'Surface' }
            : { text: coreItem.core, guild: signalGuild.name, type: 'Core' };

        const friction = FRICTIONS[Math.floor(Math.random() * FRICTIONS.length)];
        const cost = COSTS[Math.floor(Math.random() * COSTS.length)];

        renderResult(mode, signalBlock, noiseBlock, friction, cost);
    }

    function renderResult(mode, signal, noise, friction, cost) {
        const card = document.getElementById('resultCard');
        card.style.display = 'none';
        card.offsetHeight;
        card.style.display = 'block';

        document.getElementById('outType').innerText = mode.toUpperCase() + ' EVIDENCE';

        document.getElementById('sigLabel').innerText = `The Signal (${signal.type})`;
        document.getElementById('sigGuild').innerText = signal.guild;
        document.getElementById('sigVal').innerText = signal.text.charAt(0).toUpperCase() + signal.text.slice(1);

        document.getElementById('noiseLabel').innerText = `The Noise (${noise.type})`;
        document.getElementById('noiseGuild').innerText = noise.guild;
        document.getElementById('noiseVal').innerText = noise.text.charAt(0).toUpperCase() + noise.text.slice(1);

        document.getElementById('outFric').innerText = friction;
        document.getElementById('outCost').innerText = cost;
    }

    init();
    window.generateClue = generateClue;
})();
