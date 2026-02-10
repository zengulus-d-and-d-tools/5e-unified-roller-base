(function () {
    // Ensure we are looking at the right global scope
    const data = (window.RTF_DATA) || (window.DATA);

    if (!data || !data.dm) {
        console.error('DM data unavailable', window.RTF_DATA);
        // Alert the user so they know something is wrong locally
        alert("Critical Error: Data file not loaded or incomplete. Please refresh or check console.");
        return;
    }

    const guilds = Array.isArray(data.guilds) ? data.guilds.filter(Boolean) : [];
    const actions = data.dm.actions;
    const whatsHappening = data.dm.whatsHappening;
    const { struct: txtStruct, guts: txtGuts, debris: txtDebris, atmos: txtAtmos } = data.dm.textures;
    const clueSigs = data.dm.clueSigs;
    const npcs = data.dm.npcs;
    const hazards = data.dm.hazards;
    const snags = data.dm.snags;
    const papers = data.dm.papers;
    const guildRefs = data.dm.guildRefs;

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
        const fallbackGuilds = Object.keys(actions || {}).filter((key) => key !== 'Env' && key !== 'Guildless');
        const activeGuilds = guilds.length ? guilds : fallbackGuilds;
        const actorPool = [...activeGuilds, 'Environment', 'Guildless'];
        const actorName = rand(actorPool);

        let actionList = [];
        if (actorName === 'Environment') {
            actionList = actions.Env || [];
        } else if (actorName === 'Guildless') {
            actionList = actions.Guildless || [];
        } else {
            actionList = actions[actorName] || actions.Env || actions.Guildless || [];
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
        const g = rand(guilds.length ? guilds : ['Unknown Faction']);
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
        const h = hazards.find(x => x.roll === roll);
        if (!h) {
            console.error("No hazard found for roll:", roll);
            return;
        }
        setText('out-hazard', `
            <div class="out-main out-heat">${escapeHtml(h.name || '')}</div>
            <div class="out-sub">${escapeMultiline(h.eff || '')}</div>
        `);
    }

    function genSnag() {
        const roll = d(20) + d(20);
        const s = snags[roll] || snags[21];
        setText('out-hazard', `
            <div class="out-main out-heat">${escapeHtml((s && s.n) || '')}</div>
            <div class="out-sub">${escapeMultiline((s && s.e) || '')}</div>
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
