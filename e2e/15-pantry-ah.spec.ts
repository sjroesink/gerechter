import { admin, login, logout, sql } from './helpers'
import { E2E_DATABASE_URL } from '../playwright.config'
import { expect, test, waitForHydrationOnGoto } from './test'

test.beforeAll(() => {
  expect(new URL(E2E_DATABASE_URL).pathname).toBe('/gerechter_e2e')
})

test.describe.configure({ mode: 'serial' })
test.use({ actionTimeout: 10_000 })

async function ingredientId() {
  const [row] = await sql(`select id from ingredient where name = 'Tomaten in blokjes'`)
  expect(row).toBeDefined()
  return row.id as string
}

test('voorraad heeft een herkenbare link naar het juiste ingrediënt en behoudt detailrijen', async ({
  page,
}) => {
  const id = await ingredientId()
  await login(page, admin.email)
  await page.goto(`/voorraad/${id}`)
  const link = page.getByRole('link', { name: 'Ingrediënt bekijken', exact: true })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', `/meer/ingredienten/${id}`)
  await expect(page.getByRole('link', { name: /Eenheid/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Ook bekend als/ })).toBeVisible()
  await link.click()
  await expect(page).toHaveURL(new RegExp(`/meer/ingredienten/${id}$`))
  await expect(page.getByRole('heading', { name: 'Tomaten in blokjes', exact: true })).toBeVisible()
})

test('voorraad toont AH-toegang zonder automatisch een product of voorraad te wijzigen', async ({ page }) => {
  const id = await ingredientId()
  await login(page, admin.email)
  const before = await sql('select * from pantry_item order by id')
  const movements = await sql('select * from pantry_movement order by id')
  const links = await sql('select * from ingredient_ah_product order by id')
  await page.goto(`/voorraad/${id}`)
  const section = page.getByRole('region', { name: 'AH-product' })
  await expect(section).toBeVisible()
  await expect(section).toContainText('Nog geen AH-product gekoppeld.')
  await section.getByRole('link', { name: 'AH-product koppelen', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/meer/ingredienten/${id}#ah-product$`))
  await expect(page.getByRole('region', { name: 'AH-product' })).toContainText(
    'Laat een eigenaar eerst AH koppelen',
  )
  expect(await sql('select * from ingredient_ah_product order by id')).toEqual(links)
  expect(await sql('select * from pantry_item order by id')).toEqual(before)
  expect(await sql('select * from pantry_movement order by id')).toEqual(movements)
})

test('annuleren van navigatie bewaart onopgeslagen telling, basisvoorraad, reden en notitie', async ({
  page,
}) => {
  const id = await ingredientId()
  await login(page, admin.email)
  await page.goto(`/voorraad/${id}`)
  await page.getByRole('switch', { name: 'Basisvoorraad', exact: true }).uncheck()
  await page.getByLabel('Hoeveelheid (g)', { exact: true }).fill('123')
  await page.getByRole('switch', { name: 'Basisvoorraad', exact: true }).check()
  await page.getByRole('combobox', { name: 'Reden', exact: true }).selectOption('correction')
  await page.getByLabel('Notitie', { exact: true }).fill('Nog niet opgeslagen')
  const dialogs: string[] = []
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message())
    await dialog.dismiss()
  })
  for (const name of ['Ingrediënt bekijken', 'AH-product koppelen']) {
    await page.getByRole('link', { name, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/voorraad/${id}$`))
  }
  expect(dialogs).toHaveLength(2)
  expect(dialogs[0]).toContain('Niet-opgeslagen')
  await expect(page.getByLabel('Notitie', { exact: true })).toHaveValue('Nog niet opgeslagen')
  await expect(page.getByRole('combobox', { name: 'Reden', exact: true })).toHaveValue('correction')
  await expect(page.getByRole('switch', { name: 'Basisvoorraad', exact: true })).toBeChecked()
  await page.getByRole('switch', { name: 'Basisvoorraad', exact: true }).uncheck()
  await expect(page.getByLabel('Hoeveelheid (g)', { exact: true })).toHaveValue('123')
  const before = await sql('select * from pantry_item order by id')
  page.removeAllListeners('dialog')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('link', { name: 'Ingrediënt bekijken', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/meer/ingredienten/${id}$`))
  expect(await sql('select * from pantry_item order by id')).toEqual(before)
})

