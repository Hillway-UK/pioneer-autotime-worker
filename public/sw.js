const VERSION = '1.0.2';
const CACHE_NAME = `autotime-v${VERSION}`;
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${VERSION}`);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Force immediate activation
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${VERSION}`);
  event.waitUntil(
    (async () => {
      // Delete old caches
      const keys = await caches.keys();
      await Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log(`[SW] Deleting old cache: ${key}`);
            return caches.delete(key);
          }
        })
      );
      // Take control immediately
      await self.clients.claim();
    })()
  );
});

// NetworkFirst strategy with optional TTL
async function networkFirst(request, cacheName, maxAge = null) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(cacheName);
    
    // Clone and cache the response
    const responseToCache = response.clone();
    
    // Add timestamp for TTL checking
    if (maxAge) {
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', Date.now().toString());
      const blob = await responseToCache.blob();
      const cachedResponse = new Response(blob, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });
      cache.put(request, cachedResponse);
    } else {
      cache.put(request, responseToCache);
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', error);
    
    const cached = await caches.match(request);
    if (cached) {
      // Check TTL if exists
      if (maxAge) {
        const cacheTime = cached.headers.get('sw-cache-time');
        if (cacheTime && Date.now() - parseInt(cacheTime) > maxAge) {
          console.log('[SW] Cached response expired');
          throw new Error('Cached response expired');
        }
      }
      return cached;
    }
    
    throw error;
  }
}

// CacheFirst strategy (for immutable assets)
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  
  const response = await fetch(request);
  const cache = await caches.open(cacheName);
  cache.put(request, response.clone());
  return response;
}

// StaleWhileRevalidate strategy (for logos - instant load, background update)
async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  
  // Always fetch in background to update cache
  const fetchPromise = fetch(request).then(async response => {
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  }).catch(err => {
    console.log('[SW] Fetch failed for stale-while-revalidate:', err);
    return cached;
  });

  // Return cached immediately if available, otherwise wait for fetch
  return cached || fetchPromise;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't cache non-GET requests
  if (request.method !== 'GET') return;

  // NetworkFirst for HTML files
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(networkFirst(request, CACHE_NAME));
    return;
  }

  // StaleWhileRevalidate for Supabase Storage (organization logos - instant display)
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/storage/')) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
    return;
  }

  // NetworkFirst for Supabase API calls
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/rest/')) {
    event.respondWith(networkFirst(request, CACHE_NAME, 60000)); // 1min TTL
    return;
  }

  // CacheFirst for Vite bundled assets (hashed filenames)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Default: NetworkFirst
  event.respondWith(networkFirst(request, CACHE_NAME));
});

// Listen for skipWaiting message
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING message');
    self.skipWaiting();
  }
});

// Push notification handling
self.addEventListener("push", (event) => {
  console.log("Push event received:", event);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "AutoTime", body: event.data.text() };
    }
  }

  const title = data.title || "AutoTime";
  const options = {
    body: data.body || "New notification",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "autotime-notification",
    requireInteraction: false,
    silent: false,
    data: data,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler - navigate to clock screen
self.addEventListener("notificationclick", (event) => {
  console.log("Notification click received:", event);

  event.notification.close();

  // Open the clock screen when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: "window", includeUnmatched: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes("/clock") && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window to /clock
      if (clients.openWindow) {
        return clients.openWindow("/clock");
      }
    }),
  );
});
