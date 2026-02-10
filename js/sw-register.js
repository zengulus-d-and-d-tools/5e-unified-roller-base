(function () {
    'use strict';

    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const protocol = String(window.location && window.location.protocol ? window.location.protocol : '');
    if (protocol !== 'https:' && protocol !== 'http:') return;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
            console.warn('Service worker registration failed:', err);
        });
    });
})();
