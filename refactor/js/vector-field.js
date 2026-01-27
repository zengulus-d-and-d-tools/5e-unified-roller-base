(() => {
    const canvas = document.getElementById('vector-cloud');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = 0;
    let height = 0;
    const mouse = { x: -999, y: -999, active: false, down: false, prevX: -999, prevY: -999 };
    let lastScrollY = window.scrollY;
    let scrollVelocity = 0;
    const BASE_RADIUS = 75;
    const RADIUS_FALLOFF = 0.67;
    const layers = [
        {
            spacing: 46,
            radius: 250,
            parallax: 0.035,
            swirl: 0.35,
            alphaScale: 0.3,
            size: 1.2,
            nodes: []
        },
        {
            spacing: 26,
            radius: 190,
            parallax: 0.012,
            swirl: 0.2,
            alphaScale: 1.3,
            size: 1,
            nodes: []
        }
    ];
    const vortices = [];
    const shockwaves = [];
    let focus = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let focusTarget = { x: focus.x, y: focus.y };
    let lastInteraction = 0;
    let activity = 0;
    const INTERACTION_TIMEOUT = 220;

    const updateAccent = () => {
        const style = getComputedStyle(document.documentElement);
        return style.getPropertyValue('--accent').trim() || '#4ecdc4';
    };

    const applyAlpha = (color, alpha = 1) => {
        if (color.startsWith('#')) {
            const hex = color.replace('#', '');
            const bigint = parseInt(hex, 16);
            const r = (bigint >> 16) & 255;
            const g = (bigint >> 8) & 255;
            const b = bigint & 255;
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return color;
    };

    const complementColor = (color) => {
        if (!color.startsWith('#')) return color;
        let hex = color.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const bigint = parseInt(hex, 16);
        const r = 255 - ((bigint >> 16) & 255);
        const g = 255 - ((bigint >> 8) & 255);
        const b = 255 - (bigint & 255);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };

    const buildNodes = () => {
        layers.forEach(layer => {
            const spacing = layer.spacing;
            const cols = Math.ceil((width + spacing * 2) / spacing);
            const rows = Math.ceil((height + spacing * 2) / spacing);
            const startX = -spacing;
            const startY = -spacing;
            const nodes = [];

            for (let cx = 0; cx < cols; cx++) {
                const x = startX + cx * spacing;
                for (let ry = 0; ry < rows; ry++) {
                    const y = startY + ry * spacing;
                    nodes.push({
                        baseX: x,
                        baseY: y,
                        x,
                        y,
                        vx: 0,
                        vy: 0,
                        lastAngle: 0,
                        alpha: 0,
                        cx,
                        ry
                    });
                }
            }

            layer.nodes = nodes;
            layer.cols = cols;
            layer.rows = rows;
        });
    };

    const resize = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        focus = { x: width / 2, y: height / 2 };
        focusTarget = { x: focus.x, y: focus.y };
        buildNodes();
    };

    window.addEventListener('resize', resize);
    const pushVortex = (x, y, dx, dy) => {
        const mag = Math.hypot(dx, dy);
        if (mag < 0.5) return;
        const strength = Math.min(1.2, mag / 18);
        vortices.push({ x, y, vx: dx * 0.4, vy: dy * 0.4, strength, life: 1 });
        if (vortices.length > 120) vortices.shift();
        lastInteraction = Date.now();
    };

    const spawnShockwave = (x, y, amplitude = 4) => {
        shockwaves.push({ x, y, radius: 0, life: 1, speed: 4, thickness: 3, amplitude });
        if (shockwaves.length > 6) shockwaves.shift();
        lastInteraction = Date.now();
        activity = 1;
    };

    window.addEventListener('mousemove', e => {
        if (mouse.prevX !== -999) {
            const dx = e.clientX - mouse.prevX;
            const dy = e.clientY - mouse.prevY;
            pushVortex(e.clientX, e.clientY, dx, dy);
        }
        mouse.prevX = e.clientX;
        mouse.prevY = e.clientY;
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
        focusTarget.x = e.clientX;
        focusTarget.y = e.clientY;
        lastInteraction = Date.now();
    });
    window.addEventListener('mousedown', e => {
        mouse.down = true;
        spawnShockwave(e.clientX, e.clientY, 4);
        lastInteraction = Date.now();
    });
    window.addEventListener('mouseup', () => { mouse.down = false; });
    window.addEventListener('touchstart', e => {
        const touch = e.touches[0];
        mouse.prevX = mouse.x = touch.clientX;
        mouse.prevY = mouse.y = touch.clientY;
        mouse.active = true;
        mouse.down = true;
        spawnShockwave(mouse.x, mouse.y, 4);
        focusTarget.x = mouse.x;
        focusTarget.y = mouse.y;
        lastInteraction = Date.now();
    });
    window.addEventListener('touchend', () => {
        mouse.active = false;
        mouse.down = false;
        focusTarget.x = width / 2;
        focusTarget.y = height / 2;
        lastInteraction = Date.now();
    });
    window.addEventListener('mouseleave', () => {
        mouse.active = false;
        mouse.down = false;
        focusTarget.x = width / 2;
        focusTarget.y = height / 2;
        lastInteraction = Date.now();
    });
    window.addEventListener('scroll', () => {
        const currentY = window.scrollY;
        scrollVelocity = currentY - lastScrollY;
        lastScrollY = currentY;
    });

    resize();

    const mixAngles = (a, b, t) => {
        const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a));
        return a + diff * t;
    };

    const sampleFlow = (x, y, centerX, centerY, radius, time, swirlStrength) => {
        const dx = x - centerX;
        const dy = y - centerY;
        const distSq = dx * dx + dy * dy;
        if (distSq > radius * radius) return null;

        const dist = Math.sqrt(distSq);
        let alpha = dist < 40 ? (dist / 40) : 1 - ((dist - 40) / (radius - 40));
        alpha = Math.max(0, Math.min(1, alpha));
        if (alpha <= 0.01) return null;

        let angle = Math.atan2(dy, dx);
        angle += Math.sin((x * 0.015 + y * 0.01) + time * 0.0015) * swirlStrength;

        const windForce = -scrollVelocity * 0.05;
        if (Math.abs(windForce) > 0.01) {
            const vx = Math.cos(angle);
            const vy = Math.sin(angle);
            angle = Math.atan2(vy + windForce, vx);
        }

        const sigma = Math.max(160, radius * 0.7);
        for (let i = 0; i < vortices.length; i++) {
            const v = vortices[i];
            const dxv = x - v.x;
            const dyv = y - v.y;
            const influence = v.life * v.strength * Math.exp(-(dxv * dxv + dyv * dyv) / (2 * sigma * sigma));
            if (influence < 0.001) continue;
            const pushAngle = Math.atan2(v.vy || 0.0001, v.vx || 0.0001);
            angle = mixAngles(angle, pushAngle, Math.min(0.9, influence));
        }

        return { angle, alpha };
    };

    const animate = () => {
        ctx.clearRect(0, 0, width, height);
        scrollVelocity *= 0.9;
        for (let i = vortices.length - 1; i >= 0; i--) {
            const v = vortices[i];
            v.x += v.vx;
            v.y += v.vy;
            v.vx *= 0.94;
            v.vy *= 0.94;
            v.life *= 0.92;
            if (v.life < 0.05) vortices.splice(i, 1);
        }

        for (let i = shockwaves.length - 1; i >= 0; i--) {
            const s = shockwaves[i];
            s.radius += s.speed;
            s.speed *= 0.99;
            s.life *= 0.95;
            s.thickness = Math.max(0.8, s.thickness * 0.98);
            if (s.life < 0.05) shockwaves.splice(i, 1);
        }

        focus.x += (focusTarget.x - focus.x) * 0.08;
        focus.y += (focusTarget.y - focus.y) * 0.08;

        const now = Date.now();
        let activityTarget = shockwaves.length ? 1 : vortices.length ? 0.6 : 0;
        const sinceInteraction = now - lastInteraction;
        if (sinceInteraction < INTERACTION_TIMEOUT) {
            const recent = 1 - sinceInteraction / INTERACTION_TIMEOUT;
            activityTarget = Math.max(activityTarget, 0.4 + 0.6 * recent);
        }
        activity += (activityTarget - activity) * 0.08;
        const fade = Math.max(0, Math.min(1, activity));
        if (fade < 0.02) {
            requestAnimationFrame(animate);
            return;
        }

        const accentColor = updateAccent();
        const baseColor = applyAlpha(accentColor, 0.66);
        const shockAccentColor = applyAlpha(complementColor(accentColor), 0.8);
        const time = Date.now();
        const pointerX = focus.x;
        const pointerY = focus.y;

        ctx.strokeStyle = accentColor;
        layers.forEach(layer => {
            const centerX = pointerX + (pointerX - width / 2) * layer.parallax;
            const centerY = pointerY + (pointerY - height / 2) * layer.parallax * 1.2;
            const radius = (layer.radius || BASE_RADIUS) * RADIUS_FALLOFF;
            const nodes = layer.nodes;
            const connectionColor = baseColor;
            const shockConnectionColor = shockAccentColor;
            const swirlStrength = vortices.length ? layer.swirl * Math.min(1, fade * 1.2) : 0;

            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const distToCenter = Math.hypot(node.baseX - centerX, node.baseY - centerY);
                if (distToCenter > radius + layer.spacing * 1.5) {
                    node.vx *= 0.85;
                    node.vy *= 0.85;
                    node.x += (node.baseX - node.x) * 0.2;
                    node.y += (node.baseY - node.y) * 0.2;
                    node.alpha = 0;
                    continue;
                }
                const baseAngle = Math.atan2(node.baseY - centerY, node.baseX - centerX);
                const flow = sampleFlow(node.x, node.y, centerX, centerY, radius, time, swirlStrength);
                const targetAngle = flow ? flow.angle : baseAngle;
                let targetAlpha = flow ? flow.alpha * 0.5 : Math.max(0.003, (1 - distToCenter / radius) * 0.05);

                if (shockwaves.length) {
                    for (let s = 0; s < shockwaves.length; s++) {
                        const wave = shockwaves[s];
                        const d = Math.hypot(node.x - wave.x, node.y - wave.y);
                        const band = Math.exp(-Math.pow((d - wave.radius) / Math.max(0.3, wave.thickness * 0.15), 2));
                        const waveInfluence = band * wave.amplitude;
                        targetAlpha = Math.max(targetAlpha, waveInfluence);
                    }
                }

                const desiredX = node.baseX + Math.cos(targetAngle) * Math.min(8, distToCenter * 0.15);
                const desiredY = node.baseY + Math.sin(targetAngle) * Math.min(8, distToCenter * 0.15);

                node.vx += (desiredX - node.x) * 0.08;
                node.vy += (desiredY - node.y) * 0.08;
                node.vx *= 0.88;
                node.vy *= 0.88;
                node.x += node.vx;
                node.y += node.vy;
                node.lastAngle = targetAngle;
                node.alpha = targetAlpha;
                node.velMag = Math.hypot(node.vx, node.vy);
                node.dist = distToCenter;
            }

            // Mesh connections
            ctx.lineWidth = 0.7;
            ctx.strokeStyle = connectionColor;
            const rows = layer.rows;
            const cols = layer.cols;
            const nearShock = (x, y) => shockwaves.some(w => Math.abs(Math.hypot(x - w.x, y - w.y) - w.radius) < Math.max(0.35, w.thickness * 0.4));

            for (let cx = 0; cx < cols; cx++) {
                for (let ry = 0; ry < rows; ry++) {
                    const idx = cx * rows + ry;
                    const node = nodes[idx];
                    if (node.dist > radius) continue;

                    const baseAlpha = fade * Math.min(1, (node.alpha || 0) * 0.7 + node.velMag * 0.08);
                    if (baseAlpha < 0.02) continue;
                    const nodeWave = nearShock(node.x, node.y);

                    if (cx < cols - 1) {
                        const neighborRight = nodes[(cx + 1) * rows + ry];
                        if (neighborRight.dist <= radius) {
                            const rightAlpha = fade * Math.min(Math.min(node.alpha, neighborRight.alpha) * 0.6 + neighborRight.velMag * 0.05, 1);
                            if (rightAlpha > 0.02) {
                                const segmentShock = nodeWave || nearShock(neighborRight.x, neighborRight.y);
                                ctx.strokeStyle = segmentShock ? shockConnectionColor : connectionColor;
                                const base = rightAlpha * 1.1 * layer.alphaScale;
                                const lineAlpha = segmentShock ? Math.min(1, base * 1.5) : Math.min(1, base);
                                ctx.globalAlpha = lineAlpha;
                                ctx.beginPath();
                                ctx.moveTo(node.x, node.y);
                                ctx.lineTo(neighborRight.x, neighborRight.y);
                                ctx.stroke();
                            }
                        }
                    }

                    if (ry < rows - 1) {
                        const neighborDown = nodes[cx * rows + (ry + 1)];
                        if (neighborDown.dist <= radius) {
                            const downAlpha = fade * Math.min(Math.min(node.alpha, neighborDown.alpha) * 0.6 + neighborDown.velMag * 0.05, 1);
                            if (downAlpha > 0.02) {
                                const segmentShock = nodeWave || nearShock(neighborDown.x, neighborDown.y);
                                ctx.strokeStyle = segmentShock ? shockConnectionColor : connectionColor;
                                const base = downAlpha * 1.1 * layer.alphaScale;
                                const lineAlpha = segmentShock ? Math.min(1, base * 1.5) : Math.min(1, base);
                                ctx.globalAlpha = lineAlpha;
                                ctx.beginPath();
                                ctx.moveTo(node.x, node.y);
                                ctx.lineTo(neighborDown.x, neighborDown.y);
                                ctx.stroke();
                            }
                        }
                    }
                }
            }

            ctx.strokeStyle = accentColor;
        });

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        requestAnimationFrame(animate);
    };

    animate();
})();
