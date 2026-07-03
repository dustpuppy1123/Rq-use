const CACHE_NAME = 'rq-dispatch-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// --- IndexedDB Queue helpers for Offline Sync ---
const DB_NAME = 'rq-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'pending-sync';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

function addToQueue(data) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

function getQueue() {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = () => reject(request.error);
    });
  });
}

function removeFromQueue(id) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

// Notify all clients of a successful synchronization event
function notifyClientsOfSync() {
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clientsList) => {
    clientsList.forEach((client) => {
      client.postMessage({
        type: 'RQ_SYNC_COMPLETE',
        message: 'All pending dispatches and reports have sync\'d with the control room!'
      });
    });
  });
}

// Notify all clients that a new request has been queued offline
function notifyClientsOfOfflineQueue(data) {
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clientsList) => {
    clientsList.forEach((client) => {
      client.postMessage({
        type: 'RQ_OFFLINE_QUEUED',
        item: data
      });
    });
  });
}

// Synchronize all pending requests with the server
async function syncPendingRequests() {
  let queue;
  try {
    queue = await getQueue();
  } catch (err) {
    console.error('SW: Failed to retrieve queue from DB:', err);
    return;
  }
  
  if (queue.length === 0) return;

  console.log(`SW: Commencing background sync for ${queue.length} items`);
  let syncedCount = 0;

  for (const item of queue) {
    try {
      const fetchOptions = {
        method: item.method,
        headers: item.headers || { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.body)
      };

      const response = await fetch(item.url, fetchOptions);
      if (response.ok) {
        await removeFromQueue(item.id);
        syncedCount++;
        console.log(`SW: Synced item ${item.id} successfully:`, item.url);
      } else {
        console.warn(`SW: Failed syncing key ${item.id}, response status:`, response.status);
      }
    } catch (err) {
      console.error(`SW: Failed to send request for key ${item.id} under sync:`, err);
    }
  }

  if (syncedCount > 0) {
    notifyClientsOfSync();
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Trigger sync on background Sync registration tags
self.addEventListener('sync', (event) => {
  if (event.tag === 'rq-sync-queue' || event.tag === 'sync') {
    event.waitUntil(syncPendingRequests());
  }
});

// Broadcast and listen to explicit client triggers (e.g. manual sync/online checks)
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'sync') {
    event.waitUntil(syncPendingRequests());
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass cache for Vite dev server files, HMR, and other local dev assets
  if (url.pathname.startsWith('/@') || 
      url.pathname.startsWith('/src/') || 
      url.pathname.startsWith('/node_modules/') || 
      url.pathname.includes('.vite')) {
    return;
  }

  // Intercept POST requests to API during offline occurrences to queue securely
  if (url.pathname.startsWith('/api/') && event.request.method === 'POST') {
    const reqClone = event.request.clone();
    event.respondWith(
      fetch(event.request.clone())
        .catch(async (error) => {
          console.log('SW: API POST failed, marking as queued offline.', error);
          
          try {
            const bodyText = await reqClone.text();
            let parsedBody = {};
            try {
              parsedBody = JSON.parse(bodyText);
            } catch {
              parsedBody = bodyText;
            }

            let type = 'unknown';
            if (url.pathname.includes('/feedbacks')) {
              type = 'feedback';
            } else if (url.pathname.includes('/status')) {
              type = 'status_update';
            }

            const queueItem = {
              url: url.pathname,
              method: 'POST',
              body: parsedBody,
              headers: { 'Content-Type': 'application/json' },
              timestamp: Date.now(),
              type: type
            };

            await addToQueue(queueItem);
            notifyClientsOfOfflineQueue(queueItem);

            // Register background sync if available
            if ('sync' in self.registration) {
              await self.registration.sync.register('rq-sync-queue').catch(err => console.log('Sync register failed', err));
            }

            return new Response(JSON.stringify({ 
              success: true, 
              queued: true, 
              message: 'Network offline. Request registered in offline sync queue.' 
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          } catch (dbErr) {
            console.error('Failed to write to IndexedDB queue:', dbErr);
            return new Response(JSON.stringify({ 
              success: false, 
              error: 'Offline, and failed to save report to offline queue.' 
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        })
    );
    return;
  }

  // For API GET requests, use Network First, fallback to cache
  if (url.pathname.startsWith('/api/') && event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch((error) => {
          // Fallback to cache if network fails
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            throw error;
          });
        })
    );
    return;
  }

  // For routing/Map APIs (like OSRM), also Network First
  if (url.hostname.includes('project-osrm.org') && event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) return response;
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
          return response;
        })
        .catch((error) => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            throw error;
          });
        })
    );
    return;
  }

  // For static assets, Cache First with background fetch (Stale-While-Revalidate)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((error) => {
          console.log('Fetch failed, offline mode active.', error);
          if (!cachedResponse) throw error;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'New Dispatch';
  const options = {
    body: data.body || 'You have a new alarm assignment.',
    icon: 'https://picsum.photos/seed/rq-icon/192/192',
    badge: 'https://picsum.photos/seed/rq-icon/192/192',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      let matchingClient = null;

      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (new URL(client.url).pathname.includes('/driver')) {
          matchingClient = client;
          break;
        }
      }

      if (matchingClient) {
        return matchingClient.navigate(urlToOpen).then((client) => client.focus());
      } else {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
