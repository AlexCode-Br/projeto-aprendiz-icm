const CACHE_NAME = 'projeto-aprendiz-shell-v3';
const APP_SHELL = [
  '/login',
  '/manifest.webmanifest',
  '/favicon-aprendiz.svg',
  '/projeto-aprendiz-logo.png',
  '/pwa-icon-192-v3.png',
  '/pwa-icon-512-v3.png',
  '/notification-icon-v3.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)),
  )));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/api' || url.pathname === '/dev-mail') return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/login')));
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok && url.pathname.startsWith('/assets/')) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  }))); 
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { body: event.data?.text() || '' }; }
  const title = String(payload.title || 'Projeto Aprendiz').slice(0, 120);
  const body = String(payload.body || 'Você recebeu uma nova atualização.').slice(0, 300);
  let targetUrl = '/';
  try {
    const parsed = new URL(String(payload.url || '/'), self.location.origin);
    if (parsed.origin === self.location.origin) targetUrl = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {}
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/pwa-icon-192-v3.png',
    badge: '/notification-icon-v3.png',
    tag: String(payload.tag || '').slice(0, 180) || undefined,
    data: { url: targetUrl },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const target = new URL(targetUrl, self.location.origin);
    for (const client of clients) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      if ('navigate' in client) await client.navigate(target.href);
      return client.focus();
    }
    return self.clients.openWindow(target.href);
  }));
});
