const CACHE = "planning-solo-v1";
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/planning-icon-v3-48.png",
  "/planning-icon-v3-192.png",
  "/planning-icon-v3-512.png",
  "/planning-icon-v3-apple.png",
];
/* Les fichiers de l'application (code, styles, polices, images légères),
   listés à la construction par scripts/stamp-sw.mjs : téléchargés dès
   l'installation, ils rendent l'application complète hors ligne, tous écrans
   compris, sans attendre qu'on les ait ouverts une première fois. */
const PRECACHE = [];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(SHELL);
      // Un fichier introuvable ne bloque pas l'installation : il sera mis en
      // cache à sa première utilisation, comme avant.
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  // Les formulaires peuvent être remplacés par l’administrateur sans changer de lien.
  if (/^\/useful-forms\/[^/]+\.(pdf|docx)$/i.test(url.pathname)) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).then(response => {
      if (response.ok && !/private|no-store/i.test(response.headers.get('cache-control') || '')) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
      } else {
        event.waitUntil(caches.open(CACHE).then(cache => cache.delete(event.request)));
      }
      return response;
    }).catch(async () => (await caches.match(event.request)) || new Response('Document indisponible hors connexion.', { status: 503 })));
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(() => caches.match("/")),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          // La copie se fait tout de suite : une fois la réponse rendue à la
          // page, son contenu est lu et ne peut plus être copié. Copiée trop
          // tard, elle n'entrait jamais dans le cache et l'application
          // s'ouvrait sur une page blanche hors ligne.
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
          }
          return response;
        }),
    ),
  );
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Rappel Planning Solo",
    body: "Vous avez une note prévue demain.",
    url: "/",
    tag: "planning-note-reminder",
  };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/planning-icon-v3-192.png",
      badge: "/planning-icon-v3-48.png",
      tag: payload.tag,
      renotify: true,
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || "/",
    self.location.origin,
  ).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );
        if (existing)
          return existing.navigate(target).then(() => existing.focus());
        return self.clients.openWindow(target);
      }),
  );
});
