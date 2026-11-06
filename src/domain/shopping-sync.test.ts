import { eq } from 'drizzle-orm'
import { describe, expect, test, vi } from 'vitest'
import { shoppingConnection, syncRun, syncSourceClaim } from '~/db/schema'
import { setupTestDb } from '../../tests/db'
import { addMember, twoHouseholds } from '../../tests/fixtures'
import { createIngredient } from './catalog'
import { Conflict, Forbidden, NotFound } from './core'
import { setPantryItem } from './pantry'
import { createPlannedMeal } from './planning'
import { createRecipe } from './recipes'
import { prepareShopping } from './shopping-needs'
import {
  checkShoppingSync,
  confirmShoppingShare,
  getShoppingPreview,
  getShoppingTargets,
  getAhConnectionReference,
  getSyncRun,
  listSyncRuns,
  removeShoppingConnection,
  saveNotionConnection,
  saveAhConnection,
  startShoppingExport,
} from './shopping-sync'
import type { ShoppingDeps, ShoppingProviderResult, ShoppingTarget } from './shopping-target'

const db = setupTestDb()
const SECRET = 'shopping-test-secret-with-at-least-32-characters'
async function setup() {
  const { a, b } = await twoHouseholds(db)
  const tomato = await createIngredient(a, { name: 'Tomaten', baseUnit: 'g' })
  const recipe = await createRecipe(a, {
    name: 'Exportsoep',
    servings: 2,
    ingredients: [{ ingredientId: tomato.id, quantity: 400, unit: 'g' }],
  })
  const source = { kind: 'recipe' as const, recipeId: recipe.id, servings: 2 }
  const proposal = await prepareShopping(a, source)
  const send = vi.fn<ShoppingTarget['send']>(async () => ({
    status: 'succeeded',
    externalId: crypto.randomUUID(),
    externalUrl: 'https://www.notion.so/example',
  }))
  const check = vi.fn<NonNullable<ShoppingTarget['check']>>(async () => ({
    status: 'uncertain',
    verifiedAbsent: true,
    message: 'Geen bestaande export gevonden. Controleer het doel voordat je bewust opnieuw exporteert.',
  }))
  const deps: ShoppingDeps = {
    secret: SECRET,
    targets: { share: { send: async () => ({ status: 'pending' }) }, notion: { send, check } },
  }
  const input = {
    source: proposal.source,
    requestId: proposal.requestId,
    fingerprint: proposal.fingerprint,
    target: 'share' as const,
  }
  return { a, b, tomato, recipe, source, proposal, deps, send, check, input }
}
async function connect(ctx: Awaited<ReturnType<typeof setup>>['a']) {
  const pageId = crypto.randomUUID(),
    token = 'ntn_this-is-a-fictitious-test-token'
  await saveNotionConnection(ctx, { pageId, token }, SECRET)
  return { pageId, token }
}

