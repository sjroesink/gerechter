import { eq } from 'drizzle-orm'
import type { Db } from '~/db/client'
import { household, membership, user, type HouseholdRole } from '~/db/schema'
import { resolveCtx, type Ctx } from '~/domain/core'

/** Maakt een gebruiker rechtstreeks in de database (zonder de registratieregels). */
export async function createUser(db: Db, opts: { name?: string; role?: 'user' | 'admin' } = {}) {
  const id = crypto.randomUUID()
  const email = `user-${id}@example.com`
  const name = opts.name ?? 'Testgebruiker'
  await db.insert(user).values({ id, name, email, emailVerified: false, role: opts.role ?? 'user' })
  return { id, name, email }
}

export async function createHousehold(db: Db, ownerId: string, name = 'Huishouden') {
  const [row] = await db.insert(household).values({ name }).returning()
  await addMember(db, row!.id, ownerId, 'owner')
  await db.update(user).set({ lastActiveHouseholdId: row!.id }).where(eq(user.id, ownerId))
  return row!
}

export async function addMember(db: Db, householdId: string, userId: string, role: HouseholdRole) {
  await db.insert(membership).values({ householdId, userId, role })
}

/** Twee huishoudens met elk een eigenaar: de basis voor afschermingstests. */
export async function twoHouseholds(db: Db): Promise<{ a: Ctx; b: Ctx }> {
  const ua = await createUser(db, { name: 'Anna' })
  const ub = await createUser(db, { name: 'Bram' })
  await createHousehold(db, ua.id, 'Huishouden A')
  await createHousehold(db, ub.id, 'Huishouden B')
  return { a: await resolveCtx(db, ua.id), b: await resolveCtx(db, ub.id) }
}
