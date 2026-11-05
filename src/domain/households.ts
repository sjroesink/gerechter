import { and, asc, eq, sql } from 'drizzle-orm'
import type { Tx } from '~/db/client'
import { household, membership, user, type HouseholdRole } from '~/db/schema'
import { Conflict, NotFound, membershipOf, requireOwner, type Ctx, type UserCtx } from './core'

const LAST_OWNER = 'Een huishouden heeft altijd minstens één eigenaar. Maak eerst iemand anders eigenaar.'

export async function getMembers(ctx: Ctx) {
  const rows = await ctx.db
    .select({ userId: user.id, name: user.name, email: user.email, role: membership.role })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .where(eq(membership.householdId, ctx.household.id))
    .orderBy(asc(membership.createdAt))
  return rows.map((r) => ({ ...r, isMe: r.userId === ctx.user.id }))
}

export async function listMyHouseholds(ctx: UserCtx) {
  return ctx.db
    .select({ id: household.id, name: household.name, role: membership.role })
    .from(membership)
    .innerJoin(household, eq(household.id, membership.householdId))
    .where(eq(membership.userId, ctx.user.id))
    .orderBy(asc(household.name))
}

export async function switchHousehold(ctx: UserCtx, householdId: string): Promise<void> {
  if (!(await membershipOf(ctx.db, ctx.user.id, householdId))) throw new NotFound('Huishouden niet gevonden.')
  await ctx.db.update(user).set({ lastActiveHouseholdId: householdId }).where(eq(user.id, ctx.user.id))
}

/** Vergrendelt de lidmaatschappen van het huishouden, zodat de eigenaarsregel niet door gelijktijdige acties breekt. */
async function lockMembers(tx: Tx, householdId: string) {
  return tx
    .select({ userId: membership.userId, role: membership.role })
    .from(membership)
    .where(eq(membership.householdId, householdId))
    .for('update')
}

function assertOwnerRemains(
  members: { userId: string; role: HouseholdRole }[],
  change: { userId: string; role: HouseholdRole | null },
) {
  const owners = members.filter((m) => (m.userId === change.userId ? change.role : m.role) === 'owner')
  if (owners.length === 0) throw new Conflict(LAST_OWNER)
}

async function clearActiveIfNeeded(tx: Tx, userId: string, householdId: string) {
  await tx
    .update(user)
    .set({ lastActiveHouseholdId: null })
    .where(and(eq(user.id, userId), eq(user.lastActiveHouseholdId, householdId)))
}

export async function changeMemberRole(ctx: Ctx, userId: string, role: HouseholdRole): Promise<void> {
  requireOwner(ctx)
  await ctx.db.transaction(async (tx) => {
    const members = await lockMembers(tx, ctx.household.id)
    if (!members.some((m) => m.userId === userId)) throw new NotFound('Lid niet gevonden.')
    assertOwnerRemains(members, { userId, role })
    await tx
      .update(membership)
      .set({ role })
      .where(and(eq(membership.householdId, ctx.household.id), eq(membership.userId, userId)))
  })
}

export async function removeMember(ctx: Ctx, userId: string): Promise<void> {
  if (userId !== ctx.user.id) requireOwner(ctx)
  await ctx.db.transaction(async (tx) => {
    const members = await lockMembers(tx, ctx.household.id)
    if (!members.some((m) => m.userId === userId)) throw new NotFound('Lid niet gevonden.')
    assertOwnerRemains(members, { userId, role: null })
    await tx
      .delete(membership)
      .where(and(eq(membership.householdId, ctx.household.id), eq(membership.userId, userId)))
    await clearActiveIfNeeded(tx, userId, ctx.household.id)
  })
}

export async function leaveHousehold(ctx: Ctx): Promise<void> {
  await removeMember(ctx, ctx.user.id)
}

export async function renameHousehold(ctx: Ctx, name: string): Promise<void> {
  requireOwner(ctx)
  const trimmed = name.trim()
  if (!trimmed) throw new Conflict('Geef het huishouden een naam.')
  await ctx.db.update(household).set({ name: trimmed }).where(eq(household.id, ctx.household.id))
}

export async function countHouseholds(ctx: UserCtx): Promise<number> {
  const [row] = await ctx.db
    .select({ n: sql<number>`count(*)::int` })
    .from(membership)
    .where(eq(membership.userId, ctx.user.id))
  return row?.n ?? 0
}
