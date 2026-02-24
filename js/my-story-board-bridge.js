(function () {
    'use strict';

    const params = new URLSearchParams(window.location.search || '');
    const isMyStoryEmbed = params.get('embedded') === 'my-story';
    if (!isMyStoryEmbed) return;

    const MSG = Object.freeze({
        REQUEST_INIT: 'rtf-my-story:request-init',
        INIT: 'rtf-my-story:init',
        UPDATE: 'rtf-my-story:update',
        SAVE: 'rtf-my-story:save',
        READY: 'rtf-my-story:ready'
    });

    const DEFAULT_BOARD = Object.freeze({
        name: 'My Story',
        nodes: [],
        connections: []
    });

    let boardCache = clone(DEFAULT_BOARD);
    let ready = false;
    let readyResolve = null;
    const readyPromise = new Promise((resolve) => {
        readyResolve = resolve;
    });

    function clone(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (err) {
            return {
                name: 'My Story',
                nodes: [],
                connections: []
            };
        }
    }

    function sanitizeBoardPayload(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        return {
            name: typeof source.name === 'string' && source.name ? source.name : DEFAULT_BOARD.name,
            nodes: Array.isArray(source.nodes) ? source.nodes : [],
            connections: Array.isArray(source.connections) ? source.connections : []
        };
    }

    function postToParent(type, payload) {
        if (!window.parent || window.parent === window) return false;
        window.parent.postMessage({ type, payload }, window.location.origin);
        return true;
    }

    function applyIncomingPayload(payload) {
        boardCache = sanitizeBoardPayload(payload);
        const caseName = document.getElementById('caseName');
        if (caseName) caseName.textContent = boardCache.name || 'My Story';
        if (window.RTF_BOARD_EMBED_API && typeof window.RTF_BOARD_EMBED_API.loadExternal === 'function') {
            window.RTF_BOARD_EMBED_API.loadExternal(boardCache);
        }
    }

    function applyMyStoryChrome() {
        document.title = 'My Story Board';
        const heroEyebrow = document.querySelector('.board-hero .hero-eyebrow');
        const heroTitle = document.querySelector('.board-hero h1');
        const heroSubtitle = document.querySelector('.board-hero .hero-subtitle');
        const heroMeta = document.querySelector('.board-hero .hero-meta');
        if (heroEyebrow) heroEyebrow.textContent = 'Character Sheet';
        if (heroTitle) heroTitle.textContent = 'My Story Board';
        if (heroSubtitle) heroSubtitle.textContent = 'A virtual whiteboard for tracking clues, people, and story threads with physics-assisted connections.';
        if (heroMeta) {
            const strong = heroMeta.querySelector('strong#caseName');
            if (heroMeta.firstChild) heroMeta.firstChild.textContent = 'Story File ';
            if (strong && !strong.textContent.trim()) strong.textContent = 'My Story';
        }
    }

    function markReady() {
        if (ready) return;
        ready = true;
        if (typeof readyResolve === 'function') {
            readyResolve();
            readyResolve = null;
        }
        postToParent(MSG.READY, { ok: true });
    }

    function handleMessage(event) {
        if (!event || event.origin !== window.location.origin) return;
        const packet = event.data && typeof event.data === 'object' ? event.data : null;
        if (!packet || typeof packet.type !== 'string') return;

        if (packet.type === MSG.INIT || packet.type === MSG.UPDATE) {
            applyIncomingPayload(packet.payload);
            markReady();
        }
    }

    window.addEventListener('message', handleMessage);

    window.RTF_BOARD_HOST = {
        mode: 'my-story',
        whenReady() {
            return readyPromise;
        },
        readBoard() {
            return clone(boardCache);
        },
        writeBoard(payload) {
            boardCache = sanitizeBoardPayload(payload);
            postToParent(MSG.SAVE, clone(boardCache));
            return true;
        }
    };

    window.RTF_MY_STORY_BRIDGE = {
        getSnapshot() {
            if (typeof window.saveBoard === 'function') {
                try {
                    window.saveBoard();
                } catch (err) {
                    console.warn('My Story bridge save flush failed', err);
                }
            }
            return clone(boardCache);
        },
        pushFromParent(payload) {
            applyIncomingPayload(payload);
            markReady();
        }
    };

    applyMyStoryChrome();
    const requested = postToParent(MSG.REQUEST_INIT, null);
    if (!requested) markReady();
    setTimeout(() => {
        if (!ready) markReady();
    }, 1200);
})();
