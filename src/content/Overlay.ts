import { PPT_PREFIX, EVENTS } from './constants'
import { identifyElement, getElementClasses, getNearbyText } from '../utils/domInspector'
import type { ElementClickDetail } from '../types'

function isAnnotatorElement(el: Element | null): boolean {
  let current: Element | null = el
  while (current) {
    const className = (current as HTMLElement | SVGElement).className
    if (typeof className === 'string' && className.includes(PPT_PREFIX)) return true
    const root = current.getRootNode()
    current = current.parentElement || (root instanceof ShadowRoot ? root.host : null)
  }
  return false
}

export class Overlay {
  #dialog: HTMLDialogElement | null = null
  #highlight: HTMLDivElement | null = null
  #onMouseOver: ((e: MouseEvent) => void) | null = null
  #onClick: ((e: MouseEvent) => void) | null = null
  #onKeyDown: ((e: KeyboardEvent) => void) | null = null

  mount() {
    this.#dialog = document.createElement('dialog')
    this.#dialog.className = `${PPT_PREFIX}overlay`

    this.#highlight = document.createElement('div')
    this.#highlight.className = `${PPT_PREFIX}highlight`
    this.#dialog.appendChild(this.#highlight)

    document.body.appendChild(this.#dialog)
    if (typeof this.#dialog.showModal === 'function') {
      this.#dialog.showModal()
    }

    this.#onMouseOver = (e) => this.#handleMouseOver(e)
    this.#onClick = (e) => this.#handleClick(e)
    this.#onKeyDown = (e) => {
      if (e.key === 'Escape') this.#hideHighlight()
    }

    document.addEventListener('mouseover', this.#onMouseOver, true)
    document.addEventListener('click', this.#onClick, true)
    document.addEventListener('keydown', this.#onKeyDown)
  }

  unmount() {
    if (!this.#dialog) return
    if (this.#onMouseOver) document.removeEventListener('mouseover', this.#onMouseOver, true)
    if (this.#onClick) document.removeEventListener('click', this.#onClick, true)
    if (this.#onKeyDown) document.removeEventListener('keydown', this.#onKeyDown)
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
  _simulateClick(target: Element): void {
    this.#dispatchElementClick(target)
  }

  #handleMouseOver(e: MouseEvent): void {
    const path = e.composedPath()
    const target = path.find((el): el is Element => el instanceof Element && !isAnnotatorElement(el))
    if (!target || target === document.body || target === document.documentElement) {
      this.#hideHighlight()
      return
    }
    if (!this.#highlight) return
    const rect = target.getBoundingClientRect()
    this.#highlight.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;display:block`
  }

  #handleClick(e: MouseEvent): void {
    const path = e.composedPath()
    if (path.some((el) => el instanceof Element && isAnnotatorElement(el))) return
    const target = path.find((el): el is Element => el instanceof Element && !isAnnotatorElement(el))
    if (!target || target === document.body || target === document.documentElement) return
    e.preventDefault()
    e.stopPropagation()
    this.#dispatchElementClick(target)
  }

  #dispatchElementClick(target: Element): void {
    if (isAnnotatorElement(target)) return
    const rect = target.getBoundingClientRect()
    const { name, path } = identifyElement(target)
    const classes = getElementClasses(target).split(' ').filter(Boolean)
    const context = getNearbyText(target)
    const detail: ElementClickDetail = {
      element: target,
      rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      selector: name,
      path,
      classes,
      context,
    }
    document.dispatchEvent(new CustomEvent<ElementClickDetail>(EVENTS.ELEMENT_CLICK, {
      bubbles: true,
      composed: true,
      detail,
    }))
  }

  #hideHighlight(): void {
    if (this.#highlight) this.#highlight.style.display = 'none'
  }
}
