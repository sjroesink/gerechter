import { test, expect, type Page, type BrowserContext, devices } from '@playwright/test'
import { admin, login, sql } from './helpers'
import { E2E_DATABASE_URL } from '../playwright.config'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const publicAssets = [
  '/pwa/offline.html',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
  '/pwa/maskable-512.png',
  '/pwa/apple-touch-icon.png',
]

async function control(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    await navigator.serviceWorker.ready
  })
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

async function offline(context: BrowserContext, pages: Page[], value: boolean) {
  await context.setOffline(value)
  for (const page of pages) {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.overrideNetworkState', {
      offline: value,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    })
    // Keep the CDP session attached: detaching resets Chromium's native online override.
    expect(await page.evaluate(() => navigator.onLine)).toBe(!value)
  }
}

test('productieworker heeft echte headers en geeft offline uitsluitend een openbare melding', async ({
  page,
  context,
  request,
}, info) => {
  const worker = await request.get('/sw.js')
  expect(worker.status()).toBe(200)
  expect(worker.headers()['content-type']).toMatch(/javascript/)
  expect(worker.headers()['cache-control']).toBe('no-cache, no-store')
  expect(worker.headers()['cloudflare-cdn-cache-control']).toBe('no-store')
  expect(worker.headers()['service-worker-allowed']).toBe('/')
  const manifest = await request.get('/manifest.webmanifest')
  expect(manifest.headers()['content-type']).toMatch(/application\/manifest\+json/)
  expect(manifest.headers()['cache-control']).toContain('no-cache')
  await page.goto('/login')
  await control(page)
  await offline(context, [page], true)
  expect(
    await page.evaluate(() =>
      fetch('/health', { cache: 'no-store' }).then(
        () => 'unexpected',
        () => 'failed',
      ),
    ),
  ).toBe('failed')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Je bent offline' })).toBeVisible()
  expect(await page.evaluate(() => navigator.onLine)).toBe(false)
  await page.reload()
  await expect(page.getByText('niet offline beschikbaar', { exact: false })).toBeVisible()
  expect(await page.evaluate(() => navigator.onLine)).toBe(false)
  await page.screenshot({ path: info.outputPath('offline-mobile.png') })
  await page.goto('/gerechten/test-fixture')
  await expect(page.getByRole('heading', { name: 'Je bent offline' })).toBeVisible()
  await offline(context, [page], false)
  await page.getByRole('link', { name: 'Opnieuw proberen' }).click()
  await expect(page.getByRole('heading', { name: 'Je bent offline' })).toHaveCount(0)
})

test('echte privéfoto met immutable HTTP-headers blijft ook na opwarmen netwerk-only', async ({
  page,
  context,
}) => {
  expect(new URL(E2E_DATABASE_URL).pathname).toBe('/gerechter_e2e')
  await login(page, admin.email)
  await control(page)
  const session = await page.evaluate(async () => (await fetch('/api/auth/get-session')).json())
  const [membership] = await sql('select household_id from membership where user_id = $1 limit 1', [
    session.user.id,
  ])
  const id = crypto.randomUUID()
  const png = readFileSync(new URL('../public/pwa/icon-192.png', import.meta.url))
  await sql(
    'insert into image (id, household_id, content_type, bytes, byte_size, sha256) values ($1, $2, $3, $4, $5, $6)',
    [
      id,
      membership.household_id,
      'image/png',
      png,
      png.length,
      createHash('sha256').update(png).digest('hex'),
    ],
  )
  try {
    const path = `/afbeeldingen/${id}`
    for (let i = 0; i < 2; i++) {
      const warm = await page.evaluate(async (url) => {
        const response = await fetch(url)
        await response.arrayBuffer()
        return { status: response.status, cache: response.headers.get('cache-control') }
      }, path)
      expect(warm.status).toBe(200)
      expect(warm.cache).toContain('immutable')
    }
    await offline(context, [page], true)
    expect(
      await page.evaluate(
        (url) =>
          fetch(url).then(
            () => false,
            () => true,
          ),
        path,
      ),
    ).toBe(true)
    expect(await page.goto(path).catch(() => null)).toBeNull()
  } finally {
    await sql('delete from image where id = $1', [id])
  }
})

const sensitivePaths = [
  '/meer/boodschappen/verbindingen',
  '/meer/account',
  '/login',
  '/setup',
  '/consent',
  '/herstel/fixture-token',
  '/uitnodiging/fixture-token',
  '/api/auth/get-session',
  '/api/ah/callback?code=fixture',
  '/mcp',
  '/.well-known/oauth-authorization-server',
  '/afbeeldingen/fixture-image',
  '/_serverFn/fixture',
  '/gerechten?token=fixture',
  '/unknown',
]

