# Pinpoint Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Pinpoint — a Manifest V3 Chrome extension that lets users annotate UI elements on any webpage and generate AI-ready markdown prompts.

**Architecture:** A Vite-bundled content script injects three vanilla JS classes (Overlay, Toolbar, Popup) into the page. A service worker manages activation state per tab, responding to icon clicks, keyboard shortcuts, and URL pattern matching. Utils (domInspector, markdown, storage) are ported from the existing `lwc-annotator` npm package with minimal changes.

**Tech Stack:** Manifest V3, Vite, Vitest, vanilla JS, `chrome.storage.local`, jsdom (tests)

---

## Execution Status (Updated)

- [x] Tasks 1-14 implemented and committed (scaffold, test infra, constants, utils, content classes, coordinator, service worker, settings page, styles, and integration tests)
- [x] TypeScript migration completed (strict `tsconfig`, shared types, TS source/tests/config conversion)
- [x] Automated verification completed (`npm run typecheck`, `npm test`, `npm run build`)
- [x] Playwright extension smoke test added and passing (`npm run test:e2e`)
- [x] Packaging/build-path issue for `options_page` fixed (`dist/settings.html` emitted at manifest root path)
- [x] Manual managed-Chrome load test attempted and blocked by enterprise policy; browser-level validation performed via Playwright as policy-safe substitute

---

## Preflight Decisions

- [ ] **Canonical annotation schema**

Use one shape end-to-end (storage, UI state, markdown, tests):

```js
{
  id: string,
  selector: string,        // was: element
  path: string,            // was: elementPath
  classes: string[],       // was: cssClasses (string → array)
  context: string,         // was: nearbyText
  feedback: string,        // was: comment
  status: 'active' | 'resolved',  // kept as string (NOT boolean)
  rect: { x, y, width, height },
  createdAt: number,       // was: timestamp
  url: string,
}
```

Field mapping from current draft examples:
- `element` -> `selector`
- `elementPath` -> `path`
- `cssClasses` string -> `classes` array
- `nearbyText` -> `context`
- `comment` -> `feedback`
- `resolved` boolean -> `status` ('active' | 'resolved')
- `timestamp` -> `createdAt`

- [ ] **URL pattern grammar**

Patterns must include scheme and match full URL strings:
- Valid: `https://*.mycompany.com/*`, `http://localhost:*/*`
- Invalid: `localhost:*` (missing scheme)

Add settings-page validation and a user-visible error message for invalid input.

- [ ] **Permissions for auto-activation**

Because auto-activation injects from the service worker, `activeTab` is insufficient.
Manifest must include:

```json
"permissions": ["storage", "activeTab", "scripting", "commands", "webNavigation"],
"host_permissions": ["<all_urls>"]
```

---

## File Structure

```
pinpoint-extension/
├── public/
│   ├── manifest.json              # MV3 manifest — copied to dist by Vite
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── src/
│   ├── constants.js               # All shared strings: event names, storage keys, CSS class prefix
│   ├── content/
│   │   ├── index.js               # Entry point: activation gate, wires Overlay→Popup→Toolbar
│   │   ├── Overlay.js             # <dialog> overlay: hover highlight + click capture
│   │   ├── Toolbar.js             # Fixed panel: annotation list, tabs, copy/resolve actions
│   │   ├── Popup.js               # Positioned form: feedback input, add/update submit
│   │   └── content.css            # All injected UI styles (overlay, toolbar, popup)
│   ├── background/
│   │   └── service-worker.js      # Icon click toggle, commands, URL pattern auto-activate
│   ├── settings/
│   │   ├── settings.html          # Settings page shell
│   │   ├── settings.js            # URL pattern CRUD, link to chrome shortcuts
│   │   └── settings.css           # Settings page styles
│   └── utils/
│       ├── domInspector.js        # Element path generation — ported from npm package, unchanged
│       ├── markdown.js            # Annotation → markdown — ported, header renamed to Pinpoint
│       └── storage.js             # chrome.storage.local wrapper — async version of npm storage.js
├── tests/
│   ├── setup.js                   # Vitest globalSetup: attaches chrome mock to global
│   ├── __mocks__/
│   │   └── chrome.js              # Shared Chrome API stub (storage, runtime, tabs, commands, action)
│   ├── utils/
│   │   ├── domInspector.test.js
│   │   ├── markdown.test.js
│   │   └── storage.test.js
│   ├── content/
│   │   ├── Overlay.test.js
│   │   ├── Toolbar.test.js
│   │   └── Popup.test.js
│   └── integration/
│       └── pipeline.test.js       # click → path → markdown end-to-end with shadow DOM fixture
├── vite.config.js
└── package.json
```

---

## Task 1: Repo Setup + Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `public/manifest.json`
- Create: `.gitignore`

- [x] **Step 1: Clone the repo and enter it**

```bash
cd ~/Code
git clone https://github.com/salesforce-ux-emu/pinpoint-extension.git
cd pinpoint-extension
```

- [x] **Step 2: Create `package.json`**

```json
{
  "name": "pinpoint-extension",
  "version": "0.1.0",
  "description": "Annotate UI elements and generate AI-ready prompts",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "vitest": "^1.0.0",
    "jsdom": "^24.0.0",
    "@vitest/coverage-v8": "^1.0.0"
  }
}
```

- [x] **Step 3: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [x] **Step 4: Create `vite.config.js`**

```js
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.js'),
        background: resolve(__dirname, 'src/background/service-worker.js'),
        settings: resolve(__dirname, 'src/settings/settings.html'),
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  publicDir: 'public',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.js'],
  },
})
```

- [x] **Step 5: Create `public/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Pinpoint",
  "version": "0.1.0",
  "description": "Annotate UI elements and generate AI-ready prompts for coding agents",
  "permissions": ["storage", "activeTab", "scripting", "commands", "webNavigation"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    },
    "default_title": "Toggle Pinpoint"
  },
  "options_page": "settings.html",
  "web_accessible_resources": [],
  "commands": {
    "toggle-pinpoint": {
      "suggested_key": {
        "default": "Ctrl+Shift+A",
        "mac": "Command+Shift+A"
      },
      "description": "Toggle Pinpoint annotator on this page"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [x] **Step 6: Create `.gitignore`**

```
node_modules/
dist/
coverage/
```

- [ ] **Step 7: Create placeholder icon files**

Create `public/icons/` directory and add three valid PNG files (16x16, 48x48, 128x128). Any solid-color PNGs work for development — replace with real icons before release.

```bash
mkdir -p public/icons
```

- [ ] **Step 8: Create stub entry point files so Vite build doesn't fail**

```bash
mkdir -p src/content src/background src/settings src/utils
touch src/content/index.js src/content/content.css
touch src/background/service-worker.js
touch src/settings/settings.js src/settings/settings.css
echo '<!DOCTYPE html><html><head><title>Pinpoint Settings</title><script type="module" src="./settings.js"></script></head><body></body></html>' > src/settings/settings.html
```

- [ ] **Step 9: Verify build succeeds**

```bash
npm run build
```

Expected: `dist/` created with `content.js`, `background.js`, `settings.html`, `settings.js`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: project scaffold — Vite, MV3 manifest, package.json"
```

---

## Task 2: Test Infrastructure

**Files:**
- Create: `tests/setup.js`
- Create: `tests/__mocks__/chrome.js`

- [ ] **Step 1: Create `tests/__mocks__/chrome.js`**

```js
import { vi } from 'vitest'

function createStorageArea() {
  const data = {}
  return {
    get: vi.fn(async (keys) => {
      if (typeof keys === 'string') return { [keys]: data[keys] }
      if (Array.isArray(keys)) return Object.fromEntries(keys.map(k => [k, data[k]]))
      return { ...data }
    }),
    set: vi.fn(async (items) => { Object.assign(data, items) }),
    remove: vi.fn(async (keys) => {
      const ks = Array.isArray(keys) ? keys : [keys]
      ks.forEach(k => delete data[k])
    }),
    clear: vi.fn(async () => { Object.keys(data).forEach(k => delete data[k]) }),
    _reset() { Object.keys(data).forEach(k => delete data[k]) },
  }
}

export const chrome = {
  storage: {
    local: createStorageArea(),
    session: createStorageArea(),
    sync: createStorageArea(),
  },
  runtime: {
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    sendMessage: vi.fn(async () => {}),
    getURL: vi.fn((path) => `chrome-extension://test/${path}`),
  },
  tabs: {
    query: vi.fn(async () => []),
    sendMessage: vi.fn(async () => {}),
    get: vi.fn(async () => ({})),
  },
  commands: {
    onCommand: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  action: {
    setBadgeText: vi.fn(async () => {}),
    setBadgeBackgroundColor: vi.fn(async () => {}),
  },
}
```

- [ ] **Step 2: Create `tests/setup.js`**

```js
import { chrome } from './__mocks__/chrome.js'
import { beforeEach } from 'vitest'

