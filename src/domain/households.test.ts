import { eq } from 'drizzle-orm'
import { describe, expect, test } from 'vitest'
import { user } from '~/db/schema'
import { setupTestDb } from '../../tests/db'
import { addMember, createUser, twoHouseholds } from '../../tests/fixtures'
import { expectHidden } from '../../tests/isolation'
import { Conflict, Forbidden, NoActiveHousehold, loadUserCtx, resolveCtx } from './core'
import {
  changeMemberRole,
  getMembers,
  leaveHousehold,
  listMyHouseholds,
  removeMember,
  switchHousehold,
} from './households'

const db = setupTestDb()

async function householdWithMember() {
  const { a, b } = await twoHouseholds(db)
  const m = await createUser(db, { name: 'Mila' })
  await addMember(db, a.household.id, m.id, 'member')
  return { owner: a, other: b, member: await resolveCtx(db, m.id) }
}

describe('ledenlijst en rollen', () => {
  test('een lid ziet alle leden met hun rol', async () => {
    const { owner, member } = await householdWithMember()
    const members = await getMembers(member)
    expect(members.map((m) => [m.name, m.role, m.isMe])).toEqual([
      ['Anna', 'owner', false],
      ['Mila', 'member', true],
    ])
    expect(owner.household.id).toBe(member.household.id)
  })

  test('de enige eigenaar kan zichzelf niet degraderen of vertrekken', async () => {
    const { owner } = await householdWithMember()
    await expect(changeMemberRole(owner, owner.user.id, 'member')).rejects.toThrow(Conflict)
    await expect(leaveHousehold(owner)).rejects.toThrow(/minstens één eigenaar/)
  })

  test('eigenaar promoveert een lid; daarna kan de oorspronkelijke eigenaar wel vertrekken', async () => {
    const { owner, member } = await householdWithMember()
    await changeMemberRole(owner, member.user.id, 'owner')
    expect((await resolveCtx(db, member.user.id)).household.role).toBe('owner')
    await leaveHousehold(owner)
    await expect(resolveCtx(db, owner.user.id)).rejects.toBeInstanceOf(NoActiveHousehold)
  })

  test('een lid kan geen rollen wijzigen of anderen verwijderen, wel zelf vertrekken', async () => {
    const { owner, member } = await householdWithMember()
    await expect(changeMemberRole(member, member.user.id, 'owner')).rejects.toBeInstanceOf(Forbidden)
    await expect(removeMember(member, owner.user.id)).rejects.toBeInstanceOf(Forbidden)
    await leaveHousehold(member)
    expect((await getMembers(owner)).map((m) => m.name)).toEqual(['Anna'])
  })

  test('een verwijderd lid heeft direct geen toegang meer', async () => {
    const { owner, member } = await householdWithMember()
    await removeMember(owner, member.user.id)
    await expect(resolveCtx(db, member.user.id)).rejects.toBeInstanceOf(NoActiveHousehold)
  })
})

describe('actief huishouden', () => {
  test('wisselen blijft bewaard voor een volgende keer', async () => {
    const { owner, other } = await householdWithMember()
    await addMember(db, other.household.id, owner.user.id, 'member')
    const userCtx = await loadUserCtx(db, owner.user.id)
    expect((await listMyHouseholds(userCtx)).map((h) => h.name)).toEqual(['Huishouden A', 'Huishouden B'])

    await switchHousehold(userCtx, other.household.id)
    const [saved] = await db.select().from(user).where(eq(user.id, owner.user.id))
    expect(saved!.lastActiveHouseholdId).toBe(other.household.id)
    expect((await resolveCtx(db, owner.user.id)).household).toMatchObject({
      name: 'Huishouden B',
      role: 'member',
    })
  })
})

describe('afscherming', () => {
  test('leden en rollen van een ander huishouden zijn onbereikbaar', async () => {
    const { owner, member, other } = await householdWithMember()
    await expectHidden(changeMemberRole(other, member.user.id, 'owner'))
    await expectHidden(removeMember(other, member.user.id))
    await expectHidden(switchHousehold(await loadUserCtx(db, other.user.id), owner.household.id))
    expect((await getMembers(other)).map((m) => m.name)).toEqual(['Bram'])
    expect((await resolveCtx(db, member.user.id)).household.role).toBe('member')
  })
})
