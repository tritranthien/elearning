// LinguaFast Service Worker
const CACHE_NAME = 'linguafast-v4';
const STATIC_CACHE = 'linguafast-static-v4';
const DYNAMIC_CACHE = 'linguafast-dynamic-v4';

// Static assets to cache
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log('[SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                    .map((key) => {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip API and authentication requests
    if (url.pathname.startsWith('/api') ||
        url.pathname.includes('logout') ||
        url.pathname.includes('login')) {
        return;
    }

    // Skip caching JavaScript and CSS files (let browser handle these with proper cache headers)
    // This prevents stale JS causing hydration errors
    if (url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css') ||
        url.pathname.includes('/@vite') ||
        url.pathname.includes('/node_modules/')) {
        return; // Let browser fetch directly without SW intervention
    }

    // For HTML pages and Data requests - network first
    const isDataRequest = url.search.includes('_data=') ||
        request.headers.get('Accept')?.includes('application/json');

    if (request.headers.get('accept')?.includes('text/html') || isDataRequest) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Only cache successful GET responses
                    if (response.status === 200 && request.method === 'GET') {
                        const responseClone = response.clone();
                        caches.open(DYNAMIC_CACHE).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback to cache
                    return caches.match(request).then((cachedResponse) => {
                        return cachedResponse || (isDataRequest ? null : caches.match('/'));
                    });
                })
        );
        return;
    }

    // For static assets (images, fonts, etc.) - cache first, fallback to network
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(request).then((response) => {
                // Cache successful responses
                if (response.status === 200 && request.method === 'GET') {
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            });
        })
    );
});

// Push notification support
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || 'Thời gian học rồi!',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            vibrate: [100, 50, 100],
            data: {
                url: data.url || '/'
            },
            actions: [
                { action: 'open', title: 'Mở app' },
                { action: 'close', title: 'Đóng' }
            ]
        };
        event.waitUntil(
            self.registration.showNotification(data.title || 'LinguaFast', options)
        );
    }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'open' || !event.action) {
        const url = event.notification.data?.url || '/';
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then((clientList) => {
                // Focus existing window or open new one
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                return clients.openWindow(url);
            })
        );
    }
});
