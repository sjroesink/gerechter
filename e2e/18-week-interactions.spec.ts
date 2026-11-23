import { E2E_DATABASE_URL } from '../playwright.config'
import { admin, expectMobileLayout, login, sql } from './helpers'
import { expect, test } from './test'

test.describe.configure({ mode: 'serial' })
test.use({ actionTimeout: 10_000 })

const ids = {
  recipeA: crypto.randomUUID(),
  mealA: crypto.randomUUID(),
  mealB: crypto.randomUUID(),
}

test.beforeAll(async () => {
  expect(new URL(E2E_DATABASE_URL).pathname).toBe('/gerechter_e2e')
  const [household] = await sql(`select id from household where name = 'Huishouden van Beheerder'`)
  await sql(
    'insert into recipe (id, household_id, name, normalized_name, servings) values ($1, $2, $3, $4, $5)',
    [ids.recipeA, household.id, 'Pasta pesto weektest', 'pasta pesto weektest', 2],
  )
  await sql(
    `insert into planned_meal (id, household_id, date, kind, recipe_id, servings, note)
     values ($1, $2, '2027-01-11', 'recipe', $3, 3, 'Met pijnboompitten')`,
    [ids.mealA, household.id, ids.recipeA],
  )
  await sql(
    `insert into planned_meal (id, household_id, date, kind, title, note)
     values ($1, $2, '2027-01-14', 'free', 'Pannenkoeken eten', '')`,
    [ids.mealB, household.id],
  )
})

test.afterAll(async () => {
  await sql('delete from planned_meal where id = any($1::text[])', [[ids.mealA, ids.mealB]])
  await sql('delete from recipe where id = $1', [ids.recipeA])
})

test('driepuntmenu verplaatst gerechten omhoog en omlaag en verwijdert na bevestiging', async ({ page }) => {
  await login(page, admin.email)
  await page.goto('/week?week=2027-01-11')
  await expectMobileLayout(page)

  // Op maandag is "Omhoog plaatsen" uitgeschakeld en verplaatst "Omlaag plaatsen" naar dinsdag.
  const monday = page.locator('[data-drop-date="2027-01-11"]')
  const tuesday = page.locator('[data-drop-date="2027-01-12"]')
  await expect(monday).toContainText('Pasta pesto weektest')

  await page.getByRole('button', { name: 'Opties voor Pasta pesto weektest' }).click()
  const menu = page.getByRole('menu', { name: 'Acties voor Pasta pesto weektest' })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: /Omhoog plaatsen/ })).toBeDisabled()
  const moveDownDone = page.waitForResponse((res) => res.request().method() === 'POST' && res.ok())
  await menu.getByRole('menuitem', { name: /Omlaag plaatsen/ }).click()
  await moveDownDone

  await expect(tuesday).toContainText('Pasta pesto weektest')
  await expect(monday).toContainText('Plan iets')
  await expect(page.getByRole('list', { name: 'Dagen' })).not.toHaveAttribute('data-busy')
  await page.reload()
  await expect(page.locator('[data-drop-date="2027-01-12"]')).toContainText('Pasta pesto weektest')

  // Vanaf dinsdag weer omhoog terug naar maandag.
  await page.getByRole('button', { name: 'Opties voor Pasta pesto weektest' }).click()
  const moveUpDone = page.waitForResponse((res) => res.request().method() === 'POST' && res.ok())
  await page.getByRole('menuitem', { name: /Omhoog plaatsen/ }).click()
  await moveUpDone
  await expect(page.locator('[data-drop-date="2027-01-11"]')).toContainText('Pasta pesto weektest')
  await expect(page.getByRole('list', { name: 'Dagen' })).not.toHaveAttribute('data-busy')
})