describe('boodschappenverbindingen en bronclaims', () => {
  test('AH bewaart uitsluitend een versleutelde referentie; leden exporteren en controleren meteen zonder sleutels te lezen', async () => {
    const { a, b, input, deps, send, check } = await setup()
    const reference = { connectionId: crypto.randomUUID(), connectionKey: 'k'.repeat(43) }
    await saveAhConnection(a, reference, SECRET)
    expect(await getAhConnectionReference(a, SECRET)).toEqual(reference)
    expect(await getAhConnectionReference(b, SECRET)).toBeNull()
    await addMember(db, a.household.id, b.user.id, 'member')
    const member = { ...b, household: { ...a.household, role: 'member' as const } }
    await expect(saveAhConnection(member, reference, SECRET)).rejects.toBeInstanceOf(Forbidden)
    await expect(getAhConnectionReference(member, SECRET)).rejects.toBeInstanceOf(Forbidden)
    await expect(removeShoppingConnection(member, 'ah')).rejects.toBeInstanceOf(Forbidden)
    deps.targets.ah = { send, check }
    send.mockResolvedValueOnce({ status: 'pending' })
    check.mockResolvedValueOnce({ status: 'succeeded' })
    const run = await startShoppingExport(member, { ...input, target: 'ah' }, deps)
    expect(run.status).toBe('pending')
    expect((await checkShoppingSync(member, run.id, deps)).status).toBe('succeeded')
    expect(check).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]?.[0].connection).toEqual({
      destinationId: reference.connectionId,
      secret: reference.connectionKey,
    })
    for (const value of [run, await getShoppingTargets(a), await listSyncRuns(a)])
      expect(JSON.stringify(value)).not.toContain(reference.connectionKey)
  })

  test('AH kijkt zelf wat al op de lijst staat: herhalen mag zonder herhaalkeuze, maar niet tijdens een lopende export', async () => {
    const { a, input, deps, send, check } = await setup()
    await saveAhConnection(a, { connectionId: crypto.randomUUID(), connectionKey: 'k'.repeat(43) }, SECRET)
    deps.targets.ah = { send, check }
    const request = { ...input, target: 'ah' as const }
    send.mockResolvedValueOnce({ status: 'succeeded' })
    await startShoppingExport(a, request, deps)
    send.mockResolvedValueOnce({ status: 'uncertain', message: 'Onzeker' })
    const uncertain = await startShoppingExport(a, { ...request, requestId: crypto.randomUUID() }, deps)
    expect(uncertain.status).toBe('uncertain')
    send.mockResolvedValueOnce({ status: 'pending' })
    await startShoppingExport(a, { ...request, requestId: crypto.randomUUID() }, deps)
    await expect(
      startShoppingExport(a, { ...request, requestId: crypto.randomUUID() }, deps),
    ).rejects.toBeInstanceOf(Conflict)
    expect(send).toHaveBeenCalledTimes(3)
  })

  test('loskoppelen bewaart een onzekere run; herstel van dezelfde Notion-bestemming maakt read-only controle weer mogelijk', async () => {
    const { a, input, deps, send, check } = await setup()
    const { pageId, token } = await connect(a)
    send.mockResolvedValueOnce({ status: 'pending' })
    const run = await startShoppingExport(a, { ...input, target: 'notion' }, deps)
    await removeShoppingConnection(a, 'notion')
    expect((await getSyncRun(a, run.id)).status).toBe('uncertain')
    await saveNotionConnection(a, { pageId, token }, SECRET)
    check.mockResolvedValueOnce({ status: 'succeeded' })
    expect((await checkShoppingSync(a, run.id, deps)).status).toBe('succeeded')
    expect(send).toHaveBeenCalledTimes(1)
  })

  test('vervangen van een bestemming zet de oude onbevestigde export op onzeker', async () => {
    const { a, input, deps, send } = await setup()
    await connect(a)
    send.mockResolvedValueOnce({ status: 'pending' })
    const run = await startShoppingExport(a, { ...input, target: 'notion' }, deps)
    await connect(a)
    expect((await getSyncRun(a, run.id)).status).toBe('uncertain')
  })

  test('annuleren of afwijzen van een bewuste herhaling behoudt de bescherming van de eerdere export', async () => {
    const { a, input, deps, send } = await setup()
    const first = await startShoppingExport(a, input, deps)
    await confirmShoppingShare(a, { runId: first.id, outcome: 'copied' })
    const repeated = await startShoppingExport(
      a,
      { ...input, requestId: crypto.randomUUID(), allowRepeat: true },
      deps,
    )
    await confirmShoppingShare(a, { runId: repeated.id, outcome: 'cancelled' })
    await expect(
      startShoppingExport(a, { ...input, requestId: crypto.randomUUID() }, deps),
    ).rejects.toBeInstanceOf(Conflict)
    await connect(a)
    const notion = await startShoppingExport(
      a,
      { ...input, requestId: crypto.randomUUID(), target: 'notion' },
      deps,
    )
    send.mockResolvedValueOnce({ status: 'failed', message: 'Geweigerd' })
    await startShoppingExport(
      a,
      { ...input, requestId: crypto.randomUUID(), target: 'notion', allowRepeat: true },
      deps,
    )
    await expect(
      startShoppingExport(a, { ...input, requestId: crypto.randomUUID(), target: 'notion' }, deps),
    ).rejects.toBeInstanceOf(Conflict)
    const preview = await getShoppingPreview(a, input.source)
    expect(preview.previousExports.map((row) => row.runId)).toEqual(
      expect.arrayContaining([first.id, notion.id]),
    )
  })

  test('alleen eigenaren beheren versleutelde verbindingen; reads en exports lekken geen geheimen', async () => {
    const { a, b, deps, input, send } = await setup()
    const { pageId, token } = await connect(a)
    const [stored] = await db
      .select()
      .from(shoppingConnection)
      .where(eq(shoppingConnection.householdId, a.household.id))
    expect(stored?.encryptedSecret).not.toContain(token)
    expect(await getShoppingTargets(a)).toMatchObject({
      canManage: true,
      targets: expect.arrayContaining([
        { target: 'notion', configured: true, destinationId: pageId, targetKey: `notion:${pageId}` },
      ]),
    })
    expect(
      (await getShoppingTargets(b)).targets.find((target) => target.target === 'notion')?.configured,
    ).toBe(false)
    await addMember(db, a.household.id, b.user.id, 'member')
    const member = { ...b, household: { ...a.household, role: 'member' as const } }
    await expect(saveNotionConnection(member, { pageId, token }, SECRET)).rejects.toBeInstanceOf(Forbidden)
    await expect(removeShoppingConnection(member, 'notion')).rejects.toBeInstanceOf(Forbidden)
    const run = await startShoppingExport(member, { ...input, target: 'notion' }, deps)
    expect(send.mock.calls[0]?.[0].connection).toEqual({ destinationId: pageId, secret: token })
    for (const result of [run, await getShoppingTargets(a), await listSyncRuns(a)]) {
      expect(JSON.stringify(result)).not.toContain(token)
      expect(JSON.stringify(result)).not.toContain(stored!.encryptedSecret)
    }
    expect(run.status).toBe('succeeded')
    await removeShoppingConnection(a, 'notion')
    expect(
      (await getShoppingTargets(a)).targets.find((target) => target.target === 'notion')?.configured,
    ).toBe(false)
    expect((await getSyncRun(a, run.id)).snapshot.title).toContain('Exportsoep')
  })

  test('ontbrekende verbinding voert geen IO uit en bewaart geen halve run', async () => {
    const { a, input, deps, send } = await setup()
    await expect(startShoppingExport(a, { ...input, target: 'notion' }, deps)).rejects.toThrow(
      /niet ingesteld/,
    )
    expect(send).not.toHaveBeenCalled()
    expect(await listSyncRuns(a)).toEqual([])
  })

  test('herhaalde en gelijktijdige bevestiging gebruiken dezelfde run en één externe write', async () => {
    const { a, input, deps, send } = await setup()
    await connect(a)
    const request = { ...input, target: 'notion' as const }
    const results = await Promise.all([
      startShoppingExport(a, request, deps),
      startShoppingExport(a, request, deps),
    ])
    expect(results[0].id).toBe(results[1].id)
    expect(send).toHaveBeenCalledTimes(1)
    expect((await startShoppingExport(a, request, deps)).id).toBe(results[0].id)
    expect(send).toHaveBeenCalledTimes(1)
    await expect(startShoppingExport(a, { ...request, allowRepeat: true }, deps)).rejects.toBeInstanceOf(
      Conflict,
    )
    expect(await listSyncRuns(a)).toHaveLength(1)
  })

  test('dag/weekoverlap blokkeert automatisch herhalen en een bewuste herhaalkeuze maakt een nieuwe run', async () => {
    const { a, recipe, deps } = await setup()
    await connect(a)
    await createPlannedMeal(a, { kind: 'recipe', recipeId: recipe.id, date: '2027-01-04' })
    const day = await prepareShopping(a, { kind: 'day', date: '2027-01-04' })
    const first = await startShoppingExport(
      a,
      { source: day.source, requestId: day.requestId, fingerprint: day.fingerprint, target: 'notion' },
      deps,
    )
    const week = await getShoppingPreview(a, { kind: 'week', date: '2027-01-04' })
    expect(week.previousExports).toEqual([expect.objectContaining({ runId: first.id, target: 'notion' })])
    const request = {
      source: week.proposal.source,
      requestId: week.proposal.requestId,
      fingerprint: week.proposal.fingerprint,
      target: 'notion' as const,
    }
    await expect(startShoppingExport(a, request, deps)).rejects.toBeInstanceOf(Conflict)
    const repeated = await startShoppingExport(a, { ...request, allowRepeat: true }, deps)
    expect(repeated.id).not.toBe(first.id)
    expect(await listSyncRuns(a)).toHaveLength(2)
  })

  test('gelijktijdige verschillende verzoeken voor dezelfde bron krijgen één winnaar', async () => {
    const { a, input, deps, send } = await setup()
    await connect(a)
    const results = await Promise.allSettled([
      startShoppingExport(a, { ...input, target: 'notion' }, deps),
      startShoppingExport(a, { ...input, requestId: crypto.randomUUID(), target: 'notion' }, deps),
    ])
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((row) => row.status === 'rejected')).toHaveLength(1)
    expect(send).toHaveBeenCalledTimes(1)
    expect(await listSyncRuns(a)).toHaveLength(1)
  })

  test('gewijzigde behoefte of lege lijsten reserveren of verzenden niets', async () => {
    const { a, tomato, input, deps, send } = await setup()
    await setPantryItem(a, { ingredientId: tomato.id, quantity: 100, unit: 'g', staple: false, version: 0 })
    await expect(startShoppingExport(a, input, deps)).rejects.toBeInstanceOf(Conflict)
    expect(await listSyncRuns(a)).toEqual([])
    const proposal = await prepareShopping(a, { kind: 'day', date: '2027-01-04' })
    await expect(
      startShoppingExport(a, { ...input, source: proposal.source, fingerprint: proposal.fingerprint }, deps),
    ).rejects.toThrow(/geen boodschappen/)
    expect(send).not.toHaveBeenCalled()
  })

  test('delen en kopiëren houden een eerlijk resultaat bij; annuleren geeft bronnen vrij', async () => {
    const { a, b, input, deps } = await setup()
    const run = await startShoppingExport(a, input, deps)
    expect(run.status).toBe('pending')
    await addMember(db, a.household.id, b.user.id, 'member')
    const member = { ...b, household: { ...a.household, role: 'member' as const } }
    await expect(confirmShoppingShare(member, { runId: run.id, outcome: 'shared' })).rejects.toBeInstanceOf(
      Forbidden,
    )
    expect((await confirmShoppingShare(a, { runId: run.id, outcome: 'cancelled' })).status).toBe('cancelled')
    const next = await startShoppingExport(a, { ...input, requestId: crypto.randomUUID() }, deps)
    expect((await confirmShoppingShare(a, { runId: next.id, outcome: 'copied' })).status).toBe('copied')
    expect((await confirmShoppingShare(a, { runId: next.id, outcome: 'copied' })).status).toBe('copied')
    await expect(confirmShoppingShare(a, { runId: next.id, outcome: 'shared' })).rejects.toBeInstanceOf(
      Conflict,
    )
  })

  test('definitieve afwijzing geeft claims vrij; onzeker resultaat vereist een read-only controle vóór herhalen', async () => {
    const { a, input, deps, send, check } = await setup()
    await connect(a)
    send.mockResolvedValueOnce({ status: 'failed', message: 'Notion heeft geweigerd.' })
    const failed = await startShoppingExport(a, { ...input, target: 'notion' }, deps)
    expect(failed.status).toBe('failed')
    send.mockResolvedValueOnce({ status: 'uncertain', message: 'Antwoord weggevallen.' })
    const request = { ...input, requestId: crypto.randomUUID(), target: 'notion' as const }
    const uncertain = await startShoppingExport(a, request, deps)
    expect(uncertain.status).toBe('uncertain')
    const retry = { ...request, requestId: crypto.randomUUID(), allowRepeat: true }
    await expect(startShoppingExport(a, retry, deps)).rejects.toBeInstanceOf(Conflict)
    const checked = await checkShoppingSync(a, uncertain.id, deps)
    expect(checked.checkedAt).toBeInstanceOf(Date)
    expect(check).toHaveBeenCalledTimes(1)
    expect((await startShoppingExport(a, retry, deps)).status).toBe('succeeded')
    expect(send).toHaveBeenCalledTimes(3)
  })

  test('read-only herstel koppelt de bestaande pagina en een mislukte controle staat geen bewuste herhaling toe', async () => {
    const { a, input, deps, send, check } = await setup()
    await connect(a)
    send.mockRejectedValueOnce(new Error('Transport weg'))
    const run = await startShoppingExport(a, { ...input, target: 'notion' }, deps)
    check.mockRejectedValueOnce(new Error('Read mislukt'))
    expect((await checkShoppingSync(a, run.id, deps)).checkedAt).toBeNull()
    check.mockResolvedValueOnce({
      status: 'succeeded',
      externalId: crypto.randomUUID(),
      externalUrl: 'https://app.notion.com/p/known',
      message: 'Gevonden',
    })
    const found = await checkShoppingSync(a, run.id, deps)
    expect(found).toMatchObject({ status: 'succeeded', externalUrl: 'https://app.notion.com/p/known' })
    expect(send).toHaveBeenCalledTimes(1)
    await checkShoppingSync(a, run.id, deps)
    expect(check).toHaveBeenCalledTimes(2)
  })

  test('nieuwe bestemming heeft eigen bronclaims en een onzekere oude run wordt niet onder een andere verbinding gecontroleerd', async () => {
    const { a, input, deps, send, check } = await setup()
    await connect(a)
    send.mockResolvedValueOnce({ status: 'uncertain' })
    const old = await startShoppingExport(a, { ...input, target: 'notion' }, deps)
    await connect(a)
    await expect(checkShoppingSync(a, old.id, deps)).rejects.toThrow(/oorspronkelijke verbinding/)
    expect(check).not.toHaveBeenCalled()
    expect(
      (await startShoppingExport(a, { ...input, requestId: crypto.randomUUID(), target: 'notion' }, deps))
        .status,
    ).toBe('succeeded')
  })

  test('andere huishoudens kunnen bronnen, runs of resultaten niet overnemen', async () => {
    const { a, b, input, deps } = await setup()
    const run = await startShoppingExport(a, input, deps)
    b.user.role = 'admin'
    expect(await listSyncRuns(b)).toEqual([])
    await Promise.all(
      [
        getSyncRun(b, run.id),
        confirmShoppingShare(b, { runId: run.id, outcome: 'shared' }),
        checkShoppingSync(b, run.id, deps),
        startShoppingExport(b, input, deps),
      ].map((action) => expect(action).rejects.toBeInstanceOf(NotFound)),
    )
    expect((await getSyncRun(a, run.id)).status).toBe('pending')
  })

  test('databaseconstraints bewaken unieke verzoeken, verbindingen en bronclaims plus statussen', async () => {
    const { a, input, deps } = await setup()
    await connect(a)
    const run = await startShoppingExport(a, input, deps)
    const [stored] = await db.select().from(syncRun).where(eq(syncRun.id, run.id))
    await expect(db.insert(syncRun).values({ ...stored!, id: crypto.randomUUID() })).rejects.toThrow()
    await expect(
      db.insert(syncRun).values({
        ...stored!,
        id: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        status: 'ongeldig' as ShoppingProviderResult['status'],
      }),
    ).rejects.toThrow()
    const [connection] = await db
      .select()
      .from(shoppingConnection)
      .where(eq(shoppingConnection.householdId, a.household.id))
    await expect(
      db.insert(shoppingConnection).values({ ...connection!, id: crypto.randomUUID() }),
    ).rejects.toThrow()
    await expect(
      db.insert(syncSourceClaim).values({
        householdId: a.household.id,
        targetKey: 'share',
        sourceKey: stored!.sourceKeys[0]!,
        runId: run.id,
      }),
    ).rejects.toThrow()
    await expect(
      db
        .insert(syncSourceClaim)
        .values({ householdId: a.household.id, targetKey: 'ander', sourceKey: 'test', runId: 'ontbreekt' }),
    ).rejects.toThrow()
  })
})
