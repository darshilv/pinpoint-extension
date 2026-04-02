# Pinpoint Extension

Pinpoint is a Manifest V3 Chrome extension for annotating UI elements and collecting feedback that can be turned into agent-ready prompts.

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
4. Click the Pinpoint extension action, or add `http://localhost:*/*` in the extension settings page to auto-activate it
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
