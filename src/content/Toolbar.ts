import { PPT_PREFIX, EVENTS } from './constants'
import { getAnnotations, saveAnnotations } from '../utils/storage'
import { annotationsToMarkdown, annotationToMarkdown } from '../utils/markdown'
import type { Annotation, PinpointMode } from '../types'

type ToolbarTheme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'pinpoint:theme'

export class Toolbar {
  #el: HTMLDivElement | null = null
  #annotations: Annotation[] = []
  #showResolvedHistory = false
  #lastResolvedId: string | null = null
  #theme: ToolbarTheme = 'dark'
  #mode: PinpointMode = 'inactive'
  #onKeyDown: ((e: KeyboardEvent) => void) | null = null

  async mount() {
    this.#annotations = await getAnnotations(window.location.pathname)
    const storedTheme = await chrome.storage.local.get(THEME_STORAGE_KEY) as Record<string, ToolbarTheme | undefined>
    this.#theme = storedTheme[THEME_STORAGE_KEY] === 'light' ? 'light' : 'dark'
    this.#el = document.createElement('div')
    this.#el.className = `${PPT_PREFIX}toolbar`
    document.body.appendChild(this.#el)
    this.#onKeyDown = (e) => this.#handleKeyDown(e)
    document.addEventListener('keydown', this.#onKeyDown)
    this.#render()
  }

  unmount() {
    if (this.#onKeyDown) document.removeEventListener('keydown', this.#onKeyDown)
    this.#el?.remove()
    this.#el = null
  }

  setMode(mode: PinpointMode): void {
    this.#mode = mode
    if (mode !== 'active-review') this.#showResolvedHistory = false
    this.#render()
  }

  getAnnotationByPath(elementPath: string): Annotation | null {
    return this.#annotations.find(
      a => a.status === 'active' && a.path === elementPath
    ) ?? null
  }

  async addAnnotation(annotation: Annotation): Promise<void> {
    this.#annotations = [...this.#annotations, annotation]
    this.#showResolvedHistory = false
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
    this.#lastResolvedId = id
    this.#showResolvedHistory = false
    await saveAnnotations(window.location.pathname, this.#annotations)
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

  #requestMode(mode: PinpointMode): void {
    document.dispatchEvent(new CustomEvent(EVENTS.MODE_CHANGE, {
      bubbles: true,
      composed: true,
      detail: { mode },
    }))
  }

  #requestReview(): void {
    document.dispatchEvent(new CustomEvent(EVENTS.OPEN_REVIEW, {
      bubbles: true,
      composed: true,
    }))
  }

  #render(): void {
    if (!this.#el) return
    const active = this.#activeAnnotations()
    const resolved = this.#resolvedAnnotations()
    const hasAttention = active.length > 0 || resolved.length > 0
    const showResolvedToast = !this.#showResolvedHistory && resolved.length > 0 && this.#lastResolvedId !== null
    const reviewOpen = this.#mode === 'active-review'
    const selecting = this.#mode === 'active-select'
    const anchorActive = this.#mode !== 'inactive'

    this.#el.className = [
      `${PPT_PREFIX}toolbar`,
      `${PPT_PREFIX}theme-${this.#theme}`,
      anchorActive ? `${PPT_PREFIX}toolbar--active` : `${PPT_PREFIX}toolbar--inactive`,
      selecting ? `${PPT_PREFIX}toolbar--selecting` : '',
      reviewOpen ? `${PPT_PREFIX}toolbar--review-open` : '',
    ].filter(Boolean).join(' ')

    const renderItems = (annotations: Annotation[]) => annotations.map(a => `
      <li class="${PPT_PREFIX}annotation-item" data-id="${a.id}">
        <div class="${PPT_PREFIX}item-meta">
          <span class="${PPT_PREFIX}item-element">${a.selector}</span>
          <span class="${PPT_PREFIX}item-badge ${a.status === 'resolved' ? `${PPT_PREFIX}item-badge--resolved` : ''}">${a.status === 'active' ? 'Open' : 'Done'}</span>
        </div>
        ${a.surface ? `
          <div class="${PPT_PREFIX}item-surface-row">
            <span class="${PPT_PREFIX}item-surface ${a.surface.kind === 'dialog' ? `${PPT_PREFIX}item-surface--dialog` : ''}">${a.surface.label}</span>
          </div>
        ` : ''}
        <span class="${PPT_PREFIX}item-comment">${a.feedback}</span>
        <span class="${PPT_PREFIX}item-context">${a.context || a.path}</span>
        <div class="${PPT_PREFIX}item-actions">
          <button class="${PPT_PREFIX}copy-one" data-id="${a.id}">Copy</button>
          ${a.status === 'active' ? `<button class="${PPT_PREFIX}resolve-one" data-id="${a.id}">Resolve</button>` : ''}
        </div>
      </li>
    `).join('')

    this.#el.innerHTML = `
      <div class="${PPT_PREFIX}anchor-shell ${anchorActive || hasAttention ? `${PPT_PREFIX}anchor-shell--active` : ''}">
        <button class="${PPT_PREFIX}anchor-button" type="button" aria-label="${selecting ? 'Pinpoint is selecting elements' : 'Activate Pinpoint selection'}">
          <span class="${PPT_PREFIX}toolbar-collapsed-dot"></span>
        </button>
        ${anchorActive ? `
          <div class="${PPT_PREFIX}anchor-actions" aria-label="Pinpoint actions">
            <button class="${PPT_PREFIX}anchor-action ${selecting ? `${PPT_PREFIX}anchor-action--selected` : ''}" type="button">Pin</button>
            <button class="${PPT_PREFIX}anchor-action ${reviewOpen ? `${PPT_PREFIX}anchor-action--selected` : ''}" type="button">Review</button>
            <button class="${PPT_PREFIX}theme-toggle" type="button" aria-label="Switch to ${this.#theme === 'dark' ? 'light' : 'dark'} theme" title="${this.#theme === 'dark' ? 'Dark' : 'Light'} theme">
              <span class="${PPT_PREFIX}theme-toggle-icon ${PPT_PREFIX}theme-toggle-icon--${this.#theme}" aria-hidden="true"></span>
            </button>
          </div>
        ` : ''}
        ${hasAttention ? `<span class="${PPT_PREFIX}anchor-badge">${active.length}</span>` : ''}
      </div>
      ${reviewOpen ? `
        <aside class="${PPT_PREFIX}review-panel" aria-label="Pinpoint review panel">
          <div class="${PPT_PREFIX}toolbar-header">
            <div class="${PPT_PREFIX}toolbar-brand">
              <h2 class="${PPT_PREFIX}toolbar-title">Pinpoint</h2>
              <p class="${PPT_PREFIX}toolbar-status">${active.length} active note${active.length === 1 ? '' : 's'}</p>
            </div>
            <div class="${PPT_PREFIX}toolbar-header-actions">
              <button class="${PPT_PREFIX}toolbar-minimize" type="button" aria-label="Close review panel">Close</button>
              <button class="${PPT_PREFIX}clear-active" ${active.length === 0 ? 'disabled' : ''}>Clear</button>
              <button class="${PPT_PREFIX}copy-all" ${active.length === 0 ? 'disabled' : ''}>Copy prompt</button>
            </div>
          </div>
          <ul class="${PPT_PREFIX}list">
            ${showResolvedToast ? `
              <li class="${PPT_PREFIX}history-toast">
                <div class="${PPT_PREFIX}history-toast-copy">
                  <span class="${PPT_PREFIX}history-toast-title">Marked resolved</span>
                  <span class="${PPT_PREFIX}history-toast-body">Completed notes are hidden to keep the workspace focused.</span>
                </div>
                <button class="${PPT_PREFIX}history-toggle" type="button">View history</button>
              </li>
            ` : ''}
            ${active.length === 0 && resolved.length === 0 ? `
              <li class="${PPT_PREFIX}empty">
                <div class="${PPT_PREFIX}empty-illustration"></div>
                <h3 class="${PPT_PREFIX}empty-title">Start collecting feedback</h3>
                <p class="${PPT_PREFIX}empty-body">Activate Pinpoint and click any element to add a note.</p>
              </li>
            ` : ''}
            ${active.length > 0 ? `
              <li class="${PPT_PREFIX}section">
                <div class="${PPT_PREFIX}section-header">
                  <span class="${PPT_PREFIX}section-title">Active</span>
                  <span class="${PPT_PREFIX}section-count">${active.length}</span>
                </div>
                <ul class="${PPT_PREFIX}section-list">
                  ${renderItems(active)}
                </ul>
              </li>
            ` : ''}
            ${this.#showResolvedHistory && resolved.length > 0 ? `
              <li class="${PPT_PREFIX}section">
                <div class="${PPT_PREFIX}section-header">
                  <div class="${PPT_PREFIX}section-header-copy">
                    <span class="${PPT_PREFIX}section-title">Resolved history</span>
                    <span class="${PPT_PREFIX}section-subtitle">A lightweight record of notes you already completed.</span>
                  </div>
                  <div class="${PPT_PREFIX}section-header-actions">
                    <span class="${PPT_PREFIX}section-count">${resolved.length}</span>
                    <button class="${PPT_PREFIX}history-hide" type="button">Hide</button>
                  </div>
                </div>
                <ul class="${PPT_PREFIX}section-list">
                  ${renderItems(resolved)}
                </ul>
              </li>
            ` : ''}
          </ul>
        </aside>
      ` : ''}
    `

    this.#el.querySelector<HTMLButtonElement>(`.${PPT_PREFIX}anchor-button`)?.addEventListener('click', () => {
      this.#requestMode('active-select')
    })
    this.#el.querySelectorAll<HTMLButtonElement>(`.${PPT_PREFIX}anchor-action`)[0]?.addEventListener('click', () => {
      this.#requestMode('active-select')
    })
    this.#el.querySelectorAll<HTMLButtonElement>(`.${PPT_PREFIX}anchor-action`)[1]?.addEventListener('click', () => {
      this.#requestReview()
    })
    this.#el.querySelector<HTMLButtonElement>(`.${PPT_PREFIX}theme-toggle`)?.addEventListener('click', (e) => {
      e.stopPropagation()
      void this.#toggleTheme()
    })
    this.#el.querySelector<HTMLButtonElement>(`.${PPT_PREFIX}toolbar-minimize`)?.addEventListener('click', () => {
      this.#requestMode('active-select')
    })
    this.#el.querySelector<HTMLButtonElement>(`.${PPT_PREFIX}copy-all`)?.addEventListener('click', () => this.copyAll())
    this.#el.querySelector<HTMLButtonElement>(`.${PPT_PREFIX}clear-active`)?.addEventListener('click', () => this.#clearActive())
    this.#el.querySelector<HTMLButtonElement>(`.${PPT_PREFIX}history-toggle`)?.addEventListener('click', () => {
      this.#showResolvedHistory = true
      this.#render()
    })
    this.#el.querySelector<HTMLButtonElement>(`.${PPT_PREFIX}history-hide`)?.addEventListener('click', () => {
      this.#showResolvedHistory = false
      this.#render()
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
    this.#lastResolvedId = null
    await saveAnnotations(window.location.pathname, this.#annotations)
    this.#render()
  }

  async #toggleTheme(): Promise<void> {
    this.#theme = this.#theme === 'dark' ? 'light' : 'dark'
    await chrome.storage.local.set({ [THEME_STORAGE_KEY]: this.#theme })
    this.#render()
  }

  #handleKeyDown(e: KeyboardEvent): void {
    if (this.#mode !== 'active-review' || e.metaKey || e.ctrlKey || e.altKey) return
    const target = e.target
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return
    }

    const key = e.key.toLowerCase()
    if (key === 'h') {
      e.preventDefault()
      this.#requestMode('active-select')
    }
    if (key === 'd' && this.#activeAnnotations().length > 0) {
      e.preventDefault()
      this.#el?.querySelector<HTMLButtonElement>(`.${PPT_PREFIX}clear-active`)?.click()
    }
    if (key === 'c' && this.#activeAnnotations().length > 0) {
      e.preventDefault()
      this.#el?.querySelector<HTMLButtonElement>(`.${PPT_PREFIX}copy-all`)?.click()
    }
  }
}
