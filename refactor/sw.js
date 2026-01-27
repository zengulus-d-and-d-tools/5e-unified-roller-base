const CACHE_NAME = 'ravnica-tools-v1';
const ASSETS = [
    './tools.html',
    './index.html',
    './hub.html',
    './css/theme.css',
    './js/config.js',
    './js/core.js',
    './js/dice.js',
    './js/sheet.js',
    './js/ui.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});
