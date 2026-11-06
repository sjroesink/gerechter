import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const publicFile = (name: string) => readFileSync(new URL(`../public/${name}`, import.meta.url))

describe('publieke PWA-identiteit', () => {
  it('heeft een stabiele root-identiteit en echte merkiconen met installatieformaten', () => {
    const manifest = JSON.parse(publicFile('manifest.webmanifest').toString())
    expect(manifest).toMatchObject({
      id: '/',
      name: 'Gerechter',
      short_name: 'Gerechter',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      lang: 'nl',
    })
    for (const [name, size, purpose] of [
      ['icon-192.png', 192, 'any'],
      ['icon-512.png', 512, 'any'],
      ['maskable-512.png', 512, 'maskable'],
    ] as const) {
      expect(manifest.icons).toContainEqual({
        src: `/pwa/${name}`,
        sizes: `${size}x${size}`,
        type: 'image/png',
        purpose,
      })
      const png = publicFile(`pwa/${name}`)
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([size, size])
    }
    const apple = publicFile('pwa/apple-touch-icon.png')
    expect([apple.readUInt32BE(16), apple.readUInt32BE(20)]).toEqual([180, 180])
    const root = readFileSync(new URL('../src/routes/__root.tsx', import.meta.url), 'utf8')
    expect(root).toContain('/manifest.webmanifest')
    expect(root).toContain('/pwa/apple-touch-icon.png')
    // Existing before-paint themeInitScript owns theme-color; a second declarative
    // tag would duplicate it during React 19 metadata hydration (covered by e2e/04).
    expect(root).toContain('themeInitScript')
    expect(readFileSync(new URL('../src/lib/theme.ts', import.meta.url), 'utf8')).toContain(
      "meta.name = 'theme-color'",
    )
  })
})
