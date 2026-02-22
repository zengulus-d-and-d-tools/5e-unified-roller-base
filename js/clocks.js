(function (global) {
    const STORAGE_KEY = 'rtf_clocks_page_v1';
    const MIN_TOTAL = 1;
    const MAX_TOTAL = 48;
    const DEFAULT_TOTAL = 4;
    const VALID_TYPES = new Set(['progress', 'danger']);

    const root = document.getElementById('clocks-page');
    if (!root) return;

    const refs = {
        addBtn: document.getElementById('add-clock-btn'),
        resetBtn: document.getElementById('reset-clocks-btn'),
        newName: document.getElementById('new-clock-name'),
        newType: document.getElementById('new-clock-type'),
        newTotal: document.getElementById('new-clock-total'),
        grid: document.getElementById('clocks-grid'),
        empty: document.getElementById('clocks-empty')
    };

    function toObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function toInt(value, fallback) {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function normalizeType(value, fallback) {
        const type = String(value || '').trim().toLowerCase();
        return VALID_TYPES.has(type) ? type : fallback;
    }

    function uid() {
        return `clock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeClock(raw, idx) {
        const source = toObject(raw);
        const total = clamp(toInt(source.total, DEFAULT_TOTAL), MIN_TOTAL, MAX_TOTAL);
        const filled = clamp(toInt(source.filled, 0), 0, total);
        const type = normalizeType(source.type, idx % 2 ? 'danger' : 'progress');
        const name = String(source.name || '').trim() || `${type === 'danger' ? 'Danger' : 'Progress'} Clock`;
        return {
            id: String(source.id || '').trim() || uid(),
            name,
            type,
            total,
            filled
        };
    }

    function getDefaultClocks() {
        return [
            { id: 'default_progress', name: 'Operation Progress', type: 'progress', total: 6, filled: 0 },
            { id: 'default_danger', name: 'Complication Risk', type: 'danger', total: 6, filled: 0 }
        ];
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return getDefaultClocks().map(normalizeClock);
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed) || !parsed.length) return getDefaultClocks().map(normalizeClock);
            return parsed.map((entry, idx) => normalizeClock(entry, idx));
        } catch (err) {
            console.warn('Clocks state load failed:', err);
            return getDefaultClocks().map(normalizeClock);
        }
    }

    let clocks = loadState();

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(clocks));
        } catch (err) {
            console.warn('Clocks state save failed:', err);
        }
    }

    function findClockIndex(id) {
        return clocks.findIndex((clock) => clock.id === id);
    }

    function getTypeLabel(type) {
        return type === 'danger' ? 'DANGER' : 'PROGRESS';
    }

    function getTypeTheme(type) {
        if (type === 'danger') {
            return {
                accent: '#ef4444',
                accentSoft: 'rgba(239, 68, 68, 0.26)',
                textSoft: '#fecaca',
                chipBg: 'rgba(127, 29, 29, 0.46)',
                chipBorder: 'rgba(252, 165, 165, 0.55)',
                ringTrack: 'rgba(255, 255, 255, 0.12)'
            };
        }
        return {
            accent: '#22c55e',
            accentSoft: 'rgba(34, 197, 94, 0.24)',
            textSoft: '#bbf7d0',
            chipBg: 'rgba(20, 83, 45, 0.45)',
            chipBorder: 'rgba(134, 239, 172, 0.5)',
            ringTrack: 'rgba(255, 255, 255, 0.12)'
        };
    }

    function drawRoundedRect(ctx, x, y, width, height, radius) {
        const safeRadius = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, width, height, safeRadius);
            return;
        }
        ctx.moveTo(x + safeRadius, y);
        ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
        ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
        ctx.arcTo(x, y + height, x, y, safeRadius);
        ctx.arcTo(x, y, x + width, y, safeRadius);
        ctx.closePath();
    }

    function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
        const words = String(text || '').trim().split(/\s+/).filter(Boolean);
        if (!words.length) {
            ctx.fillText('Untitled Clock', x, y);
            return 1;
        }

        const lines = [];
        let currentLine = words[0];
        for (let idx = 1; idx < words.length; idx += 1) {
            const candidate = `${currentLine} ${words[idx]}`;
            if (ctx.measureText(candidate).width <= maxWidth) {
                currentLine = candidate;
                continue;
            }
            lines.push(currentLine);
            currentLine = words[idx];
            if (lines.length >= maxLines - 1) break;
        }
        lines.push(currentLine);

        const hasOverflow = lines.length >= maxLines && words.join(' ') !== lines.join(' ');
        if (hasOverflow) {
            let clipped = lines[maxLines - 1];
            while (clipped.length > 1 && ctx.measureText(`${clipped}...`).width > maxWidth) {
                clipped = clipped.slice(0, -1);
            }
            lines[maxLines - 1] = `${clipped}...`;
        }

        const renderLines = lines.slice(0, maxLines);
        renderLines.forEach((line, idx) => {
            ctx.fillText(line, x, y + (idx * lineHeight));
        });
        return renderLines.length;
    }

    function drawSegmentedRing(ctx, config) {
        const safeTotal = clamp(toInt(config.total, DEFAULT_TOTAL), MIN_TOTAL, MAX_TOTAL);
        const safeFilled = clamp(toInt(config.filled, 0), 0, safeTotal);
        const cx = config.cx;
        const cy = config.cy;
        const radius = config.radius;
        const thickness = config.thickness;
        const step = (Math.PI * 2) / safeTotal;
        const gap = Math.min(step * 0.34, 0.2);
        const segmentSweep = Math.max(step - gap, step * 0.5);

        ctx.save();
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        for (let idx = 0; idx < safeTotal; idx += 1) {
            const start = (-Math.PI / 2) + (idx * step) + (gap / 2);
            const end = start + segmentSweep;
            ctx.beginPath();
            ctx.strokeStyle = idx < safeFilled ? config.fillColor : config.trackColor;
            ctx.arc(cx, cy, radius, start, end, false);
            ctx.stroke();
        }
        ctx.restore();
    }

    function sanitizeFilePart(value, fallback = 'clock') {
        const slug = String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return slug || fallback;
    }

    function downloadCanvasPng(canvas, filename) {
        const triggerDownload = (href) => {
            const link = document.createElement('a');
            link.href = href;
            link.download = filename;
            link.click();
        };

        if (typeof canvas.toBlob === 'function') {
            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                triggerDownload(url);
                setTimeout(() => URL.revokeObjectURL(url), 0);
            }, 'image/png');
            return;
        }

        triggerDownload(canvas.toDataURL('image/png'));
    }

    function exportClockAsPng(id) {
        const idx = findClockIndex(id);
        if (idx < 0) return;
        const clock = clocks[idx];
        const theme = getTypeTheme(clock.type);
        const ratio = clock.total > 0 ? (clock.filled / clock.total) : 0;
        const completionPct = Math.round(ratio * 100);

        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 640;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const panelX = 46;
        const panelY = 46;
        const panelWidth = width - (panelX * 2);
        const panelHeight = height - (panelY * 2);
        const typeLabel = clock.type === 'danger' ? 'Danger Clock' : 'Progress Clock';
        const fillSummary = `${clock.filled}/${clock.total} filled (${completionPct}%)`;
        const statusText = clock.filled >= clock.total ? 'Complete' : 'In Progress';

        const bgGradient = ctx.createLinearGradient(0, 0, width, height);
        bgGradient.addColorStop(0, '#060b14');
        bgGradient.addColorStop(1, '#131d2e');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.46)';
        ctx.shadowBlur = 28;
        drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 24);
        ctx.fillStyle = 'rgba(8, 15, 28, 0.85)';
        ctx.fill();
        ctx.restore();

        drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 24);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#f3f7ff';
        ctx.font = '700 46px "Segoe UI", Roboto, sans-serif';
        const titleLines = drawWrappedText(ctx, clock.name, 92, 120, 560, 56, 2);
        const badgeY = 128 + (titleLines * 56);
        const badgeText = getTypeLabel(clock.type);
        ctx.font = '800 22px "Segoe UI", Roboto, sans-serif';
        const badgeWidth = ctx.measureText(badgeText).width + 34;

        drawRoundedRect(ctx, 92, badgeY, badgeWidth, 42, 21);
        ctx.fillStyle = theme.chipBg;
        ctx.fill();
        drawRoundedRect(ctx, 92, badgeY, badgeWidth, 42, 21);
        ctx.strokeStyle = theme.chipBorder;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = theme.textSoft;
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, 109, badgeY + 21);
        ctx.textBaseline = 'alphabetic';

        const detailsX = 92;
        let detailsY = badgeY + 92;
        ctx.fillStyle = '#8fa3c6';
        ctx.font = '600 20px "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Type', detailsX, detailsY);
        detailsY += 34;
        ctx.fillStyle = '#f6f9ff';
        ctx.font = '700 34px "Segoe UI", Roboto, sans-serif';
        ctx.fillText(typeLabel, detailsX, detailsY);

        detailsY += 54;
        ctx.fillStyle = '#8fa3c6';
        ctx.font = '600 20px "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Filled', detailsX, detailsY);
        detailsY += 34;
        ctx.fillStyle = '#f6f9ff';
        ctx.font = '700 34px "Segoe UI", Roboto, sans-serif';
        ctx.fillText(fillSummary, detailsX, detailsY);

        detailsY += 54;
        ctx.fillStyle = '#8fa3c6';
        ctx.font = '600 20px "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Status', detailsX, detailsY);
        detailsY += 34;
        ctx.fillStyle = clock.filled >= clock.total ? theme.accent : '#f6f9ff';
        ctx.font = '700 30px "Segoe UI", Roboto, sans-serif';
        ctx.fillText(statusText, detailsX, detailsY);

        const ringCx = 792;
        const ringCy = 324;
        drawSegmentedRing(ctx, {
            cx: ringCx,
            cy: ringCy,
            radius: 130,
            thickness: 26,
            total: clock.total,
            filled: clock.filled,
            fillColor: theme.accent,
            trackColor: theme.ringTrack
        });

        ctx.fillStyle = theme.accentSoft;
        ctx.beginPath();
        ctx.arc(ringCx, ringCy, 87, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f7faff';
        ctx.textAlign = 'center';
        ctx.font = '800 54px "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`${clock.filled}/${clock.total}`, ringCx, ringCy + 20);
        ctx.font = '700 20px "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = theme.textSoft;
        ctx.fillText(`${completionPct}% complete`, ringCx, ringCy + 56);
        ctx.textAlign = 'start';

        ctx.fillStyle = '#8ea2c4';
        ctx.font = '500 16px "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`Exported ${new Date().toLocaleString()}`, 92, 580);

        const filenameBase = sanitizeFilePart(clock.name);
        const filename = `${filenameBase}_${clock.type}_${clock.filled}-of-${clock.total}_${new Date().toISOString().slice(0, 10)}.png`;
        downloadCanvasPng(canvas, filename);
    }

    function render() {
        refs.grid.innerHTML = clocks.map((clock) => {
            const ratio = clock.total > 0 ? clock.filled / clock.total : 0;
            const safeName = escapeHtml(clock.name);
            const safeType = clock.type === 'danger' ? 'danger' : 'progress';
            return `
                <article class="clock-card" data-id="${escapeHtml(clock.id)}">
                    <div class="clock-controls">
                        <button class="btn" type="button" data-action="minus">-1</button>
                        <button class="btn btn-dp" type="button" data-action="plus">+1</button>
                        <button class="btn" type="button" data-action="reset">Reset</button>
                        <button class="btn btn-danger btn-remove" type="button" data-action="remove">Remove</button>
                    </div>
                    <button class="btn clock-export-btn" type="button" data-action="export">Export this clock</button>
                    <div class="clock-pie-wrap ${safeType}">
                        <div class="clock-pie" style="--clock-total:${clock.total}; --clock-fill-ratio:${ratio};" aria-hidden="true">
                            <div class="clock-pie-center">${clock.filled}/${clock.total}</div>
                        </div>
                        <p class="clock-type-label">${getTypeLabel(safeType)}</p>
                        <p class="clock-name-label" data-role="name-label">${safeName}</p>
                    </div>
                    <div class="clock-settings">
                        <label class="clock-setting-field">
                            <span>Name</span>
                            <input type="text" data-field="name" value="${safeName}">
                        </label>
                        <label class="clock-setting-field">
                            <span>Type</span>
                            <select data-field="type">
                                <option value="progress"${safeType === 'progress' ? ' selected' : ''}>Progress</option>
                                <option value="danger"${safeType === 'danger' ? ' selected' : ''}>Danger</option>
                            </select>
                        </label>
                        <label class="clock-setting-field">
                            <span>Total</span>
                            <input type="number" min="${MIN_TOTAL}" max="${MAX_TOTAL}" step="1" inputmode="numeric" data-field="total" value="${clock.total}">
                        </label>
                    </div>
                </article>
            `;
        }).join('');

        refs.empty.classList.toggle('is-hidden', clocks.length > 0);
    }

    function addClock() {
        const name = String(refs.newName.value || '').trim() || 'New Clock';
        const type = normalizeType(refs.newType.value, 'progress');
        const total = clamp(toInt(refs.newTotal.value, DEFAULT_TOTAL), MIN_TOTAL, MAX_TOTAL);
        clocks.push(normalizeClock({ id: uid(), name, type, total, filled: 0 }, clocks.length));
        refs.newName.value = '';
        refs.newType.value = 'progress';
        refs.newTotal.value = String(DEFAULT_TOTAL);
        saveState();
        render();
    }

    function updateClockFilled(id, delta) {
        const idx = findClockIndex(id);
        if (idx < 0) return;
        const clock = clocks[idx];
        clock.filled = clamp(clock.filled + delta, 0, clock.total);
        saveState();
        render();
    }

    function resetClock(id) {
        const idx = findClockIndex(id);
        if (idx < 0) return;
        clocks[idx].filled = 0;
        saveState();
        render();
    }

    function removeClock(id) {
        const idx = findClockIndex(id);
        if (idx < 0) return;
        clocks.splice(idx, 1);
        saveState();
        render();
    }

    function updateClockField(id, field, value) {
        const idx = findClockIndex(id);
        if (idx < 0) return;
        const clock = clocks[idx];

        if (field === 'name') {
            clock.name = String(value || '').trim() || 'Untitled Clock';
            saveState();
            const row = refs.grid.querySelector(`[data-id="${id}"]`);
            const label = row ? row.querySelector('[data-role="name-label"]') : null;
            if (label) label.textContent = clock.name;
            return;
        }

        if (field === 'type') {
            clock.type = normalizeType(value, clock.type);
            saveState();
            render();
            return;
        }

        if (field === 'total') {
            clock.total = clamp(toInt(value, clock.total), MIN_TOTAL, MAX_TOTAL);
            clock.filled = clamp(clock.filled, 0, clock.total);
            saveState();
            render();
        }
    }

    function handleGridClick(event) {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const actionBtn = target.closest('button[data-action]');
        if (!actionBtn) return;
        const row = actionBtn.closest('[data-id]');
        if (!row) return;
        const id = row.getAttribute('data-id');
        const action = actionBtn.getAttribute('data-action');
        if (!id || !action) return;

        if (action === 'plus') {
            updateClockFilled(id, 1);
            return;
        }
        if (action === 'minus') {
            updateClockFilled(id, -1);
            return;
        }
        if (action === 'reset') {
            resetClock(id);
            return;
        }
        if (action === 'remove') {
            removeClock(id);
            return;
        }
        if (action === 'export') {
            exportClockAsPng(id);
        }
    }

    function handleGridInput(event) {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const row = target.closest('[data-id]');
        if (!row) return;
        const id = row.getAttribute('data-id');
        if (!id) return;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
        const field = target.getAttribute('data-field');
        if (!field) return;
        updateClockField(id, field, target.value);
    }

    refs.addBtn.addEventListener('click', addClock);
    refs.newName.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        addClock();
    });
    refs.newTotal.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        addClock();
    });
    refs.resetBtn.addEventListener('click', () => {
        clocks = getDefaultClocks().map(normalizeClock);
        saveState();
        render();
    });
    refs.grid.addEventListener('click', handleGridClick);
    refs.grid.addEventListener('input', handleGridInput);
    refs.grid.addEventListener('change', handleGridInput);

    render();
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
