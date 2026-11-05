import { expect, test } from './test'
import { admin, login, submitLogin } from './helpers'

test('niet ingelogd naar een beschermde pagina: inloggen en terug naar die pagina', async ({ page }) => {
  await page.goto('/meer/huishouden')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await submitLogin(page, admin.email, 'een-goed-wachtwoord')
  await expect(page).toHaveURL(/\/meer\/huishouden$/)
})

test('wisselen van sectie markeert de actieve sectie en toont een lege staat', async ({ page }) => {
  await login(page, admin.email)
  const nav = page.getByRole('navigation', { name: 'Hoofdnavigatie' })
  await nav.getByRole('link', { name: 'Gerechten' }).click()
  await expect(page).toHaveURL(/\/gerechten$/)
  await expect(nav.getByRole('link', { name: 'Gerechten' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: 'Nog geen gerechten', exact: true })).toBeVisible()
  await nav.getByRole('link', { name: 'Voorraad' }).click()
  await expect(page.getByRole('heading', { name: 'Nog geen voorraad', exact: true })).toBeVisible()
})

test('terug vanaf een detailpagina en een directe link', async ({ page }) => {
  await login(page, admin.email)
  await page.goto('/meer')
  await page.getByRole('link', { name: /^Huishouden/ }).click()
  await expect(page).toHaveURL(/\/meer\/huishouden$/)
  await page.getByRole('link', { name: 'Terug naar Meer' }).click()
  await expect(page).toHaveURL(/\/meer$/)

  await page.goto('/meer/account')
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Terug naar Meer' }).click()
  await expect(page).toHaveURL(/\/meer$/)
})

test('gewone gebruiker ziet geen Beheer en kan de pagina niet openen', async ({ page }) => {
  await login(page, 'sanne@e2e.test')
  await page.goto('/meer')
  await expect(page.getByRole('link', { name: /^Account/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Verbonden apps/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Beheer/ })).toHaveCount(0)
  await page.goto('/meer/beheer')
  await expect(page).toHaveURL(/\/meer$/)
})

test.describe('360 px breed', () => {
  const pages = [
    '/week',
    '/gerechten',
    '/voorraad',
    '/meer',
    '/meer/account',
    '/meer/huishouden',
    '/meer/beheer',
    '/meer/verbonden-apps',
  ]

  test('geen horizontaal scrollen en aanraakdoelen van minstens 44×44', async ({ page }) => {
    await login(page, admin.email)
    for (const path of pages) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, `horizontaal scrollen op ${path}`).toBeLessThanOrEqual(0)
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('a[href], button, select, input:not([type=hidden])')]
          .filter((el) => el.offsetParent !== null)
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ el, r }) => (r.width < 44 || r.height < 44) && !el.closest('p'))
          .map(
            ({ el, r }) =>
              `${el.tagName} "${el.textContent?.trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`,
          ),
      )
      expect(small, `te kleine aanraakdoelen op ${path}`).toEqual([])
    }
  })
})
