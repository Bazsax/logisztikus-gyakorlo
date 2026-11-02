// Egyszerű offline gyorsítótár: először hálózat, hiba esetén a tárolt példány.
const CACHE = 'lg-v3';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/util.js', 'js/store.js', 'js/session.js', 'js/theory.js',
  'js/practiceView.js', 'js/ai.js', 'js/practice/index.js', 'js/practice/common.js', 'js/practice/drp.js', 'js/practice/mrp.js',
  'js/practice/supplier.js', 'js/practice/eoq.js', 'js/practice/johnson.js', 'js/practice/turnover.js', 'js/practice/production.js',
  'js/practice/route.js', 'js/practice/valuation.js', 'js/practice/sched.js', 'js/practice/abc.js', 'js/practice/oee.js', 'js/practice/stock.js', 'js/practice/supplier3.js', 'js/practice/quality.js', 'data/theory.json', 'assets/icon.svg', 'manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
