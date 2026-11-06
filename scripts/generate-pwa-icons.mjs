// Reproduce the checked-in PNGs with the existing Playwright Chromium dependency.
import { chromium } from '@playwright/test'
import { readFile, mkdir } from 'node:fs/promises'

const browser = await chromium.launch({ executablePath: process.env.PWA_CHROMIUM_PATH || undefined })
try {
  const svg = await readFile(new URL('../src/pwa/icon.svg', import.meta.url), 'utf8')
  const target = new URL('../public/pwa/', import.meta.url)
  await mkdir(target, { recursive: true })
  for (const [file, size] of [
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['maskable-512.png', 512],
    ['apple-touch-icon.png', 180],
  ]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    await page.setContent(`<style>body{margin:0;background:#c23b22}svg{width:100%;height:100%}</style>${svg}`)
    await page.screenshot({ path: new URL(file, target).pathname })
    await page.close()
  }
} finally {
  await browser.close()
}
