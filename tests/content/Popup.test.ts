// @ts-nocheck
import { vi } from 'vitest'
import { Popup } from '../../src/content/Popup'
import { EVENTS, PPT_PREFIX } from '../../src/constants'

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
      popup.show(
        { x: 100, y: 200, width: 50, height: 30 },
        null,
        { noteNumber: 1, selectorPath: 'section.hero > h1' },
      )
      const el = document.querySelector(`.${PPT_PREFIX}popup`)
      expect(el.style.display).not.toBe('none')
    })

    it('shows "Add" label when no existing annotation', () => {
      popup.show(
        { x: 0, y: 0, width: 0, height: 0 },
        null,
        { noteNumber: 1, selectorPath: 'section.hero > h1' },
      )
      const btn = document.querySelector(`.${PPT_PREFIX}popup-submit`)
      expect(btn.textContent).toBe('Add')
    })

    it('shows "Update" label and prefills text for existing annotation', () => {
      popup.show(
        { x: 0, y: 0, width: 0, height: 0 },
        { id: '1', feedback: 'Old feedback' },
        { noteNumber: 2, selectorPath: 'main > dialog.modal > button.primary' },
      )
      const btn = document.querySelector(`.${PPT_PREFIX}popup-submit`)
      const textarea = document.querySelector(`.${PPT_PREFIX}popup-textarea`)
      const helper = document.querySelector(`.${PPT_PREFIX}popup-helper`)
      expect(btn.textContent).toBe('Update')
      expect(textarea.value).toBe('Old feedback')
      expect(document.querySelector(`.${PPT_PREFIX}popup-title`)).toBeNull()
      expect(helper.textContent).toBe('main > dialog.modal > button.primary')
    })

    it('keeps the popup inside the viewport when near the bottom edge', () => {
      Object.defineProperty(window, 'innerWidth', { value: 640, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: 480, configurable: true })
      const el = document.querySelector(`.${PPT_PREFIX}popup`)
      el.getBoundingClientRect = vi.fn(() => ({ width: 360, height: 220 }))

      popup.show(
        { x: 540, y: 430, width: 80, height: 24 },
        null,
        { noteNumber: 3, selectorPath: 'section.hero > h1' },
      )

      expect(el.style.top).toBe('198px')
      expect(el.style.left).toBe('268px')
    })
  })

  describe('hide', () => {
    it('hides the popup', () => {
      popup.show(
        { x: 0, y: 0, width: 0, height: 0 },
        null,
        { noteNumber: 1, selectorPath: 'section.hero > h1' },
      )
      popup.hide()
      const el = document.querySelector(`.${PPT_PREFIX}popup`)
      expect(el.style.display).toBe('none')
    })
  })

  describe('annotationadd event', () => {
    it('dispatches pinpoint:annotationadd with comment on submit', () => {
      popup.show(
        { x: 0, y: 0, width: 0, height: 0 },
        null,
        { noteNumber: 1, selectorPath: 'section.hero > h1' },
      )

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
      popup.show(
        { x: 0, y: 0, width: 0, height: 0 },
        null,
        { noteNumber: 1, selectorPath: 'section.hero > h1' },
      )

      let received = null
      document.addEventListener(EVENTS.ANNOTATION_ADD, (e) => { received = e }, { once: true })

      const form = document.querySelector(`.${PPT_PREFIX}popup-form`)
      form.dispatchEvent(new Event('submit'))

      expect(received).toBeNull()
    })

    it('includes existing annotation id on update', () => {
      const existing = { id: 'abc', feedback: 'Old' }
      popup.show(
        { x: 0, y: 0, width: 0, height: 0 },
        existing,
        { noteNumber: 1, selectorPath: 'section.hero > h1' },
      )

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
      popup.show(
        { x: 0, y: 0, width: 0, height: 0 },
        null,
        { noteNumber: 1, selectorPath: 'section.hero > h1' },
      )
      document.querySelector(`.${PPT_PREFIX}popup-cancel`).click()
      const el = document.querySelector(`.${PPT_PREFIX}popup`)
      expect(el.style.display).toBe('none')
    })

    it('dispatches cancel event when popup is dismissed', () => {
      popup.show(
        { x: 0, y: 0, width: 0, height: 0 },
        null,
        { noteNumber: 1, selectorPath: 'section.hero > h1' },
      )

      let received = null
      document.addEventListener(EVENTS.ANNOTATION_CANCEL, (e) => { received = e }, { once: true })

      document.querySelector(`.${PPT_PREFIX}popup-cancel`).click()

      expect(received).not.toBeNull()
    })
  })
})