test('gerechten verslepen tussen dagen op mobiel en desktop', async ({ page }) => {
  await login(page, admin.email)
  await page.goto('/week?week=2027-01-11')

  // Mobiel: versleep via het sleephandvat van maandag naar woensdag.
  const handle = page.locator(`[data-meal-id="${ids.mealA}"] [data-drag-handle]`)
  const wednesday = page.locator('[data-drop-date="2027-01-13"]')
  const fromBox = await handle.boundingBox()
  const toBox = await wednesday.boundingBox()
  expect(fromBox).not.toBeNull()
  expect(toBox).not.toBeNull()

  const mobileDropDone = page.waitForResponse((res) => res.request().method() === 'POST' && res.ok())
  await page.mouse.move(fromBox!.x + fromBox!.width / 2, fromBox!.y + fromBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(toBox!.x + toBox!.width / 2, toBox!.y + toBox!.height / 2, { steps: 12 })
  await page.mouse.up()
  await mobileDropDone

  await expect(wednesday).toContainText('Pasta pesto weektest')
  await expect(page.getByRole('list', { name: 'Dagen' })).not.toHaveAttribute('data-busy')
  await page.reload()
  await expect(page.locator('[data-drop-date="2027-01-13"]')).toContainText('Pasta pesto weektest')

  // Desktop: versleep van woensdag naar vrijdag in het raster.
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/week?week=2027-01-11')
  const mealCard = page.locator(`[data-meal-id="${ids.mealA}"]`)
  const friday = page.locator('[data-drop-date="2027-01-15"]')
  const cardBox = await mealCard.boundingBox()
  const fridayBox = await friday.boundingBox()
  expect(cardBox).not.toBeNull()
  expect(fridayBox).not.toBeNull()

  const desktopDropDone = page.waitForResponse((res) => res.request().method() === 'POST' && res.ok())
  await page.mouse.move(cardBox!.x + 30, cardBox!.y + cardBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(fridayBox!.x + fridayBox!.width / 2, fridayBox!.y + fridayBox!.height / 2, {
    steps: 12,
  })
  await page.mouse.up()
  await desktopDropDone

  await expect(friday).toContainText('Pasta pesto weektest')
  await expect(page.getByRole('list', { name: 'Dagen' })).not.toHaveAttribute('data-busy')
  await page.reload()
  await expect(page.locator('[data-drop-date="2027-01-15"]')).toContainText('Pasta pesto weektest')
})

test('gerecht wegswipen vraagt om bevestiging en verwijdert pas na akkoord', async ({ page }) => {
  await login(page, admin.email)
  await page.goto('/week?week=2027-01-11')
  await expectMobileLayout(page)

  const thursday = page.locator('[data-drop-date="2027-01-14"]')
  await expect(thursday).toContainText('Pannenkoeken eten')

  async function swipeLeftOn(mealId: string) {
    const row = page.locator(`[data-meal-id="${mealId}"]`)
    const box = await row.boundingBox()
    expect(box).not.toBeNull()
    const y = box!.y + box!.height / 2
    await page.mouse.move(box!.x + box!.width - 60, y)
    await page.mouse.down()
    await page.mouse.move(box!.x + 20, y, { steps: 10 })
    await page.mouse.up()
  }

  // Eerste swipe: annuleren behoudt het gerecht.
  await swipeLeftOn(ids.mealB)
  const dialog = page.getByRole('dialog', { name: 'Uit planning verwijderen?' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Pannenkoeken eten')
  await dialog.getByRole('button', { name: 'Annuleren', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(thursday).toContainText('Pannenkoeken eten')

  // Tweede swipe: bevestigen verwijdert het gerecht uit de planning.
  await swipeLeftOn(ids.mealB)
  await expect(dialog).toBeVisible()
  const swipeRemoveDone = page.waitForResponse((res) => res.request().method() === 'POST' && res.ok())
  await dialog.getByRole('button', { name: 'Verwijderen', exact: true }).click()
  await swipeRemoveDone
  await expect(dialog).toBeHidden()
  await expect(thursday).toContainText('Plan iets')
  await expect(page.getByRole('list', { name: 'Dagen' })).not.toHaveAttribute('data-busy')
  await page.reload()
  await expect(page.locator('[data-drop-date="2027-01-14"]')).toContainText('Plan iets')

  // Ook via het driepuntmenu verwijderen na bevestiging.
  await page.getByRole('button', { name: 'Opties voor Pasta pesto weektest' }).click()
  await page.getByRole('menuitem', { name: 'Uit planning verwijderen' }).click()
  await expect(dialog).toBeVisible()
  const menuRemoveDone = page.waitForResponse((res) => res.request().method() === 'POST' && res.ok())
  await dialog.getByRole('button', { name: 'Verwijderen', exact: true }).click()
  await menuRemoveDone
  await expect(page.locator('[data-drop-date="2027-01-15"]')).toContainText('Plan iets')
  await expect(page.getByRole('list', { name: 'Dagen' })).not.toHaveAttribute('data-busy')
})