test('AH-koppelen vanuit voorraad gebruikt de bestaande fixturezoeker en schrijft alleen na bevestigen', async ({
  page,
}) => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    'Alleen de geïsoleerde AH-transportfixture; geen live AH-account.',
  )
  const id = await ingredientId()
  await login(page, admin.email)
  const tables = [
    'pantry_item',
    'pantry_movement',
    'recipe',
    'recipe_ingredient',
    'planned_meal',
    'sync_run',
    'sync_source_claim',
  ]
  const snapshot = async () => Promise.all(tables.map((table) => sql(`select * from ${table} order by id`)))
  const before = await snapshot()
  await page.goto('/meer/boodschappen/verbindingen')
  await page.getByLabel('AH-aanmeldcode of callback-URL').fill('appie://login-exit?code=pantry-fixture-code')
  await page.getByRole('button', { name: 'AH verbinden', exact: true }).click()
  await expect(
    page.getByText('AH-verbinding ingesteld. Er zijn geen boodschappen verzonden.', { exact: true }),
  ).toBeVisible()
  await page.goto(`/voorraad/${id}`)
  await page.getByRole('link', { name: 'AH-product koppelen', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/meer/ingredienten/${id}#ah-product$`))
  const section = page.getByRole('region', { name: 'AH-product' })
  await section.getByRole('button', { name: 'AH-product koppelen', exact: true }).click()
  await expect(page.getByLabel('Zoek bij Albert Heijn')).toHaveValue('Tomaten in blokjes')
  await page.context().route('**/*', async (route) => {
    if (route.request().postData()?.includes('fixture-search-error')) await route.abort()
    else await route.continue()
  })
  await page.getByLabel('Zoek bij Albert Heijn').fill('fixture-search-error')
  await page.getByRole('button', { name: 'Zoeken', exact: true }).click()
  await expect(section.getByRole('alert')).toContainText('Zoeken bij AH is niet gelukt.')
  await page.getByLabel('Zoek bij Albert Heijn').fill('bestaat-niet-fixture')
  await page.getByRole('button', { name: 'Zoeken', exact: true }).click()
  await expect(section).toContainText('Geen producten gevonden.')
  await page.getByLabel('Zoek bij Albert Heijn').fill('tomaten')
  await page.getByRole('button', { name: 'Zoeken', exact: true }).click()
  await page.getByRole('button', { name: /AH Trostomaten/ }).click()
  expect(await sql('select * from ingredient_ah_product where ingredient_id = $1', [id])).toEqual([])
  expect(await snapshot()).toEqual(before)
  await page.getByRole('button', { name: 'Product koppelen', exact: true }).click()
  await expect(section.getByRole('button', { name: 'Ontkoppelen', exact: true })).toBeVisible()
  await expect(section).toContainText('AH Trostomaten')
  const [linked] = await sql('select * from ingredient_ah_product where ingredient_id = $1', [id])
  expect(linked.product_id).toBe(4471)
  await page.goto(`/voorraad/${id}`)
  await expect(page.getByRole('region', { name: 'AH-product' })).toContainText('AH Trostomaten')
  await expect(page.getByRole('region', { name: 'AH-product' })).toContainText('Inhoud 500 g')
  await page.getByRole('link', { name: 'AH-product bekijken of wijzigen', exact: true }).click()
  await section.getByRole('button', { name: 'Ontkoppelen', exact: true }).click()
  await expect(section.getByRole('button', { name: 'AH-product koppelen', exact: true })).toBeVisible()
  await page.goto(`/voorraad/${id}`)
  await expect(page.getByRole('region', { name: 'AH-product' })).toContainText(
    'Nog geen AH-product gekoppeld.',
  )
  expect(await snapshot()).toEqual(before)
  await page.goto('/meer/boodschappen/verbindingen')
  await page.getByRole('button', { name: 'AH loskoppelen', exact: true }).click()
  await expect(page.getByText('Nog geen AH-verbinding ingesteld.', { exact: true })).toBeVisible()
})

