import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { E2E_DATABASE_URL } from '../playwright.config'
import { admin, login, sql } from './helpers'
import { expect, test } from './test'

test.describe.configure({ mode: 'serial' })
const ids = {
  a: crypto.randomUUID(),
  b: crypto.randomUUID(),
  none: crypto.randomUUID(),
  imageA: crypto.randomUUID(),
  imageB: crypto.randomUUID(),
}
const title = 'Fotofixture traybake met krieltjes, zalm en broccoli'

test.beforeAll(async () => {
  expect(new URL(E2E_DATABASE_URL).pathname).toBe('/gerechter_e2e')
  const [household] = await sql(`select id from household where name = 'Huishouden van Beheerder'`)
  // Public app icons stand in for dish photographs, served through the real private-image route.
  for (const [id, filename] of [
    [ids.imageA, 'icon-192.png'],
    [ids.imageB, 'icon-512.png'],
  ]) {
    const bytes = readFileSync(new URL(`../public/pwa/${filename}`, import.meta.url))
    await sql(
      'insert into image (id, household_id, content_type, bytes, byte_size, sha256) values ($1,$2,$3,$4,$5,$6)',
      [id, household.id, 'image/png', bytes, bytes.length, createHash('sha256').update(bytes).digest('hex')],
    )
  }
  for (const [id, name, image] of [
    [ids.a, title, ids.imageA],
    [ids.b, 'Fotofixture tweede gerecht', ids.imageB],
    [ids.none, 'Fotofixture zonder afbeelding', null],
  ]) {
    await sql(
      'insert into recipe (id, household_id, name, normalized_name, servings, photo_image_id) values ($1,$2,$3,$4,2,$5)',
      [id, household.id, name, String(name).toLowerCase(), image],
    )
  }
})
test.afterAll(async () => {
  await sql('delete from planned_meal where recipe_id = any($1::text[])', [[ids.a, ids.b, ids.none]])
  await sql('delete from recipe where id = any($1::text[])', [[ids.a, ids.b, ids.none]])
  await sql('delete from image where id = any($1::text[])', [[ids.imageA, ids.imageB]])
})

test('gekozen gerecht toont een compacte foto uit de bestaande privéafbeelding', async ({ page }) => {
  await login(page, admin.email)
  await page.goto(`/week/nieuw?date=2027-01-08&recipeId=${ids.a}`)
  const selected = page.getByRole('region', { name: 'Gekozen maaltijd' })
  await expect(selected).toContainText(title)
  const image = selected.locator('img')
  await expect(image).toHaveAttribute('src', `/afbeeldingen/${ids.imageA}`)
  await expect(image).toHaveAttribute('alt', '')
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  const box = await image.boundingBox()
  expect(box?.width).toBeGreaterThanOrEqual(64)
  expect(box?.width).toBeLessThanOrEqual(80)
  expect(box?.height).toBe(box?.width)
  expect(await image.evaluate((img) => getComputedStyle(img).objectFit)).toBe('cover')
  await expect(page.getByLabel('Datum', { exact: true })).toHaveValue('2027-01-08')
})

test('ander gerecht kiezen vervangt de foto en behoudt datum, personen en notitie', async ({ page }) => {
  await login(page, admin.email)
  await page.goto(`/week/nieuw?date=2027-01-08&recipeId=${ids.a}`)
  await page.getByLabel('Datum', { exact: true }).fill('2027-01-09')
  await page.getByRole('button', { name: 'Meer personen', exact: true }).click()
  await page.getByRole('textbox', { name: 'Notitie bij maaltijd', exact: true }).fill('Bewaar mijn planning')
  await page.getByRole('button', { name: 'Iets anders kiezen', exact: true }).click()
  await page.getByRole('button', { name: 'Fotofixture tweede gerecht', exact: true }).click()
  const selected = page.getByRole('region', { name: 'Gekozen maaltijd' })
  await expect(selected.locator('img')).toHaveAttribute('src', `/afbeeldingen/${ids.imageB}`)
  await expect(page.getByLabel('Datum', { exact: true })).toHaveValue('2027-01-09')
  await expect(page.getByRole('region', { name: 'Details', exact: true }).getByRole('status')).toHaveText('3')
  await expect(page.getByRole('textbox', { name: 'Notitie bij maaltijd', exact: true })).toHaveValue(
    'Bewaar mijn planning',
  )
  await page.getByRole('button', { name: 'Iets anders kiezen', exact: true }).click()
  await page.getByRole('button', { name: 'Fotofixture zonder afbeelding', exact: true }).click()
  await expect(selected).toContainText('Fotofixture zonder afbeelding')
  await expect(selected.locator('img')).toHaveCount(0)
  await expect(selected.locator('span[aria-hidden="true"]')).toHaveText('F')
  await expect(page.getByLabel('Datum', { exact: true })).toHaveValue('2027-01-09')
  await expect(page.getByRole('textbox', { name: 'Notitie bij maaltijd', exact: true })).toHaveValue(
    'Bewaar mijn planning',
  )
})

