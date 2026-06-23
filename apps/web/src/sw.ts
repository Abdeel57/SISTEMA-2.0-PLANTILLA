/// <reference lib="webworker" />
//
// Service Worker personalizado de Bismark (estrategia `injectManifest` de
// vite-plugin-pwa). Responsable de:
//  - Precaché del shell de la app (manifest inyectado por workbox).
//  - Fallback de navegación offline a /offline.html.
//  - Caché cache-first del boleto digital (/boleto/:code) para mostrarlo sin red.
//  - Cola de Background Sync para reintentar subidas de comprobante.
//  - Web Push: mostrar notificación (push) y abrir/enfocar la URL (notificationclick).
//
// Las notificaciones push son SOLO para riferos (el backend solo suscribe y
// dispara a organizadores). El comprador nunca recibe push.

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// ── Precaché del shell (inyectado por vite-plugin-pwa) ──────────────────────
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// Activación inmediata de la nueva versión.
self.addEventListener('install', () => {
  void self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Fallback de navegación offline ──────────────────────────────────────────
// Si una navegación falla (sin red y no está en precaché), servimos offline.html.
const OFFLINE_URL = '/offline.html';
registerRoute(
  new NavigationRoute(
    async ({ event }) => {
      try {
        return await fetch((event as FetchEvent).request);
      } catch {
        const cached = await caches.match(OFFLINE_URL);
        return cached ?? Response.error();
      }
    },
    // No interceptar rutas de API ni el propio offline.html.
    { denylist: [/^\/api\//, /^\/offline\.html$/] },
  ),
);

// ── Boleto digital: cache-first ─────────────────────────────────────────────
// El boleto (/boleto/:code) debe verse durante el sorteo aunque no haya señal.
registerRoute(
  ({ url, request }) => request.mode === 'navigate' && /^\/boleto\//.test(url.pathname),
  new CacheFirst({
    cacheName: 'boleto-pages',
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

// ── Background Sync: reintento de subida de comprobante ─────────────────────
// Subida de comprobante del comprador: POST /api/public/orders/:code/proof.
// Cuando hay red, NetworkOnly es un passthrough transparente (igual que sin SW);
// si falla por falta de red, workbox la encola y la reintenta al reconectar.
const proofSyncPlugin = new BackgroundSyncPlugin('sortea-proof-uploads', {
  maxRetentionTime: 24 * 60, // minutos (24 h)
});
registerRoute(
  ({ url, request }) =>
    request.method === 'POST' && /^\/api\/public\/orders\/[^/]+\/proof$/.test(url.pathname),
  new NetworkOnly({ plugins: [proofSyncPlugin] }),
  'POST',
);

// ── Web Push (solo riferos) ─────────────────────────────────────────────────
interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {};
  try {
    payload = event.data ? (event.data.json() as PushPayload) : {};
  } catch {
    payload = { body: event.data?.text() };
  }

  const title = payload.title || 'Sortea';
  const options: NotificationOptions = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: payload.url || '/admin/ordenes' },
    // Vibración corta en móvil (donde esté soportada).
    vibrate: [80, 40, 80],
  } as NotificationOptions;

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data as { url?: string } | undefined)?.url || '/admin/ordenes';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Si ya hay una ventana de la app abierta, enfocarla y navegar.
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client && targetUrl) {
            try {
              await (client as WindowClient).navigate(targetUrl);
            } catch {
              /* navegación entre orígenes no permitida: ignorar */
            }
          }
          return;
        }
      }
      // Si no, abrir una nueva.
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
