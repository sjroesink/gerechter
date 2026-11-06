import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildPwa } from '../src/pwa/build'

/** Real HTTP release fixture, forwarding HTML/assets to the actual production backend.
 * No intercepted browser requests, fake worker lifecycle or production data.
 */
async function releases(upstream: string) {
  let revision = 'initial'
  let failAsset = false
  const original = buildPwa()
  const server = createServer(async (request, response) => {
    try {
      if (request.url === '/sw.js') {
        const built = buildPwa({ workerSource: original.workerSource + `\n// release: ${revision}\n` })
        response.writeHead(200, {
          'content-type': 'text/javascript',
          'cache-control': 'no-cache, no-store',
          'service-worker-allowed': '/',
        })
        response.end(built.worker)
      } else if (failAsset && request.url === '/pwa/icon-192.png') {
        response.writeHead(503).end('fixture update failure')
      } else {
        const result = await fetch(new URL(request.url!, upstream), { redirect: 'manual' })
        response.writeHead(
          result.status,
          Object.fromEntries(
            [...result.headers].filter(
              ([name]) => !['content-encoding', 'transfer-encoding', 'content-length'].includes(name),
            ),
          ),
        )
        response.end(Buffer.from(await result.arrayBuffer()))
      }
    } catch {
      response.writeHead(502).end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No fixture port')
  return {
    origin: `http://127.0.0.1:${address.port}`,
    release: (next: string, broken = false) => {
      revision = next
      failAsset = broken
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      }),
  }
}

test('update wacht op toestemming en herlaadt alleen het instemmende tabblad', async ({ browser }, info) => {
  const fixture = await releases(String(info.project.use.baseURL))
  const context = await browser.newContext({
    baseURL: fixture.origin,
    viewport: { width: 1280, height: 800 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
  })
  try {
    const first = await context.newPage()
    const second = await context.newPage()
    for (const page of [first, second]) {
      await page.goto('/login')
      await page.locator('html[data-hydrated]').waitFor()
      await page.evaluate(() => navigator.serviceWorker.ready.then(() => {}))
      await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
      await expect(page.getByText('Nieuwe versie beschikbaar', { exact: true })).toHaveCount(0)
    }
    await first.evaluate(async () => {
      await (await caches.open('unrelated-cache')).put('/unrelated', new Response('keep'))
    })
    await first.getByLabel('E-mailadres').fill('eerste@fixture.test')
    await second.getByLabel('E-mailadres').fill('tweede@fixture.test')
    const times = await Promise.all(
      [first, second].map((page) => page.evaluate(() => performance.timeOrigin)),
    )
    let firstReloads = 0
    let secondReloads = 0
    first.on('framenavigated', (frame) => {
      if (frame === first.mainFrame()) firstReloads++
    })
    second.on('framenavigated', (frame) => {
      if (frame === second.mainFrame()) secondReloads++
    })
    fixture.release('second')
    await first.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())!.update()
    })
    for (const page of [first, second]) {
      await expect(page.getByText('Nieuwe versie beschikbaar', { exact: true })).toBeVisible()
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(times[page === first ? 0 : 1])
    }
    expect(
      await first.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.waiting?.state),
    ).toBe('installed')
    await first.getByRole('button', { name: 'Bijwerken…', exact: true }).click()
    const dialog = first.getByRole('dialog')
    await expect(dialog).toContainText('Niet-opgeslagen wijzigingen')
    await dialog.getByRole('button', { name: 'Later', exact: true }).click()
    await expect(first.getByLabel('E-mailadres')).toHaveValue('eerste@fixture.test')
    await first.getByRole('button', { name: 'Bijwerken…', exact: true }).click()
    await first.screenshot({ path: info.outputPath('update-consent-desktop.png') })
    await first.getByRole('dialog').getByRole('button', { name: 'Nu bijwerken', exact: true }).click()
    await expect
      .poll(() => first.evaluate(() => performance.timeOrigin).catch(() => times[0]))
      .not.toBe(times[0])
    await first.locator('html[data-hydrated]').waitFor()
    await expect(first.getByLabel('E-mailadres')).toHaveValue('')
    expect(await second.evaluate(() => performance.timeOrigin)).toBe(times[1])
    await expect(second.getByLabel('E-mailadres')).toHaveValue('tweede@fixture.test')
    await expect(second.getByText('Nieuwe versie beschikbaar', { exact: true })).toHaveCount(0)
    expect(firstReloads).toBe(1)
    expect(secondReloads).toBe(0)
    expect(await first.evaluate(() => caches.has('unrelated-cache'))).toBe(true)
  } finally {
    await context.close()
    await fixture.close()
  }
})

test('mislukte offline-assetupdate laat actieve cache en andere namespaces intact', async ({
  browser,
}, info) => {
  const fixture = await releases(String(info.project.use.baseURL))
  const context = await browser.newContext({
    baseURL: fixture.origin,
    viewport: { width: 1280, height: 800 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
  })
  try {
    const page = await context.newPage()
    await page.goto('/login')
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => {}))
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    await page.evaluate(async () => {
      await (await caches.open('unrelated-cache')).put('/unrelated', new Response('keep'))
    })
    const before = await page.evaluate(() => caches.keys())
    fixture.release('broken-assets', true)
    const state = await page.evaluate(async () => {
      const registration = (await navigator.serviceWorker.getRegistration())!
      const finished = new Promise<string>((resolve) =>
        registration.addEventListener(
          'updatefound',
          () => {
            const worker = registration.installing!
            worker.addEventListener('statechange', () => {
              if (worker.state === 'redundant' || worker.state === 'installed') resolve(worker.state)
            })
          },
          { once: true },
        ),
      )
      await registration.update()
      return finished
    })
    expect(state).toBe('redundant')
    expect(await page.evaluate(() => caches.keys())).toEqual(before)
    await expect(page.getByText('Nieuwe versie beschikbaar', { exact: true })).toHaveCount(0)
    await context.setOffline(true)
    await page.goto('/gerechten/offline-fixture')
    await expect(page.getByRole('heading', { name: 'Je bent offline' })).toBeVisible()
    expect(
      await page.evaluate(async () =>
        (await (await caches.open('unrelated-cache')).match('/unrelated'))!.text(),
      ),
    ).toBe('keep')
  } finally {
    await context.close()
    await fixture.close()
  }
})

test('persistent Chromium meldt nul installability errors voor het echte productiemanifest', async ({
  playwright,
}, info) => {
  const dir = await mkdtemp(join(process.env.TMPDIR || tmpdir(), 'gerechter-installability-'))
  const context = await playwright.chromium.launchPersistentContext(dir, { headless: true })
  try {
    const page = context.pages()[0]!
    await page.goto(String(info.project.use.baseURL) + '/login')
    await page.locator('html[data-hydrated]').waitFor()
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => {}))
    const cdp = await context.newCDPSession(page)
    await cdp.send('Page.enable')
    const manifest = await cdp.send('Page.getAppManifest')
    expect(manifest.errors).toEqual([])
    expect(manifest.data).toBeTruthy()
    expect(JSON.parse(manifest.data!)).toMatchObject({
      id: '/',
      name: 'Gerechter',
      scope: '/',
      start_url: '/',
    })
    await expect
      .poll(async () => (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors)
      .toEqual([])
    await info.attach('installability.json', {
      body: JSON.stringify({ manifest, installability: await cdp.send('Page.getInstallabilityErrors') }),
      contentType: 'application/json',
    })
  } finally {
    await context.close()
    await rm(dir, { recursive: true, force: true })
  }
})
