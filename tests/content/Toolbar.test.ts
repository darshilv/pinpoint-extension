// @ts-nocheck
import { Toolbar } from '../../src/content/Toolbar'
import { EVENTS, PPT_PREFIX } from '../../src/constants'

const makeAnnotation = (overrides = {}) => ({
  id: crypto.randomUUID(),
  selector: 'button.primary',
  path: 'div > button.primary',
  classes: ['primary'],
  context: 'Save',
  surface: { kind: 'page', label: 'Page' },
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

  it('starts with only the anchor button visible', () => {
    expect(document.querySelector(`.${PPT_PREFIX}anchor-button`)).not.toBeNull()
    expect(document.querySelector(`.${PPT_PREFIX}anchor-actions`)).toBeNull()
    expect(document.querySelector(`.${PPT_PREFIX}review-panel`)).toBeNull()
  })

  it('restores persisted annotations from storage on mount', async () => {
    const saved = [makeAnnotation()]
    await chrome.storage.local.set({ 'pinpoint:/': saved })

    const t2 = new Toolbar()
    await t2.mount()
    t2.setMode('active-review')

    const list = document.querySelectorAll(`.${PPT_PREFIX}review-panel .${PPT_PREFIX}annotation-item`)
    expect(list.length).toBeGreaterThan(0)
    t2.unmount()
  })

  describe('mode rendering', () => {
    it('shows quick actions in active-select mode', () => {
      toolbar.setMode('active-select')

      expect(document.querySelector(`.${PPT_PREFIX}anchor-actions`)).not.toBeNull()
      expect(document.querySelectorAll(`.${PPT_PREFIX}anchor-action--icon`).length).toBe(2)
      expect(document.querySelector(`.${PPT_PREFIX}review-panel`)).toBeNull()
    })

    it('shows the side review panel in active-review mode', async () => {
      await toolbar.addAnnotation(makeAnnotation())
      toolbar.setMode('active-review')

      expect(document.querySelector(`.${PPT_PREFIX}review-panel`)).not.toBeNull()
      expect(document.querySelector(`.${PPT_PREFIX}toolbar-title`)?.textContent).toBe('Pinpoint')
      expect(document.querySelector(`.${PPT_PREFIX}section-title`)?.textContent).toBe('Active')
    })
  })

  describe('events', () => {
    it('requests active-select mode when the anchor is clicked', () => {
      let received = null
      document.addEventListener(EVENTS.MODE_CHANGE, (e) => { received = e }, { once: true })

      document.querySelector(`.${PPT_PREFIX}anchor-button`)?.click()

      expect(received?.detail.mode).toBe('active-select')
    })

    it('requests review mode from the review action', () => {
      toolbar.setMode('active-select')
      let received = null
      document.addEventListener(EVENTS.OPEN_REVIEW, (e) => { received = e }, { once: true })

      document.querySelectorAll(`.${PPT_PREFIX}anchor-action`)[1]?.click()

      expect(received).not.toBeNull()
    })
  })

  describe('annotation actions', () => {
    it('shows the captured surface label on the annotation card', async () => {
      await toolbar.addAnnotation(makeAnnotation({ surface: { kind: 'dialog', label: 'Dialog: Invite people' } }))
      toolbar.setMode('active-review')

      expect(document.querySelector(`.${PPT_PREFIX}item-surface`)?.textContent).toContain('Dialog: Invite people')
    })

    it('shows the active note number on the annotation card', async () => {
      await toolbar.addAnnotation(makeAnnotation({ id: 'note-1' }))
      await toolbar.addAnnotation(makeAnnotation({ id: 'note-2', selector: 'input.email' }))
      toolbar.setMode('active-review')

      const noteNumbers = Array.from(document.querySelectorAll(`.${PPT_PREFIX}item-note-number`)).map(el => el.textContent)
      expect(noteNumbers).toEqual(['Note 1', 'Note 2'])
    })

    it('updates comment on existing annotation', async () => {
      const annotation = makeAnnotation({ feedback: 'Old' })
      await toolbar.addAnnotation(annotation)
      await toolbar.updateAnnotation(annotation.id, 'New comment')
      toolbar.setMode('active-review')

      const items = document.querySelectorAll(`.${PPT_PREFIX}annotation-item`)
      expect(items[0].textContent).toContain('New comment')
    })

    it('reveals resolved history on demand', async () => {
      const annotation = makeAnnotation()
      await toolbar.addAnnotation(annotation)
      await toolbar.resolve(annotation.id)
      toolbar.setMode('active-review')

      document.querySelector(`.${PPT_PREFIX}history-toggle`)?.click()

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

  describe('theme toggle', () => {
    it('toggles the theme from the active anchor controls', async () => {
      toolbar.setMode('active-select')
      const setSpy = chrome.storage.local.set

      document.querySelector(`.${PPT_PREFIX}theme-toggle`)?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()

      expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ 'pinpoint:theme': 'light' }))
      expect(document.querySelector(`.${PPT_PREFIX}toolbar`)?.className).toContain(`${PPT_PREFIX}theme-light`)
    })
  })

  describe('keyboard shortcuts', () => {
    it('closes review mode when h is pressed', async () => {
      await toolbar.addAnnotation(makeAnnotation())
      toolbar.setMode('active-review')

      let received = null
      document.addEventListener(EVENTS.MODE_CHANGE, (e) => { received = e }, { once: true })

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }))

      expect(received?.detail.mode).toBe('active-select')
    })

    it('clears active annotations when d is pressed', async () => {
      await toolbar.addAnnotation(makeAnnotation())
      toolbar.setMode('active-review')
      const clearButton = document.querySelector(`.${PPT_PREFIX}clear-active`)
      const clickSpy = vi.spyOn(clearButton, 'click')

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }))

      expect(clickSpy).toHaveBeenCalled()
    })

    it('copies active annotations when c is pressed', async () => {
      const writeMock = vi.fn(async () => {})
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: writeMock }, configurable: true })
      await toolbar.addAnnotation(makeAnnotation({ feedback: 'Use shortcut copy' }))
      toolbar.setMode('active-review')

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }))
      await Promise.resolve()

      expect(writeMock).toHaveBeenCalledWith(expect.stringContaining('Use shortcut copy'))
    })
  })
})
