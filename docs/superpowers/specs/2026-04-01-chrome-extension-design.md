# Chrome Extension Design — Pinpoint

**Date:** 2026-04-01  
**Status:** Approved  
**Replaces:** npm package (`@dvora/lwc-annotator`)

---

## Problem

The current npm package has three compounding distribution problems:
1. Hosted on an internal Salesforce registry — hard to install and update
2. Requires per-project vite config changes and a component tag in a template
3. Only works in LWC apps using `vite-plugin-lwc`

A Chrome extension solves all three: install once, works on any webpage, no project-side configuration.

---

## Product Roadmap

| Phase | Scope |
|---|---|
| **1 — Extension (this spec)** | Solo use, local persistence, works on any webpage |
| **2 — Identity** | Google Sign-In via Chrome Identity API; annotations get `userId` + `userName` |
| **3 — Collaboration** | Backend sync (Firestore), threaded comments, session sharing, full context bundle → AI prompt |

---

## Phase 1 Scope

A Manifest V3 Chrome extension. Install via `Load unpacked` in developer mode. No backend. Annotations persist locally via `chrome.storage.local`.

The tool works on any webpage (React, Vue, plain HTML, LWC). Product name: **Pinpoint**.

---

## Architecture

### Repository

New repo: `pinpoint-extension`. The existing npm package repo is archived or kept for LWC-specific legacy use.

### Tech Stack

- **Manifest V3**
- **Vite** — bundles content script and settings page; keeps source as ES modules during development
- **Vitest** — unit and integration tests
- **No UI framework** — vanilla JS DOM manipulation (components are simple enough)

### Entry Points (Vite outputs)

| File | Role |
|---|---|
| `content.js` + `content.css` | Injected into pages; all annotation UI |
| `background.js` | Service worker; handles activation, icon click, hotkey |
| `settings.html` + `settings.js` | Extension settings page |

### Permissions

`storage`, `activeTab`, `scripting`, `commands`

---

## Components

Three vanilla JS classes, each managing their own DOM subtree.

### `Overlay`

- Injected as a `<dialog>` element using `showModal()` — promotes it to the browser's top layer so it renders above all other content including native `<dialog>` modals and Popover API elements
- Listens for `mousemove` to draw a highlight rect over the hovered element
- Listens for `click` (capture phase) to capture the target element
- Ignores events on annotator-owned elements (identified by a reserved CSS class prefix)
- Fires `elementclick` custom event with: target element reference, bounding rect, generated selector path

### `Toolbar`

- Fixed-position panel injected into the page
- Owns annotation state: active (To Tackle) and resolved lists
- Listens for `elementclick` to open the Popup
- Renders annotation list with per-item copy, edit, and resolve buttons
- Global copy (all annotations → markdown) and clear buttons
- Same tab-based UX as the current redesign

### `Popup`

- Positioned form that appears near the clicked element
- Accepts feedback text; fires `annotationadd`
- Supports editing existing annotations (`Update` vs `Add` label)
- Closes on outside click or Escape

---

## Utilities

All three utils from the current package port with minimal changes.

| Utility | Changes |
|---|---|
| `domInspector.js` | None — shadow DOM traversal via `getRootNode()` + `root.host` works identically from a content script for open native shadow roots. Synthetic shadow (older LWC) produces flat selectors without shadow-crossing paths — acceptable degradation. |
| `markdown.js` | Rename LWC-specific language to generic terms (e.g., "component path" → "element path"). Output format otherwise unchanged — still designed for AI agent consumption. |
| `storage.js` | Swap `localStorage` for `chrome.storage.local` (async API, higher quota, more reliable). Key format unchanged: `/path/name` per page URL. |

---

## Data Model

One canonical annotation shape used across storage, UI, and markdown generation — never reshaped between layers.

```js
{
  id: string,           // uuid
  selector: string,     // short selector, e.g. "button.slds-button_brand"
  path: string,         // full element path crossing shadow boundaries
  classes: string[],    // all CSS classes on the element
  context: string,      // nearby text content for AI confirmation
  rect: {               // bounding box at time of annotation
    top: number,
    left: number,
    width: number,
    height: number
  },
  feedback: string,     // user's comment / instruction
  resolved: boolean,
  createdAt: number     // Date.now() timestamp
}
```

Event name strings and storage key prefixes are defined in a single `constants.js` — not duplicated across files.

---

## Activation

All three mechanisms coordinate through the service worker. Activation state is stored in `chrome.storage.session` (per-session, cleared on browser close).

**Priority rule:** manual icon click or keyboard shortcut always overrides URL pattern auto-activation. If a user explicitly deactivates on a matching URL, the annotator stays off for that tab for the remainder of the session.

### URL Patterns
Configured in the settings page. On page load, the service worker checks the current URL against saved patterns and injects the content script if it matches. Patterns support wildcards (e.g., `localhost:*`, `*.mycompany.com/*`).

### Extension Icon Click
Toggles the annotator on/off for the current tab. The icon badge reflects current state (on/off).

### Keyboard Shortcut
Default: `Ctrl+Shift+A` / `Cmd+Shift+A`. Configurable via Chrome's native shortcut settings (`chrome://extensions/shortcuts`) — no custom hotkey UI needed.

---

## Settings Page

Minimal UI:
- List of saved URL patterns with add/remove controls
- Link to `chrome://extensions/shortcuts` for hotkey configuration

---

## Testing

**Vitest** for all tests. Three layers:

### Unit — Utils
Pure functions, no browser APIs. Cover `domInspector` path generation, `markdown` output format, `storage` read/write. These are highest priority since they produce the AI prompt output.

### Component — UI Classes
Tested with `jsdom`. Chrome APIs (`chrome.storage`, `chrome.runtime`, `chrome.commands`) stubbed via a shared mock module in `tests/__mocks__/chrome.js` — one place, imported by all component tests (DRY).

Test contracts: given input events, assert correct DOM mutations and output events. No testing of internal implementation details.

### Integration
A fixture HTML page with nested shadow roots simulating a real LWC-like component tree. Verifies the full pipeline: click → `domInspector` path → `markdown` output.

### Coverage target
Utils: 100%. Components: critical paths (annotation add/edit/resolve/copy). Integration: happy path + modal/top-layer scenario.

---

## Shadow DOM & Modal Support

Content scripts share the page DOM and can access open shadow roots via `element.shadowRoot`. The `domInspector` traversal is unaffected.

Modals and popovers are fully supported:
- **z-index modals** (most frameworks): overlay renders above them naturally
- **Native `<dialog>` / Popover API** (top-layer): overlay is itself a `<dialog showModal()>`, so it enters the top layer and renders above everything

---

## Out of Scope (Phase 1)

- User identity / sign-in
- Annotation sync or sharing
- Backend of any kind
- Support for browser-native dialogs (`alert`, `confirm`, `prompt`)
- Firefox or other browsers
