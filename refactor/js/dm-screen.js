(function () {
    // Ensure we are looking at the right global scope
    const data = (window.RTF_DATA) || (window.DATA);

    if (!data || !data.dm) {
        console.error('DM data unavailable', window.RTF_DATA);
        // Alert the user so they know something is wrong locally
        alert("Critical Error: Data file not loaded or incomplete. Please refresh or check console.");
        return;
    }

    const guilds = data.guilds;
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

    function setText(id, html) {
        const box = document.getElementById(id);
        if (!box) return;
        const content = box.querySelector(id.includes('texture') ? '.texture-out' : '.text-output');
        if (!content) return;
        content.innerHTML = html;
        box.classList.add('active');
    }

    function genStreetScene() {
        console.log("genStreetScene called");
        const rollActor = d(12);
        let actorName = '';
        let actionList = [];

        if (rollActor <= 10) {
            actorName = guilds[rollActor - 1];
            actionList = actions[actorName];
        } else if (rollActor === 11) {
            actorName = 'Environment';
            actionList = actions.Env;
        } else {
            actorName = 'Guildless';
            actionList = actions.Guildless;
        }

        const action = rand(actionList);
        const compl = rand(whatsHappening);
        const rollSource = d(12);
        const sourceName = rollSource <= 10 ? guilds[rollSource - 1] : (rollSource === 11 ? 'Hazard' : 'Gang');

        const box = document.getElementById('out-street');
        if (box) box.classList.add('active');
        const content = document.getElementById('dispatch-content');
        if (!content) {
            console.error("dispatch-content element not found");
            return;
        }
        content.innerHTML = `
            <div class="dispatch-row"><div class="dispatch-label">Actor</div><div class="dispatch-val highlight">${actorName}</div></div>
            <div class="dispatch-row"><div class="dispatch-label">Activity</div><div class="dispatch-val">${action}</div></div>
            <div class="dispatch-row"><div class="dispatch-label">Conflict</div><div class="dispatch-val alert">${compl}</div></div>
            <div class="dispatch-row"><div class="dispatch-label">Source</div><div class="dispatch-val">${sourceName}</div></div>
        `;
    }

    function genTexture(type) {
        console.log("genTexture called with type:", type);
        let html = '';
        if (type === 'struct') {
            html = `<span class="hl-txt">${rand(txtStruct.a)}</span>, made of <span class="hl-ctx">${rand(txtStruct.b)}</span>, currently <span class="hl-state">${rand(txtStruct.c)}</span>.`;
        } else if (type === 'guts') {
            html = `<span class="hl-txt">${rand(txtGuts.a)}</span>, for <span class="hl-ctx">${rand(txtGuts.b)}</span>, currently <span class="hl-state">${rand(txtGuts.c)}</span>.`;
        } else if (type === 'debris') {
            html = `<span class="hl-txt">${rand(txtDebris.a)}</span>, found <span class="hl-ctx">${rand(txtDebris.b)}</span>, <span class="hl-state">${rand(txtDebris.c)}</span>.`;
        } else if (type === 'atmos') {
            html = `Light from <span class="hl-txt">${rand(txtAtmos.a)}</span>, which is <span class="hl-ctx">${rand(txtAtmos.b)}</span>, <span class="hl-state">${rand(txtAtmos.c)}</span>.`;
        }
        setText('out-texture', html);
    }

    function genNPC() {
        console.log("genNPC called");
        const roll = d(6) + d(6) - 2;
        const res = npcs[roll];
        const g = rand(guilds);
        setText('out-npc', `
            <div class="out-main"><span style="color:var(--accent)">${g}</span> NPC</div>
            <div style="margin-top:5px; font-size:0.9rem;"><strong>Wants:</strong> ${res.w}</div>
            <div style="margin-top:2px; font-size:0.9rem;"><strong>Leverage:</strong> ${res.l}</div>
        `);
    }

    function genHazard() {
        console.log("genHazard called");
        const roll = d(6) + d(6);
        const h = hazards.find(x => x.roll === roll);
        if (!h) {
            console.error("No hazard found for roll:", roll);
            return;
        }
        setText('out-hazard', `
            <div class="out-main out-heat">${h.name}</div>
            <div class="out-sub">${h.eff}</div>
        `);
    }

    function genSnag() {
        console.log("genSnag called");
        const roll = d(20) + d(20);
        const s = snags[roll] || snags[21];
        setText('out-hazard', `
            <div class="out-main out-heat">${s.n}</div>
            <div class="out-sub">${s.e}</div>
            <div class="out-sub" style="margin-top:4px;">Roll: ${roll}</div>
        `);
    }

    function genBroadsheet() {
        console.log("genBroadsheet called");
        const roll = d(6) - 1;
        const p = papers[roll];
        if (!p) {
            console.error("No broadsheet found for roll:", roll);
            return;
        }
        const cls = p.e.includes('Heat +') ? 'out-heat' : 'out-good';
        setText('out-paper', `
            <div class="out-main">${p.n}</div>
            <div class="out-sub">Tone: ${p.t}</div>
            <div class="${cls}" style="font-weight:bold; font-size:0.8rem; margin-top:5px;">${p.e}</div>
        `);
    }

    function toggleRef(id) {
        console.log("toggleRef called with id:", id);
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
            console.log("Filling accordion content for:", id);
            if (id === 'clue-ref') {
                body.innerHTML = clueSigs.map(c => `
                    <tr><td class="ref-hl">${c.g}</td><td><span class="clue-type">PHYSICAL:</span> ${c.p}<br><span class="clue-type" style="margin-top:4px;">SOCIAL:</span> ${c.s}<br><span class="clue-type" style="margin-top:4px; color:var(--accent-dim); text-shadow:0 0 1px var(--accent);">ARCANE:</span> ${c.a}</td></tr>
                `).join('');
            } else if (id === 'guild-ref') {
                body.innerHTML = guildRefs.map(g => `<tr><td class="ref-hl">${g.n}</td><td>${g.j}</td><td style="color:#fff;">${g.b}</td></tr>`).join('');
            }
        }
        el.classList.toggle('open');
    }

    // Expose to window explicitly
    window.genStreetScene = genStreetScene;
    window.genTexture = genTexture;
    window.genNPC = genNPC;
    window.genHazard = genHazard;
    window.genSnag = genSnag;
    window.genBroadsheet = genBroadsheet;
    window.toggleRef = toggleRef;

    console.log("DM Screen Script Loaded Successfully. Data Present:", !!data);
    console.log("Exposed functions:", {
        genStreetScene: !!window.genStreetScene,
        genTexture: !!window.genTexture,
        genNPC: !!window.genNPC,
        genHazard: !!window.genHazard,
        genSnag: !!window.genSnag,
        genBroadsheet: !!window.genBroadsheet,
        toggleRef: !!window.toggleRef
    });
})();
