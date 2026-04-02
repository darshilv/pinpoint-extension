import { PPT_PREFIX } from './constants'
import { getAnnotations, saveAnnotations } from '../utils/storage'
import { annotationsToMarkdown, annotationToMarkdown } from '../utils/markdown'
import type { Annotation } from '../types'

export class Toolbar {
  #el: HTMLDivElement | null = null
  #annotations: Annotation[] = []
  #tab: 'active' | 'resolved' = 'active'

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

  getAnnotationByPath(elementPath: string): Annotation | null {
    return this.#annotations.find(
      a => a.status === 'active' && a.path === elementPath
    ) ?? null
  }

  async addAnnotation(annotation: Annotation): Promise<void> {
    this.#annotations = [...this.#annotations, annotation]
    await saveAnnotations(window.location.pathname, this.#annotations)
    this.#render()
  }

  async updateAnnotation(id: string, comment: string): Promise<void> {
    this.#annotations = this.#annotations.map(a =>
      a.id === id ? { ...a, feedback: comment, createdAt: Date.now() } : a
    )
    await saveAnnotations(window.location.pathname, this.#annotations)
    this.#render()
  }

  async resolve(id: string): Promise<void> {
    this.#annotations = this.#annotations.map(a =>
      a.id === id ? { ...a, status: 'resolved' } : a
    )
    await saveAnnotations(window.location.pathname, this.#annotations)
    this.#render()
  }

  setTab(tab: 'active' | 'resolved'): void {
    this.#tab = tab
    this.#render()
  }

  async copyAll(): Promise<void> {
    const active = this.#annotations.filter(a => a.status === 'active')
    const md = annotationsToMarkdown(active, window.location.href)
    try {
      await navigator.clipboard.writeText(md)
    } catch {
      console.log('[pinpoint] Clipboard unavailable:\n\n' + md) // eslint-disable-line no-console
    }
  }

  async copyOne(id: string): Promise<void> {
    const annotation = this.#annotations.find(a => a.id === id)
    if (!annotation) return
    const md = annotationToMarkdown(annotation)
    try {
      await navigator.clipboard.writeText(md)
    } catch {
      console.log('[pinpoint] Clipboard unavailable:\n\n' + md) // eslint-disable-line no-console
    }
  }

  #activeAnnotations(): Annotation[] {
    return this.#annotations.filter(a => a.status === 'active')
  }

  #resolvedAnnotations(): Annotation[] {
    return this.#annotations.filter(a => a.status === 'resolved')
  }

  #render(): void {
    if (!this.#el) return
    const active = this.#activeAnnotations()
    const resolved = this.#resolvedAnnotations()
    const shown = this.#tab === 'active' ? active : resolved
    const total = this.#annotations.length
    const reviewLabel = active.length === 1 ? 'item to review' : 'items to review'
    const emptyTitle = this.#tab === 'active' ? 'Start collecting feedback' : 'Nothing resolved yet'
    const emptyBody = this.#tab === 'active'
      ? 'Click any element on the page to pin a note, and your active requests will stack up here.'
      : 'Resolved notes stay here as a lightweight audit trail once you mark them complete.'

    this.#el.innerHTML = `
      <div class="${PPT_PREFIX}toolbar-header">
        <div class="${PPT_PREFIX}toolbar-brand">
          <p class="${PPT_PREFIX}toolbar-eyebrow">Pinpoint</p>
          <h2 class="${PPT_PREFIX}toolbar-title">${active.length} ${reviewLabel}</h2>
        </div>
        <div class="${PPT_PREFIX}toolbar-header-actions">
          <button class="${PPT_PREFIX}clear-active" ${active.length === 0 ? 'disabled' : ''}>Clear</button>
          <button class="${PPT_PREFIX}copy-all" ${active.length === 0 ? 'disabled' : ''}>Copy prompt</button>
        </div>
      </div>
      <div class="${PPT_PREFIX}toolbar-summary">
        <div class="${PPT_PREFIX}summary-card">
          <span class="${PPT_PREFIX}summary-label">Active</span>
          <span class="${PPT_PREFIX}summary-value">${active.length}</span>
        </div>
        <div class="${PPT_PREFIX}summary-card">
          <span class="${PPT_PREFIX}summary-label">Resolved</span>
          <span class="${PPT_PREFIX}summary-value">${resolved.length}</span>
        </div>
        <div class="${PPT_PREFIX}summary-card">
          <span class="${PPT_PREFIX}summary-label">Total</span>
          <span class="${PPT_PREFIX}summary-value">${total}</span>
        </div>
      </div>
      <div class="${PPT_PREFIX}tabs">
        <button class="${PPT_PREFIX}tab ${this.#tab === 'active' ? `${PPT_PREFIX}tab--active` : ''}" data-tab="active">
          To tackle <span class="${PPT_PREFIX}tab-count">${active.length}</span>
        </button>
        <button class="${PPT_PREFIX}tab ${this.#tab === 'resolved' ? `${PPT_PREFIX}tab--active` : ''}" data-tab="resolved">
          Resolved <span class="${PPT_PREFIX}tab-count">${resolved.length}</span>
        </button>
      </div>
      <ul class="${PPT_PREFIX}list">
        ${shown.length === 0 ? `
          <li class="${PPT_PREFIX}empty">
            <div class="${PPT_PREFIX}empty-illustration"></div>
            <h3 class="${PPT_PREFIX}empty-title">${emptyTitle}</h3>
            <p class="${PPT_PREFIX}empty-body">${emptyBody}</p>
          </li>
        ` : ''}
        ${shown.map(a => `
          <li class="${PPT_PREFIX}annotation-item" data-id="${a.id}">
            <div class="${PPT_PREFIX}item-meta">
              <span class="${PPT_PREFIX}item-element">${a.selector}</span>
              <span class="${PPT_PREFIX}item-badge">${a.status === 'active' ? 'Open' : 'Done'}</span>
            </div>
            <span class="${PPT_PREFIX}item-comment">${a.feedback}</span>
            <span class="${PPT_PREFIX}item-context">${a.context || a.path}</span>
            <div class="${PPT_PREFIX}item-actions">
              <button class="${PPT_PREFIX}copy-one" data-id="${a.id}">Copy</button>
              ${a.status === 'active' ? `<button class="${PPT_PREFIX}resolve-one" data-id="${a.id}">Resolve</button>` : ''}
            </div>
          </li>
        `).join('')}
      </ul>
    `

    this.#el.querySelector<HTMLButtonElement>(`.${PPT_PREFIX}copy-all`)?.addEventListener('click', () => this.copyAll())
    this.#el.querySelector<HTMLButtonElement>(`.${PPT_PREFIX}clear-active`)?.addEventListener('click', () => this.#clearActive())
    this.#el.querySelectorAll<HTMLButtonElement>(`.${PPT_PREFIX}tab`).forEach((btn) => {
      btn.addEventListener('click', (e) => this.setTab((e.currentTarget as HTMLButtonElement).dataset.tab as 'active' | 'resolved'))
    })
    this.#el.querySelectorAll<HTMLButtonElement>(`.${PPT_PREFIX}copy-one`).forEach((btn) => {
      btn.addEventListener('click', (e) => this.copyOne((e.currentTarget as HTMLButtonElement).dataset.id!))
    })
    this.#el.querySelectorAll<HTMLButtonElement>(`.${PPT_PREFIX}resolve-one`).forEach((btn) => {
      btn.addEventListener('click', (e) => this.resolve((e.currentTarget as HTMLButtonElement).dataset.id!))
    })
  }

  async #clearActive(): Promise<void> {
    this.#annotations = this.#resolvedAnnotations()
    await saveAnnotations(window.location.pathname, this.#annotations)
    this.#render()
  }
}
