(() => {
    const canvas = document.getElementById('vector-cloud');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // =========================================
    //               CONFIGURATION
    // =========================================
    const CONFIG = {
        MOUSE_RADIUS_SQ: 0,
        VISIBILITY_CUTOFF: 0.4,
        TRAIL_SENSITIVITY: 2,
        TENSION: 0.01,
        FRICTION: 0.9,
        SHOCK_WIDTH: 3,
        SHOCK_AMPLITUDE: 2.5,
        SHOCK_DURATION: 30,
        SHOCK_THICKNESS: 15,
        SHOCK_SPEED: 2,
        LAYERS: [
            { spacing: 20, radius: 260, drag: 0.15 },
            { spacing: 10, radius: 180, drag: 0.075 }
        ]
    };

    const DRAG_FACTOR = 2000;

    // =========================================
    //               STATE
    // =========================================
    const layers = CONFIG.LAYERS.map(l => ({ ...l, nodes: [] }));
    const forces = [];
    const shockwaves = [];
    let activity = 0;
    const mouse = { x: -999, y: -999, prevX: -999, prevY: -999 };
    let currentAccentRGB = "78, 205, 196";

    // STYLES
    const STYLES = [
        { id: 'FIELD', label: 'BG: Field' },
        { id: 'GRID', label: 'BG: Grid' },
        { id: 'VECTOR', label: 'BG: Vector' },
        { id: 'BOIDS', label: 'BG: Boids' },
        { id: 'TOPO', label: 'BG: Topography' },
        { id: 'RAIN', label: 'BG: Rain' },
        { id: 'CONSTELLATION', label: 'BG: Constellation' },
        { id: 'NEBULA', label: 'BG: Nebula' },
        { id: 'NEURAL', label: 'BG: Neural' },
        { id: 'OFF', label: 'BG: Off' }
    ];
    let currentStyleIdx = 0;

    // RAIN STATE
    const rainDrops = [];
    const initRain = () => {
        rainDrops.length = 0;
        const count = 100;
        for (let i = 0; i < count; i++) {
            rainDrops.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vy: 5 + Math.random() * 5,
                len: 10 + Math.random() * 20
            });
        }
    };

    // CONSTELLATION STATE
    const stars = [];
    const initConstellation = () => {
        stars.length = 0;
        const count = 120;
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 1,
                vy: (Math.random() - 0.5) * 1
            });
        }
    };

    // =========================================
    //             CORE FUNCTIONS
    // =========================================
    const hexToRgb = (hex) => {
        const bigint = parseInt(hex.slice(1), 16);
        return `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`;
    };

    const updateAccent = () => {
        const style = getComputedStyle(document.documentElement);
        const hex = style.getPropertyValue('--accent').trim() || '#4ecdc4';
        currentAccentRGB = hexToRgb(hex);
    };

    const buildNodes = () => {
        layers.forEach(layer => {
            const spacing = layer.spacing;
            const cols = Math.ceil((width + spacing * 2) / spacing);
            const rows = Math.ceil((height + spacing * 2) / spacing);
            const nodes = new Float32Array(cols * rows * 6);
            const meta = new Float32Array(cols * rows * 2);

            for (let i = 0; i < cols * rows; i++) {
                const cx = (i / rows) | 0;
                const cy = i % rows;
                const x = -spacing + cx * spacing;
                const y = -spacing + cy * spacing;
                const baseIdx = i * 6;
                nodes[baseIdx] = x; nodes[baseIdx + 1] = y;
                nodes[baseIdx + 2] = 0; nodes[baseIdx + 3] = 0;
                nodes[baseIdx + 4] = x; nodes[baseIdx + 5] = y;
            }

            layer.rawNodes = nodes;
            layer.rawMeta = meta;
            layer.cols = cols;
            layer.rows = rows;
        });
    };

    const resize = () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        buildNodes();
        updateAccent();
        if (STYLES[currentStyleIdx].id === 'RAIN') initRain();
        if (STYLES[currentStyleIdx].id === 'CONSTELLATION') initConstellation();
    };

    const spawnShockwave = (x, y) => {
        shockwaves.push({
            x, y, radius: 0, age: 0,
            maxAge: CONFIG.SHOCK_DURATION,
            thickness: CONFIG.SHOCK_THICKNESS,
            amplitude: CONFIG.SHOCK_AMPLITUDE
        });
        if (shockwaves.length > 10) shockwaves.shift();
        activity = 1;
    };

    const addForce = (x, y, dx, dy) => {
        const magSq = dx * dx + dy * dy;
        if (magSq < 0.25) return;
        forces.push({ x, y, vx: dx, vy: dy, life: 1 });
        if (forces.length > 15) forces.shift();
        activity = 1;
    };

    // =========================================
    //              GLOBAL CONTROLS
    // =========================================
    window.cycleBgStyle = () => {
        currentStyleIdx = (currentStyleIdx + 1) % STYLES.length;
        const s = STYLES[currentStyleIdx];
        const btn = document.getElementById('btn-bg-style');
        if (btn) btn.innerText = "🌌 " + s.label;

        if (s.id === 'RAIN') initRain();
        if (s.id === 'CONSTELLATION') initConstellation();
    };

    // =========================================
    //            EVENT LISTENERS
    // =========================================
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', e => {
        if (mouse.prevX !== -999) {
            addForce(e.clientX, e.clientY, e.clientX - mouse.prevX, e.clientY - mouse.prevY);
        }
        mouse.prevX = mouse.x = e.clientX;
        mouse.prevY = mouse.y = e.clientY;
    });
    window.addEventListener('mousedown', e => spawnShockwave(e.clientX, e.clientY));
    window.addEventListener('touchstart', e => {
        const touch = e.touches[0];
        spawnShockwave(touch.clientX, touch.clientY);
        mouse.prevX = mouse.x = touch.clientX;
        mouse.prevY = mouse.y = touch.clientY;
    });

    // =========================================
    //          PHYSICS & RENDERING
    // =========================================
    const updateVectorPhysics = (activeForces, activeShocks) => {
        activity *= 0.99;
        if (activeForces) activity = Math.max(activity, 0.8);
        if (activeShocks) activity = 1;

        layers.forEach(layer => {
            const { rawNodes, rawMeta, cols, rows, drag } = layer;
            const total = cols * rows;

            for (let i = 0; i < total; i++) {
                const baseIdx = i * 6;
                let x = rawNodes[baseIdx]; let y = rawNodes[baseIdx + 1];
                let vx = rawNodes[baseIdx + 2]; let vy = rawNodes[baseIdx + 3];
                const baseX = rawNodes[baseIdx + 4]; const baseY = rawNodes[baseIdx + 5];

                if (activeForces) {
                    let targetX = baseX; let targetY = baseY;
                    for (let f of forces) {
                        const dx = baseX - f.x; const dy = baseY - f.y;
                        const distSq = dx * dx + dy * dy + 400;
                        const influence = f.life * drag * DRAG_FACTOR / distSq;
                        targetX += f.vx * influence; targetY += f.vy * influence;
                    }
                    vx += (targetX - x) * CONFIG.TENSION;
                    vy += (targetY - y) * CONFIG.TENSION;
                } else {
                    vx += (baseX - x) * CONFIG.TENSION;
                    vy += (baseY - y) * CONFIG.TENSION;
                }

                vx *= CONFIG.FRICTION; vy *= CONFIG.FRICTION;
                x += vx; y += vy;

                rawNodes[baseIdx] = x; rawNodes[baseIdx + 1] = y;
                rawNodes[baseIdx + 2] = vx; rawNodes[baseIdx + 3] = vy;

                rawMeta[i * 2] = Math.abs(vx) + Math.abs(vy);

                let shock = 0;
                if (activeShocks) {
                    for (let s of shockwaves) {
                        const dx = x - s.x; const dy = y - s.y;
                        const distSq = dx * dx + dy * dy;
                        const dist = Math.sqrt(distSq);
                        const d = Math.abs(dist - s.radius);
                        if (d < s.thickness * 3) {
                            const band = Math.exp(-(d * d) / (2 * s.thickness * s.thickness));
                            const lifeFade = 1 - (s.age / s.maxAge);
                            shock = Math.max(shock, band * lifeFade * s.amplitude);
                        }
                    }
                }
                rawMeta[i * 2 + 1] = shock;
            }
        });
    };

    const processConnection = (layer, i1, i2, isNeural) => {
        const { rawNodes, rawMeta, buckets, shockBucket } = layer;
        const base1 = i1 * 6; const base2 = i2 * 6;
        const x1 = rawNodes[base1]; const y1 = rawNodes[base1 + 1];
        const x2 = rawNodes[base2]; const y2 = rawNodes[base2 + 1];

        const s1 = rawMeta[i1 * 2 + 1]; const s2 = rawMeta[i2 * 2 + 1];
        const avgShock = (s1 + s2) * 0.5;

        // Neural mode shows faint network always, others optimize
        if (!isNeural && activity < 0.01 && avgShock < 0.01) return;

        const e1 = rawMeta[i1 * 2]; const e2 = rawMeta[i2 * 2];
        let moveVis = (e1 + e2) * (isNeural ? CONFIG.TRAIL_SENSITIVITY * 4 : CONFIG.TRAIL_SENSITIVITY);
        if (isNeural) moveVis += 0.05;

        const combinedAlpha = (moveVis * (isNeural ? 1.0 : activity)) + avgShock;

        if (combinedAlpha > CONFIG.VISIBILITY_CUTOFF || isNeural) {
            if (combinedAlpha > 0.8) {
                shockBucket.push(x1, y1, x2, y2);
            } else {
                let bucketIdx = Math.floor(Math.min(1.0, combinedAlpha) * 20);
                if (bucketIdx > 0 && bucketIdx < buckets.length) buckets[bucketIdx].push(x1, y1, x2, y2);
            }
        }
    };

    const drawBuckets = (layer, rgb, lineWidth, shockWidth) => {
        const baseColor = `rgba(${rgb}, `;
        const shockColorStr = `rgba(${rgb}, 0.9)`;
        ctx.lineWidth = lineWidth;
        const BUCKETS = 21;
        for (let b = 1; b < BUCKETS; b++) {
            const list = layer.buckets[b];
            if (list.length === 0) continue;
            const alpha = b * 0.05;
            ctx.strokeStyle = baseColor + alpha + ")";
            ctx.beginPath();
            for (let i = 0; i < list.length; i += 4) {
                ctx.moveTo(list[i], list[i + 1]);
                ctx.lineTo(list[i + 2], list[i + 3]);
            }
            ctx.stroke();
        }
        if (layer.shockBucket.length > 0) {
            ctx.strokeStyle = shockColorStr;
            ctx.lineWidth = shockWidth;
            ctx.beginPath();
            for (let i = 0; i < layer.shockBucket.length; i += 4) {
                ctx.moveTo(layer.shockBucket[i], layer.shockBucket[i + 1]);
                ctx.lineTo(layer.shockBucket[i + 2], layer.shockBucket[i + 3]);
            }
            ctx.stroke();
        }
    };

    // --- RENDERERS ---
    const renderField = (rgb) => {
        layers.forEach(layer => {
            const BUCKETS = 21;
            if (!layer.buckets) {
                layer.buckets = Array.from({ length: BUCKETS }, () => []);
                layer.shockBucket = [];
            }
            for (let b = 0; b < BUCKETS; b++) layer.buckets[b].length = 0;
            layer.shockBucket.length = 0;

            const { cols, rows } = layer;
            for (let cx = 0; cx < cols; cx++) {
                for (let cy = 0; cy < rows; cy++) {
                    const idx = cx * rows + cy;
                    if (cx < cols - 1) processConnection(layer, idx, idx + rows, false);
                    if (cy < rows - 1) processConnection(layer, idx, idx + 1, false);
                }
            }
            drawBuckets(layer, rgb, 0.8, CONFIG.SHOCK_WIDTH);
        });
    };

    const renderNeural = (rgb) => {
        layers.forEach(layer => {
            const BUCKETS = 21;
            if (!layer.buckets) {
                layer.buckets = Array.from({ length: BUCKETS }, () => []);
                layer.shockBucket = [];
            }
            for (let b = 0; b < BUCKETS; b++) layer.buckets[b].length = 0;
            layer.shockBucket.length = 0;

            const { cols, rows } = layer;
            for (let cx = 0; cx < cols; cx++) {
                for (let cy = 0; cy < rows; cy++) {
                    const idx = cx * rows + cy;
                    if (cx < cols - 1) processConnection(layer, idx, idx + rows, true);
                    if (cy < rows - 1) processConnection(layer, idx, idx + 1, true);
                }
            }
            drawBuckets(layer, rgb, 1.2, 4);
        });
    };

    const renderGrid = (rgb) => {
        ctx.fillStyle = `rgba(${rgb}, 0.4)`;
        layers.forEach(l => {
            const count = l.cols * l.rows;
            for (let i = 0; i < count; i++) {
                const base = i * 6;
                const bx = l.rawNodes[base + 4];
                const by = l.rawNodes[base + 5];
                const energy = l.rawMeta[i * 2] + l.rawMeta[i * 2 + 1];
                const size = 1 + Math.min(3, energy * 2);
                ctx.globalAlpha = 0.2 + Math.min(0.8, energy);
                ctx.beginPath();
                ctx.arc(bx, by, size, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.globalAlpha = 1;
    };

    const renderVector = (rgb) => {
        ctx.strokeStyle = `rgba(${rgb}, 0.5)`;
        ctx.lineWidth = 1;
        layers.forEach(l => {
            const count = l.cols * l.rows;
            for (let i = 0; i < count; i++) {
                const base = i * 6;
                const x = l.rawNodes[base];
                const y = l.rawNodes[base + 1];
                const vx = l.rawNodes[base + 2];
                const vy = l.rawNodes[base + 3];
                const shock = l.rawMeta[i * 2 + 1];
                const mag = Math.hypot(vx, vy);
                if (mag < 0.1 && shock < 0.1) continue;
                const len = 5 + mag * 10 + shock * 20;
                const angle = Math.atan2(vy, vx);
                const x2 = x + Math.cos(angle) * len;
                const y2 = y + Math.sin(angle) * len;
                ctx.globalAlpha = Math.min(1, (mag + shock) * 2);
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        });
        ctx.globalAlpha = 1;
    };

    const renderBoids = (rgb) => {
        ctx.fillStyle = `rgba(${rgb}, 0.8)`;
        layers.forEach(l => {
            const count = l.cols * l.rows;
            for (let i = 0; i < count; i++) {
                const base = i * 6;
                const x = l.rawNodes[base];
                const y = l.rawNodes[base + 1];
                const vx = l.rawNodes[base + 2];
                const vy = l.rawNodes[base + 3];
                const shock = l.rawMeta[i * 2 + 1];
                const mag = Math.hypot(vx, vy);
                if (mag < 0.1 && shock < 0.1) continue;
                const angle = Math.atan2(vy, vx);
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(5, 0);
                ctx.lineTo(-3, 3);
                ctx.lineTo(-3, -3);
                ctx.fill();
                ctx.restore();
            }
        });
    };

    const renderTopo = (rgb) => {
        ctx.strokeStyle = `rgba(${rgb}, 0.3)`;
        ctx.lineWidth = 1.5;
        layers.forEach(l => {
            const { cols, rows, rawMeta } = l;
            ctx.beginPath();
            for (let cx = 0; cx < cols - 1; cx++) {
                for (let cy = 0; cy < rows - 1; cy++) {
                    const iTL = cx * rows + cy;
                    const vTL = rawMeta[iTL * 2] + rawMeta[iTL * 2 + 1];
                    if (vTL > 0.1) {
                        const x = l.rawNodes[iTL * 6];
                        const y = l.rawNodes[iTL * 6 + 1];
                        ctx.moveTo(x + 5, y);
                        ctx.arc(x, y, 5 + vTL * 10, 0, Math.PI * 2);
                    }
                }
            }
            ctx.stroke();
        });
    };

    const renderRain = (rgb, activeShocks) => {
        ctx.strokeStyle = `rgba(${rgb}, 0.4)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        rainDrops.forEach(d => {
            d.y += d.vy;
            forces.forEach(f => {
                const dist = Math.hypot(d.x - f.x, d.y - f.y);
                if (dist < 200) d.x += (d.x - f.x) / dist * 5 * f.life;
            });
            if (activeShocks) {
                shockwaves.forEach(s => {
                    const dist = Math.hypot(d.x - s.x, d.y - s.y);
                    if (Math.abs(dist - s.radius) < s.thickness + 10) {
                        d.y -= 5;
                        d.x += (Math.random() - 0.5) * 10;
                    }
                });
            }
            if (d.y > height) {
                d.y = -d.len;
                d.x = Math.random() * width;
            }
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x, d.y + d.len);
        });
        ctx.stroke();
    };

    const renderConstellation = (rgb) => {
        ctx.fillStyle = `rgba(${rgb}, 0.8)`;
        ctx.strokeStyle = `rgba(${rgb}, 0.2)`;
        stars.forEach(s => {
            s.x += s.vx; s.y += s.vy;
            if (s.x < 0 || s.x > width) s.vx *= -1;
            if (s.y < 0 || s.y > height) s.vy *= -1;
        });
        ctx.beginPath();
        for (let i = 0; i < stars.length; i++) {
            const s1 = stars[i];
            ctx.moveTo(s1.x, s1.y);
            ctx.arc(s1.x, s1.y, 1.5, 0, Math.PI * 2);
            for (let j = i + 1; j < stars.length; j++) {
                const s2 = stars[j];
                const dx = s1.x - s2.x; const dy = s1.y - s2.y;
                if (dx * dx + dy * dy < 22500) {
                    ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y);
                }
            }
        }
        ctx.fill(); ctx.stroke();
    };

    const renderNebula = (rgb) => {
        ctx.globalCompositeOperation = 'lighter';
        layers.forEach(l => {
            const count = l.cols * l.rows;
            for (let i = 0; i < count; i += 4) {
                const e = l.rawMeta[i * 2] + l.rawMeta[i * 2 + 1];
                if (e > 0.2) {
                    const base = i * 6;
                    const x = l.rawNodes[base];
                    const y = l.rawNodes[base + 1];
                    const grad = ctx.createRadialGradient(x, y, 0, x, y, 30 + e * 50);
                    grad.addColorStop(0, `rgba(${rgb}, ${0.1 * e})`);
                    grad.addColorStop(1, `rgba(${rgb}, 0)`);
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(x, y, 30 + e * 50, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });
        ctx.globalCompositeOperation = 'source-over';
    };

    const animate = () => {
        ctx.clearRect(0, 0, width, height);

        const currentStyle = STYLES[currentStyleIdx].id;
        if (currentStyle === 'OFF') {
            requestAnimationFrame(animate);
            return;
        }

        let activeForces = false;
        for (let i = forces.length - 1; i >= 0; i--) {
            forces[i].life *= 0.85;
            if (forces[i].life < 0.01) forces.splice(i, 1);
            else activeForces = true;
        }

        let activeShocks = false;
        for (let i = shockwaves.length - 1; i >= 0; i--) {
            const s = shockwaves[i];
            s.radius += CONFIG.SHOCK_SPEED;
            s.age++;
            if (s.age >= s.maxAge) shockwaves.splice(i, 1);
            else activeShocks = true;
        }

        updateVectorPhysics(activeForces, activeShocks);

        const accent = currentAccentRGB;
        switch (currentStyle) {
            case 'FIELD': renderField(accent); break;
            case 'GRID': renderGrid(accent); break;
            case 'VECTOR': renderVector(accent); break;
            case 'BOIDS': renderBoids(accent); break;
            case 'TOPO': renderTopo(accent); break;
            case 'RAIN': renderRain(accent, activeShocks); break;
            case 'CONSTELLATION': renderConstellation(accent); break;
            case 'NEBULA': renderNebula(accent); break;
            case 'NEURAL': renderNeural(accent); break;
        }

        requestAnimationFrame(animate);
    };

    // =========================================
    //                 INIT
    // =========================================
    buildNodes();
    updateAccent();
    if (STYLES[currentStyleIdx].id === 'RAIN') initRain();
    if (STYLES[currentStyleIdx].id === 'CONSTELLATION') initConstellation();

    animate();
})();