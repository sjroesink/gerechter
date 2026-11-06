import { admin, expectMobileLayout, login } from './helpers'
import { expect, test } from './test'

test.describe.configure({ mode: 'serial' })
test.use({ actionTimeout: 10_000 })
let eventPath = ''

test('gemaakt registreren met aangepaste afboeking, persoonlijke beoordeling en blijvende momentopname', async ({
  page,
}, testInfo) => {
  await login(page, admin.email)
  await page.goto('/voorraad/nieuw')
  await page.getByLabel('Ingrediënt zoeken').fill('tomaat in blik')
  await page.getByRole('button', { name: 'Zoek ingrediënt', exact: true }).click()
  await page.getByRole('button', { name: 'Tomaten in blokjes', exact: true }).click()
  await page.getByLabel('Hoeveelheid (g)', { exact: true }).fill('1000')
  await page.getByRole('button', { name: 'Voorraad opslaan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tomaten in blokjes', level: 1 })).toBeVisible()
  const pantryPath = new URL(page.url()).pathname
  await page.goto('/week?week=2027-01-04')
  await page.getByRole('link', { name: /Tomatensoep uit eigen keuken/ }).click()
  await page.getByRole('link', { name: 'Gemaakt', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Personen' }).getByRole('status')).toHaveText('2')
  await expect(page.getByLabel('Tomaten in blokjes afboeken (g)', { exact: true })).toHaveValue('400')
  await page.getByLabel('Gemaakt op').fill('2027-01-04')
  const grade = page
    .getByRole('group', { name: 'Jouw cijfer' })
    .getByRole('button', { name: '8', exact: true })
  await grade.click()
  await expect(grade).toHaveAttribute('aria-pressed', 'true')
  await page
    .getByRole('textbox', { name: 'Notitie (optioneel)', exact: true })
    .fill('Met wat extra peper erg lekker')
  await page.getByLabel('Tomaten in blokjes afboeken (g)', { exact: true }).fill('300')
  await expectMobileLayout(page)
  await page.getByRole('button', { name: 'Opslaan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tomatensoep uit eigen keuken', level: 1 })).toBeVisible()
  eventPath = new URL(page.url()).pathname
  await expect(page.getByRole('region', { name: 'Bevestigde afboekingen' })).toContainText(
    '300 g · Tomaten in blokjes',
  )
  await expect(page.getByRole('region', { name: 'Bevestigde afboekingen' })).toContainText('1.000 → 700 g')
  await expect(page.getByRole('region', { name: 'Persoonlijke beoordelingen' })).toContainText('8/10')
  await expectMobileLayout(page)
  await page
    .getByRole('group', { name: 'Mijn cijfer' })
    .getByRole('button', { name: '9', exact: true })
    .click()
  await page.getByRole('textbox', { name: 'Mijn notitie', exact: true }).fill('Zeker nog eens maken')
  await page.getByRole('button', { name: 'Mijn beoordeling opslaan', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Persoonlijke beoordelingen' })).toContainText('9/10')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({ path: testInfo.outputPath('made-dark.png'), fullPage: true })
  await page.getByRole('link', { name: 'Huidig recept bekijken' }).click()
  await page.getByRole('link', { name: 'Gerecht bewerken' }).click()
  await page.getByLabel('Naam van het gerecht').fill('Tomatensoep na bereiding')
  await page.getByRole('button', { name: 'Gerecht opslaan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tomatensoep na bereiding', level: 1 })).toBeVisible()
  await page.goto(eventPath)
  await expect(page.getByRole('heading', { name: 'Tomatensoep uit eigen keuken', level: 1 })).toBeVisible()
  await expect(page.getByText('Verwarm de tomaten en pureer de soep.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Mijn beoordeling wissen', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Persoonlijke beoordelingen' })).toContainText(
    'Nog geen beoordelingen.',
  )
  await page.getByRole('link', { name: 'Terug naar gemaakt' }).click()
  await page.getByLabel('Zoek bereidingen').fill('Tomatensoep uit eigen keuken')
  await page.getByLabel('Zoek bereidingen').press('Enter')
  await expect(page).toHaveURL(/query=/)
  await expect(page.getByRole('link', { name: /Tomatensoep uit eigen keuken/ })).toHaveCount(1)
  await page.goto(pantryPath)
  await expect(page.getByLabel('Hoeveelheid (g)', { exact: true })).toHaveValue('700')
  await expect(page.getByRole('region', { name: 'Voorraadgeschiedenis' })).toContainText(
    'Gemaakt · 1.000 → 700 g',
  )
})

test('bereidingen en beoordelingen zijn niet zichtbaar voor een ander huishouden', async ({ page }) => {
  await login(page, 'sanne@e2e.test')
  await page.goto('/meer')
  await page.getByRole('link', { name: /Gemaakt Bereidingen en beoordelingen/ }).click()
  await expect(page.getByRole('link', { name: /Tomatensoep/ })).toHaveCount(0)
  await page.goto(eventPath)
  await expect(page.getByRole('alert')).toHaveText('Bereiding niet gevonden.')
})
