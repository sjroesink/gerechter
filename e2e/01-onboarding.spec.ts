import { expect, openPage, test } from './test'
import { PASSWORD, admin, expectMobileLayout, login, logout, readLink, register, sql } from './helpers'

test.describe.configure({ mode: 'serial' })

const sanne = { name: 'Sanne', email: 'sanne@e2e.test' }
const tim = { name: 'Tim', email: 'tim@e2e.test' }
let householdInvite = ''
let memberInvite = ''

test('eerste start toont de setuppagina', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/setup$/)
  await expect(page.getByRole('heading', { name: 'Welkom', exact: true })).toBeVisible()
  await expectMobileLayout(page)
})

test('setup weigert een ander e-mailadres en maakt daarna de beheerder aan', async ({ page }) => {
  await page.goto('/setup')
  await page.getByLabel('Naam').fill(admin.name)
  await page.getByLabel('E-mailadres').fill('iemand@e2e.test')
  await page.getByLabel('Wachtwoord', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Account aanmaken' }).click()
  await expect(page.getByRole('alert')).toContainText('beheerdersadres')

  await page.getByLabel('E-mailadres').fill(admin.email)
  await page.getByRole('button', { name: 'Account aanmaken' }).click()
  await expect(page).toHaveURL(/\/week$/)
  await expect(page.getByRole('heading', { name: 'Week', exact: true })).toBeVisible()
})

test('setuppagina is daarna niet meer beschikbaar', async ({ page }) => {
  await page.goto('/setup')
  await expect(page.getByRole('heading', { name: 'Setup niet beschikbaar', exact: true })).toBeVisible()
  await expectMobileLayout(page)
})

test('beheerder nodigt een nieuw huishouden uit', async ({ page }) => {
  await login(page, admin.email)
  await page.getByRole('navigation', { name: 'Hoofdnavigatie' }).getByRole('link', { name: 'Meer' }).click()
  await page.getByRole('link', { name: /^Beheer/ }).click()
  await page.getByLabel('Naam van het huishouden').fill('Familie de Vries')
  await page.getByRole('button', { name: 'Uitnodigingslink maken' }).click()
  householdInvite = await readLink(page)
})

test('registreren zonder uitnodiging kan niet; met uitnodiging start je een huishouden', async ({ page }) => {
  await page.goto('/uitnodiging/bestaat-niet')
  await expect(page.getByRole('heading', { name: 'Uitnodiging ongeldig', exact: true })).toBeVisible()
  await expectMobileLayout(page)

  await register(page, householdInvite, sanne.name, sanne.email)
  await page.goto('/meer')
  await expect(page.getByRole('link', { name: /^Huishouden/ })).toContainText('Familie de Vries')
  await expect(page.getByRole('link', { name: /^Beheer/ })).toHaveCount(0)

  await page.goto(householdInvite)
  await expect(page.getByText('al gebruikt')).toBeVisible()
  await expectMobileLayout(page)
})

test('eigenaar nodigt een lid uit, dat via de link registreert', async ({ page, browser }) => {
  await login(page, sanne.email)
  await page.goto('/meer/huishouden')
  await page.getByRole('button', { name: 'Uitnodigingslink maken' }).click()
  memberInvite = await readLink(page)
  await expect(page.getByText('Openstaande uitnodiging')).toBeVisible()

  const other = await openPage(browser)
  await register(other, memberInvite, tim.name, tim.email)
  await other.goto('/meer/huishouden')
  await expect(other.getByText('Sanne', { exact: true })).toBeVisible()
  await expect(other.getByRole('button', { name: 'Uitnodigingslink maken' })).toHaveCount(0)
  await other.close()

  await page.reload()
  await expect(page.getByText('Tim', { exact: true })).toBeVisible()
  await expect(page.getByText('Openstaande uitnodiging')).toHaveCount(0)
})

test('een verlopen uitnodiging toont een melding', async ({ page }) => {
  await login(page, sanne.email)
  await page.goto('/meer/huishouden')
  await page.getByRole('button', { name: 'Uitnodigingslink maken' }).click()
  const link = await readLink(page)
  await sql(
    `update invite set expires_at = now() - interval '1 minute' where used_at is null and revoked_at is null`,
  )
  await logout(page)
  await page.goto(link)
  await expect(page.getByText('verlopen')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Account aanmaken' })).toHaveCount(0)
  await expectMobileLayout(page)
})

test('bestaand account accepteert een uitnodiging en kan wisselen', async ({ page, browser }) => {
  const owner = await openPage(browser)
  await login(owner, sanne.email)
  await owner.goto('/meer/huishouden')
  await owner.getByRole('button', { name: 'Uitnodigingslink maken' }).click()
  const link = await readLink(owner)
  await owner.close()

  await login(page, admin.email)
  await page.goto(link)
  await expectMobileLayout(page)
  await page.getByRole('button', { name: 'Uitnodiging accepteren' }).click()
  await expect(page).toHaveURL(/\/week$/)

  await page.goto('/meer')
  const switcher = page.getByRole('combobox', { name: 'Huishouden' })
  await expect(switcher).toHaveValue(/.+/)
  await expect(page.getByRole('link', { name: /^Huishouden/ })).toContainText('Familie de Vries')
  await switcher.selectOption({ label: 'Huishouden van Beheerder' })
  await expect(page.getByRole('link', { name: /^Huishouden/ })).toContainText('Huishouden van Beheerder')

  await logout(page)
  await login(page, admin.email)
  await page.goto('/meer')
  await expect(page.getByRole('link', { name: /^Huishouden/ })).toContainText('Huishouden van Beheerder')
})

test('gebruiker met één huishouden ziet geen wisselaar', async ({ page }) => {
  await login(page, tim.email)
  await page.goto('/meer')
  await expect(page.getByRole('combobox', { name: 'Huishouden' })).toHaveCount(0)
})

test('ongeldige inloggegevens geven een algemene melding', async ({ page }) => {
  await page.goto('/login')
  await expectMobileLayout(page)
  await page.getByLabel('E-mailadres').fill('onbekend@e2e.test')
  await page.getByLabel('Wachtwoord', { exact: true }).fill('verkeerd-wachtwoord')
  await page.getByRole('button', { name: 'Inloggen' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'Inloggen is niet gelukt. Controleer je e-mailadres en wachtwoord.',
  )
})

test('uitloggen beëindigt de sessie', async ({ page }) => {
  await login(page, tim.email)
  await logout(page)
  await page.goto('/week')
  await expect(page).toHaveURL(/\/login\?redirect=/)
})

test('beheerder maakt een herstellink en de gebruiker stelt een nieuw wachtwoord in', async ({
  page,
  browser,
}) => {
  await login(page, admin.email)
  await page.goto('/meer/beheer')
  await page
    .getByRole('listitem')
    .filter({ hasText: tim.email })
    .getByRole('button', { name: 'Herstellink' })
    .click()
  const link = await readLink(page)

  const user = await openPage(browser)
  await user.goto(link)
  await expectMobileLayout(user)
  await user.getByLabel('Nieuw wachtwoord').fill('nieuw-wachtwoord-123')
  await user.getByRole('button', { name: 'Wachtwoord instellen' }).click()
  await expect(user.getByRole('heading', { name: 'Wachtwoord ingesteld', exact: true })).toBeVisible()
  await expectMobileLayout(user)
  await login(user, tim.email, 'nieuw-wachtwoord-123')
  await user.close()
})
