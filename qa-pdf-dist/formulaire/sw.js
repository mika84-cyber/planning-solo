/* service worker : rend l'application installable et utilisable hors connexion */
var VERSION = '78';
var CACHE = 'demandes-' + VERSION;
var SHELL = ['./', './index.html', './app.webmanifest',
             './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png',
             './form-bg-1.jpg', './form-bg-2.png', './form-bg-3.png'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(SHELL); })
              .then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(noms){
    return Promise.all(noms.map(function(n){ return n === CACHE ? null : caches.delete(n); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  // Pour une navigation, priorité au réseau afin qu'une nouvelle version
  // déployée soit visible immédiatement. Le cache sert uniquement hors connexion.
  if(req.mode === 'navigate'){
    e.respondWith(fetch(req).then(function(res){
      if(res && res.ok){
        var copie = res.clone();
        caches.open(CACHE).then(function(c){ c.put('./index.html', copie); });
      }
      return res;
    }).catch(function(){
      return caches.match('./index.html').then(function(cached){
        return cached || Response.error();
      });
    }));
    return;
  }
  // le reste : cache d'abord, puis réseau. Les gros modules sont mis en cache
  // après leur première utilisation, sans ralentir l'ouverture initiale.
  e.respondWith(caches.match(req).then(function(r){
    if(r) return r;
    return fetch(req).then(function(res){
      if(res && res.ok){
        var copie=res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copie); });
      }
      return res;
    });
  }));
});
