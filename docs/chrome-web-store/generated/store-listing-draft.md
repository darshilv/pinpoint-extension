# Store Listing Draft

## Short description

Annotate live webpages and turn UI feedback into implementation-ready prompts.

## Detailed description

Pinpoint is a Manifest V3 Chrome extension for product reviews, QA passes, and design handoff. Activate it on any webpage, click the exact UI element you want to discuss, and attach a focused note with the intended change. Pinpoint keeps the notes anchored to the relevant elements and lets you copy the open feedback into a clean prompt that can be handed to a coding agent or engineer.

Key workflows:

- Activate Pinpoint on the current page from the toolbar button or keyboard shortcut.
- Click any visible UI element to attach feedback directly to that element.
- Review, update, resolve, and copy notes from the review panel.
- Optionally configure URL patterns in settings so Pinpoint auto-activates on the pages you review frequently.

## Permission copy for the dashboard

- `storage`: Stores saved annotations, local UI state, and extension preferences.
- `activeTab`: Allows user-triggered activation on the current tab without granting ongoing access to every site.
- `scripting`: Injects the Pinpoint content script and stylesheet only when the user activates the extension.
- `commands`: Supports the keyboard shortcut that toggles Pinpoint on the current page.
- `webNavigation`: Re-enables Pinpoint after top-level navigation only for sites the user explicitly approved.
- `https://*/*`: Optional host access that the user can grant per HTTPS site when they want persistent access and auto-activation.
- `http://*/*`: Optional host access that the user can grant per HTTP site, primarily for local development or non-production environments.

## Submission notes

- Replace this draft with final marketing copy if you want a more polished public listing.
- Keep the per-site permission story explicit in the privacy tab.
- Add the hosted privacy policy URL before submission.
