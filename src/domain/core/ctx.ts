import { and, asc, eq } from 'drizzle-orm'
import type { DbOrTx } from '~/db/client'
import { household, membership, user, type HouseholdRole } from '~/db/schema'
import { Forbidden, NoActiveHousehold, NotFound } from './errors'

export type PlatformRole = 'user' | 'admin'

export type CtxUser = { id: string; name: string; email: string; role: PlatformRole }

/** Context voor acties van een ingelogde gebruiker, los van een huishouden (bijv. uitnodiging accepteren). */
export type UserCtx = { db: DbOrTx; user: CtxUser }

/** Context voor alles wat huishoudgegevens raakt. Domeinfuncties scopen altijd op `household.id`. */
export type Ctx = UserCtx & { household: { id: string; name: string; role: HouseholdRole } }

export async function loadUserCtx(db: DbOrTx, userId: string): Promise<UserCtx> {
  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(eq(user.id, userId))
  if (!row) throw new NotFound('Gebruiker niet gevonden.')
  return { db, user: { ...row, role: row.role === 'admin' ? 'admin' : 'user' } }
}

/**
 * Bepaalt het actieve huishouden: `lastActiveHouseholdId` als de gebruiker daar nog lid van is,
 * anders het oudste lidmaatschap (dat wordt dan bewaard). Zonder lidmaatschap: NoActiveHousehold.
 */
export async function resolveCtx(db: DbOrTx, userId: string): Promise<Ctx> {
  const userCtx = await loadUserCtx(db, userId)
  const [current] = await db.select({ id: user.lastActiveHouseholdId }).from(user).where(eq(user.id, userId))

  const memberships = await db
    .select({ id: household.id, name: household.name, role: membership.role })
    .from(membership)
    .innerJoin(household, eq(household.id, membership.householdId))
    .where(eq(membership.userId, userId))
    .orderBy(asc(membership.createdAt))

  const active = memberships.find((m) => m.id === current?.id) ?? memberships[0]
  if (!active) throw new NoActiveHousehold()
  if (active.id !== current?.id) {
    await db.update(user).set({ lastActiveHouseholdId: active.id }).where(eq(user.id, userId))
  }
  return { ...userCtx, household: active }
}

export async function membershipOf(db: DbOrTx, userId: string, householdId: string) {
  const [row] = await db
    .select({ role: membership.role })
    .from(membership)
    .where(and(eq(membership.userId, userId), eq(membership.householdId, householdId)))
  return row
}

export function requireOwner(ctx: Ctx): void {
  if (ctx.household.role !== 'owner') throw new Forbidden('Alleen een eigenaar van het huishouden kan dit.')
}

export function requireAdmin(ctx: UserCtx): void {
  if (ctx.user.role !== 'admin') throw new Forbidden('Alleen een platformbeheerder kan dit.')
}
