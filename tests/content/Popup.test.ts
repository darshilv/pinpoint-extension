// @ts-nocheck
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
