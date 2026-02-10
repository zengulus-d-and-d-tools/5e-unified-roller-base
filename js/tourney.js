let data = { matches: [], active: false, meta: {} };
        let curId = null;
        const escapeHtml = (str = '') => String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
            } catch (err) {
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

        // --- GENERATOR (Same logic as v5, creates data structure) ---
        function generate() {
            const txt = document.getElementById('pInput').value.trim();
            let names = txt.split('\n').map(x => x.trim()).filter(x => x);
            if (names.length < 3) return alert("Need 3+ players.");
            if (document.getElementById('chkRand').checked) names.sort(() => Math.random() - 0.5);

            const size = Math.pow(2, Math.ceil(Math.log2(names.length)));
            const seeds = [];
            for (let i = 0; i < size; i++) seeds.push(names[i] || "BYE");

            const wbRounds = Math.log2(size);
            const lbRounds = (wbRounds - 1) * 2;
            const matches = [];
            let wbLayer = [];

            // WB Gen
            let r1Ids = [];
            for (let i = 0; i < size / 2; i++) {
                const id = `w1_${i}`;
                const side = i < (size / 4) ? 'left' : 'right';
                matches.push({ id, type: 'wb', r: 1, side, p1: seeds[i * 2], p2: seeds[i * 2 + 1], s1: 0, s2: 0, win: null });
                r1Ids.push(id);
            }
            wbLayer.push(r1Ids);

            for (let r = 2; r <= wbRounds; r++) {
                let rIds = [];
                let count = size / Math.pow(2, r);
                for (let i = 0; i < count; i++) {
                    const id = `w${r}_${i}`;
                    let side = count > 1 ? (i < (count / 2) ? 'left' : 'right') : 'center';
                    matches.push({ id, type: 'wb', r: r, side, p1: null, p2: null, s1: 0, s2: 0, win: null });
                    rIds.push(id);
                    link(matches, wbLayer[r - 2][i * 2], id, 1);
                    link(matches, wbLayer[r - 2][i * 2 + 1], id, 2);
                }
                wbLayer.push(rIds);
            }
            const wfId = wbLayer[wbLayer.length - 1][0];

            // LB Gen
            let lbLayer = [];
            let l1Ids = [];
            for (let i = 0; i < size / 4; i++) {
                const id = `l1_${i}`;
                const side = i < (size / 8) ? 'left' : 'right';
                matches.push({ id, type: 'lb', r: 1, side, p1: null, p2: null, s1: 0, s2: 0, win: null });
                l1Ids.push(id);
                linkLose(matches, wbLayer[0][i * 2], id, 1);
                linkLose(matches, wbLayer[0][i * 2 + 1], id, 2);
            }
            lbLayer.push(l1Ids);

            for (let r = 2; r <= lbRounds; r++) {
                let rIds = [];
                let prevCount = lbLayer[r - 2].length;
                let isDrop = (r % 2 === 0);
                let count = isDrop ? prevCount : prevCount / 2;

                for (let i = 0; i < count; i++) {
                    const id = `l${r}_${i}`;
                    let side = count > 1 ? (i < (count / 2) ? 'left' : 'right') : 'center';
                    matches.push({ id, type: 'lb', r: r, side, p1: null, p2: null, s1: 0, s2: 0, win: null });
                    rIds.push(id);

                    if (isDrop) {
                        link(matches, lbLayer[r - 2][i], id, 1);
                        let wbDropR = (r / 2);
                        linkLose(matches, wbLayer[wbDropR][i], id, 2);
                    } else {
                        link(matches, lbLayer[r - 2][i * 2], id, 1);
                        link(matches, lbLayer[r - 2][i * 2 + 1], id, 2);
                    }
                }
                lbLayer.push(rIds);
            }
            const lfId = lbLayer[lbLayer.length - 1][0];

            // GF
            const gfId = 'gf';
            matches.push({ id: gfId, type: 'gf', r: 99, side: 'center', p1: null, p2: null, s1: 0, s2: 0, win: null });
            link(matches, wfId, gfId, 1);
            link(matches, lfId, gfId, 2);

            data.matches = matches;
            data.meta = { wbRounds, lbRounds };
            data.active = true;
            save();
            render();
            advanceByes();
            document.getElementById('setup-modal').classList.remove('active');
        }

        // --- RENDERER ---
        function render() {
            if (!data.active) return;
            const root = document.getElementById('bracket-root');
            // Keep SVG, clear rest
            const svg = document.getElementById('connections');
            root.innerHTML = '';
            root.appendChild(svg);

            // Containers
            const wbCont = mk('div', 'wb-container');
            const lbCont = mk('div', 'lb-container');

            // WB Layout
            const wbLeft = mk('div', 'side-block left');
            for (let r = 1; r < data.meta.wbRounds; r++) wbLeft.appendChild(createCol('wb', r, 'left'));

            const wbRight = mk('div', 'side-block right');
            for (let r = data.meta.wbRounds - 1; r >= 1; r--) wbRight.appendChild(createCol('wb', r, 'right'));

            // Center
            const center = mk('div', 'center-stack');
            center.innerHTML = '<div class="label tourney-label-grand-finals">GRAND FINALS</div><div id="slot-gf" class="tourney-slot-gf"></div>';

            const wfMatches = data.matches.filter(m => m.type === 'wb' && m.side === 'center');
            wfMatches.forEach(m => {
                center.innerHTML += '<div class="label tourney-label-winners-final">WINNERS FINAL</div>';
                center.appendChild(createNode(m, 'final-node'));
            });

            const lbCenterMatches = data.matches.filter(m => m.type === 'lb' && m.side === 'center').sort((a, b) => b.r - a.r);
            if (lbCenterMatches.length) center.innerHTML += '<div class="label tourney-label-losers-finals">L-FINALS</div>';
            lbCenterMatches.forEach(m => center.appendChild(createNode(m, 'lb-final-node')));

            // Render GF into slot
            const gfM = data.matches.find(m => m.type === 'gf');
            if (gfM) center.querySelector('#slot-gf').appendChild(createNode(gfM, 'gf-node'));

            wbCont.append(wbLeft, center, wbRight);

            // LB Layout
            const lbLeft = mk('div', 'side-block left');
            for (let r = 1; r <= data.meta.lbRounds; r++) {
                if (data.matches.some(m => m.type === 'lb' && m.r === r && m.side === 'left'))
                    lbLeft.appendChild(createCol('lb', r, 'left'));
            }

            const lbRight = mk('div', 'side-block right');
            for (let r = data.meta.lbRounds; r >= 1; r--) {
                if (data.matches.some(m => m.type === 'lb' && m.r === r && m.side === 'right'))
                    lbRight.appendChild(createCol('lb', r, 'right'));
            }

            // Invisible spacer for LB center gap
            const lbSpacer = mk('div', 'center-stack');
            lbSpacer.style.visibility = 'hidden';
            lbCont.append(lbLeft, lbSpacer, lbRight);

            root.append(wbCont, lbCont);

            // Wait for DOM layout then Draw Lines
            setTimeout(() => { autoFit(); drawLines(); }, 50);
        }

        function createCol(type, r, side) {
            const d = mk('div', 'round-col');
            const count = data.matches.filter(m => m.type === 'wb' && m.r === 1).length;
            let h = (count / 2) * 80;
            if (type === 'lb') h = h * 0.8;
            d.style.height = Math.max(200, h) + 'px';
            d.innerHTML = `<div class="col-header">${type === 'wb' ? 'R' : 'L'}${r}</div>`;

            data.matches.filter(m => m.type === type && m.r === r && m.side === side)
                .forEach(m => d.appendChild(createNode(m)));
            return d;
        }

        function createNode(m, ex = '') {
            const el = mk('div', 'node ' + ex);
            el.id = `node-${m.id}`; // Crucial for SVG linking
            el.addEventListener('click', () => openScore(m.id));
            const p1c = m.win === 1 ? 'win' : (m.win === 2 ? 'lose' : '');
            const p2c = m.win === 2 ? 'win' : (m.win === 1 ? 'lose' : '');
            let sid = m.id.split('_')[1];
            if (m.type === 'gf') sid = '';
            const safeP1 = escapeHtml(m.p1 || '-');
            const safeP2 = escapeHtml(m.p2 || '-');
            const safeS1 = Number.isFinite(Number(m.s1)) ? Number(m.s1) : 0;
            const safeS2 = Number.isFinite(Number(m.s2)) ? Number(m.s2) : 0;
            el.innerHTML = `${sid ? `<div class="node-id">${parseInt(sid) + 1}</div>` : ''}
            <div class="p-row ${p1c}"><div class="p-name">${safeP1}</div><div class="p-sc">${safeS1}</div></div>
            <div class="p-row ${p2c}"><div class="p-name">${safeP2}</div><div class="p-sc">${safeS2}</div></div>`;
            return el;
        }

        // --- SVG DRAWER (The Magic) ---
        function drawLines() {
            const svg = document.getElementById('connections');
            svg.innerHTML = ''; // Clear lines
            const rootRect = document.getElementById('bracket-root').getBoundingClientRect();

            // Helper to get relative coords
            const getPt = (id, side) => {
                const el = document.getElementById(`node-${id}`);
                if (!el) return null;
                const r = el.getBoundingClientRect();
                // Scale correction
                const scale = rootRect.width / document.getElementById('bracket-root').offsetWidth;

                const relY = (r.top - rootRect.top + r.height / 2) / scale;
                const relLeft = (r.left - rootRect.left) / scale;
                const relRight = (r.right - rootRect.left) / scale;

                return { x: side === 'left' ? relLeft : relRight, y: relY };
            };

            data.matches.forEach(m => {
                if (m.nextWin) drawPath(m.id, m.nextWin, m.side, false);
                if (m.nextLose) drawPath(m.id, m.nextLose, m.side, true);
            });

            function drawPath(srcId, dstId, srcSide, isLoserDrop) {
                // Logic to determine sides
                let startSide = 'right';
                let endSide = 'left';

                // If we are in the Right Bracket, flow is reversed (Left output)
                if (srcSide === 'right') startSide = 'left';

                // Drop lines usually come from bottom or side? stick to side.
                if (srcSide === 'right' && isLoserDrop) startSide = 'left'; // Consistently output inward

                // Destination Input Side
                const dstM = data.matches.find(x => x.id === dstId);
                if (dstM.side === 'right') endSide = 'right';

                const p1 = getPt(srcId, startSide);
                const p2 = getPt(dstId, endSide);

                if (!p1 || !p2) return;

                // ELBOW PATH GENERATION
                let d = '';
                const midX = (p1.x + p2.x) / 2;

                // Simple Elbow
                d = `M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y} L ${p2.x} ${p2.y}`;

                // Dashed line for loser drops
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', d);
                if (isLoserDrop) {
                    path.style.strokeDasharray = "5,5";
                    path.style.opacity = "0.4";
                }
                svg.appendChild(path);
            }
        }

        // --- STANDARD UTILS ---
        function mk(tag, cls) { const e = document.createElement(tag); e.className = cls; return e; }
        function link(arr, s, d, sl) { let x = arr.find(z => z.id === s); if (x) { x.nextWin = d; x.winSlot = sl; } }
        function linkLose(arr, s, d, sl) { let x = arr.find(z => z.id === s); if (x) { x.nextLose = d; x.loseSlot = sl; } }

        function openScore(id) {
            curId = id; const m = data.matches.find(x => x.id === id); if (!m.p1 || !m.p2) return;
            document.getElementById('mP1').innerText = m.p1; document.getElementById('mP2').innerText = m.p2;
            document.getElementById('sP1').value = m.s1; document.getElementById('sP2').value = m.s2;
            document.getElementById('score-modal').classList.add('active');
        }
        function closeScore() { document.getElementById('score-modal').classList.remove('active'); curId = null; }
        function mod(d, p) { const el = document.getElementById(p === 1 ? 'sP1' : 'sP2'); el.value = Math.max(0, parseInt(el.value) + d); }
        function saveScore() {
            const m = data.matches.find(x => x.id === curId); const s1 = parseInt(document.getElementById('sP1').value); const s2 = parseInt(document.getElementById('sP2').value);
            if (s1 === s2) return alert("No draws");
            m.s1 = s1; m.s2 = s2; m.win = s1 > s2 ? 1 : 2;
            const w = m.win === 1 ? m.p1 : m.p2; const l = m.win === 1 ? m.p2 : m.p1;
            if (m.nextWin) update(m.nextWin, m.winSlot, w);
            if (m.nextLose) update(m.nextLose, m.loseSlot, l);
            save(); render(); advanceByes(); closeScore();
        }
        function update(id, sl, n) { const x = data.matches.find(z => z.id === id); if (x) { if (sl === 1) x.p1 = n; else x.p2 = n; x.win = null; x.s1 = 0; x.s2 = 0; } }
        function advanceByes() {
            let d = false; data.matches.forEach(m => {
                if (!m.win && (m.p1 === 'BYE' || m.p2 === 'BYE')) {
                    m.s1 = m.p2 === 'BYE' ? 1 : 0; m.s2 = m.p1 === 'BYE' ? 1 : 0; m.win = m.p2 === 'BYE' ? 1 : 2;
                    const w = m.win === 1 ? m.p1 : m.p2;
                    if (m.nextWin) update(m.nextWin, m.winSlot, w);
                    if (m.nextLose) update(m.nextLose, m.loseSlot, 'BYE');
                    d = true;
                }
            });
            if (d) { save(); render(); }
        }
        function autoFit() {
            const r = document.getElementById('bracket-root'); r.style.transform = 'scale(1)';
            const w = r.scrollWidth + 100; const h = r.scrollHeight + 50;
            const sc = Math.min(window.innerWidth / w, window.innerHeight / h, 1);
            r.style.transform = `scale(${sc})`;
        }
        function save() { localStorage.setItem('uni_v6', JSON.stringify(data)); }
        function reset() { if (confirm("Clear?")) { localStorage.removeItem('uni_v6'); location.reload(); } }

        bindDelegatedDataHandlers();

        // Init
        const s = localStorage.getItem('uni_v6');
        if (s) {
            try {
                const parsed = JSON.parse(s);
                if (parsed && typeof parsed === 'object') data = parsed;
            } catch (err) {
                console.warn('Invalid tournament save; resetting state.', err);
            }
            if (data.active) {
                document.getElementById('setup-modal').classList.remove('active');
                render();
            }
        }
        window.addEventListener('resize', () => { autoFit(); drawLines(); });

        // --- EXCITED BACKGROUND FIELD SCRIPT (Optimized for performance) ---
        (function () {
