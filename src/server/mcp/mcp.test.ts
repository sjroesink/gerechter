import { createHash, randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { createTestAuth, signUpWithSession, testEnv } from '../../../tests/auth'
import { setupTestDb } from '../../../tests/db'
import { addMember, createHousehold, createUser } from '../../../tests/fixtures'
import { listConnectedApps, revokeConnectedApp } from '~/domain/connected-apps'
import { Invalid, loadUserCtx, resolveCtx } from '~/domain/core'
import { removeMember } from '~/domain/households'
import type { RecipeImportDeps } from '../recipe-import'
import { createMcpRequestHandler } from './handler'

const db = setupTestDb()
const auth = createTestAuth(db)
const base = testEnv.PUBLIC_BASE_URL
// Receptimport zonder netwerk: vaste pagina's en afbeeldingen per URL.
const importPages: Record<string, { finalUrl: string; html: string }> = {}
const importImages: Record<string, Uint8Array> = {}
const recipeImport: RecipeImportDeps = {
  async fetchPage(url) {
    const page = importPages[url]
    if (!page) throw new Invalid('De pagina gaf status 404.')
    return page
  },
  async fetchImage(url) {
    const bytes = importImages[url]
    if (!bytes) throw new Invalid('De pagina gaf status 404.')
    return { bytes, finalUrl: url }
  },
}
const mcp = createMcpRequestHandler({ db, auth, env: testEnv, recipeImport })
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
    result: {
      content: { text: string }[]
      isError?: boolean
      tools?: { name: string }[]
      instructions?: string
    }
  }
}

