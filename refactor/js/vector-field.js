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
        SHOCK_AMPLITUDE: 1,
        SHOCK_DURATION: 60,
        SHOCK_THICKNESS: 15,
        SHOCK_SPEED: 1,
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
    const mouse = { x: -999, y: -999, prevX: -999, prevY: -999, down: false };
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
                history: []
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
        if (STYLES[currentStyleIdx].id === 'BOIDS') initBoids();
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
    window.addEventListener('mousedown', e => {
        spawnShockwave(e.clientX, e.clientY);
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
                        const dist = Math.sqrt(distSq);
                        const d = Math.abs(dist - s.radius);
                        if (d < s.thickness * 3) {
                            const band = Math.exp(-(d * d) / (2 * s.thickness * s.thickness));
                            const lifeFade = 1 - (s.age / s.maxAge);
                            const intensity = band * lifeFade * s.amplitude;
                            shock = Math.max(shock, intensity);

                            // Apply radial force
                            if (dist > 1) {
                                const push = intensity * 2.0; // Force scalar
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

    const drawLightning = (ctx, x1, y1, x2, y2, intensity) => {
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        // Jitter heavily based on intensity
        const jitterMult = 35 * (1 + intensity);
        const jitterX = (Math.random() - 0.5) * jitterMult;
        const jitterY = (Math.random() - 0.5) * jitterMult;

        ctx.moveTo(x1, y1);
        ctx.lineTo(midX + jitterX, midY + jitterY);
        ctx.lineTo(x2, y2);
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

    const renderElectric = (rgb) => {
        // High contrast, jagged lines
        const { width, height } = canvas;
        ctx.lineJoin = 'miter';

        layers.forEach(layer => {
            const { cols, rows, rawMeta, rawNodes } = layer;
            ctx.lineWidth = 1.0;
            ctx.shadowBlur = 15;
            ctx.shadowColor = `rgba(${rgb}, 0.9)`;
            ctx.beginPath();

            for (let cx = 0; cx < cols; cx++) {
                for (let cy = 0; cy < rows; cy++) {
                    const idx = cx * rows + cy;
                    const x = rawNodes[idx * 6];
                    const y = rawNodes[idx * 6 + 1];
                    // Higher threshold for "sparks"
                    let shock = rawMeta[idx * 2 + 1];
                    let energy = rawMeta[idx * 2];

                    // SPARK BRUSH: Boost energy near mouse
                    if (mouse.x !== -999) {
                        const dx = x - mouse.x;
                        const dy = y - mouse.y;
                        if (Math.abs(dx) < 80 && Math.abs(dy) < 80) { // Fast box check
                            const distSq = dx * dx + dy * dy;
                            if (distSq < 6400) { // 80px radius
                                energy += 1.0; // Artificial boost
                            }
                        }
                    }

                    if (shock > 0.05 || energy > 0.8) {
                        const intensity = shock + (energy * 0.5);

                        // Dynamic color based on intensity
                        const alpha = Math.min(1, intensity);
                        ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;

                        const isHot = (nIdx) => {
                            let nShock = rawMeta[nIdx * 2 + 1];
                            let nEnergy = rawMeta[nIdx * 2];
                            // Apply same mouse boost
                            const nx = rawNodes[nIdx * 6];
                            const ny = rawNodes[nIdx * 6 + 1];
                            if (mouse.x !== -999) {
                                const dx = nx - mouse.x;
                                const dy = ny - mouse.y;
                                if (dx * dx + dy * dy < 6400) nEnergy += 1.0;
                            }
                            return (nShock > 0.05 || nEnergy > 0.8);
                        };

                        // Connect to neighbors if they are also active
                        if (cx < cols - 1) {
                            const nIdx = idx + rows;
                            if (isHot(nIdx)) {
                                drawLightning(ctx, x, y, rawNodes[nIdx * 6], rawNodes[nIdx * 6 + 1], intensity);
                            }
                        }
                        if (cy < rows - 1) {
                            const nIdx = idx + 1;
                            if (isHot(nIdx)) {
                                drawLightning(ctx, x, y, rawNodes[nIdx * 6], rawNodes[nIdx * 6 + 1], intensity);
                            }
                        }
                    }
                }
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
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
        ctx.lineWidth = 1.5;

        // BOID CONSTANTS
        const perception = 60;
        const protection = 15;
        const matching = 0.05;
        const centering = 0.005; // Cohesion strength 
        const avoid = 0.15;      // Separation strength (increased slightly)
        const turn = 0.8;        // Mouse turn strength

        boids.forEach(b => {
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

                if (mouse.down) {
                    // FLEE on Click
                    if (dist < 500) {
                        const force = (500 - dist) / 500;
                        b.vx += (dx / dist) * turn * 4.0 * force;
                        b.vy += (dy / dist) * turn * 4.0 * force;
                    }
                } else {
                    // ORBIT with No Click
                    if (dist < 400) {
                        // Go towards a ring at radius 120
                        const targetRadius = 120;
                        const diff = dist - targetRadius;
                        const radialStrength = 0.05;

                        // Push in or out to reach radius
                        b.vx -= (dx / dist) * diff * radialStrength * 0.1;
                        b.vy -= (dy / dist) * diff * radialStrength * 0.1;

                        // Tangential spin
                        // Direction depends on angle relative to mouse to encourage uniform flow? 
                        // Or just one direction (clockwise)
                        b.vx += -(dy / dist) * turn * 0.8;
                        b.vy += (dx / dist) * turn * 0.8;
                    }
                }
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
            if (b.history.length > 20) b.history.shift(); // Trail length

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

        // Thresholds for elevation bands
        const thresholds = [0.2, 0.4, 0.6, 0.8];

        layers.forEach(l => {
            const { cols, rows, rawMeta, rawNodes } = l;

            // Helper to get energy at (cx, cy)
            const getE = (cx, cy) => {
                if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return 0;
                const idx = cx * rows + cy;
                return rawMeta[idx * 2] + rawMeta[idx * 2 + 1]; // energy + shock
            };

            // Helper to interpolate position between two nodes based on energy
            // For aesthetic simplicity, we just use midpoint (0.5) 
            // or we could do linear interpolation for smoother curves.
            // Let's do midpoint for "stylized" look, or linear for "accurate".
            // Linear looks better.
            const lerp = (v0, v1, t) => {
                return (t - v0) / (v1 - v0);
            };

            for (let tVal of thresholds) {
                ctx.beginPath();
                for (let cx = 0; cx < cols - 1; cx++) {
                    for (let cy = 0; cy < rows - 1; cy++) {
                        // 4 corners
                        const tl = getE(cx, cy);
                        const tr = getE(cx + 1, cy);
                        const br = getE(cx + 1, cy + 1);
                        const bl = getE(cx, cy + 1);

                        let idx = 0;
                        if (tl >= tVal) idx |= 8;
                        if (tr >= tVal) idx |= 4;
                        if (br >= tVal) idx |= 2;
                        if (bl >= tVal) idx |= 1;

                        if (idx === 0 || idx === 15) continue;

                        // Node positions
                        const bIdx = (cx * rows + cy) * 6;
                        const x = rawNodes[bIdx];
                        const y = rawNodes[bIdx + 1];
                        // Assume uniform grid spacing for cell size
                        // We can just grab neighbor coords
                        const bRight = ((cx + 1) * rows + cy) * 6;
                        const xRight = rawNodes[bRight];
                        const bDown = (cx * rows + (cy + 1)) * 6;
                        const yDown = rawNodes[bDown + 1];

                        // Midpoints (Top, Right, Bottom, Left)
                        // Simple midpoint interpolation relative to cell corner (x,y)
                        // A better way is using the generic marching squares lookup geometry
                        // a = (x + lerp(tl, tr, tVal)*(xRight-x), y)
                        // etc.

                        // SIMPLIFIED GEOMETRY (midpoints) for performance/style
                        const cellW = xRight - x;
                        const cellH = yDown - y;
                        const a = { x: x + cellW * 0.5, y: y }; // Top
                        const b = { x: x + cellW, y: y + cellH * 0.5 }; // Right
                        const c = { x: x + cellW * 0.5, y: y + cellH }; // Bottom
                        const d = { x: x, y: y + cellH * 0.5 }; // Left

                        switch (idx) {
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
                    }
                }
                ctx.stroke();
            }
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

    const renderNebula = (rgb) => {
        ctx.globalCompositeOperation = 'lighter';
        layers.forEach(l => {
            const count = l.cols * l.rows;
            for (let i = 0; i < count; i += 4) {
                const e = l.rawMeta[i * 2] + l.rawMeta[i * 2 + 1];
                if (e > 0.1) {
                    const base = i * 6;
                    const x = l.rawNodes[base];
                    const y = l.rawNodes[base + 1];
                    // Clamp radius so it doesn't explode infinitely
                    const radius = 20 + Math.min(e, 3.0) * 40;
                    const alpha = Math.min(1.0, e * 0.15); // Lower alpha mul

                    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
                    grad.addColorStop(0, `rgba(${rgb}, ${alpha})`);
                    grad.addColorStop(1, `rgba(${rgb}, 0)`);
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
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
    // =========================================
    //                 INIT
    // =========================================
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
    }

    if (STYLES[currentStyleIdx].id === 'RAIN') initRain();
    if (STYLES[currentStyleIdx].id === 'CONSTELLATION') initConstellation();
    if (STYLES[currentStyleIdx].id === 'BOIDS') initBoids();

    animate();
})();