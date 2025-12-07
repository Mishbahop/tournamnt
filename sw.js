// [file name]: sw.js
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Cache-first strategy for CSS and JS
  if (event.request.url.includes('.css') || event.request.url.includes('.js')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});