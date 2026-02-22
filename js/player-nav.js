(function () {
    const NAV_ITEMS = [
        { id: 'sheet', label: 'Sheet', href: 'index.html' },
        { id: 'tools', label: 'Portal', href: 'tools.html' },
        { id: 'dashboard', label: 'Dashboard', href: 'player-dashboard.html' },
        { id: 'timeline', label: 'Timeline', href: 'timeline.html' },
        { id: 'leads', label: 'Leads', href: 'leads.html' },
        { id: 'board', label: 'Board', href: 'board.html' },
        { id: 'roster', label: 'Roster', href: 'roster.html' },
        { id: 'locations', label: 'Locations', href: 'locations.html' },
        { id: 'requisitions', label: 'Requisitions', href: 'requisitions.html' },
        { id: 'prep', label: 'Prep/Procedure', href: 'prep-procedure.html' }
    ];

    const header = document.querySelector('.hero-header');
    if (!header || header.dataset.playerNavReady === '1') return;

    const body = document.body;
    const explicitActive = body && body.dataset ? String(body.dataset.playerNav || '').trim() : '';
    const path = String(window.location.pathname || '').split('/').pop().toLowerCase();
    const inferredActive = (NAV_ITEMS.find((item) => item.href.toLowerCase() === path) || {}).id || '';
    const activeId = explicitActive || inferredActive;

    function isAddActionLabel(labelText) {
        const clean = String(labelText || '').trim().toLowerCase();
        return /^\+\s*(add|new|log)\b/.test(clean);
    }

    function buildNavDropdown() {
        const wrap = document.createElement('div');
        wrap.className = 'player-nav-wrap';
        const nav = document.createElement('nav');
        nav.className = 'player-nav';
        nav.setAttribute('aria-label', 'Player navigation');

        const label = document.createElement('label');
        label.className = 'player-nav-label';
        label.setAttribute('for', 'player-nav-select');
        label.textContent = 'Navigate';

        const select = document.createElement('select');
        select.id = 'player-nav-select';
        select.className = 'player-nav-select';
        select.setAttribute('aria-label', 'Navigate to page');

        NAV_ITEMS.forEach((item) => {
            const option = document.createElement('option');
            option.value = item.href;
            option.textContent = item.label;
            if (item.id === activeId) option.selected = true;
            select.appendChild(option);
        });

        select.addEventListener('change', () => {
            const target = String(select.value || '').trim();
            if (!target) return;
            const current = String(window.location.pathname || '').split('/').pop();
            if (current.toLowerCase() === target.toLowerCase()) return;
            window.location.assign(target);
        });

        nav.append(label, select);
        wrap.appendChild(nav);
        return wrap;
    }

    function moveAddButtonsBelowHero(bars) {
        const addButtons = [];
        bars.forEach((bar) => {
            const candidates = bar.querySelectorAll('a.hero-btn, button.hero-btn');
            candidates.forEach((btn) => {
                if (!isAddActionLabel(btn.textContent)) return;
                addButtons.push(btn);
            });
        });
        if (!addButtons.length) return;

        const row = document.createElement('div');
        row.className = 'hero-add-row';
        const inner = document.createElement('div');
        inner.className = 'hero-add-actions';
        addButtons.forEach((btn) => {
            btn.classList.add('hero-add-btn');
            inner.appendChild(btn);
        });
        row.appendChild(inner);
        header.insertAdjacentElement('afterend', row);
    }

    function setupHeroMenu() {
        const actions = header.querySelector('.hero-actions');
        if (!actions || actions.dataset.heroMenuReady === '1') return;

        let bars = Array.from(actions.querySelectorAll(':scope > .hero-action-bar'));
        if (!bars.length) {
            const fallbackItems = Array.from(actions.children).filter((child) => {
                if (!(child instanceof HTMLElement)) return false;
                if (child.classList.contains('sheet-nav-group')) return false;
                if (child.classList.contains('hero-menu-controls')) return false;
                if (child.classList.contains('hero-menu-panel')) return false;
                return true;
            });
            if (fallbackItems.length) {
                const fallbackBar = document.createElement('div');
                fallbackBar.className = 'hero-action-bar primary';
                fallbackItems.forEach((item) => fallbackBar.appendChild(item));
                actions.appendChild(fallbackBar);
                bars = [fallbackBar];
            }
        }
        if (!bars.length) return;

        moveAddButtonsBelowHero(bars);

        const controls = document.createElement('div');
        controls.className = 'hero-menu-controls';

        const gearBtn = document.createElement('button');
        gearBtn.type = 'button';
        gearBtn.className = 'hero-menu-btn hero-menu-gear';
        gearBtn.setAttribute('aria-label', 'Open settings and action menu');
        gearBtn.setAttribute('aria-expanded', 'false');
        gearBtn.textContent = '⚙';

        const hamburgerBtn = document.createElement('button');
        hamburgerBtn.type = 'button';
        hamburgerBtn.className = 'hero-menu-btn hero-menu-hamburger';
        hamburgerBtn.setAttribute('aria-label', 'Open settings and action menu');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        hamburgerBtn.textContent = '☰';

        controls.append(gearBtn, hamburgerBtn);

        const panel = document.createElement('div');
        panel.className = 'hero-menu-panel';
        panel.setAttribute('aria-hidden', 'true');

        const panelHeader = document.createElement('div');
        panelHeader.className = 'hero-menu-panel-title';
        panelHeader.textContent = '⚙ Settings & Actions';
        panel.appendChild(panelHeader);

        bars.forEach((bar) => {
            const hasControls = !!bar.querySelector('a, button, input, select, textarea');
            if (!hasControls) return;
            panel.appendChild(bar);
        });

        const setOpen = (isOpen) => {
            panel.classList.toggle('is-open', isOpen);
            panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
            gearBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            hamburgerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        };

        const toggleOpen = () => setOpen(!panel.classList.contains('is-open'));

        gearBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleOpen();
        });
        hamburgerBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleOpen();
        });

        document.addEventListener('click', (event) => {
            if (!panel.classList.contains('is-open')) return;
            if (actions.contains(event.target)) return;
            setOpen(false);
        });
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if (!panel.classList.contains('is-open')) return;
            setOpen(false);
        });

        actions.classList.add('has-hero-menu');
        actions.append(controls, panel);
        actions.dataset.heroMenuReady = '1';
    }

    const dropdown = buildNavDropdown();
    header.classList.add('has-player-nav');
    header.appendChild(dropdown);
    setupHeroMenu();
    header.dataset.playerNavReady = '1';
})();
