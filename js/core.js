export const Core = {
    loadState(key, defaultState) {
        try {
            const saved = localStorage.getItem(key);
            return saved ? JSON.parse(saved) : defaultState;
        } catch (e) {
            console.error("Corrupted Save", e);
            return defaultState;
        }
    },

    saveState(key, state) {
        localStorage.setItem(key, JSON.stringify(state));
    },

    exportData(state, filenamePrefix) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${filenamePrefix}_backup_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    },

    async importData() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            input.onchange = (e) => {
                const target = e && e.target ? e.target : null;
                const file = target && target.files && target.files[0] ? target.files[0] : null;
                if (!file) {
                    reject("No file selected");
                    return;
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const payload = event && event.target ? event.target.result : '';
                        const loaded = JSON.parse(payload);
                        resolve(loaded);
                    } catch (err) {
                        reject("Invalid JSON file");
                    }
                };
                reader.onerror = () => reject("File reading failed");
                reader.readAsText(file);
            };
            input.click();
        });
    },

    async compress(json) {
        const str = JSON.stringify(json);
        const stream = new Blob([str]).stream();
        const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));
        const compressedResponse = new Response(compressedStream);
        const blob = await compressedResponse.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result.split(',')[1]);
            reader.readAsDataURL(blob);
        });
    },

    async decompress(b64) {
        try {
            const binString = atob(b64);
            const bytes = Uint8Array.from(binString, c => c.charCodeAt(0));
            const stream = new Blob([bytes]).stream();
            const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));
            const resp = new Response(decompressedStream);
            return await resp.json();
        } catch (e) {
            // Fallback for non-compressed base64 or legacy formats
            try {
                const oldJson = decodeURIComponent(atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                return JSON.parse(oldJson);
            } catch (err2) {
                throw new Error("Invalid or corrupted data format");
            }
        }
    },

    initVectorCloud(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let width, height;

        const mouse = { x: -999, y: -999, active: false, down: false };
        let lastScrollY = window.scrollY;
        let scrollVelocity = 0;

        const SPACING = 30;
        const FIELD_RADIUS = 200;

        const updateAccent = () => {
            const style = getComputedStyle(document.documentElement);
            return style.getPropertyValue('--accent').trim();
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

        window.addEventListener('scroll', () => {
            const currentY = window.scrollY;
            scrollVelocity = currentY - lastScrollY;
            lastScrollY = currentY;
        });

        resize();

        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            scrollVelocity *= 0.9;
            const accentColor = updateAccent();

            if (mouse.active || Math.abs(scrollVelocity) > 0.1) {
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
                            angle = Math.atan2(Math.sin(angle) + windForce, Math.cos(angle));
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
            }
            requestAnimationFrame(animate);
        };

        animate();
    },

    sendToDiscord(webhook, name, label, descText, type = 'check') {
        if (!webhook) return;
        let color = 5164484; // Default Green
        if (type === 'atk') color = 16739179; // Reddish
        if (type === 'dmg') color = 9807270; // Greyish
        if (type === 'save') color = 3066993; // Blue
        if (type === 'feature') color = 3447003; // Light Blue

        const payload = {
            embeds: [{
                author: { name: name || "Character" },
                title: label,
                description: descText,
                color: color
            }]
        };

        return fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(err => console.error(err));
    }
};
