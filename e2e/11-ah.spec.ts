import { admin, expectMobileLayout, login } from './helpers'
import { expect, test } from './test'

test.describe.configure({ mode: 'serial' })
test.use({ actionTimeout: 10_000 })
// The default runner starts an isolated ASGI service. Never log into a live AH account in this suite.
test.skip(
  Boolean(process.env.E2E_BASE_URL),
  'Deze contractflow gebruikt uitsluitend de door Playwright gestarte testsidecar.',
)
let exportPath = ''

test('eigenaar koppelt AH en exporteert via de echte sidecar met gecontroleerd AH-transport', async ({
  page,
}, testInfo) => {
  await login(page, admin.email)
  await page.goto('/meer/boodschappen/verbindingen')
  await expect(page.getByRole('link', { name: 'Aanmelden bij AH (nieuw tabblad)' })).toHaveAttribute(
    'href',
    /^https:\/\/login\.ah\.nl\//,
  )
  await page.getByLabel('AH-aanmeldcode of callback-URL').fill('appie://login-exit?code=browser-test-code')
  await page.getByRole('button', { name: 'AH verbinden', exact: true }).click()
  await expect(
    page.getByText('AH-verbinding ingesteld. Er zijn geen boodschappen verzonden.', { exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('AH-aanmeldcode of callback-URL')).toHaveValue('')
  expect(await page.content()).not.toContain('browser-test-code')
  await expectMobileLayout(page)
  await page.goto('/week/dag/2027-01-05')
  await page.getByRole('link', { name: 'Op lijst zetten', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Te kopen' })).toContainText('300 g te kopen')
  await page.getByRole('button', { name: /^Albert Heijn/ }).click()
  await expect(page.getByRole('button', { name: /^Albert Heijn/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Zet op lijst · Albert Heijn', exact: true }).click()
  await expect(page).toHaveURL(/\/meer\/boodschappen\/historie\/[^/?]+$/)
  exportPath = new URL(page.url()).pathname
  await expect(page.getByText('Verzonden', { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/Albert Heijn: 1 van 1 regels op de lijst/)).toBeVisible()
  await expect(page.getByLabel('Boodschappenlijst')).toContainText('300 g · Tomaten in blokjes')
  await expectMobileLayout(page)
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({ path: testInfo.outputPath('ah-export-dark.png'), fullPage: true })
  await page.reload()
  await expect(page.getByText('Verzonden', { exact: true })).toBeVisible()
})

test('AH-product koppelen vanuit boodschappen en ingrediëntpagina; export stuurt het product', async ({
  page,
}, testInfo) => {
  await login(page, admin.email)
  await page.goto('/week/dag/2027-01-05')
  await page.getByRole('link', { name: 'Op lijst zetten', exact: true }).click()
  await page.getByRole('button', { name: /^Albert Heijn/ }).click()
  const toBuy = page.getByRole('region', { name: 'Te kopen' })
  await expect(toBuy).toContainText('AH: als tekstregel')
  await toBuy.getByRole('button', { name: 'Koppel product', exact: true }).click()
  await expect(page.getByLabel('Zoek bij Albert Heijn')).toHaveValue('Tomaten in blokjes')
  await page.getByLabel('Zoek bij Albert Heijn').fill('tomaten')
  await page.getByRole('button', { name: 'Zoeken', exact: true }).click()
  await page.getByRole('button', { name: /AH Trostomaten/ }).click()
  await expect(page.getByLabel('Inhoud per verpakking in g')).toHaveValue('500')
  await expectMobileLayout(page)
  await page.getByRole('button', { name: 'Product koppelen', exact: true }).click()
  await expect(toBuy).toContainText('1× AH Trostomaten')
  await expect(toBuy).not.toContainText('aantal controleren')
  await expect(
    page.getByText('Wat al op je AH-lijst staat wordt overgeslagen', { exact: false }),
  ).toBeVisible()
  await expect(page.getByLabel('Bewust opnieuw exporteren naar dit doel')).toHaveCount(0)
  await page.getByRole('button', { name: 'Zet op lijst · Albert Heijn', exact: true }).click()
  await expect(page).toHaveURL(/\/meer\/boodschappen\/historie\/[^/?]+$/)
  await expect(page.getByText('Verzonden', { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/Albert Heijn: 1 van 1 regels op de lijst/)).toBeVisible()

  await page.goto('/meer/ingredienten')
  await page.getByLabel('Zoek ingrediënten').fill('tomaat in blik')
  await page.getByLabel('Zoek ingrediënten').press('Enter')
  await page.getByRole('link', { name: /Tomaten in blokjes/ }).click()
  const section = page.getByRole('region', { name: 'AH-product' })
  await expect(section).toContainText('AH Trostomaten')
  await expect(section).toContainText('Inhoud 500 g')
  // The product image became the ingredient photo, credited to AH.
  await expect(page.getByRole('link', { name: 'Foto: Albert Heijn' })).toHaveAttribute(
    'href',
    /^https:\/\/www\.ah\.nl\/producten\/product\/wi\d+$/,
  )
  await section.getByRole('button', { name: 'Ontkoppelen', exact: true }).click()
  await section.getByRole('button', { name: 'AH-product koppelen', exact: true }).click()
  await page.getByLabel('Zoek bij Albert Heijn').fill('tomaten')
  await page.getByRole('button', { name: 'Zoeken', exact: true }).click()
  await page.getByRole('button', { name: /AH Trostomaten/ }).click()
  await page.getByLabel('Inhoud per verpakking in g').fill('')
  await page.getByRole('button', { name: 'Product koppelen', exact: true }).click()
  await expect(section).toContainText('Inhoud onbekend · altijd 1 stuk')
  await expectMobileLayout(page)
  await page.goto('/week/dag/2027-01-05')
  await page.getByRole('link', { name: 'Op lijst zetten', exact: true }).click()
  await page.getByRole('button', { name: /^Albert Heijn/ }).click()
  await expect(toBuy).toContainText('1× AH Trostomaten')
  await expect(toBuy).toContainText('aantal controleren')
  await expectMobileLayout(page)
  await toBuy.screenshot({ path: testInfo.outputPath('ah-needs.png') })
  await page.goto('/meer/ingredienten')
  await page.getByLabel('Zoek ingrediënten').fill('tomaat in blik')
  await page.getByLabel('Zoek ingrediënten').press('Enter')
  await page.getByRole('link', { name: /Tomaten in blokjes/ }).click()
  await section.getByRole('button', { name: 'Ontkoppelen', exact: true }).click()
  await expect(section.getByRole('button', { name: 'AH-product koppelen', exact: true })).toBeVisible()
})

test('AH-product wisselen vanuit de ingrediëntenlijst en het boodschappenoverzicht', async ({ page }) => {
  await login(page, admin.email)
  async function choose(query: string, product: RegExp) {
    await page.getByLabel('Zoek bij Albert Heijn').fill(query)
    await page.getByRole('button', { name: 'Zoeken', exact: true }).click()
    await page.getByRole('button', { name: product }).click()
  }
  await page.goto('/meer/ingredienten')
  await page.getByLabel('Zoek ingrediënten').fill('tomaat in blik')
  await page.getByLabel('Zoek ingrediënten').press('Enter')
  const list = page.getByRole('navigation', { name: 'Ingrediënten' })
  await list.getByRole('button', { name: 'Koppel AH-product voor Tomaten in blokjes', exact: true }).click()
  await choose('tomaten', /AH Trostomaten/)
  await page.getByRole('button', { name: 'Product koppelen', exact: true }).click()
  await expect(list).toContainText('AH: AH Trostomaten · 500 g')
  await list.getByRole('button', { name: 'Wissel AH-product voor Tomaten in blokjes', exact: true }).click()
  await choose('uien', /AH Uien/)
  await expect(page.getByLabel('Inhoud per verpakking in g')).toHaveValue('1000')
  await expectMobileLayout(page)
  await page.getByRole('button', { name: 'Product koppelen', exact: true }).click()
  await expect(list).toContainText('AH: AH Uien · 1 kg')
  await expect(list).not.toContainText('AH Trostomaten')

  await page.goto('/week/dag/2027-01-05')
  await page.getByRole('link', { name: 'Op lijst zetten', exact: true }).click()
  await page.getByRole('button', { name: /^Albert Heijn/ }).click()
  const toBuy = page.getByRole('region', { name: 'Te kopen' })
  await expect(toBuy).toContainText('1× AH Uien')
  await toBuy.getByRole('button', { name: 'Wissel AH-product voor Tomaten in blokjes', exact: true }).click()
  await choose('tomaten', /AH Trostomaten/)
  await page.getByRole('button', { name: 'Product koppelen', exact: true }).click()
  await expect(toBuy).toContainText('1× AH Trostomaten')
  await expect(toBuy).not.toContainText('AH Uien')
  await expectMobileLayout(page)

  await page.goto('/meer/ingredienten')
  await page.getByLabel('Zoek ingrediënten').fill('tomaat in blik')
  await page.getByLabel('Zoek ingrediënten').press('Enter')
  await page.getByRole('link', { name: /Tomaten in blokjes/ }).click()
  const section = page.getByRole('region', { name: 'AH-product' })
  await expect(section).toContainText('AH Trostomaten')
  await section.getByRole('button', { name: 'Ontkoppelen', exact: true }).click()
  await expect(section.getByRole('button', { name: 'AH-product koppelen', exact: true })).toBeVisible()
})

test('een gewoon lid kan AH niet beheren en ziet geen export van een ander huishouden', async ({ page }) => {
  await login(page, 'tim@e2e.test', 'nieuw-wachtwoord-123')
  await page.goto('/meer/boodschappen/verbindingen')
  await expect(page.getByRole('button', { name: 'AH verbinden', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'AH loskoppelen', exact: true })).toHaveCount(0)
  await expect(
    page.getByText('Vraag een eigenaar van dit huishouden om AH te koppelen.', { exact: true }),
  ).toBeVisible()
  await page.goto(exportPath)
  await expect(page.getByRole('alert')).toHaveText('Boodschappenexport niet gevonden.')
})

test('AH loskoppelen bewaart de exporthistorie en verwijdert de actieve verbinding', async ({ page }) => {
  await login(page, admin.email)
  await page.goto('/meer/boodschappen/verbindingen')
  await page.getByRole('button', { name: 'AH loskoppelen', exact: true }).click()
  await expect(
    page.getByText('AH-verbinding losgekoppeld. De exporthistorie blijft bewaard.', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Nog geen AH-verbinding ingesteld.', { exact: true })).toBeVisible()
  await page.goto(exportPath)
  await expect(page.getByText('Verzonden', { exact: true })).toBeVisible()
  await expectMobileLayout(page)
})
