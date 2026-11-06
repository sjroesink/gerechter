/* global self, caches, CACHE_NAME, PUBLIC_ASSETS */
// Never store app HTML, JS, private images or requests carrying credentials.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // Validate the entire release before writing; integrity also rejects a mixed deployment.
        const responses = await Promise.all(
          PUBLIC_ASSETS.map(async ({ url, integrity }) => {
            const response = await fetch(url, {
              credentials: 'omit',
              cache: 'no-store',
              redirect: 'error',
              integrity,
            })
            if (!response.ok || response.type === 'opaque') throw new Error('Offlinebestand niet beschikbaar')
            return response
          }),
        )
        const cache = await caches.open(CACHE_NAME)
        await Promise.all(PUBLIC_ASSETS.map(({ url }, i) => cache.put(url, responses[i])))
      } catch (error) {
        await caches.delete(CACHE_NAME)
        throw error
      }
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVATE_UPDATE' && event.source?.type === 'window') {
    event.waitUntil(self.skipWaiting())
  }
})

self.addEventListener('activate', (event) => {
  // Keep the previous public fallback for tabs still finishing an old fetch.
  event.waitUntil(
    (async () => {
      const previous = (await caches.keys()).filter(
        (key) => key.startsWith('gerechter-public-offline-v1-') && key !== CACHE_NAME,
      )
      await Promise.all(previous.slice(0, -1).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  const networkOnly = () => fetch(request, { cache: 'no-store' })
  if (request.method !== 'GET' || url.search) {
    event.respondWith(networkOnly())
    return
  }
  if (PUBLIC_ASSETS.some((asset) => asset.url === url.pathname)) {
    event.respondWith(
      (async () =>
        (await caches.open(CACHE_NAME)).match(url.pathname).then((response) => response || fetch(request)))(),
    )
    return
  }
  // Closed navigation allowlist: auth, API, OAuth/discovery, tokens, invitations,
  // AH setup/callback, private images and every unknown endpoint stay network-only.
  if (
    request.mode === 'navigate' &&
    (url.pathname === '/' ||
      url.pathname === '/meer' ||
      /^\/(week|gerechten|voorraad)(\/|$)/.test(url.pathname))
  ) {
    event.respondWith(
      (async () => {
        try {
          return await networkOnly()
        } catch {
          const fallback = await (await caches.open(CACHE_NAME)).match('/pwa/offline.html')
          return fallback || Response.error()
        }
      })(),
    )
    return
  }
  // Explicitly bypass the browser HTTP cache too: private image responses use
  // immutable headers upstream, so a passive fall-through would not be network-only.
  event.respondWith(networkOnly())
})