describe('MCP-toegang', () => {
  test('ingrediëntfoto via OAuth behoudt bron en rechten en blijft staan bij een oude naamwijziging', async () => {
    const actor = await signUpWithSession(auth, 'Beeldagent')
    await createHousehold(db, actor.userId)
    const stranger = await signUpWithSession(auth, 'Andere beeldagent')
    await createHousehold(db, stranger.userId)
    const first = await authorize(actor.headers.get('cookie')!, true),
      second = await authorize(stranger.headers.get('cookie')!, true)
    async function invoke(token: string | null, name: string, args: Record<string, unknown>) {
      return (
        await rpcResult(
          await rpc(token, {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name, arguments: args },
          }),
        )
      ).result
    }
    const photo = {
      url: 'https://images.example.test/rijst.png',
      sourceUrl: 'https://example.test/rijst',
      credit: 'Testbron',
      licenseUrl: null,
    }
    const saved = await invoke(first.token, 'create_ingredient', { name: 'Beeldrijst', baseUnit: 'g', photo })
    expect(saved.isError).not.toBe(true)
    const item = JSON.parse(saved.content[0]!.text)
    expect(item.photo).toEqual(photo)
    await invoke(first.token, 'update_ingredient', {
      ingredientId: item.id,
      name: 'Beeldrijst hernoemd',
      aliases: [],
    })
    const read = JSON.parse(
      (await invoke(first.token, 'get_ingredient', { ingredientId: item.id })).content[0]!.text,
    )
    expect(read.photo).toEqual(photo)
    expect((await invoke(second.token, 'get_ingredient', { ingredientId: item.id })).isError).toBe(true)
    expect(
      (
        await invoke(second.token, 'update_ingredient', {
          ingredientId: item.id,
          name: 'Overnemen',
          photo: null,
        })
      ).isError,
    ).toBe(true)
    await invoke(first.token, 'update_ingredient', { ingredientId: item.id, name: read.name, photo: null })
    expect(
      JSON.parse((await invoke(first.token, 'get_ingredient', { ingredientId: item.id })).content[0]!.text)
        .photo,
    ).toBeNull()
  })

  test('huishoudwissel gebruikt actuele lidmaatschappen en schermt eerder gelezen privé-IDs af', async () => {
    const actor = await signUpWithSession(auth, 'Wisselende agentgebruiker')
    const owner = await createUser(db),
      stranger = await createUser(db)
    const first = await createHousehold(db, actor.userId, 'Agent eigen huis')
    const second = await createHousehold(db, owner.id, 'Agent gedeeld huis')
    const foreign = await createHousehold(db, stranger.id, 'Agent vreemd privéhuis')
    await addMember(db, second.id, actor.userId, 'member')
    const { token } = await authorize(actor.headers.get('cookie')!, true)
    async function invoke(name: string, args: Record<string, unknown> = {}) {
      return (
        await rpcResult(
          await rpc(token, {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name, arguments: args },
          }),
        )
      ).result
    }
    const initial = JSON.parse((await invoke('list_households')).content[0]!.text)
    expect(initial.activeHousehold.id).toBe(first.id)
    expect(initial.households).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id, role: 'owner' }),
        expect.objectContaining({ id: second.id, role: 'member' }),
      ]),
    )
    expect(initial.households).toHaveLength(2)
    const ingredient = JSON.parse(
      (await invoke('create_ingredient', { name: 'Privérijst', baseUnit: 'g' })).content[0]!.text,
    )
    const privateRecipe = JSON.parse(
      (
        await invoke('create_recipe', {
          name: 'Privégerecht voor wissel',
          servings: 2,
          ingredients: [{ ingredientId: ingredient.id, quantity: 100, unit: 'g' }],
        })
      ).content[0]!.text,
    )
    const denied = await invoke('switch_household', { householdId: foreign.id })
    expect(denied.isError).toBe(true)
    expect(denied.content[0]!.text).toBe('Huishouden niet gevonden.')
    expect((await resolveCtx(db, actor.userId)).household.id).toBe(first.id)
    const switched = JSON.parse(
      (await invoke('switch_household', { householdId: second.id })).content[0]!.text,
    )
    expect(switched.activeHousehold).toMatchObject({ id: second.id, role: 'member' })
    expect(JSON.parse((await invoke('whoami')).content[0]!.text).activeHousehold.id).toBe(second.id)
    expect((await invoke('get_recipe', { recipeId: privateRecipe.id })).isError).toBe(true)
    const sharedIngredient = JSON.parse(
      (await invoke('create_ingredient', { name: 'Gedeelde rijst', baseUnit: 'g' })).content[0]!.text,
    )
    const shared = await invoke('create_recipe', {
      name: 'Gedeeld gerecht na wissel',
      servings: 2,
      ingredients: [{ ingredientId: sharedIngredient.id, quantity: 100, unit: 'g' }],
    })
    expect(shared.isError).not.toBe(true)
    expect((await resolveCtx(db, actor.userId)).household.id).toBe(second.id)
    await removeMember(await resolveCtx(db, owner.id), actor.userId)
    expect(JSON.parse((await invoke('whoami')).content[0]!.text).activeHousehold.id).toBe(first.id)
    expect((await invoke('switch_household', { householdId: second.id })).isError).toBe(true)
    expect((await invoke('get_recipe', { recipeId: JSON.parse(shared.content[0]!.text).id })).isError).toBe(
      true,
    )
    expect((await invoke('get_recipe', { recipeId: privateRecipe.id })).isError).not.toBe(true)
  })

  test('werkwijzer beschrijft alle ontdekte tools en staat ook in initialize-instructies', async () => {
    const actor = await signUpWithSession(auth, 'Lezende agent')
    await createHousehold(db, actor.userId)
    const { token } = await authorize(actor.headers.get('cookie')!, true)
    const guideResult = (
      await rpcResult(
        await rpc(token, {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'get_agent_guide', arguments: {} },
        }),
      )
    ).result
    expect(guideResult.isError).not.toBe(true)
    const guide = JSON.parse(guideResult.content[0]!.text)
    const list = (await rpcResult(await rpc(token, { jsonrpc: '2.0', id: 2, method: 'tools/list' }))).result
    expect(Object.values(guide.workflows).flat().sort()).toEqual(list.tools!.map((item) => item.name).sort())
    expect(list.tools).toHaveLength(44)
    const initialized = await rpcResult(
      await rpc(token, {
        jsonrpc: '2.0',
        id: 3,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'Guide-test', version: '1' },
        },
      }),
    )
    expect(JSON.parse(initialized.result.instructions!)).toEqual(guide)
    expect(guide.rules.cooking).toContain('requestId')
    expect(guide.rules.exportRecovery).toContain('read-only')
    expect(guide.rules.instructions).toContain('get_instruction_format')
    expect(guideResult.content[0]!.text).not.toContain(testEnv.BETTER_AUTH_SECRET)
  })

  test('boodschappentools bewaken actuele behoefte, deelresultaat, herhaalveiligheid en afscherming', async () => {
    const first = await signUpWithSession(auth, 'Boodschappengebruiker A')
    const second = await signUpWithSession(auth, 'Boodschappengebruiker B')
    await createHousehold(db, first.userId, 'Boodschappenhuis A')
    await createHousehold(db, second.userId, 'Boodschappenhuis B')
    const a = await authorize(first.headers.get('cookie')!, true)
    const b = await authorize(second.headers.get('cookie')!, true)
    async function invoke(token: string | null, name: string, args: Record<string, unknown> = {}) {
      return (
        await rpcResult(
          await rpc(token, {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name, arguments: args },
          }),
        )
      ).result
    }
    const ingredient = JSON.parse(
      (await invoke(a.token, 'create_ingredient', { name: 'Boodschappenrijst', baseUnit: 'g' })).content[0]!
        .text,
    )
    await invoke(a.token, 'set_pantry_item', {
      ingredientId: ingredient.id,
      quantity: 300,
      unit: 'g',
      staple: false,
      version: 0,
    })
    const recipe = JSON.parse(
      (
        await invoke(a.token, 'create_recipe', {
          name: 'Boodschappengerecht',
          servings: 2,
          ingredients: [{ ingredientId: ingredient.id, quantity: 500, unit: 'g' }],
        })
      ).content[0]!.text,
    )
    const source = { kind: 'recipe', recipeId: recipe.id, servings: 2 }
    const preview = JSON.parse((await invoke(a.token, 'prepare_shopping', source)).content[0]!.text)
    expect(preview.proposal.lines).toEqual(['200 g · Boodschappenrijst'])
    const targetStatus = await invoke(a.token, 'get_shopping_targets')
    expect(targetStatus.isError).not.toBe(true)
    expect(targetStatus.content[0]!.text).not.toContain('encryptedSecret')
    const input = {
      source: preview.proposal.source,
      requestId: preview.proposal.requestId,
      fingerprint: preview.proposal.fingerprint,
      target: 'share',
    }
    const created = await invoke(a.token, 'start_shopping_export', input)
    expect(created.isError).not.toBe(true)
    const run = JSON.parse(created.content[0]!.text)
    expect(run.status).toBe('pending')
    const confirmed = await invoke(a.token, 'confirm_shopping_share', { runId: run.id, outcome: 'copied' })
    expect(JSON.parse(confirmed.content[0]!.text).status).toBe('copied')
    expect(JSON.parse((await invoke(a.token, 'start_shopping_export', input)).content[0]!.text).id).toBe(
      run.id,
    )
    expect((await invoke(a.token, 'get_shopping_export', { runId: run.id })).content[0]!.text).toContain(
      '200 g · Boodschappenrijst',
    )
    expect((await invoke(a.token, 'list_shopping_exports')).content[0]!.text).toContain(run.id)
    expect((await invoke(b.token, 'list_shopping_exports')).content[0]!.text).not.toContain(run.id)
    for (const [name, args] of [
      ['get_shopping_export', { runId: run.id }],
      ['confirm_shopping_share', { runId: run.id, outcome: 'copied' }],
      ['check_shopping_export', { runId: run.id }],
      ['prepare_shopping', source],
    ] as const)
      expect((await invoke(b.token, name, args)).isError).toBe(true)
    expect(
      (await invoke(a.token, 'start_shopping_export', { ...input, requestId: crypto.randomUUID() })).isError,
    ).toBe(true)
    await invoke(a.token, 'set_pantry_item', {
      ingredientId: ingredient.id,
      quantity: 50,
      unit: 'g',
      staple: false,
      version: 1,
    })
    const stale = await invoke(a.token, 'start_shopping_export', {
      ...input,
      requestId: crypto.randomUUID(),
      allowRepeat: true,
    })
    expect(stale.isError).toBe(true)
    expect(stale.content[0]!.text).toMatch(/behoefte is gewijzigd/)
  })

  test('gemaakttools bevestigen eenmaal, bewaren beoordelingen en schermen bronnen en events af', async () => {
    const first = await signUpWithSession(auth, 'Kok A')
    const second = await signUpWithSession(auth, 'Kok B')
    await createHousehold(db, first.userId, 'Kookhuis A')
    await createHousehold(db, second.userId, 'Kookhuis B')
    const a = await authorize(first.headers.get('cookie')!, true)
    const b = await authorize(second.headers.get('cookie')!, true)
    async function invoke(token: string | null, name: string, args: Record<string, unknown> = {}) {
      return (
        await rpcResult(
          await rpc(token, {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name, arguments: args },
          }),
        )
      ).result
    }
    const ingredient = JSON.parse(
      (await invoke(a.token, 'create_ingredient', { name: 'Kookrijst', baseUnit: 'g' })).content[0]!.text,
    )
    expect(
      (
        await invoke(a.token, 'set_pantry_item', {
          ingredientId: ingredient.id,
          quantity: 800,
          unit: 'g',
          staple: false,
          version: 0,
        })
      ).isError,
    ).not.toBe(true)
    const recipe = JSON.parse(
      (
        await invoke(a.token, 'create_recipe', {
          name: 'Kookgerecht',
          servings: 2,
          ingredients: [{ ingredientId: ingredient.id, quantity: 400, unit: 'g' }],
        })
      ).content[0]!.text,
    )
    const prep = JSON.parse(
      (await invoke(a.token, 'prepare_cooking', { recipeId: recipe.id })).content[0]!.text,
    )
    expect(prep.deductions[0]).toMatchObject({ required: 400, proposed: 400, available: 800 })
    const input = {
      requestId: prep.requestId,
      recipeId: prep.recipeId,
      recipeVersion: prep.recipeVersion,
      servings: prep.servings,
      date: prep.date,
      deductions: [
        { ingredientId: ingredient.id, quantity: 300, pantryVersion: prep.deductions[0].pantryVersion },
      ],
      rating: { score: 8, note: 'Via MCP bewust bevestigd' },
    }
    const recorded = await invoke(a.token, 'record_made', input)
    expect(recorded.isError).not.toBe(true)
    const event = JSON.parse(recorded.content[0]!.text)
    expect(event.deductions[0]).toMatchObject({ quantity: 300, remainingQuantity: 500 })
    expect(JSON.parse((await invoke(a.token, 'record_made', input)).content[0]!.text).id).toBe(event.id)
    expect(
      JSON.parse(
        (await invoke(a.token, 'get_pantry_item', { ingredientId: ingredient.id })).content[0]!.text,
      ),
    ).toMatchObject({ quantity: 500, version: 2 })
    expect(
      (await invoke(a.token, 'search_cooking_history', { query: 'Kookgerecht' })).content[0]!.text,
    ).toContain(event.id)
    expect((await invoke(b.token, 'search_cooking_history')).content[0]!.text).not.toContain(event.id)
    for (const [name, args] of [
      ['get_made_event', { eventId: event.id }],
      ['set_my_made_rating', { eventId: event.id, score: 10 }],
      ['prepare_cooking', { recipeId: recipe.id }],
      ['record_made', { ...input, requestId: crypto.randomUUID() }],
    ] as const)
      expect((await invoke(b.token, name, args)).isError).toBe(true)
    const rated = await invoke(a.token, 'set_my_made_rating', {
      eventId: event.id,
      score: 9,
      note: 'Nogmaals geproefd',
    })
    expect(rated.isError).not.toBe(true)
    expect(JSON.parse(rated.content[0]!.text).ratings).toEqual([
      expect.objectContaining({ score: 9, isMe: true }),
    ])
    expect((await invoke(a.token, 'record_made', { ...input, servings: 3 })).isError).toBe(true)
    const read = await invoke(a.token, 'get_made_event', { eventId: event.id })
    expect(JSON.parse(read.content[0]!.text).snapshot.name).toBe('Kookgerecht')
  })

  test('planningtools tonen kalenderweken, schalen gerechten en controleren versie en huishouden', async () => {
    const first = await signUpWithSession(auth, 'Planner A')
    const second = await signUpWithSession(auth, 'Planner B')
    await createHousehold(db, first.userId, 'Planhuis A')
    await createHousehold(db, second.userId, 'Planhuis B')
    const a = await authorize(first.headers.get('cookie')!, true)
    const b = await authorize(second.headers.get('cookie')!, true)
    async function invoke(token: string | null, name: string, args: Record<string, unknown> = {}) {
      return (
        await rpcResult(
          await rpc(token, {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name, arguments: args },
          }),
        )
      ).result
    }
    const ingredient = JSON.parse(
      (await invoke(a.token, 'create_ingredient', { name: 'Planningsrijst', baseUnit: 'g' })).content[0]!
        .text,
    )
    const recipe = JSON.parse(
      (
        await invoke(a.token, 'create_recipe', {
          name: 'MCP plangerecht',
          servings: 2,
          ingredients: [{ ingredientId: ingredient.id, quantity: 200, unit: 'g' }],
        })
      ).content[0]!.text,
    )
    const input = {
      kind: 'recipe',
      recipeId: recipe.id,
      date: '2027-01-01',
      servings: 3,
      note: 'Nieuwjaarsmaaltijd',
    }
    const created = await invoke(a.token, 'create_planned_meal', input)
    expect(created.isError).not.toBe(true)
    const meal = JSON.parse(created.content[0]!.text)
    expect(meal.recipe.ingredients[0].scaledQuantity).toBe(300)
    const week = JSON.parse((await invoke(a.token, 'get_week_plan', { date: input.date })).content[0]!.text)
    expect(week).toMatchObject({ start: '2026-12-28', end: '2027-01-03' })
    expect(week.days[4].items[0].id).toBe(meal.id)
    expect((await invoke(a.token, 'get_day_plan', { date: input.date })).content[0]!.text).toContain(meal.id)
    expect((await invoke(b.token, 'get_day_plan', { date: input.date })).content[0]!.text).not.toContain(
      meal.id,
    )
    for (const [name, args] of [
      ['get_planned_meal', { mealId: meal.id }],
      ['update_planned_meal', { mealId: meal.id, input: { ...input, version: 1 } }],
      ['remove_planned_meal', { mealId: meal.id, version: 1 }],
      ['create_planned_meal', input],
    ] as const)
      expect((await invoke(b.token, name, args)).isError).toBe(true)
    const changed = await invoke(a.token, 'update_planned_meal', {
      mealId: meal.id,
      input: { kind: 'free', date: '2027-01-04', title: 'Restjes', version: 1 },
    })
    expect(changed.isError).not.toBe(true)
    expect(JSON.parse(changed.content[0]!.text)).toMatchObject({
      title: 'Restjes',
      recipe: null,
      effectiveServings: null,
      version: 2,
    })
    expect(
      (await invoke(a.token, 'update_planned_meal', { mealId: meal.id, input: { ...input, version: 1 } }))
        .isError,
    ).toBe(true)
    expect((await invoke(a.token, 'create_planned_meal', { ...input, date: '2026-02-30' })).isError).toBe(
      true,
    )
    expect((await invoke(a.token, 'remove_planned_meal', { mealId: meal.id, version: 1 })).isError).toBe(true)
    expect((await invoke(a.token, 'remove_planned_meal', { mealId: meal.id, version: 2 })).isError).not.toBe(
      true,
    )
    expect((await invoke(a.token, 'get_planned_meal', { mealId: meal.id })).isError).toBe(true)
  })

  test('voorraad- en voorkeurtools blijven gescopeerd en schrijven controleerbare tellingen', async () => {
    const first = await signUpWithSession(auth, 'Voorraadgebruiker A')
    const second = await signUpWithSession(auth, 'Voorraadgebruiker B')
    await createHousehold(db, first.userId, 'Voorraadhuis A')
    await createHousehold(db, second.userId, 'Voorraadhuis B')
    const a = await authorize(first.headers.get('cookie')!, true)
    const b = await authorize(second.headers.get('cookie')!, true)
    async function invoke(token: string | null, name: string, args: Record<string, unknown> = {}) {
      return (
        await rpcResult(
          await rpc(token, {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name, arguments: args },
          }),
        )
      ).result
    }
    const ingredient = JSON.parse(
      (await invoke(a.token, 'create_ingredient', { name: 'MCP voorraadrĳst', baseUnit: 'g' })).content[0]!
        .text,
    )
    const itemArgs = { ingredientId: ingredient.id }
    expect(JSON.parse((await invoke(a.token, 'get_pantry_item', itemArgs)).content[0]!.text).version).toBe(0)
    const count = { ...itemArgs, quantity: 1.5, unit: 'kg', staple: true, version: 0, note: 'MCP telling' }
    const created = await invoke(a.token, 'set_pantry_item', count)
    expect(created.isError).not.toBe(true)
    expect(JSON.parse(created.content[0]!.text)).toMatchObject({ quantity: 1500, version: 1, staple: true })
    expect((await invoke(a.token, 'get_pantry')).content[0]!.text).toContain(ingredient.id)
    expect((await invoke(a.token, 'set_pantry_item', count)).isError).toBe(true)
    for (const [name, args] of [
      ['get_pantry_item', itemArgs],
      ['get_pantry_history', itemArgs],
      ['set_pantry_item', { ...count, version: 1 }],
      ['remove_pantry_item', { ...itemArgs, version: 1 }],
    ] as const)
      expect((await invoke(b.token, name, args)).isError).toBe(true)
    expect((await invoke(b.token, 'get_pantry')).content[0]!.text).not.toContain(ingredient.id)
    expect((await invoke(a.token, 'set_pantry_item', { ...count, version: 1, unit: 'snuf' })).isError).toBe(
      true,
    )
    const history = JSON.parse((await invoke(a.token, 'get_pantry_history', itemArgs)).content[0]!.text)
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      note: 'MCP telling',
      actorName: 'Voorraadgebruiker A',
      quantity: 1500,
    })
    expect((await invoke(a.token, 'remove_pantry_item', { ...itemArgs, version: 1 })).isError).not.toBe(true)
    expect(JSON.parse((await invoke(a.token, 'get_pantry')).content[0]!.text)).toEqual([])
    expect(JSON.parse((await invoke(a.token, 'get_pantry_history', itemArgs)).content[0]!.text)).toHaveLength(
      2,
    )
    expect((await invoke(a.token, 'set_household_preferences', { defaultServings: 4 })).isError).not.toBe(
      true,
    )
    expect(JSON.parse((await invoke(a.token, 'get_household_preferences')).content[0]!.text)).toEqual({
      defaultServings: 4,
    })
    expect(JSON.parse((await invoke(b.token, 'get_household_preferences')).content[0]!.text)).toEqual({
      defaultServings: 2,
    })
    expect((await invoke(a.token, 'set_household_preferences', { defaultServings: 0 })).isError).toBe(true)
  })

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

  test('een verwijderd lid verliest direct MCP-toegang, ook met een nog geldig token', async () => {
    const owner = await createUser(db)
    const household = await createHousehold(db, owner.id)
    const { headers, userId } = await signUpWithSession(auth, 'Verwijderd lid')
    await addMember(db, household.id, userId, 'member')
    const { token } = await authorize(headers.get('cookie')!, true)
    const whoami = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'whoami', arguments: {} } }
    expect((await rpcResult(await rpc(token, whoami))).result.isError).not.toBe(true)

    await removeMember(await resolveCtx(db, owner.id), userId)

    const result = (await rpcResult(await rpc(token, whoami))).result
    expect(result.isError).toBe(true)
    expect(result.content[0]!.text).toMatch(/geen lid van een huishouden/)
    expect(result.content[0]!.text).not.toContain(household.id)
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

  test('catalogustools werken namens het token en houden huishoudens afgeschermd', async () => {
    const first = await signUpWithSession(auth, 'Catalogusgebruiker A')
    const second = await signUpWithSession(auth, 'Catalogusgebruiker B')
    await createHousehold(db, first.userId, 'Catalogushuis A')
    await createHousehold(db, second.userId, 'Catalogushuis B')
    const a = await authorize(first.headers.get('cookie')!, true)
    const b = await authorize(second.headers.get('cookie')!, true)
    async function invoke(token: string | null, name: string, args: Record<string, unknown> = {}) {
      return (
        await rpcResult(
          await rpc(token, {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name, arguments: args },
          }),
        )
      ).result
    }
    const units = await invoke(a.token, 'list_units')
    expect(units.isError).not.toBe(true)
    expect(units.content[0]!.text).toContain('milliliter')

    const created = await invoke(a.token, 'create_ingredient', {
      name: 'MCP tomaten',
      baseUnit: 'g',
      aliases: ['MCP paradeiser'],
    })
    expect(created.isError).not.toBe(true)
    const item = JSON.parse(created.content[0]!.text) as { id: string }
    expect(
      (await invoke(a.token, 'search_ingredients', { query: 'MCP paradeiser' })).content[0]!.text,
    ).toContain(item.id)
    expect(
      (await invoke(b.token, 'search_ingredients', { query: 'MCP paradeiser' })).content[0]!.text,
    ).not.toContain(item.id)
    const hidden = await invoke(b.token, 'get_ingredient', { ingredientId: item.id })
    expect(hidden.isError).toBe(true)
    expect(hidden.content[0]!.text).toMatch(/niet gevonden/)
    expect(
      (await invoke(b.token, 'set_ingredient_conversion', { ingredientId: item.id, unit: 'blik', factor: 1 }))
        .isError,
    ).toBe(true)

    const converted = await invoke(a.token, 'set_ingredient_conversion', {
      ingredientId: item.id,
      unit: 'blik',
      factor: 400,
    })
    expect(converted.isError).not.toBe(true)
    expect(JSON.parse(converted.content[0]!.text).conversions).toEqual([{ unit: 'blik', factor: 400 }])
    expect(
      (
        await invoke(a.token, 'update_ingredient', {
          ingredientId: item.id,
          name: 'MCP tomatenblokjes',
          aliases: [],
        })
      ).isError,
    ).not.toBe(true)
    expect(
      (await invoke(a.token, 'set_ingredient_archived', { ingredientId: item.id, archived: true })).isError,
    ).not.toBe(true)
    expect(
      (await invoke(a.token, 'search_ingredients', { query: 'MCP tomatenblokjes' })).content[0]!.text,
    ).not.toContain(item.id)
    expect((await invoke(a.token, 'get_ingredient', { ingredientId: item.id })).content[0]!.text).toContain(
      item.id,
    )
    expect(
      (await invoke(a.token, 'set_ingredient_archived', { ingredientId: item.id, archived: false })).isError,
    ).not.toBe(true)
    const removed = await invoke(a.token, 'remove_ingredient_conversion', {
      ingredientId: item.id,
      unit: 'blik',
    })
    expect(JSON.parse(removed.content[0]!.text).conversions).toEqual([])
    expect(
      (
        await invoke(a.token, 'create_ingredient', {
          name: 'MCP verboden globaal',
          baseUnit: 'g',
          scope: 'global',
        })
      ).isError,
    ).toBe(true)

    const invalid = await rpcResult(
      await rpc(a.token, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'create_ingredient',
          arguments: { name: 'MCP bypass', baseUnit: 'g', householdId: 'ander-huishouden' },
        },
      }),
    )
    expect(invalid.result?.isError ?? 'error' in invalid).toBe(true)
    expect(
      (await invoke(a.token, 'search_ingredients', { query: 'MCP bypass' })).content[0]!.text,
    ).not.toContain('MCP bypass')
  })

  test('recepttools gebruiken OAuth, versiecontrole, echte ingrediënten en vaste instructies', async () => {
    const first = await signUpWithSession(auth, 'Receptgebruiker A')
    const second = await signUpWithSession(auth, 'Receptgebruiker B')
    await createHousehold(db, first.userId, 'Recepthuis A')
    await createHousehold(db, second.userId, 'Recepthuis B')
    const a = await authorize(first.headers.get('cookie')!, true)
    const b = await authorize(second.headers.get('cookie')!, true)
    async function invoke(token: string | null, name: string, args: Record<string, unknown> = {}) {
      return (
        await rpcResult(
          await rpc(token, {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name, arguments: args },
          }),
        )
      ).result
    }
    const format = await invoke(a.token, 'get_instruction_format')
    expect(format.isError).not.toBe(true)
    const instructions = JSON.parse(format.content[0]!.text)
    expect(instructions.example).toContain('RecipeSteps')
    const ingredientResult = await invoke(a.token, 'create_ingredient', {
      name: 'MCP recepttomaat',
      baseUnit: 'g',
    })
    const ingredient = JSON.parse(ingredientResult.content[0]!.text)
    const input = {
      name: 'MCP tomatensoep',
      servings: 2,
      tags: ['soep'],
      ingredients: [{ ingredientId: ingredient.id, quantity: 400, unit: 'g' }],
      sections: [{ id: 'cooking', text: 'Verwarm en pureer.', openUi: instructions.example }],
    }
    const created = await invoke(a.token, 'create_recipe', input)
    expect(created.isError).not.toBe(true)
    const recipe = JSON.parse(created.content[0]!.text)
    expect(recipe.version).toBe(1)
    const scaled = JSON.parse(
      (await invoke(a.token, 'get_recipe', { recipeId: recipe.id, servings: 4 })).content[0]!.text,
    )
    expect(scaled.ingredients[0].quantity).toBe(400)
    expect(scaled.ingredients[0].scaledQuantity).toBe(800)
    expect(scaled.ingredients[0].baseQuantity).toBe(800)
    expect((await invoke(a.token, 'search_recipes', { query: 'soep' })).content[0]!.text).toContain(recipe.id)
    expect((await invoke(b.token, 'search_recipes', { query: 'soep' })).content[0]!.text).not.toContain(
      recipe.id,
    )
    for (const [name, args] of [
      ['get_recipe', { recipeId: recipe.id }],
      ['update_recipe', { ...input, recipeId: recipe.id, version: 1 }],
      ['set_recipe_archived', { recipeId: recipe.id, archived: true }],
      ['create_recipe', input],
    ] as const)
      expect((await invoke(b.token, name, args)).isError).toBe(true)
    const updated = await invoke(a.token, 'update_recipe', {
      ...input,
      name: 'MCP snelle soep',
      recipeId: recipe.id,
      version: 1,
    })
    expect(updated.isError).not.toBe(true)
    expect(JSON.parse(updated.content[0]!.text).version).toBe(2)
    expect(
      (await invoke(a.token, 'update_recipe', { ...input, recipeId: recipe.id, version: 1 })).isError,
    ).toBe(true)
    expect(
      (
        await invoke(a.token, 'create_recipe', {
          ...input,
          sections: [{ id: 'cooking', text: '', openUi: 'root = Button("Run", mutate("delete"))' }],
        })
      ).isError,
    ).toBe(true)
    expect(
      (await invoke(a.token, 'set_recipe_archived', { recipeId: recipe.id, archived: true })).isError,
    ).not.toBe(true)
    expect(
      (await invoke(a.token, 'search_recipes', { query: 'MCP snelle soep' })).content[0]!.text,
    ).not.toContain(recipe.id)
    expect((await invoke(a.token, 'get_recipe', { recipeId: recipe.id })).content[0]!.text).toContain(
      recipe.id,
    )
    expect(
      (await invoke(a.token, 'set_recipe_archived', { recipeId: recipe.id, archived: false })).isError,
    ).not.toBe(true)
    const stored = JSON.parse((await invoke(a.token, 'get_recipe', { recipeId: recipe.id })).content[0]!.text)
    expect(stored.ingredients[0].quantity).toBe(400)
    expect(stored.sections[0].openUi).toBe(instructions.example)
  })

  test('receptimport leest een URL uit, bewaart de foto zelf en herkent een eerdere import', async () => {
    const first = await signUpWithSession(auth, 'Importeur A')
    const second = await signUpWithSession(auth, 'Importeur B')
    await createHousehold(db, first.userId, 'Importhuis A')
    await createHousehold(db, second.userId, 'Importhuis B')
    const a = await authorize(first.headers.get('cookie')!, true)
    const b = await authorize(second.headers.get('cookie')!, true)
    async function invoke(token: string | null, name: string, args: Record<string, unknown> = {}) {
      return (
        await rpcResult(
          await rpc(token, {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name, arguments: args },
          }),
        )
      ).result
    }
    const jsonLd = JSON.stringify({
      '@type': 'Recipe',
      name: 'Linzensoep',
      recipeYield: '4 porties',
      cookTime: 'PT30M',
      recipeIngredient: ['250 g rode linzen', '1 ui'],
      recipeInstructions: [{ '@type': 'HowToStep', text: 'Kook de linzen gaar.' }],
      image: '/foto/linzensoep.png',
    })
    importPages['https://kook.example.com/r/123'] = {
      finalUrl: 'https://kook.example.com/recepten/linzensoep',
      html: `<html><head><script type="application/ld+json">${jsonLd}</script></head><body></body></html>`,
    }
    importImages['https://kook.example.com/foto/linzensoep.png'] = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7,
    ])

    const fetched = await invoke(a.token, 'fetch_recipe_from_url', { url: 'https://kook.example.com/r/123' })
    expect(fetched.isError).not.toBe(true)
    const draft = JSON.parse(fetched.content[0]!.text)
    expect(draft).toMatchObject({
      structured: true,
      sourceUrl: 'https://kook.example.com/recepten/linzensoep',
      existingRecipe: null,
      name: 'Linzensoep',
      servings: 4,
      cookMinutes: 30,
      ingredientLines: ['250 g rode linzen', '1 ui'],
      imageUrl: 'https://kook.example.com/foto/linzensoep.png',
    })
    const lentils = JSON.parse(
      (await invoke(a.token, 'create_ingredient', { name: 'Rode linzen import', baseUnit: 'g' })).content[0]!
        .text,
    )
    const created = await invoke(a.token, 'create_recipe', {
      name: draft.name,
      servings: draft.servings,
      cookMinutes: draft.cookMinutes,
      sourceUrl: draft.sourceUrl,
      photoUrl: draft.imageUrl,
      ingredients: [{ ingredientId: lentils.id, quantity: 250, unit: 'g' }],
      sections: [{ id: 'cooking', text: draft.steps[0].text, openUi: '' }],
    })
    expect(created.isError).not.toBe(true)
    const recipe = JSON.parse(created.content[0]!.text)
    expect(recipe.photoUrl).toBe(draft.imageUrl)
    expect(recipe.imageUrl).toMatch(/^\/afbeeldingen\//)
    expect(recipe).not.toHaveProperty('photoWarning')

    const again = JSON.parse(
      (await invoke(a.token, 'fetch_recipe_from_url', { url: 'https://kook.example.com/r/123' })).content[0]!
        .text,
    )
    expect(again.existingRecipe).toEqual({ id: recipe.id, name: 'Linzensoep', archived: false })
    const other = JSON.parse(
      (await invoke(b.token, 'fetch_recipe_from_url', { url: 'https://kook.example.com/r/123' })).content[0]!
        .text,
    )
    expect(other.existingRecipe).toBeNull()

    const missing = await invoke(a.token, 'fetch_recipe_from_url', { url: 'https://kook.example.com/weg' })
    expect(missing.isError).toBe(true)
    expect(missing.content[0]!.text).toContain('404')
    expect((await invoke(a.token, 'fetch_recipe_from_url', { url: 'geen url' })).isError).toBe(true)
  })
})
