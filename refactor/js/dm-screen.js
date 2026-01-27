import { DATA } from './data.js';

const guilds = DATA.guilds;
const actions = DATA.dm.actions;
const whatsHappening = DATA.dm.whatsHappening;
const { struct: txtStruct, guts: txtGuts, debris: txtDebris, atmos: txtAtmos } = DATA.dm.textures;
const clueSigs = DATA.dm.clueSigs;
const npcs = DATA.dm.npcs;
const hazards = DATA.dm.hazards;
const snags = DATA.dm.snags;
const papers = DATA.dm.papers;
const guildRefs = DATA.dm.guildRefs;

        // --- LOGIC ---

        function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
        function d(n) { return Math.floor(Math.random() * n) + 1; }

        function setText(id, html) {
            const box = document.getElementById(id);
            const content = box.querySelector(id.includes('texture') ? '.texture-out' : '.text-output');
            content.innerHTML = html;
            box.classList.add('active');
        }

        function genStreetScene() {
            const rollActor = d(12);
            let actorName = "";
            let actionList = [];

            if (rollActor <= 10) {
                actorName = guilds[rollActor - 1];
                actionList = actions[actorName];
            } else if (rollActor === 11) {
                actorName = "Environment";
                actionList = actions["Env"];
            } else {
                actorName = "Guildless";
                actionList = actions["Guildless"];
            }

            const action = rand(actionList);
            const compl = rand(whatsHappening);
            const rollSource = d(12);
            let sourceName = rollSource <= 10 ? guilds[rollSource - 1] : (rollSource === 11 ? "Hazard" : "Gang");

            const box = document.getElementById('out-street');
            box.classList.add('active');
            const content = document.getElementById('dispatch-content');
            content.innerHTML = `
            <div class="dispatch-row"><div class="dispatch-label">Actor</div><div class="dispatch-val highlight">${actorName}</div></div>
            <div class="dispatch-row"><div class="dispatch-label">Activity</div><div class="dispatch-val">${action}</div></div>
            <div class="dispatch-row"><div class="dispatch-label">Conflict</div><div class="dispatch-val alert">${compl}</div></div>
            <div class="dispatch-row"><div class="dispatch-label">Source</div><div class="dispatch-val">${sourceName}</div></div>
        `;
        }

        function genTexture(type) {
            let html = "";
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
            const roll = d(6) + d(6);
            const h = hazards.find(x => x.roll === roll);
            setText('out-hazard', `
            <div class="out-main out-heat">${h.name}</div>
            <div class="out-sub">${h.eff}</div>
        `);
        }

        function genSnag() {
            const roll = d(20) + d(20);
            let s = snags[roll] || snags[21];
            setText('out-hazard', `
            <div class="out-main out-heat">${s.n}</div>
            <div class="out-sub">${s.e}</div>
            <div class="out-sub" style="margin-top:4px;">Roll: ${roll}</div>
        `);
        }

        function genBroadsheet() {
            const roll = d(6) - 1;
            const p = papers[roll];
            const cls = p.e.includes("Heat +") ? "out-heat" : "out-good";
            setText('out-paper', `
            <div class="out-main">${p.n}</div>
            <div class="out-sub">Tone: ${p.t}</div>
            <div class="${cls}" style="font-weight:bold; font-size:0.8rem; margin-top:5px;">${p.e}</div>
        `);
        }

        function toggleRef(id) {
            const el = document.getElementById(id);
            const body = el.querySelector('tbody');
            if (body.innerHTML.trim() === "") {
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

        window.genStreetScene = genStreetScene;
        window.genTexture = genTexture;
        window.genNPC = genNPC;
        window.genHazard = genHazard;
        window.genSnag = genSnag;
        window.genBroadsheet = genBroadsheet;
        window.toggleRef = toggleRef;
