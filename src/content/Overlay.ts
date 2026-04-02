import { PPT_PREFIX, EVENTS } from './constants'
import { identifyElement, getAnnotationSurface, getElementClasses, getNearbyText } from '../utils/domInspector'
import type { AnnotationMarker, AnnotationRect, ElementClickDetail } from '../types'

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
  #markersLayer: HTMLDivElement | null = null
  #selectionEnabled = false
  #frozen = false
  #lockedRect: AnnotationRect | null = null
  #activeMarkers: AnnotationMarker[] = []
  #onMouseOver: ((e: MouseEvent) => void) | null = null
  #onClick: ((e: MouseEvent) => void) | null = null
  #onKeyDown: ((e: KeyboardEvent) => void) | null = null
  #onViewportChange: (() => void) | null = null

  mount() {
    this.#root = document.createElement('div')
    this.#root.className = `${PPT_PREFIX}overlay`

    this.#highlight = document.createElement('div')
    this.#highlight.className = `${PPT_PREFIX}highlight`
    this.#root.appendChild(this.#highlight)

    this.#markersLayer = document.createElement('div')
    this.#markersLayer.className = `${PPT_PREFIX}markers`
    this.#root.appendChild(this.#markersLayer)

    document.body.appendChild(this.#root)
    this.#applyInteractivity()

    this.#onMouseOver = (e) => this.#handleMouseOver(e)
    this.#onClick = (e) => this.#handleClick(e)
    this.#onKeyDown = (e) => {
      if (e.key === 'Escape') this.#hideHighlight()
    }
    this.#onViewportChange = () => {
      if (this.#lockedRect) this.#showHighlight(this.#lockedRect)
      this.#renderMarkers()
    }

    document.addEventListener('mouseover', this.#onMouseOver, true)
    document.addEventListener('click', this.#onClick, true)
    document.addEventListener('keydown', this.#onKeyDown)
    window.addEventListener('scroll', this.#onViewportChange, true)
    window.addEventListener('resize', this.#onViewportChange)
  }

  unmount() {
    if (!this.#root) return
    if (this.#onMouseOver) document.removeEventListener('mouseover', this.#onMouseOver, true)
    if (this.#onClick) document.removeEventListener('click', this.#onClick, true)
    if (this.#onKeyDown) document.removeEventListener('keydown', this.#onKeyDown)
    if (this.#onViewportChange) {
      window.removeEventListener('scroll', this.#onViewportChange, true)
      window.removeEventListener('resize', this.#onViewportChange)
    }
    document.documentElement.style.cursor = ''
    document.body.style.cursor = ''
    this.#root.remove()
    this.#root = null
    this.#highlight = null
    this.#markersLayer = null
    this.#lockedRect = null
    this.#activeMarkers = []
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
    this.#lockedRect = null
    this.#applyInteractivity()
  }

  setLockedHighlight(rect: AnnotationRect | null): void {
    this.#lockedRect = rect
    if (rect) {
      this.#showHighlight(rect)
      return
    }
    if (this.#selectionEnabled && !this.#frozen) return
    this.#hideHighlight()
  }

  setAnnotationMarkers(markers: AnnotationMarker[]): void {
    this.#activeMarkers = markers
    this.#renderMarkers()
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
    this.#showHighlight({ x: rect.left, y: rect.top, width: rect.width, height: rect.height })
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

  #showHighlight(rect: AnnotationRect): void {
    if (!this.#highlight) return
    this.#highlight.style.cssText = `position:fixed;top:${rect.y}px;left:${rect.x}px;width:${rect.width}px;height:${rect.height}px;display:block`
  }

  #renderMarkers(): void {
    if (!this.#markersLayer) return
    const markerMarkup = this.#activeMarkers
      .filter(marker => marker.surface?.kind !== 'dialog')
      .map((marker) => {
        const top = Math.max(10, Math.min(window.innerHeight - 42, marker.rect.y + marker.rect.height - 18))
        const left = Math.max(10, Math.min(window.innerWidth - 42, marker.rect.x + marker.rect.width - 18))
        return `<button class="${PPT_PREFIX}marker" type="button" style="top:${top}px;left:${left}px" aria-label="Pinpoint note ${marker.number}" title="Pinpoint note ${marker.number}">${marker.number}</button>`
      })
      .join('')
    this.#markersLayer.innerHTML = markerMarkup
  }

  #applyInteractivity(): void {
    if (!this.#root) return
    const canInteract = this.#selectionEnabled && !this.#frozen
    this.#root.style.pointerEvents = canInteract ? '' : 'none'
    document.documentElement.style.cursor = canInteract ? 'crosshair' : ''
    document.body.style.cursor = canInteract ? 'crosshair' : ''
  }
}
