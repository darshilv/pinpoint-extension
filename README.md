# Pinpoint Extension

Pinpoint is a Manifest V3 Chrome extension for annotating UI elements and collecting feedback that can be turned into agent-ready prompts.

## Repo Structure

- `docs/` contains the public GitHub Pages site only.
- `planning/` contains internal planning notes and Chrome Web Store submission docs.

## Local Chrome Testing

### Prerequisites

- Node.js installed
- Google Chrome installed
- Dependencies installed with `npm install`

### Build the extension

```bash
npm run build
```

This creates the unpacked extension bundle in `dist/`.

### Load the extension in Chrome

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select `/Users/darshilvora/Code/general_projects/pinpoint-extension/dist`

### Manual smoke test

1. Build the extension with `npm run build`
2. Start the demo page with `npm run demo:serve`
3. Open [http://localhost:4173/manual-smoke.html](http://localhost:4173/manual-smoke.html) in Chrome
4. Click the Pinpoint extension action for one-time access on the current tab, or add `http://localhost:4173/*` in the extension settings page for persistent site access
5. Hover and click demo elements to create annotations
6. Verify the toolbar, popup, save flow, and copy flow all work

### Open the extension settings page

After loading the extension, open its details in `chrome://extensions` and use `Extension options`, or run the Playwright smoke test below to discover the generated extension ID automatically.

### Automated tests

Run unit and integration tests:

```bash
npm test
```

Run extension end-to-end tests with Playwright's bundled Chromium:

```bash
npm run test:e2e
```

Run extension end-to-end tests against installed Google Chrome:

```bash
npm run test:chrome
```

If macOS blocks native binaries in `node_modules`, allow them in `Privacy & Security` or clear quarantine attributes before rerunning the commands above.

## Chrome Web Store Submission Prep

Generate the reviewer docs and packaged ZIP:

```bash
npm run cws:prepare
```

That command:

- validates the manifest and icons
- generates submission docs in `planning/chrome-web-store/generated/`
- writes metadata to `artifacts/chrome-web-store/`
- packages `dist/` into a versioned ZIP for upload

Pinpoint now uses a narrow site-access model:

- one-time access comes from the user's direct action via `activeTab`
- persistent access is granted per site through an explicit Chrome permission prompt
- only approved origins are stored in settings for auto-activation

Capture store screenshots:

```bash
npm run cws:screenshots
```

This uses Playwright's bundled `chromium` channel so the extension can be side-loaded reliably for screenshot capture.

Core files for submission:

- `planning/chrome-web-store/privacy-policy.md`
- `planning/chrome-web-store/store-listing.md`
- `planning/chrome-web-store/generated/reviewer-notes.md`
- `planning/chrome-web-store/generated/submission-checklist.md`
- `planning/chrome-web-store/submission-runbook.md`