global.chrome = chrome

// Reset storage state and mock call history before each test
beforeEach(() => {
  chrome.storage.local._reset()
  chrome.storage.session._reset()
  Object.values(chrome.storage).forEach(area => {
    Object.values(area).forEach(fn => fn.mock?.calls && fn.mockClear())
  })
  chrome.runtime.sendMessage.mockClear()
  chrome.tabs.sendMessage.mockClear()
  chrome.action.setBadgeText.mockClear()
  chrome.action.setBadgeBackgroundColor.mockClear()
})
```

- [ ] **Step 3: Verify test infrastructure runs**

Create a canary test at `tests/canary.test.js`:
```js
it('chrome mock is available', () => {
  expect(global.chrome).toBeDefined()
  expect(chrome.storage.local.get).toBeDefined()
})
```

Run:
```bash
npm test
```

Expected: 1 test passes.

- [ ] **Step 4: Delete canary test and commit**

```bash
rm tests/canary.test.js
git add -A
git commit -m "chore: test infrastructure — vitest setup, chrome API mock"
```

---

## Task 3: `constants.js`

**Files:**
- Create: `src/constants.js`

- [ ] **Step 1: Create `src/constants.js`**

```js
// CSS class prefix for all Pinpoint-injected DOM elements.
// Used to exclude annotator elements from overlay hover/click detection.
export const PPT_PREFIX = 'ppt-'

// Custom event names dispatched on document
export const EVENTS = {
  ELEMENT_CLICK: 'pinpoint:elementclick',
  ANNOTATION_ADD: 'pinpoint:annotationadd',
}

// chrome.storage keys
export const STORAGE_NAMESPACE = 'pinpoint'
export const SETTINGS_KEY = 'pinpoint:settings'

// Messages between content script and service worker
export const MSG = {
  ACTIVATE: 'PINPOINT_ACTIVATE',
  DEACTIVATE: 'PINPOINT_DEACTIVATE',
  GET_STATE: 'PINPOINT_GET_STATE',
}
```

- [ ] **Step 2: Commit**

```bash
git add src/constants.js
git commit -m "feat: constants — event names, storage keys, message types"
```

---

## Task 4: `storage.js` (TDD)

**Files:**
- Create: `src/utils/storage.js`
- Create: `tests/utils/storage.test.js`

- [ ] **Step 1: Write failing tests at `tests/utils/storage.test.js`**

```js
import { getAnnotations, saveAnnotations, clearAnnotations } from '../../src/utils/storage.js'

