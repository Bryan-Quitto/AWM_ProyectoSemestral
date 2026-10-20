/**
 * Service Worker para la PWA de RACPD (Red de Apoyo para Cuidadores de Personas con Dependencia).
 *
 * Diseñado bajo la directiva de Cero Indulgencia:
 * - Cumple con el criterio de instalabilidad PWA para navegadores móviles.
 * - Protege las peticiones de desarrollo (Vite HMR, WebSockets) y las llamadas a la API (/api/*)
 *   haciéndolas pasar directamente a la red sin interceptaciones perjudiciales.
 */

const NOMBRE_CACHE = 'racpd-cache-v1';
const RECURSOS_BASICOS = [
  '/',
  '/manifest.webmanifest',
  '/icono-racpd.svg'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(NOMBRE_CACHE).then((cache) => {
      return cache.addAll(RECURSOS_BASICOS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nombres) => {
      return Promise.all(
        nombres
          .filter((nombre) => nombre !== NOMBRE_CACHE)
          .map((nombre) => caches.delete(nombre))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);

  // Excluir de la caché: llamadas a la API del backend, Supabase y módulos internos de Vite dev
  if (
    url.pathname.startsWith('/api') ||
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('@vite') ||
    url.pathname.includes('@fs') ||
    evento.request.method !== 'GET'
  ) {
    return;
  }

  // Estrategia Network-First con fallback a caché para navegación offline básica
  evento.respondWith(
    fetch(evento.request)
      .catch(() => caches.match(evento.request).then((respuesta) => respuesta || caches.match('/')))
  );
});

// No incluir información clínica en la pantalla bloqueada.
self.addEventListener('push', (evento) => {
  evento.waitUntil((async () => {
    let datos;
    try { datos = evento.data?.json(); } catch { datos = null; }
    const valido = datos && typeof datos === 'object' && typeof datos.idMensaje === 'string'
      && /^[0-9a-f-]{36}$/i.test(datos.idMensaje);
    const ruta = valido && typeof datos.ruta === 'string' && /^\/agenda(?:\?bloqueIdDestacado=[0-9a-f-]{36})?$/i.test(datos.ruta) ? datos.ruta : '/agenda';
    await self.registration.showNotification('RACPD', {
      body: 'Hay una actualización importante en tu red de cuidados. Abre la aplicación para revisarla.',
      tag: valido ? datos.idMensaje : 'racpd-aviso',
      icon: '/icono-racpd.svg',
      data: { ruta },
    });
  })());
});
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil((async () => {
    const ruta = evento.notification.data?.ruta;
    const destino = typeof ruta === 'string' && /^\/agenda(?:\?bloqueIdDestacado=[0-9a-f-]{36})?$/i.test(ruta) ? ruta : '/agenda';
    const url = new URL(destino, self.location.origin);
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const ventana = ventanas.find(v => new URL(v.url).origin === self.location.origin);
    if (ventana) { await ventana.navigate(url.href); await ventana.focus(); }
    else await self.clients.openWindow(url.href);
  })());
});
