import { createHash, randomBytes } from 'node:crypto'
import type { APIRequestContext, Page } from '@playwright/test'
import { E2E_BASE_URL } from '../playwright.config'
import { admin, PASSWORD, submitLogin } from './helpers'
import { expect, test } from './test'

const redirectUri = 'http://127.0.0.1:9876/callback'

async function registerClient(request: APIRequestContext, name: string) {
  const res = await request.post('/api/auth/oauth2/register', {
    data: {
      client_name: name,
      application_type: 'native',
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
  })
  expect(res.ok(), await res.text()).toBe(true)
  return ((await res.json()) as { client_id: string }).client_id
}

/** Start de OAuth-flow in de browser, zoals een MCP-client dat doet, en vangt de callback af. */
async function startAuthorization(page: Page, request: APIRequestContext, name: string) {
  const clientId = await registerClient(request, name)
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  let callback: URL | undefined
  await page.route('http://127.0.0.1:9876/**', async (route) => {
    callback = new URL(route.request().url())
    await route.fulfill({ body: 'klaar' })
  })
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile email offline_access',
    state: 'e2e',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: `${E2E_BASE_URL}/mcp`,
  })
  await page.goto(`/api/auth/oauth2/authorize?${params}`)
  return { clientId, verifier, getCallback: () => callback }
}

async function callWhoami(request: APIRequestContext, token: string) {
  return request.post('/mcp', {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-06-18',
    },
    data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'whoami', arguments: {} } },
  })
}

test('agent koppelen: inloggen, toestemming geven, whoami aanroepen en daarna intrekken', async ({
  page,
  request,
}) => {
  const flow = await startAuthorization(page, request, 'E2E-agent')
  await expect(page).toHaveURL(/\/login/)
  await submitLogin(page, admin.email, PASSWORD)

  await expect(page).toHaveURL(/\/consent/)
  await expect(page.getByRole('heading', { name: 'Toegang geven', exact: true })).toBeVisible()
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  await page.getByRole('button', { name: 'Toestaan' }).click()
  await expect.poll(() => flow.getCallback()?.searchParams.get('code')).toBeTruthy()

  const tokenRes = await request.post('/api/auth/oauth2/token', {
    form: {
      grant_type: 'authorization_code',
      code: flow.getCallback()!.searchParams.get('code')!,
      redirect_uri: redirectUri,
      client_id: flow.clientId,
      code_verifier: flow.verifier,
      resource: `${E2E_BASE_URL}/mcp`,
    },
  })
  expect(tokenRes.ok(), await tokenRes.text()).toBe(true)
  const { access_token: token } = (await tokenRes.json()) as { access_token: string }

  const whoami = await callWhoami(request, token)
  expect(whoami.status()).toBe(200)
  expect(await whoami.text()).toContain(admin.email)

  await page.goto('/meer/verbonden-apps')
  const row = page.getByRole('listitem').filter({ hasText: 'E2E-agent' })
  await expect(row).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await row.getByRole('button', { name: 'Intrekken' }).click()
  await expect(page.getByRole('heading', { name: 'Nog geen verbonden apps', exact: true })).toBeVisible()

  expect((await callWhoami(request, token)).status()).toBe(401)
})

test('toestemming weigeren geeft de agent geen code', async ({ page, request }) => {
  const flow = await startAuthorization(page, request, 'Geweigerde agent')
  await submitLogin(page, admin.email, PASSWORD)
  await expect(page).toHaveURL(/\/consent/)
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  await page.getByRole('button', { name: 'Weigeren' }).click()
  await expect.poll(() => flow.getCallback()?.searchParams.get('error')).toBe('access_denied')
  expect(flow.getCallback()?.searchParams.get('code')).toBeNull()
})

test('whoami toont per gebruiker alleen de eigen huishoudens', async ({ page, request }) => {
  const flow = await startAuthorization(page, request, 'Agent van Sanne')
  await submitLogin(page, 'sanne@e2e.test', PASSWORD)
  await expect(page).toHaveURL(/\/consent/)
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  await page.getByRole('button', { name: 'Toestaan' }).click()
  await expect.poll(() => flow.getCallback()?.searchParams.get('code')).toBeTruthy()

  const tokenRes = await request.post('/api/auth/oauth2/token', {
    form: {
      grant_type: 'authorization_code',
      code: flow.getCallback()!.searchParams.get('code')!,
      redirect_uri: redirectUri,
      client_id: flow.clientId,
      code_verifier: flow.verifier,
      resource: `${E2E_BASE_URL}/mcp`,
    },
  })
  const { access_token: token } = (await tokenRes.json()) as { access_token: string }
  const text = await (await callWhoami(request, token)).text()
  expect(text).toContain('sanne@e2e.test')
  expect(text).toContain('Familie de Vries')
  expect(text).not.toContain('Huishouden van Beheerder')
})
