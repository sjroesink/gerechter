import { createHash, randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { createTestAuth, signUpWithSession, testEnv } from '../../../tests/auth'
import { setupTestDb } from '../../../tests/db'
import { createHousehold } from '../../../tests/fixtures'
import { listConnectedApps, revokeConnectedApp } from '~/domain/connected-apps'
import { loadUserCtx } from '~/domain/core'
import { createMcpRequestHandler } from './handler'

const db = setupTestDb()
const auth = createTestAuth(db)
const base = testEnv.PUBLIC_BASE_URL
const mcp = createMcpRequestHandler({ db, auth, env: testEnv })
const redirectUri = 'http://127.0.0.1:9876/callback'

// requireMcpAuth haalt de JWKS via HTTP op; stuur verzoeken naar onze eigen origin rechtstreeks naar Better Auth.
const realFetch = globalThis.fetch
beforeAll(() => {
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    return request.url.startsWith(base) ? auth.handler(request) : realFetch(request)
  })
})
afterAll(() => vi.unstubAllGlobals())

function call(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return auth.handler(new Request(`${base}${path}`, { ...init, headers: { origin: base, ...init.headers } }))
}

async function registerClient() {
  const res = await call('/api/auth/oauth2/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Testagent',
      application_type: 'native',
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }),
  })
  expect(res.status, await res.clone().text()).toBeLessThan(300)
  return ((await res.json()) as { client_id: string }).client_id
}

/** Doorloopt autoriseren → toestemming → token, zoals een MCP-client dat doet. */
async function authorize(cookie: string, accept: boolean) {
  const clientId = await registerClient()
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile email offline_access',
    state: 'xyz',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: `${base}/mcp`,
  })
  const authorizeRes = await call(`/api/auth/oauth2/authorize?${params}`, { headers: { cookie } })
  const consentUrl = new URL(authorizeRes.headers.get('location') ?? '', base)
  expect(consentUrl.pathname).toBe('/consent')

  const consentRes = await call('/api/auth/oauth2/consent', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ accept, oauth_query: consentUrl.search.slice(1) }),
  })
  const consentBody = (await consentRes.json()) as { url?: string; redirect_uri?: string }
  const callback = new URL(consentBody.url ?? consentBody.redirect_uri ?? '')
  const code = callback.searchParams.get('code')
  if (!code) return { clientId, callback, token: null }

  const tokenRes = await call('/api/auth/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
      resource: `${base}/mcp`,
    }).toString(),
  })
  expect(tokenRes.status, await tokenRes.clone().text()).toBe(200)
  const token = ((await tokenRes.json()) as { access_token: string }).access_token
  return { clientId, callback, token }
}

function rpc(token: string | null, body: unknown) {
  return mcp(
    new Request(`${base}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-06-18',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  )
}

async function rpcResult(res: Response) {
  const text = await res.text()
  const json = text.startsWith('{')
    ? text
    : text
        .split('\n')
        .find((l) => l.startsWith('data: '))!
        .slice(6)
  return JSON.parse(json) as {
    result: { content: { text: string }[]; isError?: boolean; tools?: { name: string }[] }
  }
}

describe('MCP-toegang', () => {
  test('zonder token: 401 met verwijzing naar de resource-metadata', async () => {
    const res = await rpc(null, { jsonrpc: '2.0', id: 1, method: 'tools/list' })
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toContain('resource_metadata=')
  })

  test('met een ongeldig token: 401 en geen tool uitgevoerd', async () => {
    const res = await rpc('niet-geldig', { jsonrpc: '2.0', id: 1, method: 'tools/list' })
    expect(res.status).toBe(401)
  })

  test('toestemming weigeren levert geen code en geen token op', async () => {
    const { headers } = await signUpWithSession(auth)
    const { callback, token } = await authorize(headers.get('cookie')!, false)
    expect(callback.searchParams.get('error')).toBe('access_denied')
    expect(token).toBeNull()
  })

  test('met toestemming: tools/list en whoami namens de gebruiker in het actieve huishouden', async () => {
    const { headers, userId } = await signUpWithSession(auth, 'Agentgebruiker')
    await createHousehold(db, userId, 'Agenthuis')
    const { token } = await authorize(headers.get('cookie')!, true)

    const list = await rpcResult(await rpc(token, { jsonrpc: '2.0', id: 1, method: 'tools/list' }))
    expect(list.result.tools?.map((t) => t.name)).toContain('whoami')

    const res = await rpc(token, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'whoami', arguments: {} },
    })
    const body = await rpcResult(res)
    const whoami = JSON.parse(body.result.content[0]!.text)
    expect(whoami.user.name).toBe('Agentgebruiker')
    expect(whoami.activeHousehold).toMatchObject({ name: 'Agenthuis', role: 'owner' })
    expect(whoami.households).toHaveLength(1)
  })

  test('zonder huishouden geeft een tool een foutmelding', async () => {
    const { headers } = await signUpWithSession(auth)
    const { token } = await authorize(headers.get('cookie')!, true)
    const body = await rpcResult(
      await rpc(token, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'whoami', arguments: {} },
      }),
    )
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0]!.text).toMatch(/geen lid van een huishouden/)
  })

  test('na intrekken van de toegang krijgt de client 401', async () => {
    const { headers, userId } = await signUpWithSession(auth)
    await createHousehold(db, userId)
    const { token } = await authorize(headers.get('cookie')!, true)
    const whoami = { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'whoami', arguments: {} } }
    expect((await rpc(token, whoami)).status).toBe(200)

    const ctx = await loadUserCtx(db, userId)
    const apps = await listConnectedApps(ctx)
    expect(apps.map((a) => a.name)).toEqual(['Testagent'])
    await revokeConnectedApp(ctx, apps[0]!.id)

    expect(await listConnectedApps(ctx)).toEqual([])
    expect((await rpc(token, whoami)).status).toBe(401)
  })
})
