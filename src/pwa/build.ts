import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const publicRoot = new URL('../../public/', import.meta.url)
const urls = [
  '/pwa/offline.html',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
  '/pwa/maskable-512.png',
  '/pwa/apple-touch-icon.png',
] as const

/** Only these public, credential-free files may ever enter CacheStorage. */
export function buildPwa({
  workerSource = readFileSync(new URL('./worker.js', import.meta.url), 'utf8'),
  readAsset = (url: string) => readFileSync(new URL(url.slice(1), publicRoot)),
}: { workerSource?: string; readAsset?: (url: string) => Buffer } = {}) {
  const assets = urls.map((url) => ({
    url,
    integrity: `sha256-${createHash('sha256').update(readAsset(url)).digest('base64')}`,
  }))
  // Hash all emitted code, not only the handwritten body: even a generator-only
  // update must never reuse (and potentially delete) the active worker's cache.
  const template = `const CACHE_NAME = "__GERECHTER_CACHE_ID__";\nconst PUBLIC_ASSETS = ${JSON.stringify(assets)};\n${workerSource}`
  const cacheName = `gerechter-public-offline-v1-${createHash('sha256').update(template).digest('hex')}`
  const worker = template.replace('__GERECHTER_CACHE_ID__', cacheName)
  return { assets, cacheName, worker, workerSource }
}
