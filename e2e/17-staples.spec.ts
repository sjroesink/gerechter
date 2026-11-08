import { admin, expectMobileLayout, login, sql } from './helpers'
import { expect, test } from './test'

test.describe.configure({ mode: 'serial' })

const stapleQuery = `
  update pantry_item set staple = $2
  where ingredient_id = (select id from ingredient where name = 'Tomaten in blokjes')
    and household_id in (
      select m.household_id from membership m join "user" u on u.id = m.user_id where u.email = $1
    )
  returning id`

test('basisvoorraad per ingrediënt alsnog op de lijst zetten', async ({ page }, testInfo) => {
  expect(await sql(stapleQuery, [admin.email, true])).toHaveLength(1)
  try {
    const [recipe] = await sql(
      `select id from recipe where name like 'Tomatensoep%' order by created_at limit 1`,
    )
    await login(page, admin.email)
    await page.goto(`/meer/boodschappen?kind=recipe&recipeId=${recipe.id}&servings=4`)
    const staples = page.getByRole('region', { name: 'Basisvoorraad uitgesloten' })
    const add = staples.getByRole('checkbox', { name: 'Tomaten in blokjes op de lijst zetten', exact: true })
    await expect(add).not.toBeChecked()
    await expect(staples).toContainText('Altijd in huis · vink aan om toch te kopen')
    await add.check()
    // Like any item, counted stock is subtracted: 800 g needed, 100 g in stock.
    await expect(staples).toContainText('700 g te kopen')
    await expect(page.getByText(/· 1 uit basisvoorraad$/)).toBeVisible()
    await expectMobileLayout(page)
    await page.screenshot({ path: testInfo.outputPath('staple-included.png'), fullPage: true })
    await page.getByRole('button', { name: /^Delen/ }).click()
    // The shopping spec already shared this recipe.
    await page.getByRole('checkbox', { name: 'Bewust opnieuw exporteren naar dit doel' }).check()
    await page.getByRole('button', { name: 'Zet op lijst · Delen', exact: true }).click()
    const list = page.getByLabel('Boodschappenlijst')
    await expect(list).toContainText('700 g · Tomaten in blokjes')
    await expect(list).not.toContainText('Basisvoorraad (niet toegevoegd)')
  } finally {
    await sql(stapleQuery, [admin.email, false])
  }
})
