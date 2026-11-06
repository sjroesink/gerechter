import { describe, expect, test } from 'vitest'
import { createTestAuth, signUpWithSession } from '../../tests/auth'
import { setupTestDb } from '../../tests/db'
import { addMember, createHousehold } from '../../tests/fixtures'
import { createIngredient } from '~/domain/catalog'
import { resolveCtx } from '~/domain/core'
import { createRecipe } from '~/domain/recipes'
import { imageResponse } from './images'

const db = setupTestDb()
const auth = createTestAuth(db)
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 3])

async function storedImage() {
  const owner = await signUpWithSession(auth, 'Fotobezitter')
  const household = await createHousehold(db, owner.userId, 'Fotohuis')
  const ctx = await resolveCtx(db, owner.userId)
  const rice = await createIngredient(ctx, { name: 'Fotorijst', baseUnit: 'g' })
  const created = await createRecipe(
    ctx,
    {
      name: 'Fotogerecht',
      servings: 2,
      photoUrl: 'https://cdn.example.com/foto.png',
      ingredients: [{ ingredientId: rice.id, quantity: 100, unit: 'g' }],
    },
    { fetchImage: async (url) => ({ bytes: png, finalUrl: url }) },
  )
  return { owner, household, id: decodeURIComponent(created.imageUrl!.split('/').pop()!) }
}

const request = (headers?: Headers) => new Request('http://localhost:3000/afbeeldingen/x', { headers })

describe('afbeeldingsroute', () => {
  test('levert de eigen kopie aan leden, met veilige headers en etag', async () => {
    const { owner, household, id } = await storedImage()
    const res = await imageResponse(request(owner.headers), id, { db, auth })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('cache-control')).toContain('private')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(png)

    const etag = res.headers.get('etag')!
    const cached = new Headers(owner.headers)
    cached.set('if-none-match', etag)
    expect((await imageResponse(request(cached), id, { db, auth })).status).toBe(304)

    const member = await signUpWithSession(auth, 'Huisgenoot')
    await addMember(db, household.id, member.userId, 'member')
    expect((await imageResponse(request(member.headers), id, { db, auth })).status).toBe(200)
  })

  test('niet-leden, anonieme bezoekers en onbekende IDs krijgen 404', async () => {
    const { id } = await storedImage()
    const stranger = await signUpWithSession(auth, 'Buitenstaander')
    await createHousehold(db, stranger.userId, 'Ander huis')
    expect((await imageResponse(request(stranger.headers), id, { db, auth })).status).toBe(404)
    expect((await imageResponse(request(), id, { db, auth })).status).toBe(404)
    const { owner } = await storedImage()
    expect((await imageResponse(request(owner.headers), 'bestaat-niet', { db, auth })).status).toBe(404)
  })
})
