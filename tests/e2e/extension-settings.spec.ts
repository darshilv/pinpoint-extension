import { test, expect, chromium, type BrowserContext } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

let context: BrowserContext

test.beforeAll(async () => {
  const extensionPath = path.resolve(process.cwd(), 'dist')
  context = await chromium.launchPersistentContext('', {
    channel: process.env.PINPOINT_BROWSER_CHANNEL,
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  })
})

test.afterAll(async () => {
  await context?.close()
})

test('loads extension settings and validates URL pattern behavior', async () => {
  let [serviceWorker] = context.serviceWorkers()
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker')
  }

  const extensionId = serviceWorker.url().split('/')[2]
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/settings.html`)

  await expect(page.getByRole('heading', { name: 'Pinpoint Settings' })).toBeVisible()

  const screenshotsDir = path.resolve(process.cwd(), 'artifacts', 'store-screenshots')
  await fs.mkdir(screenshotsDir, { recursive: true })
  await page.screenshot({
    path: path.join(screenshotsDir, 'settings-initial-1280x800.png'),
    fullPage: false,
  })

  const input = page.locator('#pattern-input')
  await input.fill('localhost:*')
  await page.locator('#add-pattern-form').dispatchEvent('submit')
  await expect(page.locator('#pattern-feedback')).toContainText(
    'Enter a full site pattern like https://app.example.com/*'
  )

  await input.fill('https://example.com/*')
  await page.locator('#add-pattern-form').dispatchEvent('submit')
  await expect(page.locator('#pattern-list')).toContainText('https://example.com/*')

  await page.getByRole('button', { name: 'Remove' }).click()
  await expect(page.locator('#pattern-list')).toContainText('No patterns added yet.')
  await page.screenshot({
    path: path.join(screenshotsDir, 'settings-after-remove-1280x800.png'),
    fullPage: false,
  })
})
