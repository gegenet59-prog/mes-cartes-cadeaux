// Service worker de « Mes cartes cadeaux »
// - garde l'appli disponible hors connexion
// - reçoit les images envoyées par le menu « Partager » d'Android
const VERSION = 'v1';
const COQUE = 'coque-' + VERSION;
const OCR = 'ocr-v1';
const PARTAGE = 'partage';
const FICHIERS = ['./', 'index.html', 'manifest.json', 'icone-192.png', 'icone-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(COQUE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n.startsWith('coque-') && n !== COQUE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Image reçue par « Partager » : on la met de côté puis on ouvre l'appli
  if (e.request.method === 'POST' && url.pathname.endsWith('/partage')) {
    e.respondWith((async () => {
      try {
        const donnees = await e.request.formData();
        const image = donnees.get('image');
        if (image) {
          const cache = await caches.open(PARTAGE);
          await cache.put('image-partagee', new Response(image, { headers: { 'Content-Type': image.type || 'image/png' } }));
        }
      } catch (err) { /* on ouvre quand même l'appli */ }
      return Response.redirect('./?partage=1', 303);
    })());
    return;
  }

  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // Moteur de lecture (gros fichiers qui ne changent pas) : cache d'abord
  if (url.pathname.includes('/ocr/')) {
    e.respondWith(caches.open(OCR).then(async c => {
      const deja = await c.match(e.request);
      if (deja) return deja;
      const rep = await fetch(e.request);
      if (rep.ok) c.put(e.request, rep.clone());
      return rep;
    }));
    return;
  }

  // Le reste : réseau d'abord (pour avoir les mises à jour), cache en secours
  e.respondWith(
    fetch(e.request).then(rep => {
      if (rep.ok) { const copie = rep.clone(); caches.open(COQUE).then(c => c.put(e.request, copie)); }
      return rep;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./')))
  );
});
