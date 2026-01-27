(() => {
    const canvas = document.getElementById('vector-cloud');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // =========================================
    //               CONFIGURATION
    // =========================================
    const CONFIG = {
        // --- VISIBILITY ---
        // Radius of the always-visible spotlight around the cursor
        MOUSE_RADIUS: 0,          
        // Minimum energy (0.0 - 1.0) required for the drag trail to light up
        VISIBILITY_CUTOFF: 0.4,    
        // Multiplier for drag trail visibility. Higher = brighter/longer trails
        TRAIL_SENSITIVITY: 2,      

        // --- FLUID PHYSICS ---
        // Elasticity: Higher (0.1+) = snappy spring. Lower (0.01) = loose liquid.
        TENSION: 0.01,            
        // Viscosity: Higher (0.95+) = thick fluid/sludge. Lower (0.8) = slippery/bouncy.
        FRICTION: 0.9,            

        // --- SHOCKWAVES ---
        SHOCK_WIDTH: 3,
        SHOCK_AMPLITUDE: 2,        // How strongly the wave distorts the grid
        SHOCK_DURATION: 30,        // How many frames the wave lasts
        SHOCK_THICKNESS: 7,       // Width of the wavefront band
        SHOCK_SPEED: 3,            // Expansion speed (pixels per frame)

        // --- LAYERS ---
        // Define the depth and drag sensitivity of the grid layers
        LAYERS: [
            { spacing: 20, radius: 260, drag: 0.15 }, // Top layer
            { spacing: 10, radius: 180, drag: 0.075 }  // Bottom layer (denser)
        ]
    };
    // =========================================

    // Working state
    const layers = CONFIG.LAYERS.map(l => ({ ...l, nodes: [] }));
    const forces = []; 
    const shockwaves = [];
    let activity = 0;
    const mouse = { x: -999, y: -999, prevX: -999, prevY: -999 };

    const applyAlpha = (color, alpha) => {
        if (!color.startsWith('#')) return color;
        const hex = color.slice(1);
        const bigint = parseInt(hex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const updateAccent = () => {
        const style = getComputedStyle(document.documentElement);
        return style.getPropertyValue('--accent').trim() || '#4ecdc4';
    };

    const buildNodes = () => {
        layers.forEach(layer => {
            const spacing = layer.spacing;
            const cols = Math.ceil((width + spacing * 2) / spacing);
            const rows = Math.ceil((height + spacing * 2) / spacing);
            const nodes = [];
            for (let cx = 0; cx < cols; cx++) {
                for (let cy = 0; cy < rows; cy++) {
                    const x = -spacing + cx * spacing;
                    const y = -spacing + cy * spacing;
                    nodes.push({
                        baseX: x,
                        baseY: y,
                        x,
                        y,
                        vx: 0,
                        vy: 0,
                        energy: 0,
                        shock: 0,
                        cx,
                        cy
                    });
                }
            }
            layer.nodes = nodes;
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
    };

    const spawnShockwave = (x, y) => {
        shockwaves.push({ 
            x, 
            y, 
            radius: 0, 
            age: 0, 
            maxAge: CONFIG.SHOCK_DURATION,
            thickness: CONFIG.SHOCK_THICKNESS, 
            amplitude: CONFIG.SHOCK_AMPLITUDE 
        });
        if (shockwaves.length > 10) shockwaves.shift();
        activity = 1;
    };

    const addForce = (x, y, dx, dy) => {
        const mag = Math.hypot(dx, dy);
        if (mag < 0.5) return;
        
        forces.push({ 
            x, 
            y, 
            vx: dx, 
            vy: dy, 
            life: 1 
        });
        
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
    
    const triggerShock = (x, y) => spawnShockwave(x, y);
    
    window.addEventListener('mousedown', e => triggerShock(e.clientX, e.clientY));
    window.addEventListener('touchstart', e => {
        const touch = e.touches[0];
        triggerShock(touch.clientX, touch.clientY);
        mouse.prevX = mouse.x = touch.clientX;
        mouse.prevY = mouse.y = touch.clientY;
    });

    buildNodes();

    const animate = () => {
        ctx.clearRect(0, 0, width, height);

        // Update Forces
        for (let i = forces.length - 1; i >= 0; i--) {
            forces[i].life *= 0.85; 
            if (forces[i].life < 0.01) forces.splice(i, 1);
        }

        // Update Shockwaves
        for (let i = shockwaves.length - 1; i >= 0; i--) {
            const s = shockwaves[i];
            s.radius += CONFIG.SHOCK_SPEED; 
            s.age++;
            if (s.age >= s.maxAge) shockwaves.splice(i, 1);
        }

        activity *= 0.99; 
        if (forces.length > 0) activity = Math.max(activity, 0.8);
        if (shockwaves.length > 0) activity = 1;
        
        if (activity < 0.01 && !shockwaves.length && !forces.length) {
            requestAnimationFrame(animate);
            return;
        }

        const accent = updateAccent();
        const baseColor = applyAlpha(accent, 0.4); 
        const shockColor = applyAlpha(accent, 0.8);

        layers.forEach(layer => {
            const nodes = layer.nodes;

            nodes.forEach(node => {
                let targetX = node.baseX;
                let targetY = node.baseY;
                
                forces.forEach(f => {
                    const dx = node.baseX - f.x;
                    const dy = node.baseY - f.y;
                    const distSq = dx * dx + dy * dy + 400; 
                    const influence = f.life * layer.drag * 2000 / distSq;
                    targetX += f.vx * influence;
                    targetY += f.vy * influence;
                });

                node.vx += (targetX - node.x) * CONFIG.TENSION;
                node.vy += (targetY - node.y) * CONFIG.TENSION;
                node.vx *= CONFIG.FRICTION; 
                node.vy *= CONFIG.FRICTION;
                node.x += node.vx;
                node.y += node.vy;
                
                node.energy = Math.min(1, Math.hypot(node.vx, node.vy));

                node.shock = 0;
                shockwaves.forEach(s => {
                    const dist = Math.hypot(node.x - s.x, node.y - s.y);
                    const d = Math.abs(dist - s.radius);
                    const band = Math.exp(-(d * d) / (2 * s.thickness * s.thickness));
                    const lifeProgress = s.age / s.maxAge;
                    const lifeFade = 1 - lifeProgress;
                    node.shock = Math.max(node.shock, band * lifeFade * s.amplitude);
                });
            });

            const rows = layer.rows;
            const cols = layer.cols;

            const drawConnection = (n1, n2) => {
                // A: Mouse Proximity
                const midX = (n1.x + n2.x) / 2;
                const midY = (n1.y + n2.y) / 2;
                const distToMouse = Math.hypot(midX - mouse.x, midY - mouse.y);
                const mouseVisibility = Math.max(0, 1 - Math.pow(distToMouse / CONFIG.MOUSE_RADIUS, 2));

                // B: Movement (Trail)
                const movementVisibility = (n1.energy + n2.energy) * CONFIG.TRAIL_SENSITIVITY;

                const combinedVisibility = Math.max(mouseVisibility, movementVisibility) * activity;

                if (combinedVisibility > CONFIG.VISIBILITY_CUTOFF) {
                    ctx.strokeStyle = baseColor;
                    ctx.lineWidth = 0.8;
                    ctx.globalAlpha = Math.min(0.5, combinedVisibility);
                    ctx.beginPath();
                    ctx.moveTo(n1.x, n1.y);
                    ctx.lineTo(n2.x, n2.y);
                    ctx.stroke();
                }

                // C: Shockwave
                const avgShock = (n1.shock + n2.shock) / 2;
                if (avgShock > 0.05) {
                    ctx.strokeStyle = shockColor;
                    ctx.lineWidth = CONFIG.SHOCK_WIDTH; 
                    const intensity = Math.min(1, Math.pow(avgShock, 3)); 
                    ctx.globalAlpha = intensity;
                    ctx.beginPath();
                    ctx.moveTo(n1.x, n1.y);
                    ctx.lineTo(n2.x, n2.y);
                    ctx.stroke();
                }
            };

            for (let cx = 0; cx < cols; cx++) {
                for (let cy = 0; cy < rows; cy++) {
                    const node = nodes[cx * rows + cy];
                    if (cx < cols - 1) drawConnection(node, nodes[(cx + 1) * rows + cy]);
                    if (cy < rows - 1) drawConnection(node, nodes[cx * rows + (cy + 1)]);
                }
            }
        });

        requestAnimationFrame(animate);
    };

    resize();
    animate();
})();