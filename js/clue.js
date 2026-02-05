(() => {
    const state = {
        data: null,
        guildStatus: [],
        dom: {},
        cardVisible: false
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

    const pickEntry = (guild, mode) => {
        const list = guild[mode] || [];
        return list[randIndex(list.length)] || { core: '', surf: '' };
    };

    const getClueData = () => {
        if (state.data) return state.data;
        const inline = window.CLUEDATA || (window.RTF_DATA && window.RTF_DATA.clue);
        if (!inline) {
            console.error('Clue data unavailable');
            return null;
        }
        state.data = inline;
        state.guildStatus = new Array(inline.guilds.length).fill(0);
        return inline;
    };

    const buildGuildGrid = () => {
        const { grid } = state.dom;
        const data = state.data;
        if (!grid || !data) return;
        grid.innerHTML = '';
        data.guilds.forEach((guild, idx) => {
            const btn = document.createElement('div');
            btn.className = 'guild-btn st-0';
            btn.innerHTML = `
                <span class="status-badge"></span>
                <span class="g-icon">${guild.icon}</span>
                <span class="g-name">${guild.name}</span>
            `;
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
        if (state.guildStatus[idx] === 1) badge.innerText = 'NOISE';
        else if (state.guildStatus[idx] === 2) badge.innerText = 'SIGNAL';
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
        dom.objectLabel.innerText = `${objectIsSignal ? 'The Signal' : 'The Noise'} (Object)`;
        dom.objectLabel.style.color = objectIsSignal ? 'var(--st-green)' : 'var(--st-orange)';
        dom.objectGuild.innerText = objectData.guild;
        dom.objectVal.innerText = capitalize(objectData.text);

        const contextIsSignal = contextData.role === 'signal';
        dom.contextBlock.classList.toggle('signal', contextIsSignal);
        dom.contextBlock.classList.toggle('noise', !contextIsSignal);
        dom.contextLabel.innerText = `${contextIsSignal ? 'The Signal' : 'The Noise'} (Context)`;
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
            alert('Please select at least one INVOLVED (Green) guild.');
            return;
        }

        const signalIdx = involvedIndices[randIndex(involvedIndices.length)];
        const signalGuild = data.guilds[signalIdx];

        let noiseIdx;
        if (herringIndices.length > 0) {
            noiseIdx = herringIndices[randIndex(herringIndices.length)];
        } else {
            const available = data.guilds.map((_, i) => i).filter(i => i !== signalIdx);
            noiseIdx = available[randIndex(available.length)];
        }
        const noiseGuild = data.guilds[noiseIdx];

        const signalEntry = pickEntry(signalGuild, mode);
        const noiseEntry = pickEntry(noiseGuild, mode);
        const objectIsSignal = Math.random() < 0.5;

        const objectData = objectIsSignal
            ? { text: signalEntry.core, guild: signalGuild.name, role: 'signal', kind: 'Object' }
            : { text: noiseEntry.core, guild: noiseGuild.name, role: 'noise', kind: 'Object' };

        const contextData = objectIsSignal
            ? { text: noiseEntry.surf, guild: noiseGuild.name, role: 'noise', kind: 'Context' }
            : { text: signalEntry.surf, guild: signalGuild.name, role: 'signal', kind: 'Context' };

        const friction = data.frictions[randIndex(data.frictions.length)];
        const cost = data.costs[randIndex(data.costs.length)];

        renderResult(mode, objectData, contextData, friction, cost);
    };

    const init = () => {
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
