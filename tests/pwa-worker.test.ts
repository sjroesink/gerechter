import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

const root = resolve(import.meta.dirname, '..')

describe('publieke offline worker', () => {
  it('bouwt uitsluitend openbare offline bestanden en versieert ook workerbron en assetbytes', async () => {
    expect(existsSync(resolve(root, 'src/pwa/build.ts'))).toBe(true)
    const { buildPwa } = await import('../src/pwa/build')
    const built = buildPwa()
    expect(built.assets.map((asset: { url: string }) => asset.url)).toEqual([
      '/pwa/offline.html',
      '/pwa/icon-192.png',
      '/pwa/icon-512.png',
      '/pwa/maskable-512.png',
      '/pwa/apple-touch-icon.png',
    ])
    expect(built.cacheName).toMatch(/^gerechter-public-offline-v1-[a-f0-9]{64}$/)
    expect(buildPwa({ workerSource: built.workerSource + '\n// update' }).cacheName).not.toBe(built.cacheName)
    expect(
      buildPwa({
        readAsset: (url: string) =>
          Buffer.concat([readFileSync(resolve(root, 'public' + url)), Buffer.from('changed')]),
      }).cacheName,
    ).not.toBe(built.cacheName)
    const offline = readFileSync(resolve(root, 'public/pwa/offline.html'), 'utf8')
    expect(offline).toContain('Je bent offline')
    expect(offline).toContain('niet offline beschikbaar')
    expect(offline).not.toMatch(/https?:|<script|<form/)
  })

  it('hashes de volledige uitgegeven worker inclusief gegenereerde proloog', async () => {
    const { buildPwa } = await import('../src/pwa/build')
    const built = buildPwa()
    const identity = createHash('sha256')
      .update(built.worker.replace(built.cacheName, '__GERECHTER_CACHE_ID__'))
      .digest('hex')
    expect(built.cacheName).toBe(`gerechter-public-offline-v1-${identity}`)
  })
})
