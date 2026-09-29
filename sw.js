const CACHE_NAME = 'brionicle-v9';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/cameras.js',
    '/js/weather.js',
    '/js/wikipedia.js',
    '/js/radio.js',
    '/js/earthquakes.js',
    '/js/iss.js',
    '/js/aurora.js',
    '/js/pins.js',
    '/js/ufo.js',
    '/js/roadtrip.js',
    '/js/rainradar.js',
    '/js/flights.js',
    '/manifest.json',
    '/data/festivals.json',
    '/data/monuments.json',
    '/data/telescopes.json',
    '/data/ufo-sightings.json',
    '/data/livecams.json',
    '/data/urban.json',
    '/data/caves.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (url.origin !== location.origin) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                const fetched = fetch(event.request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                }).catch(() => cached);

                return cached || fetched;
            })
    );
});
