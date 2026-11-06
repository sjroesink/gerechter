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
  await expect(page.getByText(/AH \(experimenteel\): 1 van 1 regels bevestigd/)).toBeVisible()
  await expect(page.getByLabel('Boodschappenlijst')).toContainText('300 g · Tomaten in blokjes')
  await expectMobileLayout(page)
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({ path: testInfo.outputPath('ah-export-dark.png'), fullPage: true })
  await page.reload()
  await expect(page.getByText('Verzonden', { exact: true })).toBeVisible()
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
