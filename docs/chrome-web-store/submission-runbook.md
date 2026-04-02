# Chrome Web Store Submission Runbook

Use this runbook any time Pinpoint is being prepared for a new Chrome Web Store submission or update.

## What is automated

Run:

```bash
npm run cws:prepare
```

That command will:

- build the extension into `dist/`
- validate the manifest and required icons
- regenerate reviewer-facing docs from the current manifest
- write submission metadata into `artifacts/chrome-web-store/`
- package the built extension as a versioned ZIP

## Where to find the generated outputs

- ZIP upload artifact: `artifacts/chrome-web-store/`
- generated reviewer docs: `docs/chrome-web-store/generated/`
- editable policy/listing source docs:
  - `docs/chrome-web-store/privacy-policy.md`
  - `docs/chrome-web-store/store-listing.md`

## Permission model to describe in review

Pinpoint does not request broad persistent access to all sites.

- One-time access: granted by the user activating the extension on the current tab through `activeTab`
- Persistent access: requested only for a specific origin when the user explicitly approves that site
- Auto-activation: limited to origins that are both:
  - stored in the Pinpoint allowlist
  - still granted in Chrome permissions

## Release checklist

1. Update the extension version in `public/manifest.json` and `package.json` if needed.
2. Run `npm run typecheck`.
3. Run `npm test` or at minimum the focused tests that cover the changed area.
4. Run `npm run cws:prepare`.
5. Review:
   - `docs/chrome-web-store/generated/reviewer-notes.md`
   - `docs/chrome-web-store/generated/store-listing-draft.md`
   - `docs/chrome-web-store/generated/submission-checklist.md`
6. Capture final screenshots for the store listing.
7. Host the privacy policy at a public HTTPS URL.
8. Upload the ZIP and listing assets in the Chrome Web Store dashboard.

## Current manual steps

- Final screenshot capture still needs a local Chrome-specific pass.
- The privacy policy needs a real support/privacy contact and a hosted URL.
- The dashboard listing text can use the generated draft directly, then be polished as needed.
