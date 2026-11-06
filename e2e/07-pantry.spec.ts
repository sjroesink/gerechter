import { admin, expectMobileLayout, login } from './helpers'
import { expect, test } from './test'

test.describe.configure({ mode: 'serial' })
test.use({ actionTimeout: 10_000 })
let pantryPath = ''

test('voorraad tellen, basisvoorraad corrigeren, verwijderen en historie behouden', async ({
  page,
}, testInfo) => {
  await login(page, admin.email)
  await page.goto('/voorraad')
  await page.getByRole('link', { name: 'Ingrediënt toevoegen' }).click()
  await page.getByLabel('Ingrediënt zoeken').fill('tomaat in blik')
  await page.getByRole('button', { name: 'Zoek ingrediënt', exact: true }).click()
  await page.getByRole('button', { name: 'Tomaten in blokjes', exact: true }).click()
  await page.getByLabel('Hoeveelheid (g)', { exact: true }).fill('800')
  await page.getByRole('switch', { name: 'Basisvoorraad', exact: true }).check()
  await expect(page.getByLabel('Hoeveelheid (g)', { exact: true })).toHaveCount(0)
  await page.getByLabel('Notitie', { exact: true }).fill('Twee blikken na boodschappen')
  await expectMobileLayout(page)
  await page.getByRole('button', { name: 'Voorraad opslaan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tomaten in blokjes', exact: true })).toBeVisible()
  pantryPath = new URL(page.url()).pathname
  await expect(page.getByRole('region', { name: 'Voorraadgeschiedenis' })).toContainText('0 → 800 g')
  await page.getByRole('switch', { name: 'Basisvoorraad', exact: true }).uncheck()
  await expect(page.getByLabel('Hoeveelheid (g)', { exact: true })).toHaveValue('800')
  await page.getByLabel('Hoeveelheid (g)', { exact: true }).fill('700')
  await page.getByRole('combobox', { name: 'Reden', exact: true }).selectOption('correction')
  await page.getByLabel('Notitie', { exact: true }).fill('Nogmaals gewogen')
  await page.getByRole('button', { name: 'Voorraad opslaan', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Voorraadgeschiedenis' })).toContainText(
    'Correctie · 800 → 700 g',
  )
  await expectMobileLayout(page)
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({ path: testInfo.outputPath('pantry-dark.png'), fullPage: true })
  await page.getByRole('link', { name: 'Terug naar voorraad' }).click()
  await page.getByLabel('Zoek voorraad').fill('tomaat in blik')
  await page.getByLabel('Zoek voorraad').press('Enter')
  await expect(page.getByRole('link', { name: /Tomaten in blokjes/ })).toContainText('700 g')
  await page.getByRole('link', { name: /Tomaten in blokjes/ }).click()
  await page.getByRole('button', { name: 'Uit voorraad verwijderen' }).click()
  await expect(
    page.getByText('Deze regel staat niet meer in je actieve voorraad.', { exact: false }),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: 'Voorraadgeschiedenis' })).toContainText(
    'Verwijderd · 700 → 0 g',
  )
  await page.getByRole('link', { name: 'Terug naar voorraad' }).click()
  await expect(page.getByRole('link', { name: /Tomaten in blokjes/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Leeg', exact: true }).click()
  await page.getByRole('link', { name: /Tomaten in blokjes/ }).click()
  await expect(page.getByText('Nogmaals gewogen', { exact: true })).toBeVisible()
})

test('globale ingrediënten delen geen voorraad of historie tussen huishoudens', async ({ page }) => {
  await login(page, 'sanne@e2e.test')
  await page.goto('/voorraad')
  await expect(page.getByRole('heading', { name: 'Nog geen voorraad', exact: true })).toBeVisible()
  await page.goto(pantryPath)
  await expect(page.getByLabel('Hoeveelheid (g)', { exact: true })).toHaveValue('0')
  await expect(page.getByText('Nog geen tellingen voor dit ingrediënt.', { exact: true })).toBeVisible()
  await expect(page.getByText('Nogmaals gewogen', { exact: true })).toHaveCount(0)
})

test('huishoudporties schalen de receptweergave en expliciete porties gaan voor', async ({ page }) => {
  await login(page, admin.email)
  await page.goto('/meer/huishouden')
  await page.getByLabel('Standaardporties', { exact: true }).fill('4')
  await page.getByRole('button', { name: 'Standaardporties opslaan', exact: true }).click()
  await expect(page.getByText('Standaardporties opgeslagen.', { exact: true })).toBeVisible()
  await expectMobileLayout(page)
  await page.goto('/gerechten')
  await page.getByRole('link', { name: /Tomatensoep uit eigen keuken/ }).click()
  const persons = page.getByRole('group', { name: 'Personen' })
  await expect(persons.getByRole('status')).toHaveText('4')
  await expect(page.getByRole('region', { name: 'Ingrediëntenlijst' })).toContainText('2 blik')
  await persons.getByRole('button', { name: 'Minder personen' }).click()
  await expect(persons.getByRole('status')).toHaveText('3')
  await expect(page.getByRole('region', { name: 'Ingrediëntenlijst' })).toContainText('1,5 blik')
  await page.getByRole('link', { name: 'Gerecht bewerken' }).click()
  await expect(page.getByLabel('Porties', { exact: true })).toHaveValue('2')
  await page.goto('/meer/huishouden')
  await page.getByLabel('Standaardporties', { exact: true }).fill('2')
  await page.getByRole('button', { name: 'Standaardporties opslaan', exact: true }).click()
  await expect(page.getByText('Standaardporties opgeslagen.', { exact: true })).toBeVisible()
})
