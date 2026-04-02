# Reviewer Notes

## Single purpose

Pinpoint helps a user review a webpage UI, click elements, record feedback annotations, and copy those notes into an AI-ready prompt for implementation work.

## Data handling

- Annotation content is stored in `chrome.storage.local` on the user's machine.
- User-approved site allowlist entries are stored in `chrome.storage.sync` so the user's settings can follow their browser profile.
- The extension does not transmit annotation data to a backend service.
- The extension does not execute remote code.

## Declared permissions

- `storage`: Stores saved annotations, local UI state, and extension preferences.
- `activeTab`: Allows user-triggered activation on the current tab without granting ongoing access to every site.
- `scripting`: Injects the Pinpoint content script and stylesheet only when the user activates the extension.
- `commands`: Supports the keyboard shortcut that toggles Pinpoint on the current page.
- `webNavigation`: Re-enables Pinpoint after top-level navigation only for sites the user explicitly approved.

## Declared host permissions

- `https://*/*`: Optional host access that the user can grant per HTTPS site when they want persistent access and auto-activation.
- `http://*/*`: Optional host access that the user can grant per HTTP site, primarily for local development or non-production environments.

## Suggested privacy-tab answers

- Single purpose: Annotate webpage UI elements and compile implementation-ready feedback.
- Is remote code used: No.
- Does the extension collect or transmit user data: It stores user-entered annotations locally and stores the user-approved site allowlist in Chrome sync storage. It does not send that data to a remote server.
- Web browsing activity: Access is only used to enable annotation features on the page the user activates or on sites the user explicitly approved for persistent access.
