import { test as base, expect, type Browser, type Page } from '@playwright/test'

/** Laat `page.goto` wachten tot React gehydrateerd is, zodat formulieren niet als gewone HTML-form verstuurd worden. */
export function waitForHydrationOnGoto(page: Page): Page {
  const goto = page.goto.bind(page)
  page.goto = async (url, options) => {
    const response = await goto(url, options)
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
    return response
  }
  return page
}

export async function openPage(browser: Browser): Promise<Page> {
  return waitForHydrationOnGoto(
    await browser.newPage({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true }),
  )
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await use(waitForHydrationOnGoto(page))
  },
})

export { expect }
