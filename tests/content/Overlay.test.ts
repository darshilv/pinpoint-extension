// @ts-nocheck
import { Overlay } from '../../src/content/Overlay'
import { EVENTS, PPT_PREFIX } from '../../src/constants'

describe('Overlay', () => {
  let overlay

  beforeEach(() => {
    overlay = new Overlay()
  })

  afterEach(() => {
    overlay.unmount()
  })

  describe('mount / unmount', () => {
    it('injects an overlay element into the document', () => {
      overlay.mount()
      const root = document.querySelector(`div.${PPT_PREFIX}overlay`)
      expect(root).not.toBeNull()
    })

    it('removes the dialog on unmount', () => {
      overlay.mount()
      overlay.unmount()
      const root = document.querySelector(`div.${PPT_PREFIX}overlay`)
      expect(root).toBeNull()
    })

    it('is safe to call unmount before mount', () => {
      expect(() => overlay.unmount()).not.toThrow()
    })

    it('does not set a crosshair cursor until selection mode is enabled', () => {
      overlay.mount()
      expect(document.documentElement.style.cursor).toBe('')
      expect(document.body.style.cursor).toBe('')
    })

    it('sets a crosshair cursor while selection mode is active', () => {
      overlay.mount()
      overlay.setSelectionEnabled(true)
      expect(document.documentElement.style.cursor).toBe('crosshair')
      expect(document.body.style.cursor).toBe('crosshair')
    })

    it('clears the crosshair cursor on unmount', () => {
      overlay.mount()
      overlay.unmount()
      expect(document.documentElement.style.cursor).toBe('')
      expect(document.body.style.cursor).toBe('')
    })
  })

  describe('freeze / unfreeze', () => {
    it('sets pointer-events:none on freeze', () => {
      overlay.mount()
      overlay.setSelectionEnabled(true)
      overlay.freeze()
      const root = document.querySelector(`div.${PPT_PREFIX}overlay`)
      expect(root.style.pointerEvents).toBe('none')
    })

    it('clears pointer-events on unfreeze', () => {
      overlay.mount()
      overlay.setSelectionEnabled(true)
      overlay.freeze()
      overlay.unfreeze()
      const root = document.querySelector(`div.${PPT_PREFIX}overlay`)
      expect(root.style.pointerEvents).toBe('')
    })
  })

  describe('elementclick event', () => {
    it('dispatches pinpoint:elementclick when a non-annotator element is clicked', () => {
      overlay.mount()
      overlay.setSelectionEnabled(true)

      const target = document.createElement('button')
      target.className = 'my-btn'
      document.body.appendChild(target)

      let received = null
      document.addEventListener(EVENTS.ELEMENT_CLICK, (e) => {
        received = e
      }, { once: true })

      overlay._simulateClick(target)

      expect(received).not.toBeNull()
      expect(received.detail.element).toBe(target)
      expect(received.detail.surface).toEqual({ kind: 'page', label: 'Page' })
      target.remove()
    })

    it('describes dialog context when the clicked element is inside a dialog', () => {
      overlay.mount()
      overlay.setSelectionEnabled(true)

      const dialog = document.createElement('dialog')
      const title = document.createElement('h2')
      title.textContent = 'Edit profile'
      const target = document.createElement('button')
      dialog.append(title, target)
      document.body.appendChild(dialog)

      let received = null
      document.addEventListener(EVENTS.ELEMENT_CLICK, (e) => {
        received = e
      }, { once: true })

      overlay._simulateClick(target)

      expect(received.detail.surface).toEqual({ kind: 'dialog', label: 'Dialog: Edit profile' })
      dialog.remove()
    })

    it('does not dispatch elementclick for annotator-owned elements', () => {
      overlay.mount()
      overlay.setSelectionEnabled(true)

      const target = document.createElement('div')
      target.className = `${PPT_PREFIX}toolbar`
      document.body.appendChild(target)

      let received = null
      document.addEventListener(EVENTS.ELEMENT_CLICK, (e) => {
        received = e
      }, { once: true })

      overlay._simulateClick(target)

      expect(received).toBeNull()
      target.remove()
    })

    it('does not dispatch elementclick when selection mode is inactive', () => {
      overlay.mount()

      const target = document.createElement('button')
      document.body.appendChild(target)

      let received = null
      document.addEventListener(EVENTS.ELEMENT_CLICK, (e) => {
        received = e
      }, { once: true })

      overlay._simulateClick(target)

      expect(received).toBeNull()
      target.remove()
    })
  })
})
