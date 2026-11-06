import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, inject, test, vi } from 'vitest'
import { startServer } from '../scripts/start.mjs'

const baseEnv = {
  DATABASE_URL: inject('databaseUrl'),
  PUBLIC_BASE_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  ADMIN_EMAIL: 'admin@example.com',
}

function brokenMigrations() {
  const dir = mkdtempSync(path.join(tmpdir(), 'gerechter-mig-'))
  mkdirSync(path.join(dir, 'meta'))
  writeFileSync(
    path.join(dir, 'meta', '_journal.json'),
    JSON.stringify({
      version: '7',
      dialect: 'postgresql',
      entries: [{ idx: 0, version: '7', when: 9_999_999_999_999, tag: '0000_broken', breakpoints: true }],
    }),
  )
  writeFileSync(path.join(dir, '0000_broken.sql'), 'SELECT * FROM tabel_die_niet_bestaat;')
  return dir
}

describe('startServer', () => {
  test('voert migraties uit en start daarna de server', async () => {
    const importServer = vi.fn(async () => ({}))
    await startServer({ env: baseEnv, importServer })
    expect(importServer).toHaveBeenCalledOnce()
  })

  test('breekt af als een migratie mislukt en start de server niet', async () => {
    const importServer = vi.fn(async () => ({}))
    await expect(startServer({ env: baseEnv, folder: brokenMigrations(), importServer })).rejects.toThrow(
      /Databasemigratie mislukt/,
    )
    expect(importServer).not.toHaveBeenCalled()
  })

  test('breekt af als een verplichte variabele ontbreekt', async () => {
    const importServer = vi.fn(async () => ({}))
    await expect(startServer({ env: { ...baseEnv, ADMIN_EMAIL: undefined }, importServer })).rejects.toThrow(
      /ADMIN_EMAIL/,
    )
    expect(importServer).not.toHaveBeenCalled()
  })

  test.each([
    ['DATABASE_URL', 'geen-url'],
    ['PUBLIC_BASE_URL', 'geen-url'],
    ['BETTER_AUTH_SECRET', 'te-kort'],
    ['ADMIN_EMAIL', 'geen-mailadres'],
    ['PORT', 'geen-poort'],
    ['AH_SIDECAR_URL', 'ftp://localhost:3001'],
  ])('weigert een ongeldige %s vóór migraties en vóór de server start', async (name, value) => {
    const importServer = vi.fn(async () => ({}))
    await expect(
      startServer({
        env: { ...baseEnv, [name]: value },
        // Een onbereikbare migratiemap zou een andere fout geven als migraties al waren gestart.
        folder: '/bestaat-niet',
        importServer,
      }),
    ).rejects.toThrow(new RegExp(`Ongeldige configuratie:[\\s\\S]*${name}`))
    expect(importServer).not.toHaveBeenCalled()
  })

  test('vereist het sidecargeheim bij een URL en accepteert het complete optionele paar', async () => {
    const importServer = vi.fn(async () => ({}))
    await expect(
      startServer({ env: { ...baseEnv, AH_SIDECAR_SECRET: 's'.repeat(32) }, importServer }),
    ).rejects.toThrow(/AH_SIDECAR_URL/)
    await expect(
      startServer({ env: { ...baseEnv, AH_SIDECAR_URL: 'http://localhost:3001' }, importServer }),
    ).rejects.toThrow(/AH_SIDECAR_SECRET/)
    expect(importServer).not.toHaveBeenCalled()
    await startServer({
      env: { ...baseEnv, AH_SIDECAR_URL: 'http://localhost:3001', AH_SIDECAR_SECRET: 's'.repeat(32) },
      importServer,
    })
    expect(importServer).toHaveBeenCalledOnce()
  })
})
