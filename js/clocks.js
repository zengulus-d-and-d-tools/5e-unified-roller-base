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
