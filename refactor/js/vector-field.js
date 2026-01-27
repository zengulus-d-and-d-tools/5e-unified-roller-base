(() => {
    const canvas = document.getElementById('vector-cloud');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = 0;
    let height = 0;
    const mouse = { x: -999, y: -999, active: false, down: false };
    let lastScrollY = window.scrollY;
    let scrollVelocity = 0;
    const SPACING = 30;
    const FIELD_RADIUS = 200;

    const updateAccent = () => {
        const style = getComputedStyle(document.documentElement);
        return style.getPropertyValue('--accent').trim() || '#4ecdc4';
    };

    const resize = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
    });
    window.addEventListener('mousedown', () => mouse.down = true);
    window.addEventListener('mouseup', () => mouse.down = false);
    window.addEventListener('touchstart', e => {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
        mouse.active = true;
        mouse.down = true;
    });
    window.addEventListener('touchmove', e => {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
    });
    window.addEventListener('touchend', () => { mouse.active = false; mouse.down = false; });
    window.addEventListener('scroll', () => {
        const currentY = window.scrollY;
        scrollVelocity = currentY - lastScrollY;
        lastScrollY = currentY;
    });

    resize();

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
                const dx = gx - mouse.x;
                const dy = gy - mouse.y;
                const distSq = dx * dx + dy * dy;
                if (distSq > FIELD_RADIUS * FIELD_RADIUS) continue;

                const dist = Math.sqrt(distSq);
                let alpha = dist < 40 ? (dist / 40) : 1 - ((dist - 40) / (FIELD_RADIUS - 40));
                alpha = Math.max(0, Math.min(1, alpha));
                if (alpha <= 0.01) continue;

                let angle = Math.atan2(dy, dx);
                if (mouse.down) angle += Math.sin(time * 0.05 + gx + gy) * 0.5;

                const windForce = -scrollVelocity * 0.05;
                if (Math.abs(windForce) > 0.01) {
                    const vx = Math.cos(angle);
                    const vy = Math.sin(angle);
                    const nvx = vx;
                    const nvy = vy + windForce;
                    angle = Math.atan2(nvy, nvx);
                }

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

        requestAnimationFrame(animate);
    };

    animate();
})();
