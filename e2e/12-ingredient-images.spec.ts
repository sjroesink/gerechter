import { admin, expectMobileLayout, login } from './helpers'
import { expect, test } from './test'

test.describe.configure({ mode: 'serial' })
test.use({ actionTimeout: 10_000 })
let detailPath = ''
const firstPhoto = 'https://images.e2e.test/tomato-a.png'
const secondPhoto = 'https://images.e2e.test/tomato-b.png'

test.beforeEach(async ({ page }) => {
  await page.route('https://images.e2e.test/**', async (route) => {
    if (route.request().url().endsWith('broken.png'))
      return route.fulfill({ status: 404, body: 'niet gevonden' })
    await route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><circle cx="64" cy="72" r="44" fill="#d33"/><path d="M40 30L60 40L70 12L77 39L98 25L84 50L53 49Z" fill="#286b3b"/></svg>',
    })
  })
})

test('foto met bron opslaan en terugzien in catalogus, voorraad, kiezer en recept', async ({
  page,
}, testInfo) => {
  await login(page, admin.email)
  await page.goto('/meer/ingredienten')
  await page.getByRole('link', { name: /^Tomaten in blokjes/ }).click()
  detailPath = new URL(page.url()).pathname
  await page.getByRole('button', { name: 'Gegevens wijzigen', exact: true }).click()
  await page.getByText('Afbeelding (optioneel)', { exact: true }).click()
  await page.getByLabel('Foto-URL', { exact: true }).fill(firstPhoto)
  await page.getByLabel('Bronpagina van de foto', { exact: true }).fill('https://example.test/tomaat')
  await page.getByLabel('Fotograaf / bron', { exact: true }).fill('Testbeeldbron')
  await page
    .getByLabel('Licentie- of voorwaarden-URL', { exact: true })
    .fill('https://example.test/voorwaarden')
  await page.getByRole('button', { name: 'Opslaan', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Tomaten in blokjes', exact: true })).toHaveAttribute(
    'src',
    firstPhoto,
  )
  await expect(page.getByRole('link', { name: 'Foto: Testbeeldbron', exact: true })).toHaveAttribute(
    'href',
    'https://example.test/tomaat',
  )
  await expect(page.getByRole('link', { name: 'Gebruiksvoorwaarden', exact: true })).toHaveAttribute(
    'href',
    'https://example.test/voorwaarden',
  )
  await expectMobileLayout(page)
  await page.screenshot({ path: testInfo.outputPath('ingredient-photo.png'), fullPage: true })
  await page.getByRole('link', { name: 'Terug naar ingrediënten', exact: true }).click()
  await expect(page.getByRole('link', { name: /^Tomaten in blokjes/ }).locator('img')).toHaveAttribute(
    'src',
    firstPhoto,
  )
  await page.goto('/voorraad')
  await expect(page.getByRole('link', { name: /^Tomaten in blokjes/ }).locator('img')).toHaveAttribute(
    'src',
    firstPhoto,
  )
  await expectMobileLayout(page)
  await page.goto('/voorraad/nieuw')
  await page.getByLabel('Ingrediënt zoeken').fill('tomaat in blik')
  await page.getByRole('button', { name: 'Zoek ingrediënt', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Tomaten in blokjes', exact: true }).locator('img'),
  ).toHaveAttribute('src', firstPhoto)
  await expectMobileLayout(page)
  await page.goto('/gerechten')
  await page.getByRole('link', { name: /Tomatensoep na bereiding/ }).click()
  await expect(page.getByRole('region', { name: 'Ingrediëntenlijst' }).locator('img')).toHaveAttribute(
    'src',
    firstPhoto,
  )
  await expectMobileLayout(page)
})

test('kapotte foto krijgt een bruikbare fallback en kan worden vervangen', async ({ page }) => {
  await login(page, admin.email)
  await page.goto(detailPath)
  await page.getByRole('button', { name: 'Gegevens wijzigen', exact: true }).click()
  await page.getByLabel('Foto-URL', { exact: true }).fill('https://images.e2e.test/broken.png')
  await page.getByRole('button', { name: 'Opslaan', exact: true }).click()
  await expect(page.getByText('Geen afbeelding beschikbaar', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Tomaten in blokjes', exact: true })).toHaveCount(0)
  await expectMobileLayout(page)
  await page.getByRole('button', { name: 'Gegevens wijzigen', exact: true }).click()
  await page.getByLabel('Foto-URL', { exact: true }).fill(secondPhoto)
  await page.getByRole('button', { name: 'Opslaan', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Tomaten in blokjes', exact: true })).toHaveAttribute(
    'src',
    secondPhoto,
  )
})

test('een gewoon lid kan een globale foto lezen en niet wijzigen', async ({ page }) => {
  await login(page, 'tim@e2e.test', 'nieuw-wachtwoord-123')
  await page.goto(detailPath)
  await expect(page.getByRole('img', { name: 'Tomaten in blokjes', exact: true })).toHaveAttribute(
    'src',
    secondPhoto,
  )
  await expect(page.getByRole('button', { name: 'Gegevens wijzigen', exact: true })).toHaveCount(0)
  await expectMobileLayout(page)
})

test('een foto expliciet verwijderen bewaart het ingrediënt en de omrekening', async ({ page }) => {
  await login(page, admin.email)
  await page.goto(detailPath)
  await page.getByRole('button', { name: 'Gegevens wijzigen', exact: true }).click()
  await page.getByLabel('Foto-URL', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Opslaan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tomaten in blokjes', level: 1 })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Tomaten in blokjes', exact: true })).toHaveCount(0)
  await expect(page.getByText('1 blik = 400 g', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link', { name: 'Foto: Testbeeldbron', exact: true })).toHaveCount(0)
})
