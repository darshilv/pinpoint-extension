// @ts-nocheck
import { Toolbar } from '../../src/content/Toolbar'
import { PPT_PREFIX } from '../../src/constants'

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

  it('starts in a collapsed state', () => {
    expect(document.querySelector(`.${PPT_PREFIX}toolbar-collapsed`)).not.toBeNull()
    expect(document.querySelector(`.${PPT_PREFIX}toolbar-header`)).toBeNull()
  })

  it('restores persisted annotations from storage on mount', async () => {
    const saved = [makeAnnotation()]
    await chrome.storage.local.set({ 'pinpoint:/': saved })

    const t2 = new Toolbar()
    await t2.mount()
    document.querySelectorAll(`.${PPT_PREFIX}toolbar .${PPT_PREFIX}toolbar-collapsed`)[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
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
      expect(document.querySelector(`.${PPT_PREFIX}toolbar-header`)).not.toBeNull()
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
    it('hides resolved annotation from the main list and shows a history action', async () => {
      const annotation = makeAnnotation()
      await toolbar.addAnnotation(annotation)
      await toolbar.resolve(annotation.id)

      expect(document.querySelectorAll(`.${PPT_PREFIX}annotation-item`).length).toBe(0)
      expect(document.querySelector(`.${PPT_PREFIX}history-toggle`)?.textContent).toContain('View history')
    })

    it('reveals resolved history on demand', async () => {
      const annotation = makeAnnotation()
      await toolbar.addAnnotation(annotation)
      await toolbar.resolve(annotation.id)

      document.querySelector(`.${PPT_PREFIX}history-toggle`).click()

      const sections = Array.from(document.querySelectorAll(`.${PPT_PREFIX}section-title`)).map(el => el.textContent)
      expect(sections).toContain('Resolved history')
      expect(document.querySelectorAll(`.${PPT_PREFIX}annotation-item`).length).toBe(1)
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

  describe('collapse toggle', () => {
    it('expands when the collapsed launcher is clicked', () => {
      document.querySelector(`.${PPT_PREFIX}toolbar-collapsed`)?.click()
      expect(document.querySelector(`.${PPT_PREFIX}toolbar-header`)).not.toBeNull()
    })
  })
})
