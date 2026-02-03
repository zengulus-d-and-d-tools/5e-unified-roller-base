(() => {
    // --- UTILS & GLOBAL STATE (Defined before Canvas Check) ---
    const hexToRgb = (hex) => {
        if (!hex) return "78, 205, 196";
        const clean = hex.startsWith('#') ? hex.slice(1) : hex;
        const bigint = parseInt(clean, 16);
        return `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`;
    };

    let currentAccentRGB = "78, 205, 196";

    window.triggerAccentPicker = () => {
        const input = document.getElementById('accent-picker-input');
        if (input) input.click();
    };

    window.setAccentColor = (hex) => {
        const root = document.documentElement;
        const rgb = hexToRgb(hex);
        root.style.setProperty('--accent', hex);
        root.style.setProperty('--accent-glow', `rgba(${rgb}, 0.4)`);
        currentAccentRGB = rgb;
        localStorage.setItem('accentColor', hex);
        const input = document.getElementById('accent-picker-input');
        if (input && input.value !== hex) input.value = hex;
    };

    const initAccent = () => {
        const saved = localStorage.getItem('accentColor');
        if (saved) setAccentColor(saved);
    };
    try { initAccent(); } catch (e) { console.warn(e); }

    // --- CANVAS INIT ---
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
        SHOCK_AMPLITUDE: 1,
        SHOCK_DURATION: 30,
        SHOCK_THICKNESS: 5,
        SHOCK_SPEED: 2,
        LAYERS: [
            { spacing: 30, radius: 260, drag: 0.15 },
            { spacing: 20, radius: 180, drag: 0.075 }
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
    const mouse = { x: -999, y: -999, prevX: -999, prevY: -999, down: false };
    // currentAccentRGB defined at top

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
        { id: 'ELECTRIC', label: 'BG: Electric' },
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
                vy: (Math.random() - 0.5) * 1,
                radius: 1.5 + Math.random()
            });
        }
    };

    // BOIDS STATE (True Simulation)
    const boids = [];
    const initBoids = () => {
        boids.length = 0;
        const count = 80;
        for (let i = 0; i < count; i++) {
            boids.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                angle: Math.random() * Math.PI * 2,
                wanderTheta: Math.random() * Math.PI * 2,
                history: []
            });
        }
    };

    // NEBULA STATE (Optimized Cloud Layers)
    const nebulaParticles = [];


    // =========================================
    //             CORE FUNCTIONS
    // =========================================
    // hexToRgb defined at top


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
        if (STYLES[currentStyleIdx].id === 'BOIDS') initBoids();
        if (STYLES[currentStyleIdx].id === 'NEBULA') initNebula();
    };

    // Force resize on load to ensure boids init correctly
    setTimeout(resize, 100);

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

        localStorage.setItem('vectorFieldStyle', s.id);

        if (s.id === 'RAIN') initRain();
        if (s.id === 'CONSTELLATION') initConstellation();
        if (s.id === 'BOIDS') initBoids();
        if (s.id === 'NEBULA') initNebula();
    };

    // --- ACCENT COLOR SYSTEM ---
    // Moved to top of file


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
    window.addEventListener('mousedown', e => {
        spawnShockwave(e.clientX, e.clientY);
        if (STYLES[currentStyleIdx].id === 'NEBULA') {
            spawnNebulaPulse(e.clientX, e.clientY);
        }
        mouse.down = true;
    });
    window.addEventListener('mouseup', () => mouse.down = false);
    window.addEventListener('touchstart', e => {
        const touch = e.touches[0];
        spawnShockwave(touch.clientX, touch.clientY);
        mouse.prevX = mouse.x = touch.clientX;
        mouse.prevY = mouse.y = touch.clientY;
        mouse.down = true;
    });
    window.addEventListener('touchend', () => mouse.down = false);

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

                // SHOCKWAVE PHYSICAL PUSH
                let shock = 0;
                if (activeShocks) {
                    for (let s of shockwaves) {
                        const dx = x - s.x;
                        const dy = y - s.y;
                        const distSq = dx * dx + dy * dy;
                        // Optimization: Check distSq first before costly sqrt
                        const maxDist = s.radius + s.thickness * 4;
                        if (distSq > maxDist * maxDist) continue;

                        const dist = Math.sqrt(distSq);
                        const d = Math.abs(dist - s.radius);
                        if (d < s.thickness * 3) {
                            const band = Math.exp(-(d * d) / (2 * s.thickness * s.thickness));
                            const lifeFade = 1 - (s.age / s.maxAge);
                            const intensity = band * lifeFade * s.amplitude;
                            shock = Math.max(shock, intensity);

                            // Apply radial force
                            if (dist > 1) {
                                const push = intensity * -5.0; // Invert direction: Strong Attraction (Down/Dent)
                                vx += (dx / dist) * push;
                                vy += (dy / dist) * push;
                            }
                        }
                    }
                }

                x += vx; y += vy;

                rawNodes[baseIdx] = x; rawNodes[baseIdx + 1] = y;
                rawNodes[baseIdx + 2] = vx; rawNodes[baseIdx + 3] = vy;

                rawMeta[i * 2] = Math.abs(vx) + Math.abs(vy);
                rawMeta[i * 2 + 1] = shock;
            }
        });
    };



    const drawBuckets = (ctx, rgb, buckets, shockBucket) => {
        const baseColor = `rgba(${rgb}, `;
        const shockColorStr = `rgba(${rgb}, 0.9)`;
        // ctx.lineWidth is handled by caller or defaults, specifically 1.0 usually
        // But renderField relies on this function to draw fading lines.

        // Buckets loop
        const BUCKETS = buckets.length;
        for (let b = 1; b < BUCKETS; b++) {
            const list = buckets[b];
            if (list.length === 0) continue;
            const alpha = b * 0.05;
            ctx.strokeStyle = baseColor + alpha + ")";
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < list.length; i += 4) {
                ctx.moveTo(list[i], list[i + 1]);
                ctx.lineTo(list[i + 2], list[i + 3]);
            }
            ctx.stroke();
        }

        // Shock bucket
        if (shockBucket.length > 0) {
            ctx.strokeStyle = shockColorStr;
            ctx.lineWidth = 0.5; // Thin lines = Stretched/Tight/Receding
            ctx.beginPath();
            for (let i = 0; i < shockBucket.length; i += 4) {
                ctx.moveTo(shockBucket[i], shockBucket[i + 1]);
                ctx.lineTo(shockBucket[i + 2], shockBucket[i + 3]);
            }
            ctx.stroke();
        }
    };

    const drawLightning = (ctx, x1, y1, x2, y2, displacement, iteration) => {
        if (iteration <= 0) {
            ctx.lineTo(x2, y2);
            return;
        }
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const normalX = -dy;
        const normalY = dx;
        const len = Math.sqrt(dx * dx + dy * dy);

        // Jitter perpendicular to the line
        const jitter = (Math.random() - 0.5) * displacement;
        const midX_j = midX + (normalX / len) * jitter;
        const midY_j = midY + (normalY / len) * jitter;

        drawLightning(ctx, x1, y1, midX_j, midY_j, displacement / 2, iteration - 1);
        drawLightning(ctx, midX_j, midY_j, x2, y2, displacement / 2, iteration - 1);
    };

    // --- RENDERERS ---
    const renderField = (rgb) => {
        // Force field lines
        // We accumulate lines in buckets for efficient drawing
        const buckets = [];
        for (let i = 0; i < 21; i++) buckets.push([]);
        const shockBucket = [];

        // Manual Subdivision for Field Density
        const STEPS = 2; // 2x subdivision

        const lerp = (a, b, t) => a + (b - a) * t;

        layers.forEach(l => {
            const { cols, rows, rawNodes, rawMeta } = l;

            for (let cx = 0; cx < cols - 1; cx++) {
                for (let cy = 0; cy < rows - 1; cy++) {
                    const idx = cx * rows + cy;
                    const right = idx + rows;
                    const down = idx + 1;
                    const diag = idx + rows + 1;

                    // Node Data
                    const x1 = rawNodes[idx * 6]; const y1 = rawNodes[idx * 6 + 1];
                    const e1 = rawMeta[idx * 2]; const s1 = rawMeta[idx * 2 + 1];

                    const x2 = rawNodes[right * 6]; const y2 = rawNodes[right * 6 + 1];
                    const e2 = rawMeta[right * 2]; const s2 = rawMeta[right * 2 + 1];

                    const x3 = rawNodes[down * 6]; const y3 = rawNodes[down * 6 + 1];
                    const e3 = rawMeta[down * 2]; const s3 = rawMeta[down * 2 + 1];

                    const x4 = rawNodes[diag * 6]; const y4 = rawNodes[diag * 6 + 1];
                    const e4 = rawMeta[diag * 2]; const s4 = rawMeta[diag * 2 + 1];

                    // Subdivide
                    for (let sx = 0; sx < STEPS; sx++) {
                        for (let sy = 0; sy < STEPS; sy++) {
                            const tx = sx / STEPS;
                            const ty = sy / STEPS;
                            const step = 1 / STEPS;

                            // Interpolate Top-Left (current virtual node)
                            const xt = lerp(x1, x2, tx); const yt = lerp(y1, y2, tx);
                            const xb = lerp(x3, x4, tx); const yb = lerp(y3, y4, tx);
                            const vx = lerp(xt, xb, ty);
                            const vy = lerp(yt, yb, ty);
                            const et = lerp(e1, e2, tx); const eb = lerp(e3, e4, tx);
                            const ve = lerp(et, eb, ty);
                            const st = lerp(s1, s2, tx); const sb = lerp(s3, s4, tx);
                            const vs = lerp(st, sb, ty);

                            // Right Neighbor (virtual)
                            // Note: we only need to connect Right and Down to form the net
                            const txR = tx + step;
                            const xtR = lerp(x1, x2, txR); const ytR = lerp(y1, y2, txR);
                            const xbR = lerp(x3, x4, txR); const ybR = lerp(y3, y4, txR);
                            const vxR = lerp(xtR, xbR, ty);
                            const vyR = lerp(ytR, ybR, ty);

                            // Down Neighbor (virtual)
                            const tyD = ty + step;
                            const xtD = lerp(x1, x2, tx); const ytD = lerp(y1, y2, tx);
                            const xbD = lerp(x3, x4, tx); const ybD = lerp(y3, y4, tx);
                            const vxD = lerp(xtD, xbD, tyD);
                            const vyD = lerp(ytD, ybD, tyD);

                            // Draw (Push to buckets)
                            // Right connection
                            if (sx < STEPS || cx < cols - 1) { // Careful with boundary, simplified: just draw
                                // Calculate visibility
                                const moveVis = ve * CONFIG.TRAIL_SENSITIVITY;
                                const combinedAlpha = (moveVis * activity) + vs;

                                if (combinedAlpha > CONFIG.VISIBILITY_CUTOFF) {
                                    if (combinedAlpha > 0.8) {
                                        shockBucket.push(vx, vy, vxR, vyR);
                                    } else {
                                        let bucketIdx = Math.floor(Math.min(1.0, combinedAlpha) * 20);
                                        if (bucketIdx > 0 && bucketIdx < buckets.length) buckets[bucketIdx].push(vx, vy, vxR, vyR);
                                    }
                                }
                            }

                            // Down connection
                            if (sy < STEPS || cy < rows - 1) {
                                const moveVis = ve * CONFIG.TRAIL_SENSITIVITY;
                                const combinedAlpha = (moveVis * activity) + vs;

                                if (combinedAlpha > CONFIG.VISIBILITY_CUTOFF) {
                                    if (combinedAlpha > 0.8) {
                                        shockBucket.push(vx, vy, vxD, vyD);
                                    } else {
                                        let bucketIdx = Math.floor(Math.min(1.0, combinedAlpha) * 20);
                                        if (bucketIdx > 0 && bucketIdx < buckets.length) buckets[bucketIdx].push(vx, vy, vxD, vyD);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        drawBuckets(ctx, rgb, buckets, shockBucket);
    };

    const renderElectric = (rgb) => {
        // High contrast, jagged lines
        const { width, height } = canvas;
        ctx.lineJoin = 'miter';
        ctx.lineCap = 'round';

        const STEPS = 2; // 2x subdivision

        layers.forEach(layer => {
            const { cols, rows, rawMeta, rawNodes } = layer;
            ctx.shadowBlur = 20;

            if (activity > 0.01 && Math.random() < 0.05) {
                ctx.shadowColor = `rgba(255, 255, 255, 0.8)`;
            } else {
                ctx.shadowColor = `rgba(${rgb}, 0.8)`;
            }

            ctx.beginPath();

            for (let cx = 0; cx < cols - 1; cx++) {
                for (let cy = 0; cy < rows - 1; cy++) {
                    const idx = cx * rows + cy;
                    const right = idx + rows;
                    const down = idx + 1;
                    const diag = idx + rows + 1;

                    // Node Data
                    const x1 = rawNodes[idx * 6]; const y1 = rawNodes[idx * 6 + 1];
                    const s1 = rawMeta[idx * 2 + 1]; const e1 = rawMeta[idx * 2];

                    const x2 = rawNodes[right * 6]; const y2 = rawNodes[right * 6 + 1];
                    const s2 = rawMeta[right * 2 + 1]; const e2 = rawMeta[right * 2]; // Right

                    const x3 = rawNodes[down * 6]; const y3 = rawNodes[down * 6 + 1];
                    const s3 = rawMeta[down * 2 + 1]; const e3 = rawMeta[down * 2]; // Down

                    const x4 = rawNodes[diag * 6]; const y4 = rawNodes[diag * 6 + 1];
                    const s4 = rawMeta[diag * 2 + 1]; const e4 = rawMeta[diag * 2]; // Diag

                    const lerp = (a, b, t) => a + (b - a) * t;

                    // Subdivide
                    for (let sx = 0; sx < STEPS; sx++) {
                        for (let sy = 0; sy < STEPS; sy++) {
                            const tx = sx / STEPS;
                            const ty = sy / STEPS;

                            // Interpolate Position
                            const xt = lerp(x1, x2, tx); const yt = lerp(y1, y2, tx);
                            const xb = lerp(x3, x4, tx); const yb = lerp(y3, y4, tx);
                            const finalX = lerp(xt, xb, ty);
                            const finalY = lerp(yt, yb, ty);

                            // Interpolate Energy/Shock
                            const et = lerp(e1, e2, tx); const eb = lerp(e3, e4, tx);
                            const finalEnergy = lerp(et, eb, ty);

                            const st = lerp(s1, s2, tx); const sb = lerp(s3, s4, tx);
                            const finalShock = lerp(st, sb, ty);

                            // Logic
                            if (finalShock > 0.1 || finalEnergy > 0.85) {
                                const intensity = finalShock + (finalEnergy * 0.5);
                                const alpha = Math.min(1, intensity);

                                if (Math.random() > 0.6) {
                                    ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
                                    ctx.lineWidth = 1.5 + (intensity * 2.0);
                                    if (intensity > 1.2) {
                                        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                                        ctx.lineWidth += 1;
                                        ctx.shadowColor = `rgba(255, 255, 255, 1.0)`;
                                    } else {
                                        ctx.shadowColor = `rgba(${rgb}, 0.8)`;
                                    }

                                    // Neighbors?
                                    // Just connect to random jitter point for arc look
                                    const jitterVal = 15;
                                    const jx = () => (Math.random() - 0.5) * jitterVal;
                                    const jy = () => (Math.random() - 0.5) * jitterVal;

                                    // Connect to virtual neighbor (right side) effectively
                                    // We approximate neighbor by just jumping step size
                                    const stepX = (x2 - x1) / STEPS;
                                    const stepY = (x3 - x1) / STEPS; // approx

                                    const ex = finalX + stepX + jx();
                                    const ey = finalY + stepY + jy(); // vague direction

                                    ctx.moveTo(finalX + jx(), finalY + jy());
                                    // Make bolt slightly longer to bridge gaps
                                    drawLightning(ctx, finalX + jx(), finalY + jy(), ex, ey, 40 * intensity, 3);
                                    ctx.stroke();
                                    ctx.beginPath(); // Reset
                                }
                            }
                        }
                    }
                }
            }
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1;
        });
    };

    const renderGrid = (rgb) => {
        ctx.fillStyle = `rgba(${rgb}, 0.8)`;
        ctx.beginPath();

        // OPTIMIZATION: 3x subdivision is visually sufficient (9 dots/cell) vs 4x (16 dots/cell)
        const STEPS = 3;

        layers.forEach(layer => {
            const { cols, rows, rawNodes, rawMeta } = layer;

            // OPTIMIZATION: Batching
            // HTML5 Canvas struggles with paths containing thousands of sub-paths.
            // We flush the path every column to keep performance high.
            ctx.beginPath();

            for (let cx = 0; cx < cols - 1; cx++) {
                for (let cy = 0; cy < rows - 1; cy++) {
                    const idx = cx * rows + cy;
                    const right = idx + rows;
                    const down = idx + 1;
                    const diag = idx + rows + 1;

                    // Node Data
                    const x1 = rawNodes[idx * 6]; const y1 = rawNodes[idx * 6 + 1];
                    const e1 = rawMeta[idx * 2]; const s1 = rawMeta[idx * 2 + 1];

                    // Check for Activation
                    // 2. Local Energy
                    const isActive = (e1 > 0.05 || s1 > 0.05);

                    // Base Grid Points (Always draw corners if active)
                    if (s1 > 0.01 || e1 > 0.01) {
                        const size = 1.5 + (e1 + s1) * 3;
                        ctx.rect(x1 - size / 2, y1 - size / 2, size, size);
                    } else if (e1 > 0.005) {
                        // Very faint dots for low energy presence
                        ctx.rect(x1 - 1, y1 - 1, 1.5, 1.5);
                    }

                    if (isActive) {
                        const x2 = rawNodes[right * 6]; const y2 = rawNodes[right * 6 + 1];
                        const x3 = rawNodes[down * 6]; const y3 = rawNodes[down * 6 + 1];
                        const x4 = rawNodes[diag * 6]; const y4 = rawNodes[diag * 6 + 1];

                        const lerp = (a, b, t) => a + (b - a) * t;

                        // Internal Subdivision (Bilinear Interpolation)
                        for (let sx = 0; sx < STEPS; sx++) {
                            for (let sy = 0; sy < STEPS; sy++) {
                                if (sx === 0 && sy === 0) continue; // Skip TL
                                const tx = sx / STEPS;
                                const ty = sy / STEPS;

                                // Interpolate Position
                                const xt = lerp(x1, x2, tx); const yt = lerp(y1, y2, tx);
                                const xb = lerp(x3, x4, tx); const yb = lerp(y3, y4, tx);
                                const finalX = lerp(xt, xb, ty);
                                const finalY = lerp(yt, yb, ty);

                                // Interpolate Energy
                                const e2 = rawMeta[right * 2]; const e3 = rawMeta[down * 2]; const e4 = rawMeta[diag * 2];
                                const s2 = rawMeta[right * 2 + 1]; const s3 = rawMeta[down * 2 + 1]; const s4 = rawMeta[diag * 2 + 1];

                                const et = lerp(e1, e2, tx); const eb = lerp(e3, e4, tx);
                                const finalEnergy = lerp(et, eb, ty);
                                const st = lerp(s1, s2, tx); const sb = lerp(s3, s4, tx);
                                const finalShock = lerp(st, sb, ty);

                                // Energy = Larger (Activity)
                                // Shock  = Smaller (Recession/Dent)
                                const size = Math.max(0.5, 1 + (finalEnergy * 2) - (finalShock * 2.5));
                                ctx.rect(finalX - size / 2, finalY - size / 2, size, size);
                            }
                        }
                    }
                }
                // FLUSH PATH PER COLUMN
                // This keeps the command buffer small and responsive.
                ctx.fill();
                ctx.beginPath();
            }
        });
        ctx.fill();
    };

    const renderVector = (rgb) => {
        ctx.strokeStyle = `rgba(${rgb}, 0.5)`;
        ctx.lineWidth = 1;
        ctx.beginPath();

        const STEPS = 2; // 2x subdivision = 15px virtual resolution

        layers.forEach(l => {
            const { cols, rows, rawNodes, rawMeta } = l;
            // Iterate cols-1, rows-1 to allow interpolation
            for (let cx = 0; cx < cols - 1; cx++) {
                for (let cy = 0; cy < rows - 1; cy++) {
                    const idx = cx * rows + cy;
                    const right = idx + rows;
                    const down = idx + 1;
                    const diag = idx + rows + 1;

                    // Node Data (Position & Velocity)
                    const base = idx * 6;
                    const x = rawNodes[base]; const y = rawNodes[base + 1];
                    const vx = rawNodes[base + 2]; const vy = rawNodes[base + 3];

                    const baseR = right * 6;
                    const vxR = rawNodes[baseR + 2]; const vyR = rawNodes[baseR + 3];
                    const xR = rawNodes[baseR]; const yR = rawNodes[baseR + 1];

                    const baseD = down * 6;
                    const vxD = rawNodes[baseD + 2]; const vyD = rawNodes[baseD + 3];
                    const xD = rawNodes[baseD]; const yD = rawNodes[baseD + 1]; // Typo fix: yD comes from baseD? No, uniform grid. 
                    // Actually, rawNodes contains x,y. Let's trust rawNodes.

                    const baseDD = diag * 6;
                    const vxDD = rawNodes[baseDD + 2]; const vyDD = rawNodes[baseDD + 3];


                    // Subdivide
                    for (let sx = 0; sx < STEPS; sx++) {
                        for (let sy = 0; sy < STEPS; sy++) {
                            const tx = sx / STEPS;
                            const ty = sy / STEPS;

                            // Bilinear Interpolation of Velocity and Position!
                            // Simple approx: Lerp X, then Lerp Y
                            // V_top = Lerp(vx, vxR, tx)
                            // V_bot = Lerp(vxD, vxDD, tx)
                            // V = Lerp(V_top, V_bot, ty)

                            const lerp = (a, b, t) => a + (b - a) * t;

                            const vxt = lerp(vx, vxR, tx);
                            const vyt = lerp(vy, vyR, tx);
                            const vxb = lerp(vxD, vxDD, tx);
                            const vyb = lerp(vyD, vyDD, tx);

                            const finalVX = lerp(vxt, vxb, ty);
                            const finalVY = lerp(vyt, vyb, ty);

                            // Position Interpolation relative to cell
                            // Grid is roughly uniform, but nodes move? 
                            // Wait, nodes move in this simulation (x += vx). 
                            // So we MUST interpolate x,y from the 4 corners.
                            const xt = lerp(x, xR, tx);
                            const yt = lerp(y, yR, tx); // Top row x,y? y is same? No, nodes move.
                            const xb = lerp(xD, rawNodes[baseDD], tx); // rawNodes[baseDD] is xDD
                            const yb = lerp(yD, rawNodes[baseDD + 1], tx); // yDD

                            const finalX = lerp(xt, xb, ty);
                            const finalY = lerp(yt, yb, ty);

                            const mag = Math.hypot(finalVX, finalVY);
                            const shock = rawMeta[idx * 2 + 1]; // Just use TL shock for now, or interp? Interp is overkill.

                            if (mag > 0.1 || shock > 0.1) {
                                const len = 5 + mag * 10 + shock * 20;
                                const angle = Math.atan2(finalVY, finalVX);
                                const x2 = finalX + Math.cos(angle) * len;
                                const y2 = finalY + Math.sin(angle) * len;

                                // Draw Arrow
                                ctx.moveTo(finalX, finalY);
                                ctx.lineTo(x2, y2);
                            }
                        }
                    }
                }
            }
        });
        ctx.stroke();
    };

    let callMinCount = 0;

    const renderBoids = (rgb) => {
        ctx.fillStyle = `rgba(${rgb}, 0.8)`;
        ctx.lineWidth = 1.5;

        // BOID CONSTANTS
        const perception = 80;   // View range
        const protection = 40;   // High protection = keep away from each other
        const matching = 0.05;   // Moderate alignment for swirling
        const centering = 0.0001;// Almost zero cohesion to prevent clumping
        const avoid = 0.005;     // EXTREMELY gentle avoidance for slow adjustments
        const turn = 0.05;       // Slow turn

        // Pre-calculate "Called" boids if mouse is down
        let calledSet = new Set();
        if (mouse.down && mouse.x !== -999) {
            // Assign stable random min count if not set
            if (callMinCount === 0) {
                callMinCount = 4 + Math.floor(Math.random() * 5); // 4 to 8
            }

            // Calculate distances
            const withDist = boids.map((b, i) => ({
                idx: i,
                dist: Math.hypot(b.x - mouse.x, b.y - mouse.y)
            }));

            // Sort by distance
            withDist.sort((a, b) => a.dist - b.dist);

            // Select active: either within 250px OR nearest [callMinCount]
            let count = 0;
            // First count valid range
            for (let i = 0; i < withDist.length; i++) {
                if (withDist[i].dist < 250) count++;
                else break;
            }
            // Ensure min [callMinCount]
            if (count < callMinCount) count = callMinCount;
            if (count > withDist.length) count = withDist.length;

            for (let i = 0; i < count; i++) {
                calledSet.add(withDist[i].idx);
            }
        } else {
            // Reset when mouse released
            callMinCount = 0;
        }

        boids.forEach((b, index) => {
            // 1. Separation / Alignment / Cohesion
            let avgVX = 0, avgVY = 0;
            let avgX = 0, avgY = 0;
            let count = 0;
            let closeDX = 0, closeDY = 0;

            boids.forEach(other => {
                const dx = b.x - other.x;
                const dy = b.y - other.y;
                const dist = Math.hypot(dx, dy);

                if (dist > 0 && dist < perception) {
                    // Alignment
                    avgVX += other.vx;
                    avgVY += other.vy;
                    // Cohesion
                    avgX += other.x;
                    avgY += other.y;
                    count++;

                    // Separation
                    if (dist < protection) {
                        closeDX += dx;
                        closeDY += dy;
                    }
                }
            });

            if (count > 0) {
                // Alignment
                b.vx += (avgVX / count - b.vx) * matching;
                b.vy += (avgVY / count - b.vy) * matching;
                // Cohesion
                b.vx += ((avgX / count) - b.x) * centering;
                b.vy += ((avgY / count) - b.y) * centering;
            }
            // Separation (avoid crowding)
            b.vx += closeDX * avoid;
            b.vy += closeDY * avoid;

            // 2. Mouse Interaction
            if (mouse.x !== -999) {
                const dx = b.x - mouse.x;
                const dy = b.y - mouse.y;
                const dist = Math.hypot(dx, dy);

                if (mouse.down && calledSet.has(index)) {
                    // CALL & ORBIT (Selected Boids Only)
                    const targetRadius = 140;
                    const diff = dist - targetRadius;

                    // Stronger pull for selected boids
                    const pullStrength = 0.02;
                    b.vx -= (dx / dist) * diff * pullStrength;
                    b.vy -= (dy / dist) * diff * pullStrength;

                    const spinStrength = 0.6;
                    b.vx += -(dy / dist) * spinStrength;
                    b.vy += (dx / dist) * spinStrength;

                } else {
                    // ORBIT with No Click (or non-selected boids)
                    // Only orbit if VERY close naturally (150px)
                    if (dist < 150) {
                        const targetRadius = 120;
                        const diff = dist - targetRadius;
                        const radialStrength = 0.05;

                        b.vx -= (dx / dist) * diff * radialStrength * 0.1;
                        b.vy -= (dy / dist) * diff * radialStrength * 0.1;

                        b.vx += -(dy / dist) * turn * 0.8;
                        b.vy += (dx / dist) * turn * 0.8;
                    } else {
                        // WANDER
                        if (!b.wanderTheta) b.wanderTheta = 0;
                        b.wanderTheta += (Math.random() - 0.5) * 0.2;
                        const wanderStrength = 0.05;
                        b.vx += Math.cos(b.wanderTheta) * wanderStrength;
                        b.vy += Math.sin(b.wanderTheta) * wanderStrength;
                    }
                }
            } else {
                // WANDER (Smooth Randomness) when mouse is missing
                if (!b.wanderTheta) b.wanderTheta = 0;
                b.wanderTheta += (Math.random() - 0.5) * 0.2;
                const wanderStrength = 0.05;
                b.vx += Math.cos(b.wanderTheta) * wanderStrength;
                b.vy += Math.sin(b.wanderTheta) * wanderStrength;
            }

            // 3. Limit Speed (Reduced Further)
            const speed = Math.hypot(b.vx, b.vy);
            const lim = 2.0; // Very calm
            if (speed > lim) {
                b.vx = (b.vx / speed) * lim;
                b.vy = (b.vy / speed) * lim;
            }
            if (speed < 0.5) { // Min speed
                b.vx = (b.vx / speed) * 0.5;
                b.vy = (b.vy / speed) * 0.5;
            }

            // 4. Update Position & Wrap
            b.x += b.vx;
            b.y += b.vy;

            // History for trails
            if (!b.history) b.history = [];
            b.history.push({ x: b.x, y: b.y });
            if (b.history.length > 50) b.history.shift(); // Longer Trail length

            if (b.x < 0) { b.x = width; b.history = []; }
            if (b.x > width) { b.x = 0; b.history = []; }
            if (b.y < 0) { b.y = height; b.history = []; }
            if (b.y > height) { b.y = 0; b.history = []; }

            // 5. Render
            // Draw Trail
            if (b.history.length > 1) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(${rgb}, 0.2)`;
                ctx.lineWidth = 2; // Faint trail
                ctx.moveTo(b.history[0].x, b.history[0].y);
                for (let i = 1; i < b.history.length; i++) {
                    ctx.lineTo(b.history[i].x, b.history[i].y);
                }
                ctx.stroke();
            }

            // Draw Head (Kite Shape)
            const angle = Math.atan2(b.vy, b.vx);
            ctx.fillStyle = `rgba(${rgb}, 0.9)`;
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(15, 0);   // Nose
            ctx.lineTo(-8, 6);   // Wing L
            ctx.lineTo(-4, 0);   // Tail notch
            ctx.lineTo(-8, -6);  // Wing R
            ctx.fill();
            ctx.restore();
        });
    };

    const renderTopo = (rgb) => {
        // MARCHING SQUARES for continuous contours
        ctx.strokeStyle = `rgba(${rgb}, 0.5)`;
        ctx.lineWidth = 1.0;

        // Thresholds
        const thresholds = [0.2, 0.4, 0.6, 0.8];
        const STEPS = 2; // 2x subdivision

        layers.forEach(l => {
            const { cols, rows, rawMeta, rawNodes } = l;

            // Helper Lerp
            const lerp = (a, b, t) => a + (b - a) * t;

            // Iterate Quads
            for (let cx = 0; cx < cols - 1; cx++) {
                for (let cy = 0; cy < rows - 1; cy++) {
                    const idx = cx * rows + cy;
                    const right = idx + rows;
                    const down = idx + 1;
                    const diag = idx + rows + 1;

                    // Corner Data
                    const x1 = rawNodes[idx * 6]; const y1 = rawNodes[idx * 6 + 1];
                    const e1 = rawMeta[idx * 2] + rawMeta[idx * 2 + 1];

                    const x2 = rawNodes[right * 6]; const y2 = rawNodes[right * 6 + 1];
                    const e2 = rawMeta[right * 2] + rawMeta[right * 2 + 1];

                    const x3 = rawNodes[down * 6]; const y3 = rawNodes[down * 6 + 1];
                    const e3 = rawMeta[down * 2] + rawMeta[down * 2 + 1];

                    const x4 = rawNodes[diag * 6]; const y4 = rawNodes[diag * 6 + 1];
                    const e4 = rawMeta[diag * 2] + rawMeta[diag * 2 + 1];

                    // Subdivide
                    for (let sx = 0; sx < STEPS; sx++) {
                        for (let sy = 0; sy < STEPS; sy++) {
                            const tx = sx / STEPS;
                            const ty = sy / STEPS;
                            const step = 1 / STEPS;

                            // 1. Calculate Virtual Corners
                            // Top Left (current)
                            const xt = lerp(x1, x2, tx); const yt = lerp(y1, y2, tx);
                            const xb = lerp(x3, x4, tx); const yb = lerp(y3, y4, tx);
                            const vx = lerp(xt, xb, ty);
                            const vy = lerp(yt, yb, ty);
                            const et = lerp(e1, e2, tx); const eb = lerp(e3, e4, tx);
                            const ve = lerp(et, eb, ty);

                            // Right
                            const txR = tx + step;
                            const xtR = lerp(x1, x2, txR); const ytR = lerp(y1, y2, txR);
                            const xbR = lerp(x3, x4, txR); const ybR = lerp(y3, y4, txR);
                            const vxR = lerp(xtR, xbR, ty);
                            const vyR = lerp(ytR, ybR, ty);
                            const etR = lerp(e1, e2, txR); const ebR = lerp(e3, e4, txR);
                            const veR = lerp(etR, ebR, ty);

                            // Bottom
                            const tyD = ty + step;
                            const xtD = lerp(x1, x2, tx); const ytD = lerp(y1, y2, tx);
                            const xbD = lerp(x3, x4, tx); const ybD = lerp(y3, y4, tx);
                            const vxD = lerp(xtD, xbD, tyD);
                            const vyD = lerp(ytD, ybD, tyD);
                            const etD = lerp(e1, e2, tx); const ebD = lerp(e3, e4, tx);
                            const veD = lerp(etD, ebD, tyD);

                            // Bottom Right
                            const vxDD = lerp(xtR, xbR, tyD);
                            const vyDD = lerp(ytR, ybR, tyD);
                            const veDD = lerp(etR, ebR, tyD);

                            // 2. Marching Squares on Virtual Cell
                            for (let tVal of thresholds) {
                                let cIdx = 0;
                                if (ve >= tVal) cIdx |= 8;    // TL
                                if (veR >= tVal) cIdx |= 4;   // TR
                                if (veDD >= tVal) cIdx |= 2;  // BR
                                if (veD >= tVal) cIdx |= 1;   // BL

                                if (cIdx === 0 || cIdx === 15) continue;

                                // Geometry
                                const cellW = vxR - vx;
                                const cellH = vxD - vx; // approx using x difference? No, vxD.x matches vx.x approx?
                                // Better:
                                const a = { x: (vx + vxR) * 0.5, y: (vy + vyR) * 0.5 }; // Top Mid
                                const b = { x: (vxR + vxDD) * 0.5, y: (vyR + vyDD) * 0.5 }; // Right Mid
                                const c = { x: (vxD + vxDD) * 0.5, y: (vyD + vyDD) * 0.5 }; // Bot Mid
                                const d = { x: (vx + vxD) * 0.5, y: (vy + vyD) * 0.5 }; // Left Mid

                                ctx.beginPath();
                                switch (cIdx) {
                                    case 1: ctx.moveTo(d.x, d.y); ctx.lineTo(c.x, c.y); break;
                                    case 2: ctx.moveTo(c.x, c.y); ctx.lineTo(b.x, b.y); break;
                                    case 3: ctx.moveTo(d.x, d.y); ctx.lineTo(b.x, b.y); break;
                                    case 4: ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); break;
                                    case 5: ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.moveTo(d.x, d.y); ctx.lineTo(c.x, c.y); break;
                                    case 6: ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); break;
                                    case 7: ctx.moveTo(d.x, d.y); ctx.lineTo(a.x, a.y); break;
                                    case 8: ctx.moveTo(d.x, d.y); ctx.lineTo(a.x, a.y); break;
                                    case 9: ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); break;
                                    case 10: ctx.moveTo(a.x, a.y); ctx.lineTo(d.x, d.y); ctx.moveTo(b.x, b.y); ctx.lineTo(c.x, c.y); break;
                                    case 11: ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); break;
                                    case 12: ctx.moveTo(d.x, d.y); ctx.lineTo(b.x, b.y); break;
                                    case 13: ctx.moveTo(c.x, c.y); ctx.lineTo(b.x, b.y); break;
                                    case 14: ctx.moveTo(d.x, d.y); ctx.lineTo(c.x, c.y); break;
                                }
                                ctx.stroke();
                            }
                        }
                    }
                }
            }
        });
    };

    const renderRain = (rgb, activeShocks) => {
        ctx.strokeStyle = `rgba(${rgb}, 0.4)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        rainDrops.forEach(d => {
            d.y += d.vy;

            // Calculate Deflection
            let vx = 0;
            if (mouse.x !== -999) {
                const dx = d.x - mouse.x;
                const dy = d.y - mouse.y;
                const dist = Math.hypot(dx, dy);
                // Mouse repel/wind
                if (dist < 300) {
                    vx += (dx / dist) * 10 * (1 - dist / 300);
                }
            }

            forces.forEach(f => {
                const dist = Math.hypot(d.x - f.x, d.y - f.y);
                if (dist < 200) vx += (d.x - f.x) / dist * 5 * f.life;
            });

            d.x += vx;

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

            // Draw skewed line based on vx
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x + vx * 2, d.y + d.len);
        });
        ctx.stroke();
    };

    const renderConstellation = (rgb, activeShocks) => {
        ctx.fillStyle = `rgba(${rgb}, 0.8)`;
        ctx.strokeStyle = `rgba(${rgb}, 0.2)`;
        stars.forEach((s, idx) => {
            // Mouse Repel
            if (mouse.x !== -999) {
                const dx = s.x - mouse.x;
                const dy = s.y - mouse.y;
                const d = Math.hypot(dx, dy);
                if (d < 150) {
                    s.vx += (dx / d) * 0.5;
                    s.vy += (dy / d) * 0.5;
                }
            }

            // VOID DRIFT: Repel from neighbors to find empty space
            // Sample a few random other stars to avoid O(N^2) every frame if N is large, 
            // but N=120 is small enough for full check or partial check.
            // Let's do a simple full check for best effect.
            let crowdX = 0;
            let crowdY = 0;
            let count = 0;
            stars.forEach((other, otherIdx) => {
                if (idx === otherIdx) return;
                const dx = s.x - other.x;
                const dy = s.y - other.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < 10000) { // 100px proximity
                    const force = 50 / (distSq + 1);
                    crowdX += dx * force;
                    crowdY += dy * force;
                    count++;
                }
            });
            // Apply drift away from crowd
            s.vx += crowdX * 0.05;
            s.vy += crowdY * 0.05;

            // Shockwave Push
            if (activeShocks) {
                shockwaves.forEach(wave => {
                    const dx = s.x - wave.x;
                    const dy = s.y - wave.y;
                    const d = Math.hypot(dx, dy);
                    const distFromWave = Math.abs(d - wave.radius);
                    if (distFromWave < wave.thickness * 2) {
                        const push = wave.amplitude * 0.5;
                        s.vx += (dx / d) * push;
                        s.vy += (dy / d) * push;
                    }
                });
            }

            s.x += s.vx; s.y += s.vy;
            s.vx *= 0.96; s.vy *= 0.96; // slightly higher drag

            if (s.x < 0 || s.x > width) s.vx *= -1;
            if (s.y < 0 || s.y > height) s.vy *= -1;

            if (Math.abs(s.vx) < 0.05) s.vx += (Math.random() - 0.5) * 0.05;
            if (Math.abs(s.vy) < 0.05) s.vy += (Math.random() - 0.5) * 0.05;
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

    // Generate a unique, stochastic cloud texture for every single particle
    const generateCloudTexture = (r, g, b) => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const half = size / 2;

        // Base soft glow (randomized intensity)
        const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
        grad.addColorStop(0, `rgba(${r},${g},${b}, ${0.1 + Math.random() * 0.05})`);
        grad.addColorStop(0.6, `rgba(${r},${g},${b}, 0.02)`);
        grad.addColorStop(1, `rgba(${r},${g},${b}, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        // "Noise" circles - Randomized count and spread
        const noiseSteps = 30 + Math.random() * 30; // 30-60 blobs
        for (let i = 0; i < noiseSteps; i++) {
            const rx = half + (Math.random() - 0.5) * size * 0.6;
            const ry = half + (Math.random() - 0.5) * size * 0.6;

            const dist = Math.hypot(rx - half, ry - half);
            if (dist > half * 0.75) continue;

            const rRad = (Math.random() * 40 + 15) * (1 - dist / half);
            const alpha = (Math.random() * 0.06 + 0.02);

            const nGrad = ctx.createRadialGradient(rx, ry, 0, rx, ry, rRad);
            nGrad.addColorStop(0, `rgba(${r},${g},${b}, ${alpha})`);
            nGrad.addColorStop(1, `rgba(${r},${g},${b}, 0)`);

            ctx.fillStyle = nGrad;
            ctx.beginPath();
            ctx.arc(rx, ry, rRad, 0, Math.PI * 2);
            ctx.fill();
        }
        return canvas;
    };

    const initNebula = () => {
        nebulaParticles.length = 0;
        const rgb = currentAccentRGB.split(',').map(n => parseInt(n.trim()));

        const count = 60;
        for (let i = 0; i < count; i++) {
            nebulaParticles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: 0,
                vy: 0,
                radius: 100 + Math.random() * 200,
                layer: 0.5 + Math.random() * 0.5,
                alpha: Math.random(),
                targetAlpha: Math.random() * 0.8 + 0.2,
                rotation: Math.random() * Math.PI * 2,
                sprite: generateCloudTexture(rgb[0], rgb[1], rgb[2]) // Unique texture
            });
        }
    };

    const spawnNebulaPulse = (x, y) => {
        const rgb = currentAccentRGB.split(',').map(n => parseInt(n.trim()));

        // 1. Spawn new dense clouds in a ring around click (jittered)
        for (let i = 0; i < 12; i++) {
            const spawnAngle = Math.random() * Math.PI * 2;
            const spawnDist = 100 + Math.random() * 80;
            const sx = x + Math.cos(spawnAngle) * spawnDist;
            const sy = y + Math.sin(spawnAngle) * spawnDist;

            const moveAngle = spawnAngle;
            const speed = 1 + Math.random() * 3;

            nebulaParticles.push({
                x: sx,
                y: sy,
                vx: Math.cos(moveAngle) * speed,
                vy: Math.sin(moveAngle) * speed,
                radius: 50 + Math.random() * 300, // Bio-organic variety (tiny to massive)
                layer: 0.5 + Math.random() * 0.5,
                alpha: 0,
                targetAlpha: Math.random() * 0.5 + 0.5,
                fadeInSpeed: 0.08,
                rotation: Math.random() * Math.PI * 2,
                fading: false,
                fadeCounter: 30,
                sprite: generateCloudTexture(rgb[0], rgb[1], rgb[2]) // Unique texture
            });
        }

        // 2. Push existing clouds away
        nebulaParticles.forEach(p => {
            const dx = p.x - x;
            const dy = p.y - y;
            const dist = Math.hypot(dx, dy);
            if (dist < 400) {
                const force = (400 - dist) / 400;
                const angle = Math.atan2(dy, dx);
                const pushStr = 15 * force;
                p.vx += Math.cos(angle) * pushStr;
                p.vy += Math.sin(angle) * pushStr;
            }
        });
    };

    const renderNebula = (rgbString) => {
        if (nebulaParticles.length === 0) initNebula();

        ctx.globalCompositeOperation = 'screen';

        const layer0 = layers[0];
        const spacing = layer0.spacing;
        const rows = layer0.rows;
        const MAX_PARTICLES = 120;
        const TARGET_PARTICLES = 60;
        const rgbVals = rgbString.split(',').map(n => parseInt(n.trim()));

        // Replenish natural clouds if low
        if (nebulaParticles.length < TARGET_PARTICLES) {
            if (Math.random() < 0.1) {
                const edge = Math.floor(Math.random() * 4);
                let nx, ny, nvx, nvy;
                switch (edge) {
                    case 0: nx = Math.random() * width; ny = -100; nvx = 0; nvy = 1; break;
                    case 1: nx = width + 100; ny = Math.random() * height; nvx = -1; nvy = 0; break;
                    case 2: nx = Math.random() * width; ny = height + 100; nvx = 0; nvy = -1; break;
                    case 3: nx = -100; ny = Math.random() * height; nvx = 1; nvy = 0; break;
                }
                nebulaParticles.push({
                    x: nx, y: ny, vx: nvx, vy: nvy,
                    radius: 100 + Math.random() * 200,
                    layer: 0.5 + Math.random() * 0.5,
                    alpha: 0, targetAlpha: Math.random() * 0.6 + 0.4, fadeInSpeed: 0.01,
                    rotation: Math.random() * Math.PI * 2,
                    fading: false, fadeCounter: 20,
                    sprite: generateCloudTexture(rgbVals[0], rgbVals[1], rgbVals[2]) // Unique texture
                });
            }
        }

        for (let i = nebulaParticles.length - 1; i >= 0; i--) {
            const p = nebulaParticles[i];

            // --- Physics ---
            let cx = Math.floor((p.x + spacing) / spacing);
            let cy = Math.floor((p.y + spacing) / spacing);
            if (cx < 0) cx = 0; if (cx >= layer0.cols) cx = layer0.cols - 1;
            if (cy < 0) cy = 0; if (cy >= layer0.rows) cy = layer0.rows - 1;

            const idx = cx * rows + cy;
            const baseIdx = idx * 6;

            const fieldVx = layer0.rawNodes[baseIdx + 2];
            const fieldVy = layer0.rawNodes[baseIdx + 3];
            const energy = layer0.rawMeta[idx * 2];

            p.vx += (fieldVx - p.vx) * 0.02;
            p.vy += (fieldVy - p.vy) * 0.02;

            p.x += p.vx * p.layer;
            p.y += p.vy * p.layer;

            p.x += (Math.random() - 0.5) * 0.1;
            p.y += (Math.random() - 0.5) * 0.1;

            // Space-Filling Drift (Repel from neighbors)
            let driftX = 0;
            let driftY = 0;
            // Iterate all to find neighbors (N is small enough < 150)
            for (let j = 0; j < nebulaParticles.length; j++) {
                if (i === j) continue;
                const other = nebulaParticles[j];
                const dx = p.x - other.x;
                const dy = p.y - other.y;
                const distSq = dx * dx + dy * dy;

                // If too close, push away gently
                // Cloud radius is ~100-200, so check overlap
                if (distSq < 90000) { // 300px range
                    const dist = Math.sqrt(distSq);
                    const force = (300 - dist) / 300; // 1.0 at center, 0.0 at 300px
                    driftX += (dx / dist) * force * 0.05;
                    driftY += (dy / dist) * force * 0.05;
                }
            }

            p.vx += driftX;
            p.vy += driftY;
            p.vx *= 0.98; // Dampen
            p.vy *= 0.98;

            p.rotation += (p.vx + p.vy) * 0.005;

            // --- Life Cycle ---
            if (p.alpha < p.targetAlpha && !p.fading) p.alpha += p.fadeInSpeed || 0.01;

            const buffer = 250;
            const outOfBounds = (p.x < -buffer || p.x > width + buffer || p.y < -buffer || p.y > height + buffer);
            if (outOfBounds) p.fading = true;
            if (nebulaParticles.length > MAX_PARTICLES && !p.fading && Math.random() < 0.01) p.fading = true;

            if (p.fading) {
                p.fadeCounter--;
                p.alpha *= 0.9;
                if (p.fadeCounter <= 0 || p.alpha < 0.01) {
                    nebulaParticles.splice(i, 1);
                    continue;
                }
            }

            // Draw
            const size = p.radius * p.layer;
            const finalAlpha = p.alpha * (0.8 + energy * 2.5);

            ctx.globalAlpha = Math.min(1, Math.max(0, finalAlpha));

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            if (p.sprite) ctx.drawImage(p.sprite, -size / 2, -size / 2, size, size);
            ctx.restore();
        }

        ctx.globalAlpha = 1.0;
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
            case 'CONSTELLATION': renderConstellation(accent, activeShocks); break;
            case 'NEBULA': renderNebula(accent); break;
            case 'ELECTRIC': renderElectric(accent); break;
            case 'NEURAL': renderElectric(accent); break; // Fallback
        }

        requestAnimationFrame(animate);
    };

    // =========================================
    //                 INIT
    // =========================================
    const init = () => {
        buildNodes();
        updateAccent();

        // LOAD SAVED STYLE
        const savedStyle = localStorage.getItem('vectorFieldStyle');
        if (savedStyle) {
            const idx = STYLES.findIndex(s => s.id === savedStyle);
            if (idx !== -1) currentStyleIdx = idx;
        }

        // Set initial button text
        const btn = document.getElementById('btn-bg-style');
        if (btn) {
            btn.innerText = "🌌 " + STYLES[currentStyleIdx].label;
        } else {
            // Retry once if button not found yet (just in case)
            setTimeout(() => {
                const retryBtn = document.getElementById('btn-bg-style');
                if (retryBtn) retryBtn.innerText = "🌌 " + STYLES[currentStyleIdx].label;
            }, 500);
        }

        if (STYLES[currentStyleIdx].id === 'RAIN') initRain();
        if (STYLES[currentStyleIdx].id === 'CONSTELLATION') initConstellation();
        if (STYLES[currentStyleIdx].id === 'BOIDS') initBoids();

        animate();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
