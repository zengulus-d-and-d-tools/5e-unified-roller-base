(() => {
    const canvas = document.getElementById('vector-cloud');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = 0;
    let height = 0;
    const mouse = { x: -999, y: -999, active: false, down: false, prevX: -999, prevY: -999 };
    let lastScrollY = window.scrollY;
    let scrollVelocity = 0;
    const SPACING = 30;
    const FIELD_RADIUS = 200;
    const particles = [];
    const MAX_PARTICLES = 350;

    const updateAccent = () => {
        const style = getComputedStyle(document.documentElement);
        return style.getPropertyValue('--accent').trim() || '#4ecdc4';
    };

    const resize = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    const spawnParticles = (count = 1) => {
        if (!mouse.active) return;
        for (let i = 0; i < count; i++) {
            if (particles.length >= MAX_PARTICLES) particles.shift();
            const life = 45 + Math.random() * 25;
            particles.push({
                x: mouse.x + (Math.random() - 0.5) * 6,
                y: mouse.y + (Math.random() - 0.5) * 6,
                vx: 0,
                vy: 0,
                life,
                maxLife: life,
                prevX: mouse.x,
                prevY: mouse.y
            });
        }
    };

    window.addEventListener('mousemove', e => {
        mouse.prevX = mouse.x;
        mouse.prevY = mouse.y;
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
        const speed = Math.hypot(e.movementX || 0, e.movementY || 0);
        if (speed > 0.2) spawnParticles(mouse.down ? 4 : 2);
    });
    window.addEventListener('mousedown', () => mouse.down = true);
    window.addEventListener('mouseup', () => mouse.down = false);
    window.addEventListener('touchstart', e => {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
        mouse.active = true;
        mouse.down = true;
        spawnParticles(6);
    });
    window.addEventListener('touchmove', e => {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
        spawnParticles(4);
    });
    window.addEventListener('touchend', () => { mouse.active = false; mouse.down = false; });
    window.addEventListener('scroll', () => {
        const currentY = window.scrollY;
        scrollVelocity = currentY - lastScrollY;
        lastScrollY = currentY;
    });

    resize();

    const sampleFlow = (x, y, time) => {
        const dx = x - mouse.x;
        const dy = y - mouse.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > FIELD_RADIUS * FIELD_RADIUS) return null;
        const dist = Math.sqrt(distSq);
        let alpha = dist < 40 ? (dist / 40) : 1 - ((dist - 40) / (FIELD_RADIUS - 40));
        alpha = Math.max(0, Math.min(1, alpha));
        if (alpha <= 0.01) return null;

        let angle = Math.atan2(dy, dx);
        if (mouse.down) angle += Math.sin(time * 0.05 + x + y) * 0.5;
        const windForce = -scrollVelocity * 0.05;
        if (Math.abs(windForce) > 0.01) {
            const vx = Math.cos(angle);
            const vy = Math.sin(angle);
            angle = Math.atan2(vy + windForce, vx);
        }
        return { angle, alpha };
    };

    const animate = () => {
        ctx.clearRect(0, 0, width, height);
        scrollVelocity *= 0.9;

        if (!mouse.active && Math.abs(scrollVelocity) < 0.1) {
            requestAnimationFrame(animate);
            return;
        }

        const accentColor = updateAccent();
        const startX = Math.floor((mouse.x - FIELD_RADIUS) / SPACING) * SPACING;
        const endX = Math.floor((mouse.x + FIELD_RADIUS) / SPACING) * SPACING;
        const startY = Math.floor((mouse.y - FIELD_RADIUS) / SPACING) * SPACING;
        const endY = Math.floor((mouse.y + FIELD_RADIUS) / SPACING) * SPACING;
        const time = Date.now();

        for (let gx = startX; gx <= endX; gx += SPACING) {
            for (let gy = startY; gy <= endY; gy += SPACING) {
                const flow = sampleFlow(gx, gy, time);
                if (!flow) continue;
                const { angle, alpha } = flow;
                const length = 14 * alpha;
                const tipX = gx + Math.cos(angle) * length;
                const tipY = gy + Math.sin(angle) * length;
                const thickness = length * 0.2;
                const perpX = -Math.sin(angle) * thickness;
                const perpY = Math.cos(angle) * thickness;

                ctx.fillStyle = accentColor;
                ctx.globalAlpha = alpha * 0.8;
                ctx.beginPath();
                ctx.moveTo(gx + perpX, gy + perpY);
                ctx.lineTo(gx - perpX, gy - perpY);
                ctx.lineTo(tipX, tipY);
                ctx.fill();
            }
        }

        // --- particle trails ---
        ctx.globalAlpha = 1;
        ctx.lineCap = 'round';
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= 1;
            const flow = sampleFlow(p.x, p.y, time);
            if (flow) {
                const speed = 0.3 + 0.6 * flow.alpha;
                p.vx += Math.cos(flow.angle) * speed;
                p.vy += Math.sin(flow.angle) * speed;
            }
            p.vx *= 0.92;
            p.vy *= 0.92;
            p.prevX = p.x;
            p.prevY = p.y;
            p.x += p.vx;
            p.y += p.vy;

            ctx.strokeStyle = accentColor;
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.4;
            ctx.lineWidth = mouse.down ? 2.2 : 1.4;
            ctx.beginPath();
            ctx.moveTo(p.prevX, p.prevY);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();

            if (p.life <= 0) particles.splice(i, 1);
        }
        ctx.globalAlpha = 1;

        requestAnimationFrame(animate);
    };

    animate();
})();
