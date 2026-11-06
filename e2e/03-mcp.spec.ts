import { createHash, randomBytes } from 'node:crypto'
import type { APIRequestContext, Page } from '@playwright/test'
import { E2E_BASE_URL } from '../playwright.config'
import { admin, expectMobileLayout, PASSWORD, submitLogin } from './helpers'
import { expect, test } from './test'

const redirectUri = 'http://127.0.0.1:9876/callback'

test('OAuth-discovery publiceert metadata voor de MCP-resource en de autorisatieserver', async ({
  request,
}) => {
  const resource = await request.get('/.well-known/oauth-protected-resource/mcp')
  expect(resource.status()).toBe(200)
  const metadata = await resource.json()
  expect(metadata.resource).toBe(`${E2E_BASE_URL}/mcp`)
  expect(metadata.authorization_servers).toEqual([`${E2E_BASE_URL}/api/auth`])

  const server = await request.get('/.well-known/oauth-authorization-server/api/auth')
  expect(server.status()).toBe(200)
  expect(await server.json()).toMatchObject({
    issuer: `${E2E_BASE_URL}/api/auth`,
    authorization_endpoint: `${E2E_BASE_URL}/api/auth/oauth2/authorize`,
    token_endpoint: `${E2E_BASE_URL}/api/auth/oauth2/token`,
    code_challenge_methods_supported: expect.arrayContaining(['S256']),
  })
})

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
  return callTool(request, token, 'whoami')
}
async function callTool(
  request: APIRequestContext,
  token: string,
  name: string,
  args: Record<string, unknown> = {},
) {
  return request.post('/mcp', {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-06-18',
    },
    data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
  })
}
async function readTool(response: Awaited<ReturnType<typeof callTool>>) {
  const text = await response.text()
  const body = JSON.parse(
    text.startsWith('{')
      ? text
      : text
          .split('\n')
          .find((line) => line.startsWith('data: '))!
          .slice(6),
  )
  return body.result as { isError?: boolean; content: { text: string }[] }
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
  await expectMobileLayout(page)
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

  const households = JSON.parse(
    (await readTool(await callTool(request, token, 'list_households'))).content[0]!.text,
  )
  const original = households.activeHousehold.id
  const other = households.households.find((item: { id: string }) => item.id !== original)
  expect(other).toMatchObject({ name: 'Familie de Vries', role: 'member' })
  const switched = await readTool(
    await callTool(request, token, 'switch_household', { householdId: other.id }),
  )
  expect(switched.isError).not.toBe(true)
  await page.goto('/meer')
  await expect(page.getByRole('combobox', { name: 'Huishouden' })).toHaveValue(other.id)
  await expectMobileLayout(page)
  const denied = await readTool(
    await callTool(request, token, 'switch_household', { householdId: crypto.randomUUID() }),
  )
  expect(denied.isError).toBe(true)
  expect(denied.content[0]!.text).toBe('Huishouden niet gevonden.')
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Huishouden' })).toHaveValue(other.id)
  await page.getByRole('combobox', { name: 'Huishouden' }).selectOption(original)
  await expect(page.getByRole('link', { name: /^Huishouden/ })).toContainText('Huishouden van Beheerder')
  expect(
    JSON.parse((await readTool(await callWhoami(request, token))).content[0]!.text).activeHousehold.id,
  ).toBe(original)

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
