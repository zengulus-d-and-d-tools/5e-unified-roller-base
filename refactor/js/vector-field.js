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
            spacing: 48,
            radius: 260,
            length: 20,
            alphaScale: 0.4,
            parallax: 0.035,
            swirl: 0.4,
            blur: 8,
            colorAlpha: 0.3
        },
        {
            spacing: 28,
            radius: 190,
            length: 15,
            alphaScale: 0.85,
            parallax: 0.015,
            swirl: 0.15,
            blur: 3,
            colorAlpha: 0.8
        }
    ];

    const fluidPush = { x: 0, y: 0 };

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
    window.addEventListener('mousemove', e => {
        if (mouse.prevX !== -999) {
            const dx = e.clientX - mouse.prevX;
            const dy = e.clientY - mouse.prevY;
            fluidPush.x += dx * 0.4;
            fluidPush.y += dy * 0.4;
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
        fluidPush.x += (Math.random() - 0.5) * 5;
        fluidPush.y += (Math.random() - 0.5) * 5;
    });
    window.addEventListener('touchmove', e => {
        const nx = e.touches[0].clientX;
        const ny = e.touches[0].clientY;
        if (mouse.prevX !== -999) {
            fluidPush.x += (nx - mouse.prevX) * 0.4;
            fluidPush.y += (ny - mouse.prevY) * 0.4;
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

        const fluidMag = Math.hypot(fluidPush.x, fluidPush.y);
        if (fluidMag > 0.1) {
            const baseVX = Math.cos(angle);
            const baseVY = Math.sin(angle);
            const pushVX = fluidPush.x / fluidMag;
            const pushVY = fluidPush.y / fluidMag;
            const falloff = Math.max(0, 1 - dist / (radius * 0.9));
            const influence = Math.min(0.6, fluidMag * 0.0025) * falloff;
            const mixVX = baseVX * (1 - influence) + pushVX * influence;
            const mixVY = baseVY * (1 - influence) + pushVY * influence;
            angle = Math.atan2(mixVY, mixVX);
        }

        return { angle, alpha };
    };

    const animate = () => {
        ctx.clearRect(0, 0, width, height);
        scrollVelocity *= 0.9;
        fluidPush.x *= 0.92;
        fluidPush.y *= 0.92;

        if (!mouse.active && Math.abs(scrollVelocity) < 0.1) {
            requestAnimationFrame(animate);
            return;
        }

        const accentColor = updateAccent();
        const time = Date.now();

        layers.forEach(layer => {
            const centerX = mouse.x + (mouse.x - width / 2) * layer.parallax;
            const centerY = mouse.y + (mouse.y - height / 2) * layer.parallax * 1.2;
            const radius = layer.radius || BASE_RADIUS;

            const startX = Math.floor((centerX - radius) / layer.spacing) * layer.spacing;
            const endX = Math.floor((centerX + radius) / layer.spacing) * layer.spacing;
            const startY = Math.floor((centerY - radius) / layer.spacing) * layer.spacing;
            const endY = Math.floor((centerY + radius) / layer.spacing) * layer.spacing;

            ctx.strokeStyle = applyAlpha(accentColor, layer.colorAlpha);
            ctx.shadowColor = applyAlpha(accentColor, layer.colorAlpha);
            ctx.shadowBlur = layer.blur || 0;

            for (let gx = startX; gx <= endX; gx += layer.spacing) {
                for (let gy = startY; gy <= endY; gy += layer.spacing) {
                    const flow = sampleFlow(gx, gy, centerX, centerY, radius, time, layer.swirl || 0);
                    if (!flow) continue;

                    const length = layer.length * flow.alpha;
                    const tipX = gx + Math.cos(flow.angle) * length;
                    const tipY = gy + Math.sin(flow.angle) * length;
                    const controlOffset = length * 0.3;

                    ctx.globalAlpha = flow.alpha * layer.alphaScale;
                    ctx.lineWidth = Math.max(0.6, length * 0.08);
                    ctx.beginPath();
                    ctx.moveTo(gx, gy);
                    ctx.quadraticCurveTo(
                        gx + Math.cos(flow.angle + Math.PI / 2) * controlOffset,
                        gy + Math.sin(flow.angle + Math.PI / 2) * controlOffset,
                        tipX,
                        tipY
                    );
                    ctx.stroke();
                }
            }
        });

        // angular vectors overlay
        const arrowSpacing = 28;
        const arrowRadius = BASE_RADIUS * 0.95;
        const startX = Math.floor((mouse.x - arrowRadius) / arrowSpacing) * arrowSpacing;
        const endX = Math.floor((mouse.x + arrowRadius) / arrowSpacing) * arrowSpacing;
        const startY = Math.floor((mouse.y - arrowRadius) / arrowSpacing) * arrowSpacing;
        const endY = Math.floor((mouse.y + arrowRadius) / arrowSpacing) * arrowSpacing;

        for (let gx = startX; gx <= endX; gx += arrowSpacing) {
            for (let gy = startY; gy <= endY; gy += arrowSpacing) {
                const flow = sampleFlow(gx, gy, mouse.x, mouse.y, arrowRadius, time, 0.12);
                if (!flow) continue;
                const length = 12 * flow.alpha;
                const tipX = gx + Math.cos(flow.angle) * length;
                const tipY = gy + Math.sin(flow.angle) * length;
                const thickness = length * 0.24;
                const perpX = -Math.sin(flow.angle) * thickness;
                const perpY = Math.cos(flow.angle) * thickness;

                ctx.fillStyle = accentColor;
                ctx.globalAlpha = Math.min(1, flow.alpha * 1.1);
                ctx.beginPath();
                ctx.moveTo(gx + perpX, gy + perpY);
                ctx.lineTo(gx - perpX, gy - perpY);
                ctx.lineTo(tipX, tipY);
                ctx.fill();
            }
        }

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        requestAnimationFrame(animate);
    };

    animate();
})();
