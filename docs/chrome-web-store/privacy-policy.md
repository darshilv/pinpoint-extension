# Pinpoint Privacy Policy

Last updated: 2026-04-01

Pinpoint is a Chrome extension that lets users annotate webpage UI elements and organize feedback for implementation work.

## What data Pinpoint stores

- User-created annotation content, including note text and metadata needed to re-open that note on the same page.
- User preferences such as toolbar theme.
- User-approved site allowlist entries used to auto-activate the extension only on selected sites.

## Where that data is stored

- Annotation content and local UI preferences are stored with Chrome extension storage on the user's device.
- URL patterns for auto-activation are stored in `chrome.storage.sync`, which means Chrome may sync those settings across the user's signed-in browser profile.

## What Pinpoint does not do

- Pinpoint does not sell personal information.
- Pinpoint does not send annotation content to a Pinpoint backend service.
- Pinpoint does not execute remotely hosted code.
- Pinpoint does not use browsing activity for advertising.

## How site access is used

Pinpoint uses temporary access on the current tab when the user activates the extension. If the user approves persistent access for a specific site, Pinpoint stores that site in an allowlist and uses the granted origin permission to re-enable annotation tools only on that approved site.

## Sharing

Pinpoint does not share stored annotation data with third parties as part of the extension's current functionality.

## Data retention and control

Users can remove saved notes by clearing them from the Pinpoint interface or by removing the extension, which deletes extension-managed storage according to Chrome's extension lifecycle rules.

## Contact

Before submitting to the Chrome Web Store, replace this section with a real support or privacy contact email and host this policy at a stable public URL for the Developer Dashboard.
