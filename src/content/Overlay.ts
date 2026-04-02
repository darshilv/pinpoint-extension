import { PPT_PREFIX, EVENTS } from './constants'
import { identifyElement, getAnnotationSurface, getElementClasses, getNearbyText } from '../utils/domInspector'
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
  #root: HTMLDivElement | null = null
  #highlight: HTMLDivElement | null = null
  #selectionEnabled = false
  #frozen = false
  #onMouseOver: ((e: MouseEvent) => void) | null = null
  #onClick: ((e: MouseEvent) => void) | null = null
  #onKeyDown: ((e: KeyboardEvent) => void) | null = null

  mount() {
    this.#root = document.createElement('div')
    this.#root.className = `${PPT_PREFIX}overlay`

    this.#highlight = document.createElement('div')
    this.#highlight.className = `${PPT_PREFIX}highlight`
    this.#root.appendChild(this.#highlight)

    document.body.appendChild(this.#root)
    this.#applyInteractivity()

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
    if (!this.#root) return
    if (this.#onMouseOver) document.removeEventListener('mouseover', this.#onMouseOver, true)
    if (this.#onClick) document.removeEventListener('click', this.#onClick, true)
    if (this.#onKeyDown) document.removeEventListener('keydown', this.#onKeyDown)
    document.documentElement.style.cursor = ''
    document.body.style.cursor = ''
    this.#root.remove()
    this.#root = null
    this.#highlight = null
  }

  setSelectionEnabled(enabled: boolean) {
    this.#selectionEnabled = enabled
    this.#frozen = false
    this.#applyInteractivity()
    if (!enabled) this.#hideHighlight()
  }

  freeze() {
    this.#frozen = true
    this.#applyInteractivity()
  }

  unfreeze() {
    this.#frozen = false
    this.#applyInteractivity()
  }

  // Test seam: allows tests to simulate a click on a specific element
  _simulateClick(target: Element): void {
    this.#dispatchElementClick(target)
  }

  #handleMouseOver(e: MouseEvent): void {
    if (!this.#selectionEnabled || this.#frozen) {
      this.#hideHighlight()
      return
    }
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
    if (!this.#selectionEnabled || this.#frozen) return
    const path = e.composedPath()
    if (path.some((el) => el instanceof Element && isAnnotatorElement(el))) return
    const target = path.find((el): el is Element => el instanceof Element && !isAnnotatorElement(el))
    if (!target || target === document.body || target === document.documentElement) return
    e.preventDefault()
    e.stopPropagation()
    this.#dispatchElementClick(target)
  }

  #dispatchElementClick(target: Element): void {
    if (!this.#selectionEnabled || this.#frozen) return
    if (isAnnotatorElement(target)) return
    const rect = target.getBoundingClientRect()
    const { name, path } = identifyElement(target)
    const classes = getElementClasses(target).split(' ').filter(Boolean)
    const context = getNearbyText(target)
    const surface = getAnnotationSurface(target)
    const detail: ElementClickDetail = {
      element: target,
      rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      selector: name,
      path,
      classes,
      context,
      surface,
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

  #applyInteractivity(): void {
    if (!this.#root) return
    const canInteract = this.#selectionEnabled && !this.#frozen
    this.#root.style.pointerEvents = canInteract ? '' : 'none'
    document.documentElement.style.cursor = canInteract ? 'crosshair' : ''
    document.body.style.cursor = canInteract ? 'crosshair' : ''
  }
}
