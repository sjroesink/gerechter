import { describe, expect, test } from 'vitest'
import { setupTestDb } from '../../tests/db'
import { addMember, createUser, twoHouseholds } from '../../tests/fixtures'
import { expectHidden } from '../../tests/isolation'
import { Forbidden, Invalid, loadUserCtx, resolveCtx } from './core'
import {
  INVITE_TTL_MS,
  consumeInvite,
  createHouseholdInvite,
  createMemberInvite,
  inspectInvite,
  listOpenInvites,
  revokeInvite,
} from './invites'

const db = setupTestDb()

describe('uitnodigingen', () => {
  test('eigenaar maakt een uitnodiging die 7 dagen geldig is', async () => {
    const { a } = await twoHouseholds(db)
    const now = new Date('2026-11-05T10:00:00Z')
    const created = await createMemberInvite(a, now)
    expect(created.expiresAt.getTime() - now.getTime()).toBe(INVITE_TTL_MS)
    expect(await inspectInvite(db, created.token, now)).toMatchObject({
      ok: true,
      kind: 'member',
      householdName: 'Huishouden A',
    })
    expect((await listOpenInvites(a, now)).map((i) => i.id)).toEqual([created.id])
  })

  test('een lid kan geen uitnodiging maken', async () => {
    const { a } = await twoHouseholds(db)
    const u = await createUser(db)
    await addMember(db, a.household.id, u.id, 'member')
    await expect(createMemberInvite(await resolveCtx(db, u.id))).rejects.toBeInstanceOf(Forbidden)
  })

  test('een verlopen uitnodiging is ongeldig en kan niet verbruikt worden', async () => {
    const { a } = await twoHouseholds(db)
    const created = await createMemberInvite(a, new Date('2026-01-01T00:00:00Z'))
    const later = new Date('2026-01-08T00:00:01Z')
    expect(await inspectInvite(db, created.token, later)).toEqual({ ok: false, problem: 'expired' })
    const u = await createUser(db)
    await expect(consumeInvite(db, created.token, u.id, later)).rejects.toThrow(/verlopen/)
  })

  test('een uitnodiging kan maar één keer gebruikt worden', async () => {
    const { a } = await twoHouseholds(db)
    const created = await createMemberInvite(a)
    const u1 = await createUser(db)
    const u2 = await createUser(db)
    await consumeInvite(db, created.token, u1.id)
    expect(await inspectInvite(db, created.token)).toEqual({ ok: false, problem: 'used' })
    await expect(consumeInvite(db, created.token, u2.id)).rejects.toBeInstanceOf(Invalid)
  })

  test('een ingetrokken uitnodiging is direct ongeldig', async () => {
    const { a } = await twoHouseholds(db)
    const created = await createMemberInvite(a)
    await revokeInvite(a, created.id)
    expect(await inspectInvite(db, created.token)).toEqual({ ok: false, problem: 'revoked' })
    expect(await listOpenInvites(a)).toEqual([])
  })

  test('een onbekend token is ongeldig', async () => {
    expect(await inspectInvite(db, 'bestaat-niet')).toEqual({ ok: false, problem: 'unknown' })
  })

  test('uitnodigingen van een ander huishouden zijn niet in te trekken of te zien', async () => {
    const { a, b } = await twoHouseholds(db)
    const created = await createMemberInvite(a)
    await expectHidden(revokeInvite(b, created.id))
    expect(await listOpenInvites(b)).toEqual([])
    expect(await inspectInvite(db, created.token)).toMatchObject({ ok: true })
  })

  test('alleen een beheerder maakt een uitnodiging voor een nieuw huishouden', async () => {
    const admin = await createUser(db, { role: 'admin' })
    const plain = await createUser(db)
    const created = await createHouseholdInvite(await loadUserCtx(db, admin.id), 'Familie Jansen')
    expect(await inspectInvite(db, created.token)).toMatchObject({
      ok: true,
      kind: 'new_household',
      householdName: 'Familie Jansen',
    })
    await expect(createHouseholdInvite(await loadUserCtx(db, plain.id), 'X')).rejects.toBeInstanceOf(
      Forbidden,
    )
  })
})
