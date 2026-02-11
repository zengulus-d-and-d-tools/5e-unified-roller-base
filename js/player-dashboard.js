const escapeHtml = (str = '') => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

const render = () => {
    const grid = document.getElementById('playerGrid');
    const empty = document.getElementById('emptyState');
    grid.innerHTML = '';

    const players = window.RTF_STORE ? window.RTF_STORE.getPlayers() : [];

    if (!players || players.length === 0) {
        empty.classList.remove('player-hidden');
        return;
    }
    empty.classList.add('player-hidden');

    players.forEach((p, i) => {
        const name = escapeHtml(p.name || '');
        const ac = Number.isFinite(Number(p.ac)) ? Number(p.ac) : 0;
        const pp = Number.isFinite(Number(p.pp)) ? Number(p.pp) : 0;
        const dc = Number.isFinite(Number(p.dc)) ? Number(p.dc) : 0;
        const hpValue = escapeHtml(p.hp || 0);
        const hpNum = parseInt(p.hp, 10);
        const hpLow = !isNaN(hpNum) && hpNum < 10;
        const ppClass = pp >= 15 ? ' player-pp-strong' : '';
        const hpBoxClass = hpLow ? ' player-hp-low' : '';
        const hpLabelClass = hpLow ? ' player-hp-label-low' : '';
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
<div class="card-header">
    <input type="text" class="input-name" value="${name}"
        data-onchange="updatePlayer(${i}, 'name', this.value)" placeholder="AGENT NAME">
        <button class="btn btn-del" data-onclick="deletePlayer(${i})">&times;</button>
</div>

<div class="stat-grid">
    <div class="stat-box">
        <span class="stat-label">AC</span>
        <input type="number" class="stat-val" value="${ac}"
            data-onchange="updatePlayer(${i}, 'ac', parseInt(this.value))">
    </div>
    <div class="stat-box">
        <span class="stat-label">Passive Perc</span>
        <input type="number" class="stat-val${ppClass}" value="${pp}"
            data-onchange="updatePlayer(${i}, 'pp', parseInt(this.value))">
    </div>
    <div class="stat-box">
        <span class="stat-label">Save DC</span>
        <input type="number" class="stat-val" value="${dc}"
            data-onchange="updatePlayer(${i}, 'dc', parseInt(this.value))">
    </div>
</div>

<div class="stat-box player-hp-box${hpBoxClass}">
    <span class="stat-label${hpLabelClass}">Hit Points</span>
    <input type="text" class="stat-val" value="${hpValue}"
        data-onchange="updatePlayer(${i}, 'hp', this.value)" placeholder="Max/Curr">
</div>
    `;
        grid.appendChild(card);
    });
};

const addPlayer = () => {
    if (window.RTF_STORE) {
        window.RTF_STORE.addPlayer({
            name: "New Agent",
            ac: 10,
            hp: 10,
            pp: 10,
            dc: 10,
            dp: 2,
            projectClock: 0,
            projectName: "",
            projectReward: "+1 Reputation"
        });
        render();
    }
};

const ALLOWED_PLAYER_FIELDS = new Set(['name', 'ac', 'pp', 'dc', 'hp']);
const sanitizePlayerUpdateValue = (field, rawValue) => {
    if (field === 'name') return String(rawValue || '').slice(0, 160);
    if (field === 'hp') return String(rawValue || '').slice(0, 40);

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(999, Math.round(parsed)));
};

const updatePlayer = (idx, field, val) => {
    if (window.RTF_STORE) {
        const players = window.RTF_STORE.getPlayers();
        if (!Array.isArray(players)) return;
        if (!Number.isInteger(idx) || idx < 0 || idx >= players.length) return;
        if (!ALLOWED_PLAYER_FIELDS.has(field)) return;
        if (!players[idx] || typeof players[idx] !== 'object') return;

        players[idx][field] = sanitizePlayerUpdateValue(field, val);
        window.RTF_STORE.save({ scope: 'campaign.players' });
        // render(); // Optional: re-render if needed, but input handles display
    }
};

const deletePlayer = (idx) => {
    if (confirm("Disavow this agent? (Delete Player)")) {
        if (window.RTF_STORE) {
            const players = window.RTF_STORE.getPlayers();
            if (!Array.isArray(players) || !Number.isInteger(idx) || idx < 0 || idx >= players.length) return;
            players.splice(idx, 1);
            window.RTF_STORE.save({ scope: 'campaign.players' });
            render();
        }
    }
};

// Init
bindDelegatedDataHandlers();

window.addEventListener('load', () => {
    if (window.RTF_STORE) {
        render();
    } else {
        setTimeout(render, 100);
    }
});

window.addEventListener('rtf-store-updated', (event) => {
    if (!event || !event.detail || event.detail.source !== 'remote') return;
    render();
});
