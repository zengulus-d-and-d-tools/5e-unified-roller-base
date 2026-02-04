(() => {
    // --- UTILS & GLOBAL STATE (Defined before Canvas Check) ---
    const hexToRgb = (hex) => {
        if (!hex) return "78, 205, 196";
        const clean = hex.startsWith('#') ? hex.slice(1) : hex;
        const bigint = parseInt(clean, 16);
        return `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`;
    };

    // --- COLOR UTILS ---
    const rgbToHsl = (r, g, b) => {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h, s, l];
    };

    const hslToRgb = (h, s, l) => {
        let r, g, b;
        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return `${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}`;
    };

    const applyOffset = (rgbStr, hOff, sOff, lOff) => {
        const [r, g, b] = rgbStr.split(',').map(n => parseInt(n.trim()));
        const [h, s, l] = rgbToHsl(r, g, b);
        let newH = (h + hOff) % 1;
        if (newH < 0) newH += 1;
        const newS = Math.max(0, Math.min(1, s + sOff));
        const newL = Math.max(0, Math.min(1, l + lOff));
        return hslToRgb(newH, newS, newL);
    };

    const getAnimatedColor = (rgbStr) => {
        const time = Date.now() * 0.001;
        const hOff = Math.sin(time * 0.5) * 0.05; // +/- 5% hue
        const sOff = Math.sin(time * 0.7 + 100) * 0.05; // +/- 5% sat
        const lOff = Math.sin(time * 0.3 + 200) * 0.05; // +/- 5% light
        return applyOffset(rgbStr, hOff, sOff, lOff);
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

    // --- SIMPLEX NOISE (Compact) ---
    const SimplexNoise = (() => {
        const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
        const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
        const p = new Uint8Array(256);
        const perm = new Uint8Array(512);
        const grad3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
        for (let i = 0; i < 256; i++) p[i] = Math.floor(Math.random() * 256);
        for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
        const dot = (g, x, y) => g[0] * x + g[1] * y;
        return {
            noise2D: (xin, yin) => {
                let n0, n1, n2;
                const s = (xin + yin) * F2;
                const i = Math.floor(xin + s);
                const j = Math.floor(yin + s);
                const t = (i + j) * G2;
                const X0 = i - t; const Y0 = j - t;
                const x0 = xin - X0; const y0 = yin - Y0;
                let i1, j1;
                if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
                const x1 = x0 - i1 + G2; const y1 = y0 - j1 + G2;
                const x2 = x0 - 1.0 + 2.0 * G2; const y2 = y0 - 1.0 + 2.0 * G2;
                const ii = i & 255; const jj = j & 255;
                const gi0 = perm[ii + perm[jj]] % 12;
                const gi1 = perm[ii + i1 + perm[jj + j1]] % 12;
                const gi2 = perm[ii + 1 + perm[jj + 1]] % 12;
                let t0 = 0.5 - x0 * x0 - y0 * y0;
                if (t0 < 0) n0 = 0.0; else { t0 *= t0; n0 = t0 * t0 * dot(grad3[gi0], x0, y0); }
                let t1 = 0.5 - x1 * x1 - y1 * y1;
                if (t1 < 0) n1 = 0.0; else { t1 *= t1; n1 = t1 * t1 * dot(grad3[gi1], x1, y1); }
                let t2 = 0.5 - x2 * x2 - y2 * y2;
                if (t2 < 0) n2 = 0.0; else { t2 *= t2; n2 = t2 * t2 * dot(grad3[gi2], x2, y2); }
                return 70.0 * (n0 + n1 + n2);
            }
        };
    })();

    const getSpatialColor = (rgbStr, x, y) => {
        const time = Date.now() * 0.0001; // Slower drift via time
        const scale = 0.0015; // Zoom

        // Simplex Noise (returns -1 to 1)
        const n1 = SimplexNoise.noise2D(x * scale, y * scale - time);
        const n2 = SimplexNoise.noise2D(x * scale * 2 + 100, y * scale * 2 + time * 0.5);

        // Combined noise (-1 to 1 approx)
        const noise = (n1 + n2 * 0.5) / 1.5;

        const hOff = noise * 0.05; // +/- 5% hue
        const sOff = noise * 0.08; // +/- 8% sat (rich variance)
        const lOff = noise * 0.04; // +/- 4% light

        return applyOffset(rgbStr, hOff, sOff, lOff);
    };

    // =========================================
    //               STATE
    // =========================================
    const layers = CONFIG.LAYERS.map(l => ({ ...l, nodes: [] }));
    const forces = [];
    const shockwaves = [];
    // OPTIMIZATION: Bolt Pool to avoid GC
    const MAX_BOLTS = 300;
    const MAX_PATHS = 32;
    const MAX_POINTS = 512; // Flat array x,y

    // Pre-allocate everything
    const boltPool = Array.from({ length: MAX_BOLTS }, () => ({
        active: false,
        life: 0, maxLife: 0,
        color: '', // RGB string
        target: null, // {x, y}
        paths: Array.from({ length: MAX_PATHS }, () => ({
            points: new Float32Array(MAX_POINTS),
            count: 0, // Number of points used (x,y pairs = count/2)
            width: 0
        })),
        pathCount: 0
    }));

    // lightningBolts array removed in favor of pool iteration
    const mouseTrack = []; // Trail history for Electric style
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
        { id: 'MATRIX', label: 'BG: Matrix' },
        { id: 'CONSTELLATION', label: 'BG: Constellation' },
        { id: 'NEBULA', label: 'BG: Nebula' },
        { id: 'ELECTRIC', label: 'BG: Electric' },
        { id: 'OFF', label: 'BG: Off' }
    ];
    let currentStyleIdx = 0;

    // MATRIX STATE (Replaces Rain)
    const matrixDrops = [];
    const matrixChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%"\'#&_()[],.?';
    // Katakana unicode range: 30A0-30FF. easier to just stirng literal or use random int

    const getRandomMatrixChar = () => {
        if (Math.random() < 0.3) {
            // Katakana
            return String.fromCharCode(0x30A0 + Math.random() * 96);
        }
        return matrixChars.charAt(Math.floor(Math.random() * matrixChars.length));
    };

    const initMatrix = () => {
        matrixDrops.length = 0;
        const columns = Math.floor(width / 20); // 20px font approx

        for (let i = 0; i < columns; i++) {
            // Staggered start
            matrixDrops.push({
                x: i * 20,
                y: Math.random() * height - height, // Start above
                vy: 5 + Math.random() * 5,
                len: 10 + Math.floor(Math.random() * 20),
                speed: 1 + Math.random() * 3, // drop speed
                vals: [], // Array of chars for the trail
                highlights: [], // Array of booleans for persistent brightness
                first: true // Flag to spawn initial trail chars immediately
            });
            // Pre-fill vals
            const col = matrixDrops[i];
            for (let j = 0; j < col.len; j++) {
                col.vals.push(getRandomMatrixChar());
                col.highlights.push(Math.random() < 0.05); // 1 in 20 chance
            }
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
                radius: 1.5 + Math.random(),
                hOff: (Math.random() - 0.5) * 0.1,
                sOff: (Math.random() - 0.5) * 0.1,
                lOff: (Math.random() - 0.5) * 0.1,
                twinklePhase: Math.random() * Math.PI * 2,
                twinkleSpeed: 0.0005 + Math.random() * 0.0015
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
                history: [],
                hOff: (Math.random() - 0.5) * 0.1,
                sOff: (Math.random() - 0.5) * 0.1,
                lOff: (Math.random() - 0.5) * 0.1
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
        if (STYLES[currentStyleIdx].id === 'MATRIX') initMatrix();
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

        // Clamp max force to avoid grid explosion
        const maxV = 50;
        const cvx = Math.max(-maxV, Math.min(maxV, dx));
        const cvy = Math.max(-maxV, Math.min(maxV, dy));

        forces.push({ x, y, vx: cvx, vy: cvy, life: 1 });
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

        if (s.id === 'MATRIX') initMatrix();
        if (s.id === 'CONSTELLATION') initConstellation();
        if (s.id === 'BOIDS') initBoids();
        if (s.id === 'NEBULA') initNebula();

        // FIX: Clear physics state to prevent lag spike when switching styles (especially to Field)
        hardReset();
        resize(); // Force resize to clear all buffers/state completely
    };

    const hardReset = () => {
        // 1. Clear Entities
        forces.length = 0;
        shockwaves.length = 0;
        mouseTrack.length = 0;
        boids.length = 0;
        matrixDrops.length = 0;
        stars.length = 0;
        // Nebula particles are re-init on style switch anyway, but clear them to be sure
        nebulaParticles.length = 0;

        // 2. Clear Rendering Buckets
        fieldBuckets.forEach(b => b.length = 0);
        fieldShockBucket.length = 0;

        // 3. Reset Pools
        for (let i = 0; i < MAX_BOLTS; i++) {
            boltPool[i].active = false;
        }

        // 4. Force Reset Grid Nodes (Crucial for Field/Vector styles)
        layers.forEach(l => {
            const { rawNodes, rawMeta } = l;
            const count = rawNodes.length / 6;
            for (let i = 0; i < count; i++) {
                const base = i * 6;
                // Position -> Base Position
                rawNodes[base] = rawNodes[base + 4];
                rawNodes[base + 1] = rawNodes[base + 5];
                // Velocity -> 0
                rawNodes[base + 2] = 0;
                rawNodes[base + 3] = 0;
            }
            // Meta (Energy/Shock) -> 0
            rawMeta.fill(0);
        });

        // 5. Reset Activity
        activity = 0;
    };

    // --- ACCENT COLOR SYSTEM ---
    // Moved to top of file


    // =========================================
    //            EVENT LISTENERS
    // =========================================
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', e => {
        // Track mouse history for Electric trail (Interpolated High-Res)
        if (mouse.prevX !== -999) {
            const distX = e.clientX - mouse.prevX;
            const distY = e.clientY - mouse.prevY;
            const dist = Math.hypot(distX, distY);
            const steps = Math.ceil(dist / 10); // One point every 10px

            for (let i = 0; i < steps; i++) {
                const t = (i + 1) / steps;
                const lx = mouse.prevX + distX * t;
                const ly = mouse.prevY + distY * t;
                mouseTrack.push({ x: lx, y: ly, life: 12 });
            }
            // Cap history
            while (mouseTrack.length > 50) mouseTrack.shift();
        } else {
            mouseTrack.push({ x: e.clientX, y: e.clientY, life: 12 });
        }

        if (mouse.prevX !== -999) {
            const distX = e.clientX - mouse.prevX;
            const distY = e.clientY - mouse.prevY;
            const dist = Math.hypot(distX, distY);

            // Interpolate to fill gaps for smooth trail
            // Step size ~15px (half-grid)
            const steps = Math.ceil(dist / 15);

            for (let i = 0; i < steps; i++) {
                const t = (i + 1) / steps;
                const lerpX = mouse.prevX + distX * t;
                const lerpY = mouse.prevY + distY * t;

                // Force scales with speed but much gentler
                // Reduced from 3.0 to 0.5 to prevent explosion
                addForce(lerpX, lerpY, distX * 0.5, distY * 0.5);
            }
        }
        mouse.prevX = mouse.x = e.clientX;
        mouse.prevY = mouse.y = e.clientY;
    });
    window.addEventListener('mousedown', e => {
        // Continuous force handles interaction now, shockwave on release
        if (STYLES[currentStyleIdx].id === 'NEBULA') {
            spawnNebulaPulse(e.clientX, e.clientY);
        }
        if (STYLES[currentStyleIdx].id === 'MATRIX') {
            const col = Math.floor(e.clientX / 20) * 20;
            const newDrop = {
                x: col,
                y: e.clientY,
                vy: 5 + Math.random() * 5,
                len: 10 + Math.floor(Math.random() * 20),
                vals: [],
                highlights: [],
                first: true
            };
            for (let j = 0; j < newDrop.len; j++) {
                newDrop.vals.push(getRandomMatrixChar());
                newDrop.highlights.push(Math.random() < 0.05);
            }
            matrixDrops.push(newDrop);
        }
        mouse.down = true;
    });
    window.addEventListener('mouseup', e => {
        spawnShockwave(mouse.x, mouse.y); // Ripple on release
        mouse.down = false;
    });
    window.addEventListener('touchstart', e => {
        const touch = e.touches[0];
        // spawnShockwave(touch.clientX, touch.clientY); // Removed
        mouse.prevX = mouse.x = touch.clientX;
        mouse.prevY = mouse.y = touch.clientY;
        mouse.down = true;
    });
    window.addEventListener('touchend', () => {
        spawnShockwave(mouse.x, mouse.y); // Ripple on release
        mouse.down = false;
    });

    // =========================================
    //          PHYSICS & RENDERING
    // =========================================
    const updateVectorPhysics = (activeForces, activeShocks) => {
        activity *= 0.99;
        if (activeForces) activity = Math.max(activity, 0.8);
        if (activeShocks) activity = 1;
        if (mouse.down) activity = 1; // Keep active while holding

        let maxEnergy = 0;

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
                        const distSq = dx * dx + dy * dy;
                        if (distSq < 3600) { // 60px radius
                            const dist = Math.sqrt(distSq);
                            const falloff = 1 - (dist / 60);
                            // Keep denominator safe but consistent
                            // Squared falloff to ensure it vanishes at edge
                            const influence = f.life * drag * DRAG_FACTOR * falloff * falloff / (distSq + 100);
                            targetX += f.vx * influence; targetY += f.vy * influence;
                        }
                    }
                    vx += (targetX - x) * CONFIG.TENSION;
                    vy += (targetY - y) * CONFIG.TENSION;
                } else {
                    vx += (baseX - x) * CONFIG.TENSION;
                    vy += (baseY - y) * CONFIG.TENSION;
                }

                if (mouse.down) {
                    const dx = x - mouse.x;
                    const dy = y - mouse.y;
                    const distSq = dx * dx + dy * dy;
                    const range = 75;
                    if (distSq < range * range) {
                        const dist = Math.sqrt(distSq);
                        if (dist > 1) {
                            // Continuous depressive force (Attraction)
                            const falloff = 1 - (dist / range);
                            const damping = dist / (dist + 50);
                            const strength = -2.0 * damping * falloff * falloff; // Squared falloff for smoother curve
                            vx += (dx / dist) * strength;
                            vy += (dy / dist) * strength;
                        }
                    }
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
                                // Hyperbolic damping to prevent crossover at close range
                                const damping = dist / (dist + 20);
                                const push = intensity * -2.0 * damping;
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

                // Track max kinetic energy for idle sleep
                const ke = Math.abs(vx) + Math.abs(vy);
                if (ke > maxEnergy) maxEnergy = ke;
            }
        });

        return maxEnergy;
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
            // Adaptive alpha based on bucket count
            const alpha = (b / BUCKETS) * 0.8;
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

    const drawLightning = (ctx, x1, y1, x2, y2, displacement, iteration, startW, endW) => {
        if (iteration <= 0) {
            ctx.beginPath();
            ctx.lineWidth = (startW + endW) * 0.5;
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            return;
        }

        // Random split point for chaos (0.3 to 0.7)
        const t = 0.3 + Math.random() * 0.4;
        const midX = x1 + (x2 - x1) * t;
        const midY = y1 + (y2 - y1) * t;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const normalX = -dy;
        const normalY = dx;
        const len = Math.sqrt(dx * dx + dy * dy);

        const jitter = (Math.random() - 0.5) * displacement;
        const midX_j = midX + (normalX / len) * jitter;
        const midY_j = midY + (normalY / len) * jitter;

        const midW = startW + (endW - startW) * t;

        drawLightning(ctx, x1, y1, midX_j, midY_j, displacement * 0.7, iteration - 1, startW, midW);
        drawLightning(ctx, midX_j, midY_j, x2, y2, displacement * 0.7, iteration - 1, midW, endW);

        // Occasional branch?
        if (Math.random() < 0.3 && iteration > 1) {
            const branchX = midX_j + (Math.random() - 0.5) * len * 0.5;
            const branchY = midY_j + (Math.random() - 0.5) * len * 0.5;
            drawLightning(ctx, midX_j, midY_j, branchX, branchY, displacement * 0.5, iteration - 1, midW * 0.7, 0);
        }
    };

    // --- RENDERERS ---

    // GLOBAL RENDER CACHE (No GC)
    const BUCKET_COUNT = 10;
    const fieldBuckets = Array.from({ length: BUCKET_COUNT }, () => []);
    const fieldShockBucket = [];
    const renderField = (rgb) => {
        // Optimized Field Renderer
        // STEPS=1, Global Buckets (Zero GC)

        const STEPS = 1;
        // Removed FLUSH_EVERY to improve batching performance
        // Canvas can easily handle full grid in one path (approx 2-3k segments)

        // Create Spatial Gradient for "Cloud Noise" effect
        // We use a diagonal linear gradient to simulate the drift
        // Sampling 'getSpatialColor' at corners to define stops
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, `rgba(${getSpatialColor(rgb, 0, 0)}, 0.8)`);
        grad.addColorStop(0.5, `rgba(${getSpatialColor(rgb, width * 0.5, height * 0.5)}, 0.8)`);
        grad.addColorStop(1, `rgba(${getSpatialColor(rgb, width, height)}, 0.8)`);

        // Helper: Flush
        const flush = () => {
            const shockColorStr = `rgba(${rgb}, 0.9)`; // Shocks stay bright accent

            // Draw Standard Buckets
            for (let b = 1; b < BUCKET_COUNT; b++) {
                const list = fieldBuckets[b];
                if (list.length === 0) continue;
                const alpha = (b / BUCKET_COUNT) * 0.8;

                ctx.strokeStyle = grad;
                ctx.globalAlpha = alpha; // Apply alpha separately since gradient has fixed alpha
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let i = 0; i < list.length; i += 4) {
                    ctx.moveTo(list[i], list[i + 1]);
                    ctx.lineTo(list[i + 2], list[i + 3]);
                }
                ctx.stroke();
                list.length = 0; // Clear
            }
            ctx.globalAlpha = 1.0;

            // Draw Shock Bucket
            if (fieldShockBucket.length > 0) {
                ctx.strokeStyle = shockColorStr;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (let i = 0; i < fieldShockBucket.length; i += 4) {
                    ctx.moveTo(fieldShockBucket[i], fieldShockBucket[i + 1]);
                    ctx.lineTo(fieldShockBucket[i + 2], fieldShockBucket[i + 3]);
                }
                ctx.stroke();
                fieldShockBucket.length = 0;
            }
        };

        layers.forEach(l => {
            const { cols, rows, rawNodes, rawMeta } = l;

            for (let cx = 0; cx < cols - 1; cx++) {
                // if (cx % FLUSH_EVERY === 0) flush(); // Removed for performance

                for (let cy = 0; cy < rows - 1; cy++) {
                    const idx = cx * rows + cy;
                    const right = idx + rows;
                    const down = idx + 1;

                    const x = rawNodes[idx * 6]; const y = rawNodes[idx * 6 + 1];
                    const e = rawMeta[idx * 2]; const s = rawMeta[idx * 2 + 1];

                    // Visual parameters
                    // Fix: Average intensity for segments to prevent "upside-down L" artifacts

                    // Draw Right
                    const rightIdx = right;
                    const er = rawMeta[rightIdx * 2]; const sr = rawMeta[rightIdx * 2 + 1];

                    const avgE_r = (e + er) * 0.5;
                    const avgS_r = (s + sr) * 0.5;
                    const intensityR = (avgE_r * CONFIG.TRAIL_SENSITIVITY) + avgS_r + 0.15;

                    const rx = rawNodes[right * 6];
                    const ry = rawNodes[right * 6 + 1];

                    const bIdxR = Math.floor(Math.min(0.99, Math.max(0, intensityR)) * BUCKET_COUNT);

                    // Optimization: Visibility Cutoff (User Request)
                    if (avgS_r > 0.05) fieldShockBucket.push(x, y, rx, ry); // Shock visible
                    else if (intensityR > 0.18 && bIdxR > 0) fieldBuckets[bIdxR].push(x, y, rx, ry); // Field visible only if intensity > threshold

                    // Draw Down
                    const downIdx = down;
                    const ed = rawMeta[downIdx * 2]; const sd = rawMeta[downIdx * 2 + 1];

                    const avgE_d = (e + ed) * 0.5;
                    const avgS_d = (s + sd) * 0.5;
                    const intensityD = (avgE_d * CONFIG.TRAIL_SENSITIVITY) + avgS_d + 0.15;

                    const dx = rawNodes[down * 6];
                    const dy = rawNodes[down * 6 + 1];

                    const bIdxD = Math.floor(Math.min(0.99, Math.max(0, intensityD)) * BUCKET_COUNT);

                    // Optimization: Visibility Cutoff (User Request)
                    // Only add to buckets if intensity is high enough to be visible
                    if (avgS_d > 0.05) fieldShockBucket.push(x, y, dx, dy); // Shock visible
                    else if (intensityD > 0.18 && bIdxD > 0) fieldBuckets[bIdxD].push(x, y, dx, dy); // Field visible only if intensity > threshold
                }
            }
            flush(); // Final flush
        });
    };

    const getRandomEdgePoint = () => {
        const side = Math.floor(Math.random() * 4);
        switch (side) {
            case 0: return { x: Math.random() * width, y: 0 };           // Top
            case 1: return { x: Math.random() * width, y: height };      // Bottom
            case 2: return { x: 0, y: Math.random() * height };          // Left
            case 3: return { x: width, y: Math.random() * height };      // Right
        }
    };

    const renderElectric = (rgb) => {
        const { width, height } = canvas;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.shadowBlur = 15;

        // --- BOLT GENERATION (Using Pool) ---
        const spawnBolt = (x1, y1, x2, y2, life, thickness, targetObj = null) => {
            // Find free bolt
            let bolt = null;
            for (let i = 0; i < MAX_BOLTS; i++) {
                if (!boltPool[i].active) {
                    bolt = boltPool[i];
                    break;
                }
            }
            if (!bolt) return; // Pool full

            bolt.active = true;
            bolt.life = life;
            bolt.maxLife = life;
            // Generate varied color for this bolt
            bolt.color = applyOffset(rgb, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1);
            bolt.target = targetObj;
            bolt.pathCount = 0;

            // Generator Helper
            const addPath = (width) => {
                if (bolt.pathCount >= MAX_PATHS) return null;
                const p = bolt.paths[bolt.pathCount++];
                p.count = 0;
                p.width = width;
                return p;
            };

            const pushPoint = (path, x, y) => {
                if (!path || path.count >= MAX_POINTS - 2) return;
                path.points[path.count++] = x;
                path.points[path.count++] = y;
            };

            // Recursive Segment Generator
            const generateSegments = (ax, ay, bx, by, displace, width, iteration) => {
                const mainPath = addPath(width);
                if (!mainPath) return;

                pushPoint(mainPath, ax, ay);

                const recurse = (p1x, p1y, p2x, p2y, disp, iter) => {
                    if (iter <= 0) {
                        pushPoint(mainPath, p2x, p2y);
                        return;
                    }
                    const dx = p2x - p1x;
                    const dy = p2y - p1y;
                    const midX = (p1x + p2x) / 2;
                    const midY = (p1y + p2y) / 2;

                    const len = Math.sqrt(dx * dx + dy * dy);
                    const nx = -dy / len;
                    const ny = dx / len;

                    const jitter = (Math.random() - 0.5) * disp;
                    const mx = midX + nx * jitter;
                    const my = midY + ny * jitter;

                    recurse(p1x, p1y, mx, my, disp * 0.5, iter - 1);
                    recurse(mx, my, p2x, p2y, disp * 0.5, iter - 1);

                    // Branching
                    if (Math.random() < 0.2 && iter > 2 && iter < 5) {
                        if (bolt.pathCount < MAX_PATHS) {
                            const branchAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.5;
                            const branchLen = len * (0.5 + Math.random() * 0.5);
                            const ex = mx + Math.cos(branchAngle) * branchLen;
                            const ey = my + Math.sin(branchAngle) * branchLen;
                            generateSegments(mx, my, ex, ey, disp, width * 0.5, iteration - 1);
                        }
                    }
                };
                recurse(ax, ay, bx, by, displace, iteration);
            };

            generateSegments(x1, y1, x2, y2, 80, thickness, 6);
        };

        // --- SPAWN LOGIC ---
        // 1. Mouse Interaction (Click): Arcs from cursor to circumference
        if (mouse.down) {
            // High frequency: spawn multiple bolts per frame for density
            const count = 3;
            for (let k = 0; k < count; k++) {
                const target = getRandomEdgePoint();
                // Spawn from mouse -> edge
                spawnBolt(mouse.x, mouse.y, target.x, target.y, 10, 2.5);
            }
        }
        // 2. Idle State (Plasma Ball): Arcs from circumference to cursor
        else {
            // Rate: 2-3 per second. Logic runs ~60 FPS.
            // 2.5 / 60 ~= 0.04
            if (Math.random() < 0.04) {
                const source = getRandomEdgePoint();
                // Spawn from edge -> mouse
                // Life 20 (approx 1/3 sec visible)
                spawnBolt(source.x, source.y, mouse.x, mouse.y, 20, 2, mouse);
            }
        }

        // --- RENDER ---
        // Iterate Pool
        for (let i = 0; i < MAX_BOLTS; i++) {
            const bolt = boltPool[i];
            if (!bolt.active) continue;

            bolt.life--;
            if (bolt.life <= 0) {
                bolt.active = false;
                continue;
            }

            // Anchor logic
            if (bolt.target && bolt.pathCount > 0) {
                const mainPath = bolt.paths[0];
                if (mainPath.count >= 2) {
                    // Update target end of the bolt depending on direction
                    // To handle both cases (Start->Target vs Target->Start), we need to know WHICH was anchored.
                    // For Idle (Edge -> Mouse), the Target is the End (last point).
                    // For Click (Mouse -> Edge), we don't track targetObj (it's null).

                    // So if bolt.target is set, it MUST be the end of the bolt (last point).
                    const lastIdx = mainPath.count - 2;
                    if (lastIdx >= 0) {
                        mainPath.points[lastIdx] += (bolt.target.x - mainPath.points[lastIdx]) * 0.5;
                        mainPath.points[lastIdx + 1] += (bolt.target.y - mainPath.points[lastIdx + 1]) * 0.5;
                    }
                }
            }

            const alpha = bolt.life / bolt.maxLife;
            ctx.globalAlpha = alpha;
            ctx.shadowBlur = 10 * alpha;
            ctx.shadowColor = `rgba(${bolt.color}, 0.8)`;
            ctx.strokeStyle = `rgba(${bolt.color}, ${alpha})`;

            for (let p = 0; p < bolt.pathCount; p++) {
                const path = bolt.paths[p];
                if (path.count < 2) continue;

                ctx.lineWidth = path.width;
                ctx.beginPath();
                ctx.moveTo(path.points[0], path.points[1]);
                for (let j = 2; j < path.count; j += 2) {
                    ctx.lineTo(path.points[j], path.points[j + 1]);
                }
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1.0;
    };


    const renderGrid = (rgb) => {
        // ctx.fillStyle moved inside
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
                        // SPATIAL COLOR
                        const color = getSpatialColor(rgb, x1, y1);
                        ctx.fillStyle = `rgba(${color}, 0.8)`;
                        const size = 1.5 + (e1 + s1) * 3;
                        ctx.fillRect(x1 - size / 2, y1 - size / 2, size, size); // fillRect avoids path overhead for simple squares
                    } else if (e1 > 0.005) {
                        const color = getSpatialColor(rgb, x1, y1);
                        ctx.fillStyle = `rgba(${color}, 0.8)`;
                        ctx.fillRect(x1 - 1, y1 - 1, 1.5, 1.5);
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

                                // SPATIAL COLOR (Sub-dots)
                                const color = getSpatialColor(rgb, finalX, finalY);
                                ctx.fillStyle = `rgba(${color}, 0.8)`;
                                ctx.fillRect(finalX - size / 2, finalY - size / 2, size, size);
                            }
                        }
                    }
                }
                // FLUSH PATH PER COLUMN
                // This keeps the command buffer small and responsive.
                // ctx.fill(); // Handled by fillRects immediately
                ctx.beginPath();
            }
        });
        // ctx.fill();
    };

    const renderVector = (rgb) => {
        // ctx.strokeStyle = ... // Moved inside
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

                                // SPATIAL COLOR
                                const color = getSpatialColor(rgb, finalX, finalY);
                                ctx.strokeStyle = `rgba(${color}, 0.5)`;
                                ctx.beginPath();

                                // Draw Arrow
                                ctx.moveTo(finalX, finalY);
                                ctx.lineTo(x2, y2);

                                // Arrowhead
                                const headLen = 4;
                                ctx.moveTo(x2, y2);
                                ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
                                ctx.moveTo(x2, y2);
                                ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
                                ctx.stroke();
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
        // ctx.fillStyle = ... // Removed
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
            const boidColor = applyOffset(rgb, b.hOff, b.sOff, b.lOff);

            // Draw Trail
            if (b.history.length > 1) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(${boidColor}, 0.2)`;
                ctx.lineWidth = 2; // Faint trail
                ctx.moveTo(b.history[0].x, b.history[0].y);
                for (let i = 1; i < b.history.length; i++) {
                    ctx.lineTo(b.history[i].x, b.history[i].y);
                }
                ctx.stroke();
            }

            // Draw Head (Kite Shape)
            const angle = Math.atan2(b.vy, b.vx);
            ctx.fillStyle = `rgba(${boidColor}, 0.9)`;
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
        // ctx.strokeStyle = moved inside
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



                                // SPATIAL COLOR
                                const color = getSpatialColor(rgb, vx, vy);
                                ctx.strokeStyle = `rgba(${color}, 0.5)`;

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

    const renderMatrix = (rgb, activeShocks) => {
        const { width, height } = canvas;
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';

        matrixDrops.forEach(d => {
            d.y += d.vy;

            // Screen wrap
            if (d.y - d.len * 20 > height) {
                d.y = -20;
                d.x = Math.floor(Math.random() * (width / 20)) * 20;
                d.len = 10 + Math.floor(Math.random() * 20);
                d.vals = [];
                d.highlights = [];
                for (let i = 0; i < d.len; i++) {
                    d.vals.push(getRandomMatrixChar());
                    d.highlights.push(Math.random() < 0.05);
                }
            }

            // Draw Trail
            const headY = d.y;
            // Snap to grid visually?
            const snapHeadY = Math.floor(headY / 20) * 20;

            for (let i = 0; i < d.len; i++) {
                const charY = snapHeadY - i * 20;
                // Cull off-screen
                if (charY > height + 20) continue;
                // Don't cull top, we need to see them falling in

                const char = d.vals[i];

                // Character Switch Logic (Decoding Effect)
                if (Math.random() < 0.05) {
                    d.vals[i] = getRandomMatrixChar();
                    // Keep existing highlight status or re-roll? 
                    // Let's re-roll to make it dynamic
                    if (Math.random() < 0.05) d.highlights[i] = !d.highlights[i];
                }

                // Opacity
                let alpha = 1.0 - (i / d.len);
                if (alpha < 0) alpha = 0;

                // Head is white/bright
                if (i === 0) {
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowBlur = 5;
                    ctx.shadowColor = '#ffffff';
                    // ctx.font = 'bold 22px monospace';
                } else {
                    // Luminosity Logic
                    let isBright = d.highlights[i];

                    if (!isBright && mouse.x !== -999) {
                        // Check proximity
                        const dist = Math.hypot(d.x - mouse.x, charY - mouse.y); // Approx Y check
                        if (dist < 100) isBright = true;
                    }

                    if (!isBright) alpha *= 0.5;

                    ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
                    ctx.shadowBlur = 0;
                    // ctx.font = '20px monospace';
                }

                ctx.fillText(char, d.x, charY);
            }
            ctx.shadowBlur = 0;
        });
    };

    const renderConstellation = (rgb, activeShocks) => {
        // stars.forEach loop for physics
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

            // VOID DRIFT
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
            s.vx *= 0.96; s.vy *= 0.96;

            if (s.x < 0 || s.x > width) s.vx *= -1;
            if (s.y < 0 || s.y > height) s.vy *= -1;

            if (Math.abs(s.vx) < 0.05) s.vx += (Math.random() - 0.5) * 0.05;
            if (Math.abs(s.vy) < 0.05) s.vy += (Math.random() - 0.5) * 0.05;
        });

        // 1. Draw Lines (Batched for performance)
        ctx.strokeStyle = `rgba(${rgb}, 0.15)`; // Faint lines
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let i = 0; i < stars.length; i++) {
            const s1 = stars[i];

            // Movement logic inside render for efficiency? 
            // Ideally should be in update, but for now we keep it here as per previous structure.
            s1.x += s1.vx; s1.y += s1.vy;
            if (s1.x < 0) s1.x = width; if (s1.x > width) s1.x = 0;
            if (s1.y < 0) s1.y = height; if (s1.y > height) s1.y = 0;

            for (let j = i + 1; j < stars.length; j++) {
                const s2 = stars[j];
                const dx = s1.x - s2.x; const dy = s1.y - s2.y;
                if (dx * dx + dy * dy < 22500) { // 150*150
                    ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y);
                }
            }
        }
        ctx.stroke();

        // 2. Draw Stars (Individual Twinkle & Shape)
        const time = Date.now();

        stars.forEach((s) => {
            // Mouse Interaction (Push)
            if (mouse.x !== -999) {
                const dx = s.x - mouse.x; const dy = s.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    const force = (150 - dist) / 150;
                    s.vx += (dx / dist) * force * 0.2;
                    s.vy += (dy / dist) * force * 0.2;
                }
            }

            // Twinkle Logic
            // Sine wave -1 to 1 -> map to 0.4 to 1.0 opacity
            const twinkle = Math.sin(time * s.twinkleSpeed + s.twinklePhase);
            const alpha = 0.4 + (twinkle + 1) * 0.3; // 0.4 to 1.0 roughly
            const size = s.radius * (0.8 + (twinkle + 1) * 0.2); // slight size pulse

            // Color
            const starColor = applyOffset(rgb, s.hOff, s.sOff, s.lOff);
            ctx.fillStyle = `rgba(${starColor}, ${alpha})`;

            // Draw Star Shape (Diamond / 4-point)
            ctx.beginPath();
            ctx.moveTo(s.x, s.y - size * 1.5); // Top
            ctx.lineTo(s.x + size, s.y);       // Right
            ctx.lineTo(s.x, s.y + size * 1.5); // Bottom
            ctx.lineTo(s.x - size, s.y);       // Left
            ctx.closePath();
            ctx.fill();
        });
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

    const cloudSpritePool = [];

    // Pre-generate nebula sprites to avoid runtime lag
    const initNebulaSprites = (r, g, b) => {
        cloudSpritePool.length = 0;
        const baseRgb = `${r},${g},${b}`;
        for (let i = 0; i < 20; i++) {
            const variant = applyOffset(baseRgb, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1);
            const [vr, vg, vb] = variant.split(',').map(n => parseInt(n.trim()));
            cloudSpritePool.push(generateCloudTexture(vr, vg, vb));
        }
    };

    const initNebula = () => {
        nebulaParticles.length = 0;
        const rgb = currentAccentRGB.split(',').map(n => parseInt(n.trim()));

        // Init cache if empty or color changed (simple check: if empty, init)
        // Ideally we should check color match but refreshing on initNebula is fine as it's called on resize/style switch
        initNebulaSprites(rgb[0], rgb[1], rgb[2]);

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
                sprite: cloudSpritePool[Math.floor(Math.random() * cloudSpritePool.length)]
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
                sprite: cloudSpritePool[Math.floor(Math.random() * cloudSpritePool.length)]
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
                    sprite: cloudSpritePool[Math.floor(Math.random() * cloudSpritePool.length)]
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

        // Always update physics to avoid cold-start lag when switching styles
        const maxEnergy = updateVectorPhysics(activeForces, activeShocks);

        if (currentStyle === 'OFF') {
            requestAnimationFrame(animate);
            return;
        }

        // --- IDLE SLEEP REMOVED (User Request) ---
        // Consistent FPS preferred over idle efficiency for this application.

        let accent = currentAccentRGB;
        // Animated variance for Field-likes (Breathing effect)
        if (['FIELD', 'GRID', 'VECTOR', 'TOPO'].includes(currentStyle)) {
            accent = getAnimatedColor(currentAccentRGB);
        }

        switch (currentStyle) {
            case 'FIELD': renderField(accent); break;
            case 'GRID': renderGrid(accent); break;
            case 'VECTOR': renderVector(accent); break;
            case 'BOIDS': renderBoids(accent); break;
            case 'TOPO': renderTopo(accent); break;
            case 'MATRIX': renderMatrix(accent, activeShocks); break;
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

        if (STYLES[currentStyleIdx].id === 'MATRIX') initMatrix();
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