test('een opgeslagen maaltijd behoudt de foto en gegevens in het bewerkformulier', async ({ page }) => {
  await login(page, admin.email)
  await page.goto(`/week/nieuw?date=2027-01-08&recipeId=${ids.a}`)
  await page.getByRole('button', { name: 'Meer personen', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Notitie bij maaltijd', exact: true })
    .fill('Fotofixture maaltijdnotitie')
  await page.getByRole('button', { name: 'Maaltijd opslaan', exact: true }).click()
  await expect(page).toHaveURL(/\/week\?week=2027-01-08$/)
  await page.getByRole('link', { name: title }).click()
  await expect(page).toHaveURL(/\/week\/maaltijd\/[^/?]+$/)
  const path = new URL(page.url()).pathname
  await page.goto(`${path}/bewerken`)
  await expect(page.getByRole('region', { name: 'Gekozen maaltijd' }).locator('img')).toHaveAttribute(
    'src',
    `/afbeeldingen/${ids.imageA}`,
  )
  await expect(page.getByLabel('Datum', { exact: true })).toHaveValue('2027-01-08')
  await expect(page.getByRole('region', { name: 'Details', exact: true }).getByRole('status')).toHaveText('3')
  await expect(page.getByRole('textbox', { name: 'Notitie bij maaltijd', exact: true })).toHaveValue(
    'Fotofixture maaltijdnotitie',
  )
})

test('fotokaart en fallback blijven compact op mobiel en desktop in beide thema’s', async ({
  page,
}, testInfo) => {
  await login(page, admin.email)
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: width === 1280 ? 900 : 844 })
    for (const hasPhoto of [true, false]) {
      await page.goto(`/week/nieuw?date=2027-01-08&recipeId=${hasPhoto ? ids.a : ids.none}`)
      const selected = page.getByRole('region', { name: 'Gekozen maaltijd' })
      await expect(selected).toContainText(hasPhoto ? title : 'Fotofixture zonder afbeelding')
      await expect(selected.locator('img')).toHaveCount(hasPhoto ? 1 : 0)
      if (hasPhoto)
        await expect
          .poll(() => selected.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
          .toBeGreaterThan(0)
      else await expect(selected.locator('span[aria-hidden="true"]')).toHaveText('F')
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        ).toBeLessThanOrEqual(0)
        const change = await selected
          .getByRole('button', { name: 'Iets anders kiezen', exact: true })
          .boundingBox()
        expect(change?.height).toBeGreaterThanOrEqual(44)
        await expect(page.getByRole('button', { name: 'Maaltijd opslaan', exact: true })).toBeVisible()
        await page.screenshot({
          path: testInfo.outputPath(
            `planning-${width}-${hasPhoto ? 'photo' : 'fallback'}-${colorScheme}.png`,
          ),
          fullPage: true,
        })
      }
    }
  }
})

test('een onbereikbare foto gebruikt de bestaande fallback zonder kapot afbeeldingsicoon', async ({
  page,
}) => {
  await sql('update recipe set photo_url = $1 where id = $2', [
    'https://images.e2e.test/broken-planning.png',
    ids.none,
  ])
  try {
    await page
      .context()
      .route('https://images.e2e.test/broken-planning.png', (route) =>
        route.fulfill({ status: 404, body: 'Fixture: ontbrekend beeld' }),
      )
    await login(page, admin.email)
    // Hold application chunks until the SSR image has really failed, before React can attach onError.
    let release!: () => void
    const failedBeforeHydration = new Promise<void>((resolve) => {
      release = resolve
    })
    const errorHydrationStates: boolean[] = []
    await page.exposeFunction('planningFixtureImageError', (hydrated: boolean) => {
      errorHydrationStates.push(hydrated)
      release()
    })
    await page.addInitScript(() => {
      document.addEventListener(
        'error',
        (event) => {
          if (event.target instanceof HTMLImageElement && event.target.src.endsWith('/broken-planning.png')) {
            void (
              window as unknown as Window & {
                planningFixtureImageError: (hydrated: boolean) => Promise<void>
              }
            ).planningFixtureImageError(document.documentElement.hasAttribute('data-hydrated'))
          }
        },
        true,
      )
    })
    await page.context().route('**/assets/*.js', async (route) => {
      await failedBeforeHydration
      await route.continue()
    })
    await page.goto(`/week/nieuw?date=2027-01-08&recipeId=${ids.none}`)
    expect(errorHydrationStates).toContain(false)
    const selected = page.getByRole('region', { name: 'Gekozen maaltijd' })
    await expect(selected.locator('img')).toHaveCount(0)
    await expect(selected.locator('span[aria-hidden="true"]')).toHaveText('F')
    await page.getByRole('button', { name: 'Iets anders kiezen', exact: true }).click()
    await page.getByRole('button', { name: 'Fotofixture tweede gerecht', exact: true }).click()
    await expect(selected.locator('img')).toHaveAttribute('src', `/afbeeldingen/${ids.imageB}`)
  } finally {
    await sql('update recipe set photo_url = null where id = $1', [ids.none])
  }
})

test('voorselectie met een gerecht uit een ander huishouden geeft geen foto of gegevens vrij', async ({
  page,
}) => {
  await login(page, 'sanne@e2e.test')
  await page.goto(`/week/nieuw?date=2027-01-08&recipeId=${ids.a}`)
  await expect(page.getByRole('alert')).toContainText('Gerecht niet gevonden')
  await expect(page.locator(`img[src="/afbeeldingen/${ids.imageA}"]`)).toHaveCount(0)
  await expect(page.getByText(title, { exact: true })).toHaveCount(0)
})
