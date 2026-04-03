import fs from 'node:fs/promises';
import path from 'node:path';

import { type BrowserContext, chromium, expect, test } from '@playwright/test';

let context: BrowserContext;
const demoUrl = 'https://example.com/';

test.beforeAll(async () => {
  const extensionPath = path.resolve(process.cwd(), 'dist');
  context = await chromium.launchPersistentContext('', {
    channel: process.env.PINPOINT_BROWSER_CHANNEL ?? 'chromium',
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
});

test.afterAll(async () => {
  await context?.close();
});

test('captures Chrome Web Store screenshots', async () => {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }

  const extensionId = serviceWorker.url().split('/')[2];
  const outputDir = path.resolve(process.cwd(), 'artifacts', 'chrome-web-store', 'screenshots');
  await fs.mkdir(outputDir, { recursive: true });

  const settingsPage = await context.newPage();
  await settingsPage.goto(`chrome-extension://${extensionId}/settings.html`);
  await expect(settingsPage.getByRole('heading', { name: 'Pinpoint Settings' })).toBeVisible();

  const patternInput = settingsPage.locator('#pattern-input');
  await patternInput.fill(`${demoUrl}*`);
  await settingsPage.locator('#add-pattern-form').dispatchEvent('submit');
  await expect(settingsPage.locator('#pattern-list')).toContainText(`${demoUrl}*`);
  await settingsPage.screenshot({
    path: path.join(outputDir, 'pinpoint-settings-1280x800.png'),
    fullPage: false,
  });

  const demoPage = await context.newPage();
  await demoPage.goto(demoUrl);
  const demoHtml = await fs.readFile(
    path.resolve(process.cwd(), 'demo', 'manual-smoke.html'),
    'utf8'
  );
  await demoPage.setContent(demoHtml, { waitUntil: 'domcontentloaded' });
  await demoPage.getByRole('button', { name: 'Activate Pinpoint' }).click();
  await demoPage.getByRole('button', { name: 'Primary call to action' }).click();
  await expect(demoPage.locator('.ppt-popup-textarea')).toBeVisible();
  await demoPage
    .locator('.ppt-popup-textarea')
    .fill('Tighten this CTA copy and add a stronger pressed state for accessibility.');
  await demoPage.getByRole('button', { name: 'Add' }).click();
  await expect(demoPage.locator('.ppt-popup-textarea')).toBeHidden();
  await demoPage
    .getByRole('button', { name: 'Open review panel' })
    .evaluate((element: HTMLButtonElement) => element.click());
  await expect(demoPage.getByRole('heading', { name: 'Pinpoint', exact: true })).toBeVisible();
  await demoPage.screenshot({
    path: path.join(outputDir, 'pinpoint-annotating-page-1280x800.png'),
    fullPage: false,
  });
});
