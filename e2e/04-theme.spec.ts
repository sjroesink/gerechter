import { admin, expectMobileLayout, login } from './helpers'
import { expect, test } from './test'

test('zonder keuze volgt ook een publieke pagina de systeemvoorkeur en wijzigingen daarin', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/login')
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(20, 18, 17)')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#141211')
  await expectMobileLayout(page)

  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(243, 245, 241)')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
})

test('eigen keuze blijft bewaard bij herladen en navigeren, Systeem volgt het apparaat weer', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await login(page, admin.email)
  await page.goto('/meer/account')
  const theme = page.getByRole('combobox', { name: 'Thema' })
  await expect(theme).toHaveValue('system')
  await theme.selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expectMobileLayout(page)

  await page.reload()
  await expect(theme).toHaveValue('dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.goto('/week')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#141211')

  await page.goto('/meer/account')
  await theme.selectOption('light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(theme).toHaveValue('light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  await theme.selectOption('system')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('een opgeslagen donker thema werkt al voordat de applicatie hydrateert', async ({ context }) => {
  const page = await context.newPage()
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript(() => localStorage.setItem('gerechter.theme', 'dark'))
  // Zonder applicatie-JavaScript moet het script in de head nog steeds de eerste paint bepalen.
  await page.route('**/assets/*.js', (route) => route.abort())
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('html')).not.toHaveAttribute('data-hydrated', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('geblokkeerde browseropslag verhindert het systeemthema niet', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Opslag geblokkeerd', 'SecurityError')
      },
    })
  })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Inloggen' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
