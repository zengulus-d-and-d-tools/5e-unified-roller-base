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

    function buildNavPanel() {
        const panel = document.createElement('div');
        panel.className = 'hero-menu-panel hero-menu-nav-panel';
        panel.setAttribute('aria-hidden', 'true');

        const panelHeader = document.createElement('div');
        panelHeader.className = 'hero-menu-panel-title';
        panelHeader.textContent = '🧭 Navigate';
        panel.appendChild(panelHeader);

        const nav = document.createElement('nav');
        nav.className = 'hero-menu-nav';
        nav.setAttribute('aria-label', 'Player navigation menu');

        NAV_ITEMS.forEach((item) => {
            const link = document.createElement('a');
            link.href = item.href;
            link.className = `hero-btn ghost hero-menu-nav-link${item.id === activeId ? ' is-active' : ''}`;
            link.textContent = item.label;
            nav.appendChild(link);
        });

        panel.appendChild(nav);
        return panel;
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

        const compassBtn = document.createElement('button');
        compassBtn.type = 'button';
        compassBtn.className = 'hero-menu-btn hero-menu-compass';
        compassBtn.setAttribute('aria-label', 'Open navigation menu');
        compassBtn.setAttribute('aria-expanded', 'false');
        compassBtn.textContent = '🧭';

        const gearBtn = document.createElement('button');
        gearBtn.type = 'button';
        gearBtn.className = 'hero-menu-btn hero-menu-gear';
        gearBtn.setAttribute('aria-label', 'Open settings and action menu');
        gearBtn.setAttribute('aria-expanded', 'false');
        gearBtn.textContent = '⚙';

        controls.append(compassBtn, gearBtn);

        const settingsPanel = document.createElement('div');
        settingsPanel.className = 'hero-menu-panel hero-menu-settings-panel';
        settingsPanel.setAttribute('aria-hidden', 'true');

        const panelHeader = document.createElement('div');
        panelHeader.className = 'hero-menu-panel-title';
        panelHeader.textContent = '⚙ Settings & Actions';
        settingsPanel.appendChild(panelHeader);

        bars.forEach((bar) => {
            const hasControls = !!bar.querySelector('a, button, input, select, textarea');
            if (!hasControls) return;
            settingsPanel.appendChild(bar);
        });

        const navPanel = buildNavPanel();

        const setOpenState = (targetPanel) => {
            const showNav = targetPanel === 'nav';
            const showSettings = targetPanel === 'settings';
            navPanel.classList.toggle('is-open', showNav);
            navPanel.setAttribute('aria-hidden', showNav ? 'false' : 'true');
            settingsPanel.classList.toggle('is-open', showSettings);
            settingsPanel.setAttribute('aria-hidden', showSettings ? 'false' : 'true');
            compassBtn.setAttribute('aria-expanded', showNav ? 'true' : 'false');
            gearBtn.setAttribute('aria-expanded', showSettings ? 'true' : 'false');
        };

        const togglePanel = (targetPanel) => {
            const navOpen = navPanel.classList.contains('is-open');
            const settingsOpen = settingsPanel.classList.contains('is-open');
            if ((targetPanel === 'nav' && navOpen) || (targetPanel === 'settings' && settingsOpen)) {
                setOpenState('');
                return;
            }
            setOpenState(targetPanel);
        };

        compassBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            togglePanel('nav');
        });
        gearBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            togglePanel('settings');
        });

        document.addEventListener('click', (event) => {
            const anyOpen = navPanel.classList.contains('is-open') || settingsPanel.classList.contains('is-open');
            if (!anyOpen) return;
            if (actions.contains(event.target)) return;
            setOpenState('');
        });
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            const anyOpen = navPanel.classList.contains('is-open') || settingsPanel.classList.contains('is-open');
            if (!anyOpen) return;
            setOpenState('');
        });

        actions.classList.add('has-hero-menu');
        actions.append(controls, navPanel, settingsPanel);
        actions.dataset.heroMenuReady = '1';
    }

    header.classList.add('has-player-nav');
    setupHeroMenu();
    header.dataset.playerNavReady = '1';
})();
