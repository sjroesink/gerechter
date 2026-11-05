import { and, eq, like } from 'drizzle-orm'
import { describe, expect, test } from 'vitest'
import { membership, user, verification } from '~/db/schema'
import { createTestAuth, signInWithSession, testEnv } from '../../tests/auth'
import { setupFreshDb, setupTestDb } from '../../tests/db'
import { createUser, twoHouseholds } from '../../tests/fixtures'
import {
  acceptInvite,
  bootstrapAdmin,
  createPasswordResetLink,
  isSetupAvailable,
  registerWithInvite,
  resetPassword,
} from './accounts'
import { Conflict, Forbidden, Invalid, loadUserCtx, resolveCtx } from './core'
import { createHouseholdInvite, createMemberInvite } from './invites'

const db = setupTestDb()
const auth = createTestAuth(db)
const deps = { db, auth, env: testEnv }

const credentials = () => ({
  name: 'Nieuw Lid',
  email: `nieuw-${crypto.randomUUID()}@example.com`,
  password: 'een-goed-wachtwoord',
})

describe('registratie alleen via uitnodiging', () => {
  test('het sign-up-endpoint weigert een account zonder uitnodiging', async () => {
    const email = `los-${crypto.randomUUID()}@example.com`
    await expect(
      auth.api.signUpEmail({ body: { name: 'Los', email, password: 'een-goed-wachtwoord' } }),
    ).rejects.toThrow()
    const response = await auth.handler(
      new Request('http://localhost:3000/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ name: 'Los', email, password: 'een-goed-wachtwoord' }),
      }),
    )
    expect(response.ok).toBe(false)
    expect(await db.select().from(user).where(eq(user.email, email))).toEqual([])
  })

  test('met een geldige uitnodiging wordt het account aangemaakt, ingelogd en lid', async () => {
    const { a } = await twoHouseholds(db)
    const created = await createMemberInvite(a)
    const result = await registerWithInvite(deps, created.token, credentials())
    expect(result.headers.getSetCookie().join(';')).toMatch(/session_token/)
    const ctx = await resolveCtx(db, result.userId)
    expect(ctx.household).toEqual({ id: a.household.id, name: 'Huishouden A', role: 'member' })
    await expect(registerWithInvite(deps, created.token, credentials())).rejects.toThrow(/al gebruikt/)
  })

  test('met een verlopen uitnodiging wordt er geen account aangemaakt', async () => {
    const { a } = await twoHouseholds(db)
    const created = await createMemberInvite(a, new Date('2020-01-01T00:00:00Z'))
    const input = credentials()
    await expect(registerWithInvite(deps, created.token, input)).rejects.toThrow(/verlopen/)
    expect(await db.select().from(user).where(eq(user.email, input.email))).toEqual([])
  })

  test('een uitnodiging voor een nieuw huishouden maakt de persoon eigenaar', async () => {
    const admin = await createUser(db, { role: 'admin' })
    const created = await createHouseholdInvite(await loadUserCtx(db, admin.id), 'Familie Jansen')
    const result = await registerWithInvite(deps, created.token, credentials())
    const ctx = await resolveCtx(db, result.userId)
    expect(ctx.household).toMatchObject({ name: 'Familie Jansen', role: 'owner' })
  })
})

describe('bestaand account accepteert uitnodiging', () => {
  test('wordt lid naast bestaande huishoudens en het nieuwe huishouden wordt actief', async () => {
    const { a, b } = await twoHouseholds(db)
    const created = await createMemberInvite(a)
    await acceptInvite(b, created.token)
    const ctx = await resolveCtx(db, b.user.id)
    expect(ctx.household.id).toBe(a.household.id)
    const rows = await db.select().from(membership).where(eq(membership.userId, b.user.id))
    expect(rows).toHaveLength(2)
  })

  test('al lid zijn geeft een duidelijke melding', async () => {
    const { a } = await twoHouseholds(db)
    const created = await createMemberInvite(a)
    await expect(acceptInvite(a, created.token)).rejects.toBeInstanceOf(Conflict)
  })
})

describe('bootstrap van de platformbeheerder', () => {
  const fresh = setupFreshDb()

  test('alleen het geconfigureerde adres, en alleen zolang er geen accounts zijn', async () => {
    const freshDb = fresh.get()
    const freshDeps = { db: freshDb, auth: createTestAuth(freshDb), env: testEnv }
    expect(await isSetupAvailable(freshDb)).toBe(true)

    await expect(
      bootstrapAdmin(freshDeps, {
        name: 'Iemand',
        email: 'iemand@example.com',
        password: 'een-goed-wachtwoord',
      }),
    ).rejects.toBeInstanceOf(Forbidden)

    const result = await bootstrapAdmin(freshDeps, {
      name: 'Beheerder',
      email: testEnv.ADMIN_EMAIL,
      password: 'een-goed-wachtwoord',
    })
    const ctx = await resolveCtx(freshDb, result.userId)
    expect(ctx.user.role).toBe('admin')
    expect(ctx.household).toMatchObject({ name: 'Huishouden van Beheerder', role: 'owner' })

    expect(await isSetupAvailable(freshDb)).toBe(false)
    await expect(
      bootstrapAdmin(freshDeps, {
        name: 'Nog een',
        email: testEnv.ADMIN_EMAIL,
        password: 'een-goed-wachtwoord',
      }),
    ).rejects.toBeInstanceOf(Forbidden)
  })
})

describe('wachtwoordherstel via de beheerder', () => {
  async function setup() {
    const admin = await loadUserCtx(db, (await createUser(db, { role: 'admin' })).id)
    const { a } = await twoHouseholds(db)
    const invite = await createMemberInvite(a)
    const input = credentials()
    const { userId } = await registerWithInvite(deps, invite.token, input)
    return { admin, userId, input }
  }

  test('herstellink werkt, trekt sessies in en is daarna verbruikt', async () => {
    const { admin, userId, input } = await setup()
    const oldSession = await signInWithSession(auth, input.email, input.password)
    const { url } = await createPasswordResetLink(deps, admin, userId)
    expect(url).toMatch(/^http:\/\/localhost:3000\/herstel\/.+/)
    const token = url.split('/herstel/')[1]!

    await resetPassword(deps, token, 'nieuw-wachtwoord-123')
    expect(await auth.api.getSession({ headers: oldSession })).toBeNull()
    await expect(signInWithSession(auth, input.email, 'nieuw-wachtwoord-123')).resolves.toBeInstanceOf(
      Headers,
    )
    await expect(resetPassword(deps, token, 'nog-een-wachtwoord')).rejects.toBeInstanceOf(Invalid)
  })

  test('een herstellink ouder dan 24 uur werkt niet', async () => {
    const { admin, userId, input } = await setup()
    const { url } = await createPasswordResetLink(deps, admin, userId)
    const token = url.split('/herstel/')[1]!
    await db
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(and(like(verification.identifier, `%${token}%`)))
    await expect(resetPassword(deps, token, 'nieuw-wachtwoord-123')).rejects.toBeInstanceOf(Invalid)
    await expect(signInWithSession(auth, input.email, input.password)).resolves.toBeInstanceOf(Headers)
  })

  test('alleen een beheerder kan een herstellink maken', async () => {
    const { a } = await twoHouseholds(db)
    await expect(createPasswordResetLink(deps, a, a.user.id)).rejects.toBeInstanceOf(Forbidden)
  })
})