describe('storage', () => {
  describe('getAnnotations', () => {
    it('returns empty array when no data stored', async () => {
      const result = await getAnnotations('/about')
      expect(result).toEqual([])
    })

    it('returns stored annotations for a path', async () => {
      const annotations = [{ id: '1', feedback: 'Fix this', status: 'active' }]
      await chrome.storage.local.set({ 'pinpoint:/about': annotations })
      const result = await getAnnotations('/about')
      expect(result).toEqual(annotations)
    })

    it('isolates annotations by path', async () => {
      const a1 = [{ id: '1', feedback: 'Page 1' }]
      const a2 = [{ id: '2', feedback: 'Page 2' }]
      await chrome.storage.local.set({ 'pinpoint:/page1': a1, 'pinpoint:/page2': a2 })
      expect(await getAnnotations('/page1')).toEqual(a1)
      expect(await getAnnotations('/page2')).toEqual(a2)
    })
  })

  describe('saveAnnotations', () => {
    it('persists annotations under the correct key', async () => {
      const annotations = [{ id: '1', feedback: 'Test' }]
      await saveAnnotations('/home', annotations)
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        'pinpoint:/home': annotations,
      })
    })

    it('overwrites previously saved annotations', async () => {
      await saveAnnotations('/home', [{ id: '1' }])
      await saveAnnotations('/home', [{ id: '2' }])
      const result = await getAnnotations('/home')
      expect(result).toEqual([{ id: '2' }])
    })
  })

  describe('clearAnnotations', () => {
    it('removes annotations for a path', async () => {
      await saveAnnotations('/about', [{ id: '1' }])
      await clearAnnotations('/about')
      const result = await getAnnotations('/about')
      expect(result).toEqual([])
    })
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test tests/utils/storage.test.js
```

Expected: FAIL — `Cannot find module '../../src/utils/storage.js'`

- [ ] **Step 3: Implement `src/utils/storage.js`**

```js
import { STORAGE_NAMESPACE } from '../constants.js'

function storageKey(pathname) {
  return `${STORAGE_NAMESPACE}:${pathname}`
}

export async function getAnnotations(pathname) {
  const key = storageKey(pathname)
  const result = await chrome.storage.local.get(key)
  return result[key] ?? []
}

export async function saveAnnotations(pathname, annotations) {
  const key = storageKey(pathname)
  await chrome.storage.local.set({ [key]: annotations })
}

export async function clearAnnotations(pathname) {
  const key = storageKey(pathname)
  await chrome.storage.local.remove(key)
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test tests/utils/storage.test.js
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/storage.js tests/utils/storage.test.js
git commit -m "feat: storage util — chrome.storage.local wrapper with tests"
```

---

## Task 5: `domInspector.js` (TDD)

**Files:**
- Create: `src/utils/domInspector.js`
- Create: `tests/utils/domInspector.test.js`

- [ ] **Step 1: Write failing tests at `tests/utils/domInspector.test.js`**

```js
import { getElementPath, identifyElement, getElementClasses, getNearbyText } from '../../src/utils/domInspector.js'

describe('getElementClasses', () => {
  it('returns space-separated class string', () => {
    const el = document.createElement('div')
    el.className = '  foo   bar  '
    expect(getElementClasses(el)).toBe('foo bar')
  })

  it('returns empty string for non-string className', () => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    expect(getElementClasses(el)).toBe('')
  })

  it('returns empty string for element with no classes', () => {
    const el = document.createElement('div')
    expect(getElementClasses(el)).toBe('')
  })
})

describe('getNearbyText', () => {
  it('returns trimmed text content', () => {
    const el = document.createElement('button')
    el.textContent = '  Save Changes  '
    expect(getNearbyText(el)).toBe('Save Changes')
  })

  it('collapses internal whitespace', () => {
    const el = document.createElement('div')
    el.textContent = 'Hello   World\n  Foo'
    expect(getNearbyText(el)).toBe('Hello World Foo')
  })

  it('truncates at 120 characters', () => {
    const el = document.createElement('div')
    el.textContent = 'a'.repeat(200)
    expect(getNearbyText(el)).toHaveLength(120)
  })
})

describe('getElementPath', () => {
  it('returns tag name for a simple element', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    expect(getElementPath(div)).toBe('div')
    div.remove()
  })

  it('includes id when present', () => {
    const el = document.createElement('section')
    el.id = 'main'
    document.body.appendChild(el)
    expect(getElementPath(el)).toBe('section#main')
    el.remove()
  })

  it('includes first two classes when no id', () => {
    const el = document.createElement('button')
    el.className = 'btn primary large'
    document.body.appendChild(el)
    expect(getElementPath(el)).toBe('button.btn.primary')
    el.remove()
  })

  it('builds path for nested elements', () => {
    const outer = document.createElement('div')
    outer.id = 'app'
    const inner = document.createElement('button')
    inner.className = 'submit'
    outer.appendChild(inner)
    document.body.appendChild(outer)
    expect(getElementPath(inner)).toBe('div#app > button.submit')
    outer.remove()
  })

  it('crosses shadow DOM boundaries', () => {
    const host = document.createElement('my-app')
    document.body.appendChild(host)
    const shadow = host.attachShadow({ mode: 'open' })
    const inner = document.createElement('button')
    inner.className = 'cta'
    shadow.appendChild(inner)
    const path = getElementPath(inner)
    expect(path).toBe('my-app > button.cta')
    host.remove()
  })
})

describe('identifyElement', () => {
  it('returns name and path', () => {
    const el = document.createElement('button')
    el.className = 'primary'
    document.body.appendChild(el)
    const { name, path } = identifyElement(el)
    expect(name).toBe('button.primary')
    expect(path).toBe('button.primary')
    el.remove()
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test tests/utils/domInspector.test.js
```

Expected: FAIL — `Cannot find module '../../src/utils/domInspector.js'`

- [ ] **Step 3: Implement `src/utils/domInspector.js`** (port from `lwc-annotator/src/utils/domInspector.js`, unchanged)

```js
/**
 * Gets a CSS selector path for an element, crossing shadow DOM boundaries.
 */
export function getElementPath(target, maxDepth = 6) {
  const parts = []
  let el = target
  let depth = 0
  while (el && el !== document.body && depth < maxDepth) {
    let selector = el.tagName.toLowerCase()
    if (el.id) {
      selector += `#${el.id}`
    } else if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).slice(0, 2).join('.')
      if (classes) selector += `.${classes}`
    }
    parts.unshift(selector)
    const root = el.getRootNode()
    el = el.parentElement || (root instanceof ShadowRoot ? root.host : null)
    depth++
  }
  return parts.join(' > ')
}

/**
 * Returns a human-readable name and selector path for an element.
 */
export function identifyElement(target) {
  const tagName = target.tagName.toLowerCase()
  const id = target.id ? `#${target.id}` : ''
  const classes = getElementClasses(target)
  const firstClass = classes ? `.${classes.split(' ')[0]}` : ''
  const name = `${tagName}${id}${firstClass}`
  return { name, path: getElementPath(target) }
}

/**
 * Returns CSS class names from an element as a space-separated string.
 */
export function getElementClasses(target) {
  if (!target.className || typeof target.className !== 'string') return ''
  return target.className.trim().replace(/\s+/g, ' ')
}

/**
 * Gets nearby text content for annotation context.
 */
export function getNearbyText(element) {
  return (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120)
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test tests/utils/domInspector.test.js
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/domInspector.js tests/utils/domInspector.test.js
git commit -m "feat: domInspector util — element path + shadow DOM traversal with tests"
```

---

## Task 6: `markdown.js` (TDD)

**Files:**
- Create: `src/utils/markdown.js`
- Create: `tests/utils/markdown.test.js`

- [ ] **Step 1: Write failing tests at `tests/utils/markdown.test.js`**

```js
import { annotationsToMarkdown, annotationToMarkdown } from '../../src/utils/markdown.js'

const annotation = {
  id: '1',
  selector: 'button.primary',
  path: 'div#app > button.primary',
  classes: ['primary', 'large'],
  context: 'Save Changes',
  feedback: 'Change button color to blue',
  status: 'active',
}

describe('annotationToMarkdown', () => {
  it('includes selector as heading', () => {
    const md = annotationToMarkdown(annotation)
    expect(md).toContain('### button.primary')
  })

  it('includes element path', () => {
    const md = annotationToMarkdown(annotation)
    expect(md).toContain('`div#app > button.primary`')
  })

  it('includes context text', () => {
    const md = annotationToMarkdown(annotation)
    expect(md).toContain('"Save Changes"')
  })

  it('includes feedback', () => {
    const md = annotationToMarkdown(annotation)
    expect(md).toContain('Change button color to blue')
  })

  it('truncates context at 80 characters with ellipsis', () => {
    const a = { ...annotation, context: 'a'.repeat(100) }
    const md = annotationToMarkdown(a)
    expect(md).toContain('…')
    const contextLine = md.split('\n').find(l => l.startsWith('**Context:**'))
    expect(contextLine.length).toBeLessThan(100)
  })

  it('omits context line when context is empty', () => {
    const a = { ...annotation, context: '' }
    const md = annotationToMarkdown(a)
    expect(md).not.toContain('**Context:**')
  })
})

describe('annotationsToMarkdown', () => {
  it('returns empty string for empty array', () => {
    expect(annotationsToMarkdown([])).toBe('')
  })

  it('includes Pinpoint header', () => {
    const md = annotationsToMarkdown([annotation], 'https://example.com/page')
    expect(md).toContain('Pinpoint')
  })

  it('includes page URL', () => {
    const md = annotationsToMarkdown([annotation], 'https://example.com/page')
    expect(md).toContain('https://example.com/page')
  })

  it('includes annotation count', () => {
    const md = annotationsToMarkdown([annotation, annotation], 'https://example.com')
    expect(md).toContain('2')
  })

  it('renders all annotations', () => {
    const a2 = { ...annotation, id: '2', selector: 'input.search', feedback: 'Add placeholder' }
    const md = annotationsToMarkdown([annotation, a2], 'https://example.com')
    expect(md).toContain('button.primary')
    expect(md).toContain('input.search')
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test tests/utils/markdown.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/utils/markdown.js`** (port from npm package; only header string changes)

```js
/**
 * Converts an annotations array into structured markdown for AI coding agents.
 */
export function annotationsToMarkdown(annotations, url = window.location.href) {
  if (!annotations.length) return ''

  const lines = [
    '## Pinpoint — UI Feedback',
    `**Page:** ${url}`,
    `**Active annotations:** ${annotations.length}`,
    '',
  ]

  annotations.forEach((a, i) => {
    lines.push(`### Annotation ${i + 1}`)
    if (a.selector) lines.push(`**Element:** \`${a.selector}\``)
    if (a.path) lines.push(`**Path:** \`${a.path}\``)
    if (a.context) lines.push(`**Context:** "${a.context.slice(0, 80)}${a.context.length > 80 ? '…' : ''}"`)
    lines.push(`**Feedback:** ${a.feedback}`)
    lines.push('')
  })

  return lines.join('\n')
}

/**
 * Converts a single annotation to a standalone markdown block.
 */
export function annotationToMarkdown(a) {
  const lines = []
  lines.push(`### ${a.selector}`)
  if (a.path) lines.push(`**Path:** \`${a.path}\``)
  if (a.context) lines.push(`**Context:** "${a.context.slice(0, 80)}${a.context.length > 80 ? '…' : ''}"`)
  lines.push(`**Feedback:** ${a.feedback}`)
  lines.push('')
  return lines.join('\n')
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test tests/utils/markdown.test.js
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/markdown.js tests/utils/markdown.test.js
git commit -m "feat: markdown util — annotation to AI-ready markdown with tests"
```

---

## Task 7: `Overlay.js` (TDD)

**Files:**
- Create: `src/content/Overlay.js`
- Create: `tests/content/Overlay.test.js`

- [ ] **Step 1: Write failing tests at `tests/content/Overlay.test.js`**

```js
import { Overlay } from '../../src/content/Overlay.js'
import { EVENTS, PPT_PREFIX } from '../../src/constants.js'

describe('Overlay', () => {
  let overlay

  beforeEach(() => {
    overlay = new Overlay()
  })

  afterEach(() => {
    overlay.unmount()
  })

  describe('mount / unmount', () => {
    it('injects a dialog element into the document', () => {
      overlay.mount()
      const dialog = document.querySelector(`dialog.${PPT_PREFIX}overlay`)
      expect(dialog).not.toBeNull()
    })

    it('removes the dialog on unmount', () => {
      overlay.mount()
      overlay.unmount()
      const dialog = document.querySelector(`dialog.${PPT_PREFIX}overlay`)
      expect(dialog).toBeNull()
    })

    it('is safe to call unmount before mount', () => {
      expect(() => overlay.unmount()).not.toThrow()
    })
  })

  describe('freeze / unfreeze', () => {
    it('sets pointer-events:none on freeze', () => {
      overlay.mount()
      overlay.freeze()
      const dialog = document.querySelector(`dialog.${PPT_PREFIX}overlay`)
      expect(dialog.style.pointerEvents).toBe('none')
    })

    it('clears pointer-events on unfreeze', () => {
      overlay.mount()
      overlay.freeze()
      overlay.unfreeze()
      const dialog = document.querySelector(`dialog.${PPT_PREFIX}overlay`)
      expect(dialog.style.pointerEvents).toBe('')
    })
  })

  describe('elementclick event', () => {
    it('dispatches pinpoint:elementclick when a non-annotator element is clicked', () => {
      overlay.mount()

      const target = document.createElement('button')
      target.className = 'my-btn'
      document.body.appendChild(target)

      let received = null
      document.addEventListener(EVENTS.ELEMENT_CLICK, (e) => { received = e }, { once: true })

      // Simulate composedPath click — use internal handler directly
      overlay._simulateClick(target)

      expect(received).not.toBeNull()
      expect(received.detail.element).toBe(target)
      target.remove()
    })

    it('does not dispatch elementclick for annotator-owned elements', () => {
      overlay.mount()

      const target = document.createElement('div')
      target.className = `${PPT_PREFIX}toolbar`
      document.body.appendChild(target)

      let received = null
      document.addEventListener(EVENTS.ELEMENT_CLICK, (e) => { received = e }, { once: true })

      overlay._simulateClick(target)

      expect(received).toBeNull()
      target.remove()
    })
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test tests/content/Overlay.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/content/Overlay.js`**

```js
import { PPT_PREFIX, EVENTS } from '../constants.js'
import { identifyElement, getElementClasses, getNearbyText } from '../utils/domInspector.js'

function isAnnotatorElement(el) {
  let current = el
  while (current) {
    if (current.className && typeof current.className === 'string' && current.className.includes(PPT_PREFIX)) return true
    const root = current.getRootNode()
    current = current.parentElement || (root instanceof ShadowRoot ? root.host : null)
  }
  return false
}

export class Overlay {
  #dialog = null
  #highlight = null
  #onMouseOver = null
  #onClick = null
  #onKeyDown = null

  mount() {
    this.#dialog = document.createElement('dialog')
    this.#dialog.className = `${PPT_PREFIX}overlay`

    this.#highlight = document.createElement('div')
    this.#highlight.className = `${PPT_PREFIX}highlight`
    this.#dialog.appendChild(this.#highlight)

    document.body.appendChild(this.#dialog)
    this.#dialog.showModal()

    this.#onMouseOver = (e) => this.#handleMouseOver(e)
    this.#onClick = (e) => this.#handleClick(e)
    this.#onKeyDown = (e) => { if (e.key === 'Escape') this.#hideHighlight() }

    document.addEventListener('mouseover', this.#onMouseOver, true)
    document.addEventListener('click', this.#onClick, true)
    document.addEventListener('keydown', this.#onKeyDown)
  }

  unmount() {
    if (!this.#dialog) return
    document.removeEventListener('mouseover', this.#onMouseOver, true)
    document.removeEventListener('click', this.#onClick, true)
    document.removeEventListener('keydown', this.#onKeyDown)
    this.#dialog.remove()
    this.#dialog = null
    this.#highlight = null
  }

  freeze() {
    if (this.#dialog) this.#dialog.style.pointerEvents = 'none'
  }

  unfreeze() {
    if (this.#dialog) this.#dialog.style.pointerEvents = ''
  }

  // Test seam: allows tests to simulate a click on a specific element
  _simulateClick(target) {
    this.#dispatchElementClick(target)
  }

  #handleMouseOver(e) {
    const path = e.composedPath()
    const target = path.find(el => el.tagName && !isAnnotatorElement(el))
    if (!target || target === document.body || target === document.documentElement) {
      this.#hideHighlight()
      return
    }
    const rect = target.getBoundingClientRect()
    this.#highlight.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;display:block`
  }

  #handleClick(e) {
    const path = e.composedPath()
    if (path.some(el => el.tagName && isAnnotatorElement(el))) return
    const target = path.find(el => el.tagName && !isAnnotatorElement(el))
    if (!target || target === document.body || target === document.documentElement) return
    e.preventDefault()
    e.stopPropagation()
    this.#dispatchElementClick(target)
  }

  #dispatchElementClick(target) {
    if (isAnnotatorElement(target)) return
    const rect = target.getBoundingClientRect()
    const { name, path } = identifyElement(target)
    const classes = getElementClasses(target).split(' ').filter(Boolean)
    const context = getNearbyText(target)
    document.dispatchEvent(new CustomEvent(EVENTS.ELEMENT_CLICK, {
      bubbles: true,
      composed: true,
      detail: {
        element: target,
        rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        selector: name,
        path,
        classes,
        context,
      },
    }))
  }

  #hideHighlight() {
    if (this.#highlight) this.#highlight.style.display = 'none'
  }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test tests/content/Overlay.test.js
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/Overlay.js tests/content/Overlay.test.js
git commit -m "feat: Overlay class — dialog-based hover highlight and element click capture"
```

---

## Task 8: `Popup.js` (TDD)

**Files:**
- Create: `src/content/Popup.js`
- Create: `tests/content/Popup.test.js`

- [ ] **Step 1: Write failing tests at `tests/content/Popup.test.js`**

```js
import { Popup } from '../../src/content/Popup.js'
import { EVENTS, PPT_PREFIX } from '../../src/constants.js'

describe('Popup', () => {
  let popup

  beforeEach(() => {
    popup = new Popup()
    popup.mount()
  })

  afterEach(() => {
    popup.unmount()
  })

  describe('show', () => {
    it('becomes visible when shown', () => {
      popup.show({ x: 100, y: 200, width: 50, height: 30 }, null)
      const el = document.querySelector(`.${PPT_PREFIX}popup`)
      expect(el.style.display).not.toBe('none')
    })

    it('shows "Add" label when no existing annotation', () => {
      popup.show({ x: 0, y: 0, width: 0, height: 0 }, null)
      const btn = document.querySelector(`.${PPT_PREFIX}popup-submit`)
      expect(btn.textContent).toBe('Add')
    })

    it('shows "Update" label and prefills text for existing annotation', () => {
      popup.show({ x: 0, y: 0, width: 0, height: 0 }, { id: '1', feedback: 'Old feedback' })
      const btn = document.querySelector(`.${PPT_PREFIX}popup-submit`)
      const textarea = document.querySelector(`.${PPT_PREFIX}popup-textarea`)
      expect(btn.textContent).toBe('Update')
      expect(textarea.value).toBe('Old feedback')
    })
  })

  describe('hide', () => {
    it('hides the popup', () => {
      popup.show({ x: 0, y: 0, width: 0, height: 0 }, null)
      popup.hide()
      const el = document.querySelector(`.${PPT_PREFIX}popup`)
      expect(el.style.display).toBe('none')
    })
  })

  describe('annotationadd event', () => {
    it('dispatches pinpoint:annotationadd with comment on submit', () => {
      popup.show({ x: 0, y: 0, width: 0, height: 0 }, null)

      let received = null
      document.addEventListener(EVENTS.ANNOTATION_ADD, (e) => { received = e }, { once: true })

      const textarea = document.querySelector(`.${PPT_PREFIX}popup-textarea`)
      textarea.value = 'Change the button color'

      const form = document.querySelector(`.${PPT_PREFIX}popup-form`)
      form.dispatchEvent(new Event('submit'))

      expect(received).not.toBeNull()
      expect(received.detail.feedback).toBe('Change the button color')
    })

    it('does not dispatch event when comment is empty', () => {
      popup.show({ x: 0, y: 0, width: 0, height: 0 }, null)

      let received = null
      document.addEventListener(EVENTS.ANNOTATION_ADD, (e) => { received = e }, { once: true })

      const form = document.querySelector(`.${PPT_PREFIX}popup-form`)
      form.dispatchEvent(new Event('submit'))

      expect(received).toBeNull()
    })

    it('includes existing annotation id on update', () => {
      const existing = { id: 'abc', feedback: 'Old' }
      popup.show({ x: 0, y: 0, width: 0, height: 0 }, existing)

      let received = null
      document.addEventListener(EVENTS.ANNOTATION_ADD, (e) => { received = e }, { once: true })

      const textarea = document.querySelector(`.${PPT_PREFIX}popup-textarea`)
      textarea.value = 'New feedback'
      document.querySelector(`.${PPT_PREFIX}popup-form`).dispatchEvent(new Event('submit'))

      expect(received.detail.existingId).toBe('abc')
    })
  })

  describe('cancel', () => {
    it('hides popup when cancel is clicked', () => {
      popup.show({ x: 0, y: 0, width: 0, height: 0 }, null)
      document.querySelector(`.${PPT_PREFIX}popup-cancel`).click()
      const el = document.querySelector(`.${PPT_PREFIX}popup`)
      expect(el.style.display).toBe('none')
    })
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test tests/content/Popup.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/content/Popup.js`**

```js
import { PPT_PREFIX, EVENTS } from '../constants.js'

export class Popup {
  #el = null
  #existing = null
  #onKeyDown = null

  mount() {
    this.#el = document.createElement('div')
    this.#el.className = `${PPT_PREFIX}popup`
    this.#el.style.display = 'none'
    this.#el.innerHTML = `
      <form class="${PPT_PREFIX}popup-form">
        <textarea class="${PPT_PREFIX}popup-textarea" placeholder="Describe the change needed…" rows="4"></textarea>
        <div class="${PPT_PREFIX}popup-actions">
          <button type="button" class="${PPT_PREFIX}popup-cancel">Cancel</button>
          <button type="submit" class="${PPT_PREFIX}popup-submit">Add</button>
        </div>
      </form>
    `
    document.body.appendChild(this.#el)

    this.#el.querySelector(`.${PPT_PREFIX}popup-form`).addEventListener('submit', (e) => {
      e.preventDefault()
      const feedback = this.#el.querySelector(`.${PPT_PREFIX}popup-textarea`).value.trim()
      if (!feedback) return
      document.dispatchEvent(new CustomEvent(EVENTS.ANNOTATION_ADD, {
        bubbles: true,
        composed: true,
        detail: { feedback, existingId: this.#existing?.id ?? null },
      }))
      this.hide()
    })

    this.#el.querySelector(`.${PPT_PREFIX}popup-cancel`).addEventListener('click', () => this.hide())

    this.#onKeyDown = (e) => {
      if (e.key === 'Escape' && this.#el.style.display !== 'none') this.hide()
      if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) && this.#el.style.display !== 'none') {
        this.#el.querySelector(`.${PPT_PREFIX}popup-form`).dispatchEvent(new Event('submit'))
      }
    }
    document.addEventListener('keydown', this.#onKeyDown)
  }

  show(rect, existing) {
    this.#existing = existing
    const textarea = this.#el.querySelector(`.${PPT_PREFIX}popup-textarea`)
    const submitBtn = this.#el.querySelector(`.${PPT_PREFIX}popup-submit`)

    textarea.value = existing?.feedback ?? ''
    submitBtn.textContent = existing ? 'Update' : 'Add'

    const top = Math.min(rect.y + rect.height + 8, window.innerHeight - 220)
    const left = Math.min(rect.x, window.innerWidth - 340)
    this.#el.style.cssText = `display:block;position:fixed;top:${top}px;left:${left}px`

    textarea.focus()
  }

  hide() {
    this.#el.style.display = 'none'
    this.#existing = null
  }

  unmount() {
    document.removeEventListener('keydown', this.#onKeyDown)
    this.#el?.remove()
    this.#el = null
  }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test tests/content/Popup.test.js
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/Popup.js tests/content/Popup.test.js
git commit -m "feat: Popup class — annotation form with add/update mode"
```

---

## Task 9: `Toolbar.js` (TDD)

**Files:**
- Create: `src/content/Toolbar.js`
- Create: `tests/content/Toolbar.test.js`

- [ ] **Step 1: Write failing tests at `tests/content/Toolbar.test.js`**

```js
import { Toolbar } from '../../src/content/Toolbar.js'
import { PPT_PREFIX } from '../../src/constants.js'

const makeAnnotation = (overrides = {}) => ({
  id: crypto.randomUUID(),
  selector: 'button.primary',
  path: 'div > button.primary',
  classes: ['primary'],
  context: 'Save',
  feedback: 'Change color',
  status: 'active',
  createdAt: Date.now(),
  url: 'http://localhost/',
  rect: { x: 10, y: 10, width: 100, height: 40 },
  ...overrides,
})

describe('Toolbar', () => {
  let toolbar

  beforeEach(async () => {
    toolbar = new Toolbar()
    await toolbar.mount()
  })

  afterEach(() => {
    toolbar.unmount()
  })

  it('injects toolbar element into document', () => {
    const el = document.querySelector(`.${PPT_PREFIX}toolbar`)
    expect(el).not.toBeNull()
  })

  it('restores persisted annotations from storage on mount', async () => {
    const saved = [makeAnnotation()]
    await chrome.storage.local.set({ 'pinpoint:/': saved })

    const t2 = new Toolbar()
    await t2.mount()
    const list = document.querySelectorAll(`.${PPT_PREFIX}toolbar .${PPT_PREFIX}annotation-item`)
    expect(list.length).toBeGreaterThan(0)
    t2.unmount()
  })

  describe('addAnnotation', () => {
    it('adds annotation and re-renders', async () => {
      const annotation = makeAnnotation()
      await toolbar.addAnnotation(annotation)
      const items = document.querySelectorAll(`.${PPT_PREFIX}annotation-item`)
      expect(items.length).toBe(1)
    })

    it('persists to storage', async () => {
      const annotation = makeAnnotation()
      await toolbar.addAnnotation(annotation)
      expect(chrome.storage.local.set).toHaveBeenCalled()
    })
  })

  describe('updateAnnotation', () => {
    it('updates comment on existing annotation', async () => {
      const annotation = makeAnnotation({ feedback: 'Old' })
      await toolbar.addAnnotation(annotation)
      await toolbar.updateAnnotation(annotation.id, 'New comment')
      const items = document.querySelectorAll(`.${PPT_PREFIX}annotation-item`)
      expect(items[0].textContent).toContain('New comment')
    })
  })

  describe('resolve', () => {
    it('moves annotation to resolved tab', async () => {
      const annotation = makeAnnotation()
      await toolbar.addAnnotation(annotation)
      await toolbar.resolve(annotation.id)

      // Switch to resolved tab to see it
      toolbar.setTab('resolved')
      const items = document.querySelectorAll(`.${PPT_PREFIX}annotation-item`)
      expect(items.length).toBe(1)
    })
  })

  describe('copyAll', () => {
    it('writes active annotations as markdown to clipboard', async () => {
      const writeMock = vi.fn(async () => {})
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: writeMock }, configurable: true })

      await toolbar.addAnnotation(makeAnnotation({ feedback: 'Fix alignment' }))
      await toolbar.copyAll()

      expect(writeMock).toHaveBeenCalledWith(expect.stringContaining('Fix alignment'))
    })
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test tests/content/Toolbar.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/content/Toolbar.js`**

```js
import { PPT_PREFIX } from '../constants.js'
import { getAnnotations, saveAnnotations } from '../utils/storage.js'
import { annotationsToMarkdown, annotationToMarkdown } from '../utils/markdown.js'

export class Toolbar {
  #el = null
  #annotations = []
  #tab = 'active' // 'active' | 'resolved'

  async mount() {
    this.#annotations = await getAnnotations(window.location.pathname)
    this.#el = document.createElement('div')
    this.#el.className = `${PPT_PREFIX}toolbar`
    document.body.appendChild(this.#el)
    this.#render()
  }

  unmount() {
    this.#el?.remove()
    this.#el = null
  }

  getAnnotationByPath(elementPath) {
    return this.#annotations.find(
      a => a.status === 'active' && a.path === elementPath
    ) ?? null
  }

  async addAnnotation(annotation) {
    this.#annotations = [...this.#annotations, annotation]
    await saveAnnotations(window.location.pathname, this.#annotations)
    this.#render()
  }

  async updateAnnotation(id, comment) {
    this.#annotations = this.#annotations.map(a =>
      a.id === id ? { ...a, feedback: comment, createdAt: Date.now() } : a
    )
    await saveAnnotations(window.location.pathname, this.#annotations)
    this.#render()
  }

  async resolve(id) {
    this.#annotations = this.#annotations.map(a =>
      a.id === id ? { ...a, status: 'resolved' } : a
    )
    await saveAnnotations(window.location.pathname, this.#annotations)
    this.#render()
  }

  setTab(tab) {
    this.#tab = tab
    this.#render()
  }

  async copyAll() {
    const active = this.#annotations.filter(a => a.status === 'active')
    const md = annotationsToMarkdown(active, window.location.href)
    try {
      await navigator.clipboard.writeText(md)
    } catch {
      console.log('[pinpoint] Clipboard unavailable:\n\n' + md) // eslint-disable-line no-console
    }
  }

  async copyOne(id) {
    const annotation = this.#annotations.find(a => a.id === id)
    if (!annotation) return
    const md = annotationToMarkdown(annotation)
    try {
      await navigator.clipboard.writeText(md)
    } catch {
      console.log('[pinpoint] Clipboard unavailable:\n\n' + md) // eslint-disable-line no-console
    }
  }

  #activeAnnotations() {
    return this.#annotations.filter(a => a.status === 'active')
  }

  #resolvedAnnotations() {
    return this.#annotations.filter(a => a.status === 'resolved')
  }

  #render() {
    const active = this.#activeAnnotations()
    const resolved = this.#resolvedAnnotations()
    const shown = this.#tab === 'active' ? active : resolved

    this.#el.innerHTML = `
      <div class="${PPT_PREFIX}toolbar-header">
        <span class="${PPT_PREFIX}toolbar-title">Pinpoint</span>
        <button class="${PPT_PREFIX}copy-all" ${active.length === 0 ? 'disabled' : ''}>Copy All</button>
        <button class="${PPT_PREFIX}clear-active">Clear</button>
      </div>
      <div class="${PPT_PREFIX}tabs">
        <button class="${PPT_PREFIX}tab ${this.#tab === 'active' ? `${PPT_PREFIX}tab--active` : ''}" data-tab="active">
          To Tackle (${active.length})
        </button>
        <button class="${PPT_PREFIX}tab ${this.#tab === 'resolved' ? `${PPT_PREFIX}tab--active` : ''}" data-tab="resolved">
          Resolved (${resolved.length})
        </button>
      </div>
      <ul class="${PPT_PREFIX}list">
        ${shown.length === 0 ? `<li class="${PPT_PREFIX}empty">No annotations yet</li>` : ''}
        ${shown.map(a => `
          <li class="${PPT_PREFIX}annotation-item" data-id="${a.id}">
            <span class="${PPT_PREFIX}item-element">${a.selector}</span>
            <span class="${PPT_PREFIX}item-comment">${a.feedback}</span>
            <div class="${PPT_PREFIX}item-actions">
              <button class="${PPT_PREFIX}copy-one" data-id="${a.id}">Copy</button>
              ${a.status === 'active' ? `<button class="${PPT_PREFIX}resolve-one" data-id="${a.id}">Resolve</button>` : ''}
            </div>
          </li>
        `).join('')}
      </ul>
    `

    this.#el.querySelector(`.${PPT_PREFIX}copy-all`).addEventListener('click', () => this.copyAll())
    this.#el.querySelector(`.${PPT_PREFIX}clear-active`).addEventListener('click', () => this.#clearActive())
    this.#el.querySelectorAll(`.${PPT_PREFIX}tab`).forEach(btn => {
      btn.addEventListener('click', (e) => this.setTab(e.currentTarget.dataset.tab))
    })
    this.#el.querySelectorAll(`.${PPT_PREFIX}copy-one`).forEach(btn => {
      btn.addEventListener('click', (e) => this.copyOne(e.currentTarget.dataset.id))
    })
    this.#el.querySelectorAll(`.${PPT_PREFIX}resolve-one`).forEach(btn => {
      btn.addEventListener('click', (e) => this.resolve(e.currentTarget.dataset.id))
    })
  }

  async #clearActive() {
    this.#annotations = this.#resolvedAnnotations()
    await saveAnnotations(window.location.pathname, this.#annotations)
    this.#render()
  }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test tests/content/Toolbar.test.js
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/Toolbar.js tests/content/Toolbar.test.js
git commit -m "feat: Toolbar class — annotation list, tabs, copy/resolve actions"
```

---

## Task 10: `content/index.js` — Coordinator

**Files:**
- Modify: `src/content/index.js`
- Create: `tests/content/index.test.js`

The coordinator wires Overlay → Popup → Toolbar. It stores `pendingElementData` between the `elementclick` event (from Overlay) and the `annotationadd` event (from Popup), then calls Toolbar methods directly.

- [ ] **Step 1: Implement `src/content/index.js`**

```js
import { Overlay } from './Overlay.js'
import { Toolbar } from './Toolbar.js'
import { Popup } from './Popup.js'
import { EVENTS, MSG } from '../constants.js'
import './content.css'

let overlay = null
let toolbar = null
let popup = null
let pendingElementData = null

export async function activate() {
  if (overlay) return // already active

  overlay = new Overlay()
  toolbar = new Toolbar()
  popup = new Popup()

  overlay.mount()
  await toolbar.mount()
  popup.mount()

  document.addEventListener(EVENTS.ELEMENT_CLICK, handleElementClick)
  document.addEventListener(EVENTS.ANNOTATION_ADD, handleAnnotationAdd)
}

export function deactivate() {
  if (!overlay) return
  document.removeEventListener(EVENTS.ELEMENT_CLICK, handleElementClick)
  document.removeEventListener(EVENTS.ANNOTATION_ADD, handleAnnotationAdd)
  overlay.unmount()
  toolbar.unmount()
  popup.unmount()
  overlay = toolbar = popup = pendingElementData = null
}

function handleElementClick(e) {
  const { rect, name, elementPath, cssClasses, nearbyText } = e.detail
  const existing = toolbar.getAnnotationByPath(elementPath)
  pendingElementData = {
    selector: name,
    path: elementPath,
    classes: cssClasses ? cssClasses.split(' ') : [],
    context: nearbyText,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    url: window.location.href,
  }
  overlay.freeze()
  popup.show(rect, existing)
}

async function handleAnnotationAdd(e) {
  const { feedback, existingId } = e.detail
  overlay.unfreeze()

  if (existingId) {
    await toolbar.updateAnnotation(existingId, feedback)
  } else {
    const annotation = {
      id: crypto.randomUUID(),
      feedback,
      ...pendingElementData,
      status: 'active',
      createdAt: Date.now(),
    }
    await toolbar.addAnnotation(annotation)
  }
  pendingElementData = null
}

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === MSG.ACTIVATE) activate()
  if (msg.type === MSG.DEACTIVATE) deactivate()
})
```

- [ ] **Step 2: Verify all existing tests still pass**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/content/index.js
git commit -m "feat: content script coordinator — wires Overlay, Popup, Toolbar"
```

- [ ] **Step 4: Add coordinator tests at `tests/content/index.test.js`**

Test cases:
- `elementclick` freezes overlay and opens popup with existing annotation lookup
- `annotationadd` with `existingId` calls `toolbar.updateAnnotation`
- `annotationadd` without `existingId` calls `toolbar.addAnnotation` with canonical schema fields
- `deactivate()` removes listeners and unmounts all components

- [ ] **Step 5: Run coordinator tests**

```bash
npm test tests/content/index.test.js
```

Expected: all coordinator tests pass.

- [ ] **Step 6: Commit coordinator tests**

```bash
git add tests/content/index.test.js
git commit -m "test: coordinator event flow and annotation mapping"
```

---

## Task 11: `service-worker.js`

**Files:**
- Modify: `src/background/service-worker.js`
- Create: `tests/background/service-worker.test.js`

- [ ] **Step 1: Implement `src/background/service-worker.js`**

```js
import { MSG, SETTINGS_KEY } from '../constants.js'

// Per-tab activation state for this session
const activeTabs = new Set()
// Tabs manually deactivated by the user — URL pattern auto-activate won't override these
const manuallyDeactivatedTabs = new Set()

// --- Icon click toggle ---
chrome.action.onClicked.addListener(async (tab) => {
  await toggleTab(tab.id)
})

// --- Keyboard shortcut ---
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-pinpoint') return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab) await toggleTab(tab.id)
})

// --- URL pattern auto-activate on navigation ---
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return // top frame only
  if (manuallyDeactivatedTabs.has(details.tabId)) return // manual override wins
  const tab = await chrome.tabs.get(details.tabId)
  const patterns = await getUrlPatterns()
  if (patterns.some(p => matchesPattern(p, tab.url))) {
    await activateTab(details.tabId)
  }
})

// --- Message handler (state queries from content script) ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === MSG.GET_STATE) {
    sendResponse({ active: activeTabs.has(sender.tab?.id) })
  }
  return true
})

async function toggleTab(tabId) {
  if (activeTabs.has(tabId)) {
    await deactivateTab(tabId, true) // manual = true, suppresses URL pattern re-activation
  } else {
    manuallyDeactivatedTabs.delete(tabId) // user re-activating manually clears the override
    await activateTab(tabId)
  }
}

async function activateTab(tabId) {
  activeTabs.add(tabId)
  await chrome.action.setBadgeText({ text: 'ON', tabId })
  await chrome.action.setBadgeBackgroundColor({ color: '#0070d2', tabId })
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  }).catch(() => {}) // already injected — ignore error
  await chrome.tabs.sendMessage(tabId, { type: MSG.ACTIVATE }).catch(() => {})
}

async function deactivateTab(tabId, manual = false) {
  activeTabs.delete(tabId)
  if (manual) manuallyDeactivatedTabs.add(tabId)
  await chrome.action.setBadgeText({ text: '', tabId })
  await chrome.tabs.sendMessage(tabId, { type: MSG.DEACTIVATE }).catch(() => {})
}

async function getUrlPatterns() {
  const result = await chrome.storage.sync.get(SETTINGS_KEY)
  return result[SETTINGS_KEY] ?? []
}

function matchesPattern(pattern, url) {
  // Convert wildcard pattern to regex: * → .*
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`).test(url)
}
```

> **Note:** `webNavigation` + host permissions are required for URL-based background injection. Add both to `manifest.json`:

```json
"permissions": ["storage", "activeTab", "scripting", "commands", "webNavigation"],
"host_permissions": ["<all_urls>"]
```

- [ ] **Step 2: Update `public/manifest.json` to add `webNavigation` and `host_permissions`**

Edit the permissions array:
```json
"permissions": ["storage", "activeTab", "scripting", "commands", "webNavigation"],
"host_permissions": ["<all_urls>"]
```

- [ ] **Step 3: Verify full test suite still passes**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/background/service-worker.js public/manifest.json
git commit -m "feat: service worker — icon toggle, hotkey, URL pattern auto-activate"
```

- [ ] **Step 5: Add service worker tests at `tests/background/service-worker.test.js`**

Cover:
- icon/hotkey toggle updates badge and sends activate/deactivate messages
- manual deactivation sets override and blocks URL auto-reactivation
- manual re-activation clears override
- `matchesPattern` full URL matching behavior for valid patterns

- [ ] **Step 6: Run service worker tests**

```bash
npm test tests/background/service-worker.test.js
```

Expected: all service worker tests pass.

- [ ] **Step 7: Commit service worker tests**

```bash
git add tests/background/service-worker.test.js
git commit -m "test: service worker activation and URL-pattern behavior"
```

---

## Task 12: Settings Page

**Files:**
- Modify: `src/settings/settings.html`
- Modify: `src/settings/settings.js`
- Modify: `src/settings/settings.css`
- Create: `tests/settings/settings.test.js`

- [ ] **Step 1: Implement `src/settings/settings.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Pinpoint Settings</title>
  <link rel="stylesheet" href="settings.css">
</head>
<body>
  <div class="settings-container">
    <h1>Pinpoint Settings</h1>

    <section>
      <h2>URL Patterns</h2>
      <p>Pinpoint activates automatically on pages matching these patterns. Use <code>*</code> as a wildcard.</p>
      <p>Examples: <code>http://localhost:*/*</code> · <code>https://*.mycompany.com/*</code></p>
      <ul id="pattern-list"></ul>
      <form id="add-pattern-form">
        <input id="pattern-input" type="text" placeholder="e.g. https://*.mycompany.com/*" autocomplete="off">
        <button type="submit">Add</button>
      </form>
      <p id="pattern-error" class="error" aria-live="polite"></p>
    </section>

    <section>
      <h2>Keyboard Shortcut</h2>
      <p>Default: <kbd>Ctrl+Shift+A</kbd> / <kbd>⌘+Shift+A</kbd></p>
      <a href="chrome://extensions/shortcuts" target="_blank">Change shortcut in Chrome settings →</a>
    </section>
  </div>
  <script type="module" src="./settings.js"></script>
</body>
</html>
```

- [ ] **Step 2: Implement `src/settings/settings.js`**

```js
import { SETTINGS_KEY } from '../constants.js'

async function loadPatterns() {
  const result = await chrome.storage.sync.get(SETTINGS_KEY)
  return result[SETTINGS_KEY] ?? []
}

async function savePatterns(patterns) {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: patterns })
}

function renderList(patterns) {
  const list = document.getElementById('pattern-list')
  list.textContent = ''
  if (patterns.length === 0) {
    const li = document.createElement('li')
    li.className = 'empty'
    li.textContent = 'No patterns added yet.'
    list.appendChild(li)
    return
  }

  patterns.forEach((p, i) => {
    const li = document.createElement('li')
    const code = document.createElement('code')
    code.textContent = p
    const btn = document.createElement('button')
    btn.className = 'remove-btn'
    btn.dataset.index = String(i)
    btn.textContent = 'Remove'
    btn.addEventListener('click', async (e) => {
      const idx = Number(e.currentTarget.dataset.index)
      const current = await loadPatterns()
      await savePatterns(current.filter((_, j) => j !== idx))
      renderList(await loadPatterns())
    })
    li.append(code, btn)
    list.appendChild(li)
  })
}

function isValidPattern(value) {
  return /^https?:\/\/.+/.test(value)
}

document.getElementById('add-pattern-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const input = document.getElementById('pattern-input')
  const error = document.getElementById('pattern-error')
  const value = input.value.trim()
  error.textContent = ''
  if (!value) return
  if (!isValidPattern(value)) {
    error.textContent = 'Invalid pattern. Use full URL form, e.g. https://*.example.com/*'
    return
  }
  const current = await loadPatterns()
  if (!current.includes(value)) {
    await savePatterns([...current, value])
  }
  input.value = ''
  renderList(await loadPatterns())
})

// Init
loadPatterns().then(renderList)
```

- [ ] **Step 3: Implement `src/settings/settings.css`**

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  margin: 0;
  background: #f4f6f9;
  color: #1a1a2e;
}

.settings-container {
  max-width: 560px;
  margin: 32px auto;
  padding: 0 24px;
}

h1 { font-size: 20px; margin-bottom: 24px; }
h2 { font-size: 15px; margin-bottom: 8px; }
section { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 16px; }

#pattern-list { list-style: none; padding: 0; margin: 12px 0; }
#pattern-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #eee; }
#pattern-list li.empty { color: #888; font-style: italic; }

#add-pattern-form { display: flex; gap: 8px; margin-top: 12px; }
#pattern-input { flex: 1; padding: 6px 10px; border: 1px solid #d8dde6; border-radius: 4px; font-size: 13px; }
button { padding: 6px 14px; background: #0070d2; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
button:hover { background: #005fb2; }
.remove-btn { background: transparent; color: #c23934; font-size: 12px; }
.remove-btn:hover { background: transparent; text-decoration: underline; }

a { color: #0070d2; }
kbd { background: #f0f0f0; border: 1px solid #ccc; border-radius: 3px; padding: 1px 5px; font-size: 12px; }
.error { color: #c23934; min-height: 18px; margin-top: 8px; }
```

- [ ] **Step 4: Commit**

```bash
git add src/settings/
git commit -m "feat: settings page — URL pattern management"
```

- [ ] **Step 5: Add settings tests at `tests/settings/settings.test.js`**

Cover:
- add valid pattern
- reject invalid pattern (`localhost:*`) and show inline error
- ignore duplicates
- remove existing pattern

- [ ] **Step 6: Run settings tests**

```bash
npm test tests/settings/settings.test.js
```

Expected: all settings tests pass.

- [ ] **Step 7: Commit settings tests**

```bash
git add tests/settings/settings.test.js
git commit -m "test: settings URL pattern validation and CRUD behaviors"
```

---

## Task 13: `content.css`

**Files:**
- Modify: `src/content/content.css`

- [ ] **Step 1: Implement `src/content/content.css`**

```css
/* === Overlay === */
dialog.ppt-overlay {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  max-width: 100vw;
  max-height: 100vh;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  pointer-events: none;
  overflow: hidden;
}

dialog.ppt-overlay::backdrop {
  background: transparent;
}

.ppt-highlight {
  position: fixed;
  display: none;
  border: 2px solid #0070d2;
  border-radius: 3px;
  background: rgba(0, 112, 210, 0.08);
  pointer-events: none;
  box-sizing: border-box;
}

/* === Toolbar === */
.ppt-toolbar {
  position: fixed;
  top: 16px;
  right: 16px;
  width: 300px;
  max-height: 80vh;
  background: #fff;
  border: 1px solid #d8dde6;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  z-index: 2147483646;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  color: #1a1a2e;
  overflow: hidden;
}

.ppt-toolbar-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid #e8edf3;
  background: #f4f6f9;
}

.ppt-toolbar-title {
  font-weight: 600;
  flex: 1;
}

.ppt-tabs {
  display: flex;
  border-bottom: 1px solid #e8edf3;
}

.ppt-tab {
  flex: 1;
  padding: 8px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 12px;
  color: #6b7280;
}

.ppt-tab--active {
  color: #0070d2;
  border-bottom-color: #0070d2;
  font-weight: 500;
}

.ppt-list {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  flex: 1;
}

.ppt-annotation-item {
  padding: 10px 12px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ppt-item-element {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 11px;
  color: #0070d2;
}

.ppt-item-comment {
  font-size: 12px;
  color: #3e3e3c;
  line-height: 1.4;
}

.ppt-item-actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.ppt-empty {
  padding: 16px 12px;
  color: #888;
  font-style: italic;
  font-size: 12px;
}

/* Shared button style inside toolbar */
.ppt-toolbar button {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid #d8dde6;
  background: #fff;
  cursor: pointer;
  color: #1a1a2e;
}

.ppt-toolbar button:hover { background: #f4f6f9; }
.ppt-toolbar button:disabled { opacity: 0.5; cursor: default; }
.ppt-copy-all { background: #0070d2 !important; color: #fff !important; border-color: #0070d2 !important; }
.ppt-copy-all:hover { background: #005fb2 !important; }

/* === Popup === */
.ppt-popup {
  position: fixed;
  width: 320px;
  background: #fff;
  border: 1px solid #d8dde6;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  padding: 12px;
}

.ppt-popup-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px;
  border: 1px solid #d8dde6;
  border-radius: 4px;
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
}

.ppt-popup-textarea:focus {
  outline: none;
  border-color: #0070d2;
}

.ppt-popup-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}

.ppt-popup-cancel {
  padding: 6px 14px;
  border: 1px solid #d8dde6;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}

.ppt-popup-submit {
  padding: 6px 14px;
  border: none;
  border-radius: 4px;
  background: #0070d2;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.ppt-popup-submit:hover { background: #005fb2; }
```

- [ ] **Step 2: Run full build to verify CSS is bundled correctly**

```bash
npm run build
```

Expected: `dist/content.css` exists and is non-empty.

- [ ] **Step 3: Commit**

```bash
git add src/content/content.css
git commit -m "feat: content styles — overlay highlight, toolbar, popup"
```

---

## Task 14: Integration Test

**Files:**
- Create: `tests/integration/pipeline.test.js`

- [ ] **Step 1: Write integration test at `tests/integration/pipeline.test.js`**

```js
import { getElementPath, identifyElement, getNearbyText } from '../../src/utils/domInspector.js'
import { annotationsToMarkdown } from '../../src/utils/markdown.js'

describe('click → path → markdown pipeline', () => {
  describe('flat DOM', () => {
    it('produces correct markdown for a clicked button', () => {
      const app = document.createElement('div')
      app.id = 'app'
      const btn = document.createElement('button')
      btn.className = 'save-btn primary'
      btn.textContent = 'Save Changes'
      app.appendChild(btn)
      document.body.appendChild(app)

      const { name, path } = identifyElement(btn)
      const nearbyText = getNearbyText(btn)

      const annotation = {
        id: '1',
        selector: name,
        path,
        classes: ['save-btn', 'primary'],
        context: nearbyText,
        feedback: 'Change to secondary style',
        status: 'active',
      }

      const md = annotationsToMarkdown([annotation], 'http://localhost:3000/')

      expect(md).toContain('button.save-btn')
      expect(md).toContain('div#app > button.save-btn')
      expect(md).toContain('Save Changes')
      expect(md).toContain('Change to secondary style')

      app.remove()
    })
  })

  describe('shadow DOM', () => {
    it('crosses shadow boundary in the generated path', () => {
      const host = document.createElement('c-my-app')
      document.body.appendChild(host)
      const shadow = host.attachShadow({ mode: 'open' })

      const inner = document.createElement('div')
      inner.id = 'content'
      const btn = document.createElement('button')
      btn.className = 'submit-btn'
      inner.appendChild(btn)
      shadow.appendChild(inner)

      const path = getElementPath(btn)
      expect(path).toContain('c-my-app')
      expect(path).toContain('div#content')
      expect(path).toContain('button.submit-btn')

      host.remove()
    })
  })

  describe('modal / top-layer scenario', () => {
    it('generates path for an element inside a <dialog>', () => {
      const dialog = document.createElement('dialog')
      const btn = document.createElement('button')
      btn.className = 'confirm-btn'
      btn.textContent = 'Confirm'
      dialog.appendChild(btn)
      document.body.appendChild(dialog)
      dialog.showModal()

      const path = getElementPath(btn)
      expect(path).toContain('button.confirm-btn')

      dialog.close()
      dialog.remove()
    })
  })
})
```

- [ ] **Step 2: Run integration tests**

```bash
npm test tests/integration/pipeline.test.js
```

Expected: All 3 scenarios pass.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: All tests across utils, content, and integration pass.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/pipeline.test.js
git commit -m "test: integration — click→path→markdown pipeline with shadow DOM and modal"
```

---

## Task 15: Load in Chrome + Final Build Verification

- [ ] **Step 1: Run final build**

```bash
npm run build
```

Expected: `dist/` contains: `content.js`, `content.css`, `background.js`, `settings.html`, `settings.js`, `settings.css`, `manifest.json`, `icons/`.

- [ ] **Step 2: Load extension in Chrome**

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

Expected: "Pinpoint" appears in the extensions list with no errors.

- [ ] **Step 3: Smoke test**

1. Open any webpage (e.g., `https://example.com`)
2. Click the Pinpoint icon in the Chrome toolbar — badge shows "ON"
3. Hover over elements — blue highlight rect appears
4. Click an element — popup appears
5. Type feedback and click "Add" — annotation appears in toolbar
6. Click "Copy All" — markdown is copied to clipboard (verify by pasting)
7. Click Resolve on an annotation — it moves to the Resolved tab
8. Reload the page — annotations are restored from storage

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final build verification — Pinpoint v0.1.0 ready for load unpacked"
```

---

## Full Test Run Reference

```bash
npm test
```

Expected output (all passing):
```
✓ tests/utils/storage.test.js (6)
✓ tests/utils/domInspector.test.js (9)
✓ tests/utils/markdown.test.js (8)
✓ tests/content/Overlay.test.js (5)
✓ tests/content/Popup.test.js (6)
✓ tests/content/Toolbar.test.js (7)
✓ tests/content/index.test.js (6)
✓ tests/background/service-worker.test.js (7)
✓ tests/settings/settings.test.js (4)
✓ tests/integration/pipeline.test.js (3)
```
