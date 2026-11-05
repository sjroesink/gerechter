import { describe, expect, test } from 'vitest'
import { NoActiveHousehold, Unauthenticated } from '~/domain/core'
import { createTestAuth, signUpWithSession } from '../../tests/auth'
import { setupTestDb } from '../../tests/db'
import { createHousehold } from '../../tests/fixtures'
import { ctxFromSession } from './ctx'

const db = setupTestDb()
const auth = createTestAuth(db)

describe('ctxFromSession', () => {
  test('weigert een verzoek zonder sessie', async () => {
    await expect(ctxFromSession(new Headers(), { db, auth })).rejects.toBeInstanceOf(Unauthenticated)
  })

  test('geeft NoActiveHousehold voor een gebruiker zonder huishouden', async () => {
    const { headers } = await signUpWithSession(auth)
    await expect(ctxFromSession(headers, { db, auth })).rejects.toBeInstanceOf(NoActiveHousehold)
  })

  test('bouwt een context met het actieve huishouden', async () => {
    const { headers, userId } = await signUpWithSession(auth, 'Sam')
    const h = await createHousehold(db, userId, 'Thuis')
    const ctx = await ctxFromSession(headers, { db, auth })
    expect(ctx.user).toMatchObject({ id: userId, name: 'Sam', role: 'user' })
    expect(ctx.household).toEqual({ id: h.id, name: 'Thuis', role: 'owner' })
  })
})
