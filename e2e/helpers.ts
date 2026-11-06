import { expect, type Page } from '@playwright/test'
import pg from 'pg'
import { E2E_ADMIN_EMAIL, E2E_DATABASE_URL } from '../playwright.config'

export const PASSWORD = 'een-goed-wachtwoord'
export const admin = { name: 'Beheerder', email: E2E_ADMIN_EMAIL }

/** Controleert dezelfde mobiele eisen op publieke pagina's en pagina's binnen de app-schil. */
export async function expectMobileLayout(page: Page) {
  expect(page.viewportSize()?.width).toBe(360)
  await page.waitForLoadState('networkidle')
  const path = new URL(page.url()).pathname
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, `horizontaal scrollen op ${path}`).toBeLessThanOrEqual(0)
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('a[href], button, select, input:not([type=hidden])')]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 44 || r.height < 44)
      .map(
        ({ el, r }) =>
          `${el.tagName} "${el.textContent?.trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`,
      ),
  )
  expect(small, `te kleine aanraakdoelen op ${path}`).toEqual([])
}

/**
 * Vult het inlogformulier in en verstuurt het. In productie (bijv. de docker-compose-stack) geldt
 * rate limiting op inloggen; dan wachten we het venster af en proberen we het opnieuw.
 */
export async function submitLogin(page: Page, email: string, password = PASSWORD) {
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.getByLabel('E-mailadres').fill(email)
    await page.getByLabel('Wachtwoord').fill(password)
    await page.getByRole('button', { name: 'Inloggen' }).click()
    // Pollen in plaats van waitForURL: de OAuth-flow loopt via tussenliggende redirects.
    const deadline = Date.now() + 10_000
    let limited = false
    while (Date.now() < deadline && !limited) {
      if (new URL(page.url()).pathname !== '/login') return
      limited = await page
        .getByText('Te veel inlogpogingen')
        .isVisible()
        .catch(() => false)
      await page.waitForTimeout(200)
    }
    if (!limited) throw new Error(`Inloggen als ${email} leidde niet tot een andere pagina`)
    await page.waitForTimeout(11_000)
  }
  throw new Error(`Inloggen als ${email} bleef geweigerd door rate limiting`)
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login')
  await submitLogin(page, email, password)
  await expect(page).toHaveURL(/\/week$/)
}

export async function logout(page: Page) {
  await page.goto('/meer')
  await page.getByRole('button', { name: 'Uitloggen' }).click()
  await expect(page).toHaveURL(/\/login/)
}

export async function register(page: Page, link: string, name: string, email: string) {
  await page.goto(link)
  await expectMobileLayout(page)
  await page.getByLabel('Naam').fill(name)
  await page.getByLabel('E-mailadres').fill(email)
  await page.getByLabel('Wachtwoord').fill(PASSWORD)
  await page.getByRole('button', { name: 'Account aanmaken' }).click()
  await expect(page).toHaveURL(/\/week$/)
}

export async function readLink(page: Page): Promise<string> {
  const value = await page.getByLabel('Link').inputValue()
  expect(value).toMatch(/^http/)
  return value
}

export async function sql(query: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL })
  await client.connect()
  try {
    return (await client.query(query, params)).rows
  } finally {
    await client.end()
  }
}
