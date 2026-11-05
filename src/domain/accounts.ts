import { asc, count, eq, sql } from 'drizzle-orm'
import type { Auth } from '~/auth/auth'
import { runAuthFlow } from '~/auth/context'
import type { Db, DbOrTx } from '~/db/client'
import { household, membership, user } from '~/db/schema'
import type { Env } from '~/lib/env'
import { Conflict, Forbidden, Invalid, NotFound, requireAdmin, type UserCtx } from './core'
import { consumeInvite, inspectInvite, inviteProblemMessages } from './invites'

export type AccountDeps = { db: Db; auth: Auth; env: Pick<Env, 'ADMIN_EMAIL' | 'PUBLIC_BASE_URL'> }

export type Credentials = { name: string; email: string; password: string }

function normalize(credentials: Credentials): Credentials {
  const name = credentials.name.trim()
  const email = credentials.email.trim().toLowerCase()
  if (!name) throw new Invalid('Vul je naam in.')
  if (credentials.password.length < 8) throw new Invalid('Kies een wachtwoord van minstens 8 tekens.')
  return { name, email, password: credentials.password }
}

async function signUp(deps: AccountDeps, credentials: Credentials) {
  try {
    return await runAuthFlow({ allowSignUp: true }, () =>
      deps.auth.api.signUpEmail({ body: credentials, returnHeaders: true }),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/already exists|USER_ALREADY_EXISTS/i.test(message)) {
      throw new Conflict('Er bestaat al een account met dit e-mailadres. Log in en open de link opnieuw.')
    }
    throw error
  }
}

async function createHouseholdFor(db: DbOrTx, userId: string, name: string) {
  const [row] = await db.insert(household).values({ name }).returning({ id: household.id })
  await db.insert(membership).values({ householdId: row!.id, userId, role: 'owner' })
  await db.update(user).set({ lastActiveHouseholdId: row!.id }).where(eq(user.id, userId))
  return row!.id
}

/** Verwerkt een (al op geldigheid gecontroleerde) uitnodiging voor een gebruiker, binnen één transactie. */
async function applyInvite(db: Db, token: string, userId: string): Promise<string> {
  return db.transaction(async (tx) => {
    const used = await consumeInvite(tx, token, userId)
    if (used.kind === 'new_household') {
      return createHouseholdFor(tx, userId, used.proposedHouseholdName ?? 'Ons huishouden')
    }
    const householdId = used.householdId!
    const [existing] = await tx
      .select({ id: membership.id })
      .from(membership)
      .where(sql`${membership.householdId} = ${householdId} and ${membership.userId} = ${userId}`)
    if (existing) throw new Conflict('Je bent al lid van dit huishouden.')
    await tx.insert(membership).values({ householdId, userId, role: 'member' })
    await tx.update(user).set({ lastActiveHouseholdId: householdId }).where(eq(user.id, userId))
    return householdId
  })
}

/** Nieuw account via een uitnodigingslink. Geeft de response-headers (sessiecookie) terug. */
export async function registerWithInvite(deps: AccountDeps, token: string, input: Credentials) {
  const info = await inspectInvite(deps.db, token)
  if (!info.ok) throw new Invalid(inviteProblemMessages[info.problem])
  const credentials = normalize(input)
  const result = await signUp(deps, credentials)
  try {
    await applyInvite(deps.db, token, result.response.user.id)
  } catch (error) {
    // Uitnodiging bleek tussentijds ongeldig: geen account zonder huishouden achterlaten.
    await deps.db.delete(user).where(eq(user.id, result.response.user.id))
    throw error
  }
  return { userId: result.response.user.id, headers: result.headers }
}

/** Ingelogde gebruiker accepteert een uitnodiging. */
export async function acceptInvite(ctx: UserCtx, token: string) {
  const info = await inspectInvite(ctx.db, token)
  if (!info.ok) throw new Invalid(inviteProblemMessages[info.problem])
  return { householdId: await applyInvite(ctx.db, token, ctx.user.id) }
}

export async function isSetupAvailable(db: Db): Promise<boolean> {
  const [row] = await db.select({ n: count() }).from(user)
  return (row?.n ?? 0) === 0
}

/** Eenmalige bootstrap: het eerste account, met het geconfigureerde e-mailadres, wordt platformbeheerder. */
export async function bootstrapAdmin(deps: AccountDeps, input: Credentials) {
  if (!(await isSetupAvailable(deps.db))) throw new Forbidden('De setup is al afgerond.')
  const credentials = normalize(input)
  if (credentials.email !== deps.env.ADMIN_EMAIL.trim().toLowerCase()) {
    throw new Forbidden('Alleen het geconfigureerde beheerdersadres kan de setup doen.')
  }
  const result = await signUp(deps, credentials)
  const userId = result.response.user.id
  await deps.db.transaction(async (tx) => {
    await tx.update(user).set({ role: 'admin' }).where(eq(user.id, userId))
    await createHouseholdFor(tx, userId, `Huishouden van ${credentials.name}`)
  })
  return { userId, headers: result.headers }
}

/** Overzicht voor de beheerpagina. */
export async function listUsers(ctx: UserCtx) {
  requireAdmin(ctx)
  return ctx.db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .orderBy(asc(user.name))
}

/** Beheerder vraagt een herstellink aan voor een account. De link wordt teruggegeven, niet gemaild. */
export async function createPasswordResetLink(deps: AccountDeps, ctx: UserCtx, userId: string) {
  requireAdmin(ctx)
  const [target] = await deps.db.select({ email: user.email }).from(user).where(eq(user.id, userId))
  if (!target) throw new NotFound('Gebruiker niet gevonden.')
  const flow: { capturedResetToken?: string } = {}
  await runAuthFlow(flow, () =>
    deps.auth.api.requestPasswordReset({
      body: { email: target.email, redirectTo: `${deps.env.PUBLIC_BASE_URL}/login` },
    }),
  )
  if (!flow.capturedResetToken) throw new Error('Er kon geen herstellink worden gemaakt.')
  return { url: `${deps.env.PUBLIC_BASE_URL}/herstel/${flow.capturedResetToken}` }
}

/** Nieuw wachtwoord instellen met een herstellink. Trekt bestaande sessies in. */
export async function resetPassword(deps: Pick<AccountDeps, 'auth'>, token: string, newPassword: string) {
  if (newPassword.length < 8) throw new Invalid('Kies een wachtwoord van minstens 8 tekens.')
  try {
    await deps.auth.api.resetPassword({ body: { token, newPassword } })
  } catch {
    throw new Invalid('Deze herstellink is ongeldig of verlopen.')
  }
}
