// LinguaFast Service Worker - Network Only (No Caching)
// This version disables caching to ensure the app stays up-to-date and requires internet.

const CACHE_NAME = 'linguafast-no-cache-v1';

// Install event - clear any existing caches
self.addEventListener('install', (event) => {
    console.log('[SW] Installing and clearing old caches...');
    self.skipWaiting();
});

// Activate event - clean up ALL old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating and deleting all caches...');
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    console.log('[SW] Deleting cache:', key);
                    return caches.delete(key);
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - Network Only strategy
// We don't intercept fetches to cache them anymore
self.addEventListener('fetch', (event) => {
    // Let all requests go directly to the network
    return;
});

// Push notification support (keeps working even without cache)
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
