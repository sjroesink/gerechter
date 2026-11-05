import { eq } from 'drizzle-orm'
import { describe, expect, test } from 'vitest'
import { user } from '~/db/schema'
import { setupTestDb } from '../../../tests/db'
import { addMember, createHousehold, createUser } from '../../../tests/fixtures'
import { Forbidden, NoActiveHousehold, requireAdmin, requireOwner, resolveCtx } from '.'

const db = setupTestDb()

describe('resolveCtx', () => {
  test('geeft NoActiveHousehold voor een gebruiker zonder huishouden', async () => {
    const u = await createUser(db)
    await expect(resolveCtx(db, u.id)).rejects.toBeInstanceOf(NoActiveHousehold)
  })

  test('valt terug op een ander lidmaatschap als het laatst actieve niet meer geldt', async () => {
    const owner = await createUser(db)
    const other = await createUser(db)
    const h1 = await createHousehold(db, owner.id, 'Eerste')
    const h2 = await createHousehold(db, other.id, 'Tweede')
    const u = await createUser(db)
    await addMember(db, h1.id, u.id, 'member')
    await db.update(user).set({ lastActiveHouseholdId: h2.id }).where(eq(user.id, u.id))

    const ctx = await resolveCtx(db, u.id)
    expect(ctx.household).toEqual({ id: h1.id, name: 'Eerste', role: 'member' })
    const [saved] = await db.select().from(user).where(eq(user.id, u.id))
    expect(saved!.lastActiveHouseholdId).toBe(h1.id)
  })
})

describe('rolhelpers', () => {
  test('requireOwner weigert een lid en accepteert een eigenaar', async () => {
    const owner = await createUser(db)
    const h = await createHousehold(db, owner.id)
    const member = await createUser(db)
    await addMember(db, h.id, member.id, 'member')

    const memberCtx = await resolveCtx(db, member.id)
    const ownerCtx = await resolveCtx(db, owner.id)
    expect(() => requireOwner(memberCtx)).toThrow(Forbidden)
    expect(() => requireOwner(ownerCtx)).not.toThrow()
  })

  test('requireAdmin weigert een gewone gebruiker', () => {
    const base = { id: 'x', name: 'x', email: 'x@example.com' }
    expect(() => requireAdmin({ db, user: { ...base, role: 'user' } })).toThrow(Forbidden)
    expect(() => requireAdmin({ db, user: { ...base, role: 'admin' } })).not.toThrow()
  })
})