test('voorraad toont alleen de huishoudkoppeling, ook voor een lid met alleen leesrechten op het globale ingrediënt', async ({
  page,
}) => {
  const id = await ingredientId()
  const [household] = await sql(`select id from household where name = 'Familie de Vries'`)
  await sql(
    `insert into ingredient_ah_product (id, household_id, ingredient_id, product_id, title, unit_size, pack_amount)
    values ('pantry-fixture-member', $1, $2, 1525, 'AH Uien · huishoudfixture', '1 kg', 1000)`,
    [household.id, id],
  )
  try {
    await login(page, admin.email)
    await page.goto(`/voorraad/${id}`)
    await expect(page.getByRole('region', { name: 'AH-product' })).not.toContainText('huishoudfixture')
    await logout(page)
    await login(page, 'tim@e2e.test', 'nieuw-wachtwoord-123')
    await page.goto(`/voorraad/${id}`)
    await expect(page.getByRole('region', { name: 'AH-product' })).toContainText('AH Uien · huishoudfixture')
    await page.getByRole('link', { name: 'AH-product bekijken of wijzigen', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Gegevens wijzigen', exact: true })).toHaveCount(0)
    const section = page.getByRole('region', { name: 'AH-product' })
    await expect(section.getByRole('button', { name: 'Ontkoppelen', exact: true })).toBeVisible()
    await expect(section.getByRole('button', { name: 'Ander product', exact: true })).toHaveCount(0)
    await section.getByRole('button', { name: 'Ontkoppelen', exact: true }).click()
    await expect(section).not.toContainText('huishoudfixture')
    expect(await sql('select * from ingredient_ah_product where id = $1', ['pantry-fixture-member'])).toEqual(
      [],
    )
    await page.goto('/voorraad/geen-bestaand-ingredient')
    await expect(page.getByRole('alert')).toContainText('Ingrediënt niet gevonden')
    const [privateIngredient] = await sql(`select id from ingredient where name = 'Mijn geheime kruiden'`)
    await logout(page)
    await login(page, admin.email)
    await page.goto(`/voorraad/${privateIngredient.id}`)
    await expect(page.getByRole('alert')).toContainText('Ingrediënt niet gevonden')
  } finally {
    await sql('delete from ingredient_ah_product where id = $1', ['pantry-fixture-member'])
  }
})

test('compacte voorraadnavigatie en productinformatie passen op mobiel en desktop, ook in het archief', async ({
  page,
  browser,
}, testInfo) => {
  const id = await ingredientId()
  const [household] = await sql(`select id from household where name = 'Huishouden van Beheerder'`)
  await login(page, admin.email)
  for (const width of [390, 320, 1280]) {
    if (width === 1280) {
      page = waitForHydrationOnGoto(
        await browser.newPage({
          storageState: await page.context().storageState(),
          viewport: { width, height: 900 },
          isMobile: false,
          hasTouch: false,
        }),
      )
    }
    await page.setViewportSize({ width, height: width === 1280 ? 900 : 844 })
    for (const mapped of [false, true]) {
      if (mapped) {
        await sql(
          `insert into ingredient_ah_product (id, household_id, ingredient_id, product_id, title, unit_size, pack_amount)
          values ('pantry-fixture-layout', $1, $2, 4471, 'AH Trostomaten in een extra lange voorbeeldverpakking', '500 g', 500)`,
          [household.id, id],
        )
        await sql('update ingredient set archived_at = now() where id = $1', [id])
      }
      try {
        await page.goto(`/voorraad/${id}`)
        await expect(page.getByRole('link', { name: 'Ingrediënt bekijken', exact: true })).toBeVisible()
        await expect(page.getByRole('region', { name: 'AH-product' })).toContainText(
          mapped ? 'Inhoud 500 g' : 'Nog geen AH-product gekoppeld.',
        )
        if (mapped)
          await expect(page.getByText('Dit ingrediënt is gearchiveerd.', { exact: false })).toBeVisible()
        for (const colorScheme of ['light', 'dark'] as const) {
          await page.emulateMedia({ colorScheme })
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
          ).toBeLessThanOrEqual(0)
          const targets = page.getByRole('link', {
            name: /Ingrediënt bekijken|AH-product koppelen|AH-product bekijken of wijzigen/,
          })
          for (const target of await targets.all()) {
            const box = await target.boundingBox()
            expect(box?.width).toBeGreaterThanOrEqual(44)
            expect(box?.height).toBeGreaterThanOrEqual(44)
          }
          await page.screenshot({
            path: testInfo.outputPath(`pantry-${width}-${mapped ? 'mapped' : 'unmapped'}-${colorScheme}.png`),
            fullPage: true,
          })
        }
        await page
          .getByRole('link', {
            name: mapped ? 'AH-product bekijken of wijzigen' : 'AH-product koppelen',
            exact: true,
          })
          .click()
        await expect(page).toHaveURL(new RegExp(`/meer/ingredienten/${id}#ah-product$`))
        await expect(page.getByRole('region', { name: 'AH-product' })).toBeInViewport()
      } finally {
        await sql('delete from ingredient_ah_product where id = $1', ['pantry-fixture-layout'])
        await sql('update ingredient set archived_at = null where id = $1', [id])
      }
    }
    if (width === 1280) await page.close()
  }
})

test('AH-toegang legt een niet-ingeschakelde installatie uit zonder voorraad te wijzigen', async ({
  page,
}) => {
  test.skip(!process.env.E2E_AH_DISABLED, 'Afzonderlijke productieserverfixture zonder AH-configuratie.')
  const id = await ingredientId()
  const before = await sql('select * from pantry_item order by id')
  await login(page, admin.email)
  await page.goto(`/voorraad/${id}`)
  await page.getByRole('link', { name: 'AH-product koppelen', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/meer/ingredienten/${id}#ah-product$`))
  const section = page.getByRole('region', { name: 'AH-product' })
  await expect(section).toBeVisible()
  await expect(section).toContainText('AH is niet ingeschakeld voor deze installatie.')
  await expect(section.getByRole('button')).toHaveCount(0)
  expect(await sql('select * from pantry_item order by id')).toEqual(before)
})
