import { describe, expect, test, vi } from 'vitest'
import { setupTestDb } from '../../tests/db'
import { addMember, twoHouseholds } from '../../tests/fixtures'
import { searchAhProducts } from './ah-product-search'
import { linkAhProduct } from './ah-products'
import { createIngredient } from './catalog'
import { Conflict, Invalid, NotFound } from './core'
import { createRecipe } from './recipes'
import { prepareShopping } from './shopping-needs'
import { getSyncRun, saveAhConnection, startShoppingExport } from './shopping-sync'
import type { AhProductSearch, ShoppingDeps, ShoppingTarget } from './shopping-target'

const db = setupTestDb()
const SECRET = 'ah-product-test-secret-with-at-least-32-characters'
const result = {
  id: 7,
  title: 'AH Trostomaten',
  brand: 'AH',
  price: 2.19,
  isBonus: false,
  bonusLabel: null,
  unitSize: '500 g',
  imageUrl: 'https://static.ah.nl/tomaat.jpg',
}

async function setup() {
  const { a, b } = await twoHouseholds(db)
  const tomato = await createIngredient(a, { name: 'Tomaten', baseUnit: 'g' })
  const search = vi.fn<AhProductSearch['search']>(async () => [result])
  const send = vi.fn<ShoppingTarget['send']>(async () => ({ status: 'pending' }))
  const deps: ShoppingDeps = { secret: SECRET, targets: { ah: { send } }, ahProducts: { search } }
  const reference = { connectionId: crypto.randomUUID(), connectionKey: 'k'.repeat(43) }
  return { a, b, tomato, search, send, deps, reference }
}

describe('AH-producten zoeken', () => {
  test('leden zoeken met de huishoudverbinding en krijgen een inhoudsvoorstel voor het ingrediënt', async () => {
    const { a, b, tomato, search, deps, reference } = await setup()
    await expect(searchAhProducts(a, { query: 'tomaat' }, deps)).rejects.toThrow(/nog geen AH-verbinding/)
    await saveAhConnection(a, reference, SECRET)
    await addMember(db, a.household.id, b.user.id, 'member')
    const member = { ...b, household: { ...a.household, role: 'member' as const } }
    const found = await searchAhProducts(member, { query: ' tomaat ', ingredientId: tomato.id }, deps)
    expect(found).toEqual([{ ...result, suggestedPackAmount: 500 }])
    expect(search).toHaveBeenCalledWith(
      { destinationId: reference.connectionId, secret: reference.connectionKey },
      'tomaat',
      20,
    )
    expect((await searchAhProducts(a, { query: 'tomaat' }, deps))[0]?.suggestedPackAmount).toBeNull()
  })

  test('weigert zonder ingestelde sidecar, met lege zoekterm of met een vreemd ingrediënt', async () => {
    const { a, b, tomato, deps, reference } = await setup()
    await saveAhConnection(a, reference, SECRET)
    await expect(searchAhProducts(a, { query: 'tomaat' }, { secret: SECRET, targets: {} })).rejects.toThrow(
      /niet ingeschakeld/,
    )
    await expect(searchAhProducts(a, { query: '  ' }, deps)).rejects.toBeInstanceOf(Invalid)
    await expect(
      searchAhProducts(b, { query: 'tomaat', ingredientId: tomato.id }, deps),
    ).rejects.toBeInstanceOf(NotFound)
  })
})

describe('AH-export met productkoppelingen', () => {
  test('stuurt de productregels mee en weigert een voorstel van vóór een koppelwijziging', async () => {
    const { a, tomato, send, deps, reference } = await setup()
    await saveAhConnection(a, reference, SECRET)
    const recipe = await createRecipe(a, {
      name: 'Tomatensoep',
      servings: 2,
      ingredients: [{ ingredientId: tomato.id, quantity: 700, unit: 'g' }],
    })
    const source = { kind: 'recipe' as const, recipeId: recipe.id, servings: 2 }
    const stale = await prepareShopping(a, source)
    await linkAhProduct(a, {
      ingredientId: tomato.id,
      productId: 7,
      title: 'AH Trostomaten',
      packAmount: 500,
    })
    const input = (proposal: typeof stale) => ({
      source: proposal.source,
      requestId: proposal.requestId,
      fingerprint: proposal.fingerprint,
      target: 'ah' as const,
    })
    await expect(startShoppingExport(a, input(stale), deps)).rejects.toBeInstanceOf(Conflict)
    const fresh = await prepareShopping(a, source)
    const run = await startShoppingExport(a, input(fresh), deps)
    expect(send.mock.calls[0]?.[0].needs.ahItems).toEqual([
      { kind: 'product', productId: 7, description: 'AH Trostomaten', quantity: 2, check: false },
    ])
    expect((await getSyncRun(a, run.id)).status).toBe('pending')
  })
})
