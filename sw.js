// Jiee Garden — service worker
// Caches the app shell so the game can boot offline after first load.
// Note: three.js is loaded from a CDN; it is cached opportunistically
// but the very first load requires network access.

const CACHE_NAME = 'jiee-garden-v3';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/main.js',
  './js/engine/Game.js',
  './js/engine/CameraController.js',
  './js/engine/InputManager.js',
  './js/engine/AudioManager.js',
  './js/entities/Player.js',
  './js/entities/Enemy.js',
  './js/entities/PositiveCharacter.js',
  './js/entities/TontonJiee.js',
  './js/world/GardenBuilder.js',
  './js/world/Collision.js',
  './js/ai/PatrolAI.js',
  './js/ai/Detection.js',
  './js/ai/Pathfinding.js',
  './js/ui/HUD.js',
  './js/save/SaveManager.js',
  './js/i18n/i18n.js',
  './js/i18n/locales.js',
  './js/levels/level01.js',
  './js/levels/level02.js',
  './js/levels/LevelLoader.js',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Cache same-origin and CDN assets opportunistically.
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
