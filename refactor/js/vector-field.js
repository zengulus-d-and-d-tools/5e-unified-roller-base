(() => {
    const canvas = document.getElementById('vector-cloud');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = 0;
    let height = 0;
    const mouse = { x: -999, y: -999, active: false, down: false, prevX: -999, prevY: -999 };
    let lastScrollY = window.scrollY;
    let scrollVelocity = 0;
    const BASE_RADIUS = 200;
    const layers = [
        {
            spacing: 46,
            radius: 250,
            parallax: 0.025,
            swirl: 0.35,
            alphaScale: 0.35,
            size: 1.2
        },
        {
            spacing: 26,
            radius: 190,
            parallax: 0.01,
            swirl: 0.18,
            alphaScale: 0.9,
            size: 1
        }
    ];

    const vortices = [];

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

    const resize = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    const pushVortex = (x, y, dx, dy) => {
        const mag = Math.hypot(dx, dy);
        if (mag < 0.5) return;
        const strength = Math.min(1.2, mag / 18);
        vortices.push({ x, y, vx: dx * 0.4, vy: dy * 0.4, strength, life: 1 });
        if (vortices.length > 120) vortices.shift();
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
    });
    window.addEventListener('mousedown', () => mouse.down = true);
    window.addEventListener('mouseup', () => mouse.down = false);
    window.addEventListener('touchstart', e => {
        mouse.prevX = mouse.x = e.touches[0].clientX;
        mouse.prevY = mouse.y = e.touches[0].clientY;
        mouse.active = true;
        mouse.down = true;
        pushVortex(mouse.x, mouse.y, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
    });
    window.addEventListener('touchmove', e => {
        const nx = e.touches[0].clientX;
        const ny = e.touches[0].clientY;
        if (mouse.prevX !== -999) {
            pushVortex(nx, ny, nx - mouse.prevX, ny - mouse.prevY);
        }
        mouse.prevX = mouse.x = nx;
        mouse.prevY = mouse.y = ny;
    });
    window.addEventListener('touchend', () => { mouse.active = false; mouse.down = false; });
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
        if (mouse.down) angle += Math.sin(time * 0.05 + x + y) * 0.5;
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

        if (!mouse.active && Math.abs(scrollVelocity) < 0.1) {
            requestAnimationFrame(animate);
            return;
        }

        const accentColor = updateAccent();
        const time = Date.now();

        ctx.fillStyle = accentColor;
        layers.forEach(layer => {
            const centerX = mouse.x + (mouse.x - width / 2) * layer.parallax;
            const centerY = mouse.y + (mouse.y - height / 2) * layer.parallax * 1.2;
            const radius = layer.radius || BASE_RADIUS;
            const spacing = layer.spacing;

            const startX = Math.floor((centerX - radius) / spacing) * spacing;
            const endX = Math.floor((centerX + radius) / spacing) * spacing;
            const startY = Math.floor((centerY - radius) / spacing) * spacing;
            const endY = Math.floor((centerY + radius) / spacing) * spacing;

            for (let gx = startX; gx <= endX; gx += spacing) {
                for (let gy = startY; gy <= endY; gy += spacing) {
                    const flow = sampleFlow(gx, gy, centerX, centerY, radius, time, layer.swirl || 0);
                    if (!flow) continue;
                    const length = 12 * layer.size * flow.alpha;
                    const tipX = gx + Math.cos(flow.angle) * length;
                    const tipY = gy + Math.sin(flow.angle) * length;
                    const thickness = length * 0.22;
                    const perpX = -Math.sin(flow.angle) * thickness;
                    const perpY = Math.cos(flow.angle) * thickness;

                    ctx.globalAlpha = flow.alpha * layer.alphaScale;
                    ctx.beginPath();
                    ctx.moveTo(gx + perpX, gy + perpY);
                    ctx.lineTo(gx - perpX, gy - perpY);
                    ctx.lineTo(tipX, tipY);
                    ctx.fill();
                }
            }
        });

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        requestAnimationFrame(animate);
    };

    animate();
})();