test('ingelogde SSR, AH, auth, MCP, tokens en privéafbeeldingen blijven strikt netwerk-only', async ({
  page,
  context,
}) => {
  await login(page, admin.email)
  await control(page)
  for (const path of ['/gerechten', '/voorraad', '/meer/account', '/meer/boodschappen/verbindingen']) {
    await page.goto(path)
    await page.locator('html[data-hydrated]').waitFor()
  }
  expect((await context.cookies()).some((cookie) => cookie.name.includes('session_token'))).toBe(true)
  const session = await page.evaluate(async () =>
    (await fetch('/api/auth/get-session', { cache: 'no-store' })).json(),
  )
  expect(session.user.email).toBe(admin.email)
  await page.evaluate(async (paths) => {
    for (const path of paths) {
      await fetch(path, { cache: 'no-store' }).then(
        (response) => response.body?.cancel(),
        () => {},
      )
    }
    await (await caches.open('unrelated-cache')).put('/unrelated', new Response('keep'))
  }, sensitivePaths)
  const entries = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.startsWith('gerechter-'))
    return Promise.all(
      names.map(async (name) => {
        const cache = await caches.open(name)
        return Promise.all(
          (await cache.keys()).map(async (request) => ({
            url: new URL(request.url).pathname,
            body: await (await cache.match(request))!.text(),
            headers: [...request.headers],
          })),
        )
      }),
    )
  })
  expect(entries).toHaveLength(1)
  expect(entries[0]!.map((entry) => entry.url).sort()).toEqual([...publicAssets].sort())
  expect(JSON.stringify(entries)).not.toContain(admin.email)
  expect(JSON.stringify(entries)).not.toContain(session.session.token)
  expect(JSON.stringify(entries)).not.toMatch(/authorization|session_token/i)
  await offline(context, [page], true)
  const failed = await page.evaluate(
    async (paths) =>
      Promise.all(
        paths.map((path) =>
          fetch(path, { cache: 'no-store' }).then(
            () => false,
            () => true,
          ),
        ),
      ),
    sensitivePaths,
  )
  expect(failed.every(Boolean)).toBe(true)
  for (const path of sensitivePaths) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => null)
    expect(response, `sensitive navigation ${path} must fail, not return offline HTML`).toBeNull()
  }
})

// UI lifecycle fixtures: a real OS installation is not performed by Playwright.
test('installatieaanbod blijft na interne navigatie beschikbaar en verdwijnt na appinstalled', async ({
  page,
  context,
}, info) => {
  await login(page, admin.email)
  await expect
    .poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/'))))
    .toBe(true)
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true })
    Object.assign(event, {
      prompt: async () => {
        document.documentElement.dataset.prompted = 'true'
      },
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    })
    window.dispatchEvent(event)
  })
  await page.getByRole('navigation', { name: 'Hoofdnavigatie' }).getByRole('link', { name: 'Meer' }).click()
  await page.getByText('Gerechter als app', { exact: true }).click()
  const install = page.getByRole('button', { name: 'Installeren', exact: true })
  await expect
    .poll(async () => {
      const buttonBox = (await install.boundingBox())!
      const navigationBox = (await page.getByRole('navigation', { name: 'Hoofdnavigatie' }).boundingBox())!
      return buttonBox.y + buttonBox.height <= navigationBox.y
    })
    .toBe(true)
  await page.screenshot({ path: info.outputPath('install-mobile.png') })
  await install.click()
  await expect(page.locator('html')).toHaveAttribute('data-prompted', 'true')
  await expect(page.getByRole('button', { name: 'Installeren', exact: true })).toHaveCount(0)
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
  await expect(page.getByText('Gerechter als app', { exact: true })).toHaveCount(0)
  await offline(context, [page], true)
  await expect(page.getByRole('status')).toContainText('Internetverbinding verbroken')
  await offline(context, [page], false)
  await expect(page.getByText('Internetverbinding verbroken', { exact: false })).toHaveCount(0)
})

test('iOS geeft handmatige instructies, maar niet als Gerechter al zelfstandig draait', async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    baseURL: String(info.project.use.baseURL),
  })
  try {
    const page = await context.newPage()
    await page.goto('/login')
    await page.getByText('Gerechter als app', { exact: true }).click()
    await expect(page.getByText('Zet op beginscherm', { exact: false })).toBeVisible()
    await page.screenshot({ path: info.outputPath('ios-instructions.png') })
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
    await offline(context, [page], true)
    await offline(context, [page], false)
    await expect(page.getByText('Gerechter als app', { exact: true })).toHaveCount(0)
    await context.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }))
    await page.reload()
    await page.locator('html[data-hydrated]').waitFor()
    await expect(page.getByText('Gerechter als app', { exact: true })).toHaveCount(0)
  } finally {
    await context.close()
  }
})
