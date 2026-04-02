import { PPT_PREFIX, EVENTS } from '../constants'
import type { AnnotationRect } from '../types'

export class Popup {
  #el: HTMLDivElement | null = null
  #existing: { id: string; feedback: string } | null = null
  #onKeyDown: ((e: KeyboardEvent) => void) | null = null

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

    this.#el.querySelector<HTMLFormElement>(`.${PPT_PREFIX}popup-form`)!.addEventListener('submit', (e) => {
      e.preventDefault()
      const feedback = this.#el!.querySelector<HTMLTextAreaElement>(`.${PPT_PREFIX}popup-textarea`)!.value.trim()
      if (!feedback) return
      document.dispatchEvent(new CustomEvent(EVENTS.ANNOTATION_ADD, {
        bubbles: true,
        composed: true,
        detail: { feedback, existingId: this.#existing?.id ?? null },
      }))
      this.hide()
    })

    this.#el.querySelector<HTMLButtonElement>(`.${PPT_PREFIX}popup-cancel`)!.addEventListener('click', () => this.hide())

    this.#onKeyDown = (e) => {
      if (e.key === 'Escape' && this.#el?.style.display !== 'none') this.hide()
      if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) && this.#el?.style.display !== 'none') {
        this.#el?.querySelector<HTMLFormElement>(`.${PPT_PREFIX}popup-form`)?.dispatchEvent(new Event('submit'))
      }
    }
    document.addEventListener('keydown', this.#onKeyDown)
  }

  show(rect: AnnotationRect, existing: { id: string; feedback: string } | null) {
    this.#existing = existing
    const textarea = this.#el!.querySelector<HTMLTextAreaElement>(`.${PPT_PREFIX}popup-textarea`)!
    const submitBtn = this.#el!.querySelector<HTMLButtonElement>(`.${PPT_PREFIX}popup-submit`)!

    textarea.value = existing?.feedback ?? ''
    submitBtn.textContent = existing ? 'Update' : 'Add'

    const top = Math.min(rect.y + rect.height + 8, window.innerHeight - 220)
    const left = Math.min(rect.x, window.innerWidth - 340)
    this.#el!.style.cssText = `display:block;position:fixed;top:${top}px;left:${left}px`

    textarea.focus()
  }

  hide() {
    if (!this.#el) return
    this.#el.style.display = 'none'
    this.#existing = null
  }

  unmount() {
    if (this.#onKeyDown) document.removeEventListener('keydown', this.#onKeyDown)
    this.#el?.remove()
    this.#el = null
  }
}
