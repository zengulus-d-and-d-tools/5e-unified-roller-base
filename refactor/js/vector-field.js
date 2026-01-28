(() => {
    const canvas = document.getElementById('vector-cloud');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); // Alpha false for potential speedup if background is opaque (it's not usually, but we clearRect)

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // =========================================
    //               CONFIGURATION
    // =========================================
    const CONFIG = {
        MOUSE_RADIUS_SQ: 0, // Radius squared, 0*0
        VISIBILITY_CUTOFF: 0.4,
        TRAIL_SENSITIVITY: 2,
        TENSION: 0.01,
        FRICTION: 0.9,
        SHOCK_WIDTH: 3,
        SHOCK_AMPLITUDE: 2,
        SHOCK_DURATION: 30,
        SHOCK_THICKNESS: 7,
        SHOCK_SPEED: 3,
        LAYERS: [
            { spacing: 20, radius: 260, drag: 0.15 },
            { spacing: 10, radius: 180, drag: 0.075 }
        ]
    };

    // Pre-calculate squared lookup
    const DRAG_FACTOR = 2000;

    const layers = CONFIG.LAYERS.map(l => ({ ...l, nodes: [] }));
    const forces = [];
    const shockwaves = [];
    let activity = 0;
    const mouse = { x: -999, y: -999, prevX: -999, prevY: -999 };

    // Cached colors strings (r, g, b)
    let currentAccentRGB = "78, 205, 196";

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
            const nodes = new Float32Array(cols * rows * 6); // x, y, vx, vy, baseX, baseY
            const meta = new Float32Array(cols * rows * 2); // energy, shock

            // Initialize
            for (let i = 0; i < cols * rows; i++) {
                const cx = (i / rows) | 0; // equivalent to Math.floor
                const cy = i % rows;
                const x = -spacing + cx * spacing;
                const y = -spacing + cy * spacing;

                const baseIdx = i * 6;
                nodes[baseIdx] = x;    // x
                nodes[baseIdx + 1] = y;    // y
                nodes[baseIdx + 2] = 0;    // vx
                nodes[baseIdx + 3] = 0;    // vy
                nodes[baseIdx + 4] = x;    // baseX
                nodes[baseIdx + 5] = y;    // baseY
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
        if (magSq < 0.25) return; // 0.5*0.5

        forces.push({ x, y, vx: dx, vy: dy, life: 1 });
        if (forces.length > 15) forces.shift();
        activity = 1;
    };

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

    buildNodes();
    updateAccent();

    // BATCHING ARRAYS
    // Pre-allocate arrays for batch drawing to avoid GC
    // Max segments is roughly 2500 for a 1080p screen per layer
    const MAX_SEGMENTS = 5000;
    const batchCoords = new Float32Array(MAX_SEGMENTS * 4); // x1, y1, x2, y2
    const batchCounts = new Int32Array(11); // 10 buckets for alpha 0.0-0.5 + 1 for shockwaves

    const animate = () => {
        ctx.clearRect(0, 0, width, height);

        // Update Forces
        let activeForces = false;
        for (let i = forces.length - 1; i >= 0; i--) {
            forces[i].life *= 0.85;
            if (forces[i].life < 0.01) {
                forces.splice(i, 1);
            } else {
                activeForces = true;
            }
        }

        // Update Shockwaves
        let activeShocks = false;
        for (let i = shockwaves.length - 1; i >= 0; i--) {
            const s = shockwaves[i];
            s.radius += CONFIG.SHOCK_SPEED;
            s.age++;
            if (s.age >= s.maxAge) {
                shockwaves.splice(i, 1);
            } else {
                activeShocks = true;
            }
        }

        activity *= 0.99;
        if (activeForces) activity = Math.max(activity, 0.8);
        if (activeShocks) activity = 1;

        if (activity < 0.01 && !activeShocks && !activeForces) {
            requestAnimationFrame(animate);
            return;
        }

        layers.forEach(layer => {
            const { rawNodes, rawMeta, cols, rows, drag } = layer;
            const count = cols * rows;

            // 1. UPDATE NODES
            for (let i = 0; i < count; i++) {
                const baseIdx = i * 6;
                // Read
                let x = rawNodes[baseIdx];
                let y = rawNodes[baseIdx + 1];
                let vx = rawNodes[baseIdx + 2];
                let vy = rawNodes[baseIdx + 3];
                const baseX = rawNodes[baseIdx + 4];
                const baseY = rawNodes[baseIdx + 5];

                // Apply forces
                if (activeForces) {
                    let targetX = baseX;
                    let targetY = baseY;
                    for (let f of forces) {
                        const dx = baseX - f.x;
                        const dy = baseY - f.y;
                        const distSq = dx * dx + dy * dy + 400;
                        const influence = f.life * drag * DRAG_FACTOR / distSq;
                        targetX += f.vx * influence;
                        targetY += f.vy * influence;
                    }
                    vx += (targetX - x) * CONFIG.TENSION;
                    vy += (targetY - y) * CONFIG.TENSION;
                } else {
                    vx += (baseX - x) * CONFIG.TENSION;
                    vy += (baseY - y) * CONFIG.TENSION;
                }

                vx *= CONFIG.FRICTION;
                vy *= CONFIG.FRICTION;
                x += vx;
                y += vy;

                // Write back
                rawNodes[baseIdx] = x;
                rawNodes[baseIdx + 1] = y;
                rawNodes[baseIdx + 2] = vx;
                rawNodes[baseIdx + 3] = vy;

                // Meta calculations
                rawMeta[i * 2] = (Math.abs(vx) + Math.abs(vy)); // approx energy (faster than hypot)

                // Shockwave
                let shock = 0;
                if (activeShocks) {
                    for (let s of shockwaves) {
                        const dx = x - s.x;
                        const dy = y - s.y;
                        const distSq = dx * dx + dy * dy;
                        const dist = Math.sqrt(distSq);
                        const d = Math.abs(dist - s.radius);
                        if (d < s.thickness * 3) { // optimization range
                            const band = Math.exp(-(d * d) / (2 * s.thickness * s.thickness));
                            const lifeFade = 1 - (s.age / s.maxAge);
                            shock = Math.max(shock, band * lifeFade * s.amplitude);
                        }
                    }
                }
                rawMeta[i * 2 + 1] = shock;
            }

            // 2. BATCH DRAWING
            // Reset batch counts
            const BUCKETS = 11; // 0-9 for alpha 0.05-0.5, 10 for shockwave
            // We use an array of arrays for buckets, but to avoid GC we can use big typed array and segment offsets?
            // Actually, simplest JS way without complex alloc management is array of arrays that we clear.
            // But we wanted to avoid GC.
            // Let's use the typed array `batchCoords`.
            // We need to track current index for each bucket.
            // Since we don't know exact distribution, we might overlap.
            // Safer: Just iterate twice? Or sort?
            // Fastest: Array of regular arrays, but reuse them?
            // Let's stick to simplest optimization: Standard array push is fast enough if we don't recreate objects.
            // But we want to batch stroke() calls.

            // Reset bucket counters using a flat array approach?
            // Let's use Array of Arrays but clear length.
            if (!layer.buckets) {
                layer.buckets = Array.from({ length: BUCKETS }, () => []);
                layer.shockBucket = [];
            }
            // Clear buckets
            for (let b = 0; b < BUCKETS; b++) layer.buckets[b].length = 0;
            layer.shockBucket.length = 0;

            const baseColor = `rgba(${currentAccentRGB}, `;
            const shockColorStr = `rgba(${currentAccentRGB}, 0.8)`;

            for (let cx = 0; cx < cols; cx++) {
                for (let cy = 0; cy < rows; cy++) {
                    const idx = cx * rows + cy;
                    // Right connection
                    if (cx < cols - 1) processConnection(layer, idx, idx + rows);
                    // Bottom connection
                    if (cy < rows - 1) processConnection(layer, idx, idx + 1);
                }
            }

            // Draw Standard Buckets
            ctx.lineWidth = 0.8;
            for (let b = 1; b < BUCKETS; b++) {
                const segmentList = layer.buckets[b];
                if (segmentList.length === 0) continue;

                const alpha = b * 0.05; // 0.05, 0.10, ... 0.50
                ctx.strokeStyle = baseColor + alpha + ")";

                ctx.beginPath();
                for (let i = 0; i < segmentList.length; i += 4) {
                    ctx.moveTo(segmentList[i], segmentList[i + 1]);
                    ctx.lineTo(segmentList[i + 2], segmentList[i + 3]);
                }
                ctx.stroke();
            }

            // Draw Shockwaves
            if (layer.shockBucket.length > 0) {
                ctx.strokeStyle = shockColorStr;
                ctx.lineWidth = CONFIG.SHOCK_WIDTH;
                ctx.beginPath();
                for (let i = 0; i < layer.shockBucket.length; i += 4) {
                    ctx.moveTo(layer.shockBucket[i], layer.shockBucket[i + 1]);
                    ctx.lineTo(layer.shockBucket[i + 2], layer.shockBucket[i + 3]);
                }
                ctx.globalAlpha = 1; // Shock bucket uses its own color string but alpha is tricky if variable
                // Actually shockwave alpha varies by intensity...
                // So batching shockwaves is harder. 
                // Fallback: Draw shockwaves individually or batch by intensity?
                // For now, simplify: Assume shockwaves are high alpha or use globalAlpha = 1 and let color handle it?
                // The original code used globalAlpha = intensity.
                // Revert to individual stroke for shockwaves to maintain look, or batch top 10%?
                // Let's draw shockwaves individually for fidelity as they are rare.
                // Wait, processConnection pushed to shockBucket.
                // Let's redraw shockBucket carefully.
                // Actually, let's just stick to the loops inside processConnection for shockwaves to avoid storage?
                // No, we already stored coords.
                // Let's assume max intensity for batch or just stroke immediately?
                // BETTER: Just dont batch shockwaves significantly or just use a high alpha.
                // Optimized compromise: Draw all shock segments at 0.8 alpha.
                ctx.stroke();
            }
        });

        requestAnimationFrame(animate);
    };

    const processConnection = (layer, i1, i2) => {
        const { rawNodes, rawMeta, buckets, shockBucket } = layer;

        const base1 = i1 * 6;
        const x1 = rawNodes[base1];
        const y1 = rawNodes[base1 + 1];

        const base2 = i2 * 6;
        const x2 = rawNodes[base2];
        const y2 = rawNodes[base2 + 1];

        // Shockwave check
        const s1 = rawMeta[i1 * 2 + 1];
        const s2 = rawMeta[i2 * 2 + 1];
        const avgShock = (s1 + s2) * 0.5;

        if (avgShock > 0.05) {
            // High priority draw
            shockBucket.push(x1, y1, x2, y2);
            return; // Don't draw normal line on top
        }

        // Visibility Check
        if (activity < 0.01) return; // optimization

        // Mouse Proximity (Optimization: skip sqrt if obvious)
        const midX = (x1 + x2) * 0.5;
        const midY = (y1 + y2) * 0.5;
        const dx = midX - mouse.x;
        const dy = midY - mouse.y;

        // Approx Visibility
        let mouseVis = 0;
        // if (dx*dx + dy*dy < CONFIG.MOUSE_RADIUS_SQ) ... // Mouse radius is 0 in config so skip

        // Movement Trail
        const e1 = rawMeta[i1 * 2];
        const e2 = rawMeta[i2 * 2];
        const moveVis = (e1 + e2) * CONFIG.TRAIL_SENSITIVITY;

        // Final Visibility
        const combinedVis = moveVis * activity; // simplified since mouseVis is 0

        if (combinedVis > CONFIG.VISIBILITY_CUTOFF) {
            // Bucketize: 0.0 - 0.5 mapped to 0-10
            let bucketIdx = Math.floor(Math.min(0.5, combinedVis) * 20); // *20 means 0.05 steps
            if (bucketIdx > 0) {
                buckets[bucketIdx].push(x1, y1, x2, y2);
            }
        }
    };

    resize();
    animate();
})();