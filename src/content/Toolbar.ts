import type { Annotation, PinpointMode } from '../types';
import { annotationsToMarkdown, annotationToMarkdown } from '../utils/markdown';
import { getAnnotations, saveAnnotations } from '../utils/storage';
import { EVENTS, PPT_PREFIX } from './constants';

type ToolbarTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'pinpoint:theme';

export class Toolbar {
  #el: HTMLDivElement | null = null;
  #annotations: Annotation[] = [];
  #showResolvedHistory = false;
  #lastResolvedId: string | null = null;
  #helpOpen = false;
  #theme: ToolbarTheme = 'dark';
  #mode: PinpointMode = 'inactive';
  #onKeyDown: ((e: KeyboardEvent) => void) | null = null;

  async mount() {
    this.#annotations = await getAnnotations(window.location.pathname);
    const storedTheme = (await chrome.storage.local.get(THEME_STORAGE_KEY)) as Record<
      string,
      ToolbarTheme | undefined
    >;
    this.#theme = storedTheme[THEME_STORAGE_KEY] === 'light' ? 'light' : 'dark';
    this.#applyGlobalTheme();
    this.#el = document.createElement('div');
    this.#el.className = `${PPT_PREFIX}toolbar`;
    document.body.appendChild(this.#el);
    this.#onKeyDown = (e) => this.#handleKeyDown(e);
    document.addEventListener('keydown', this.#onKeyDown);
    this.#render();
  }

  unmount() {
    if (this.#onKeyDown) document.removeEventListener('keydown', this.#onKeyDown);
    document.documentElement.removeAttribute('data-pinpoint-theme');
    this.#el?.remove();
    this.#el = null;
  }

  setMode(mode: PinpointMode): void {
    this.#mode = mode;
    if (mode !== 'active-review') {
      this.#showResolvedHistory = false;
      this.#helpOpen = false;
    }
    this.#render();
  }

  getAnnotationByPath(elementPath: string): Annotation | null {
    return this.#annotations.find((a) => a.status === 'active' && a.path === elementPath) ?? null;
  }

  async addAnnotation(annotation: Annotation): Promise<void> {
    this.#annotations = [...this.#annotations, annotation];
    this.#showResolvedHistory = false;
    this.#emitAnnotationsChange();
    this.#render();
    await saveAnnotations(window.location.pathname, this.#annotations);
  }

  async updateAnnotation(id: string, comment: string): Promise<void> {
    this.#annotations = this.#annotations.map((a) =>
      a.id === id ? { ...a, feedback: comment, createdAt: Date.now() } : a
    );
    this.#emitAnnotationsChange();
    this.#render();
    await saveAnnotations(window.location.pathname, this.#annotations);
  }

  async resolve(id: string): Promise<void> {
    this.#annotations = this.#annotations.map((a) =>
      a.id === id ? { ...a, status: 'resolved' } : a
    );
    this.#lastResolvedId = id;
    this.#showResolvedHistory = false;
    this.#emitAnnotationsChange();
    this.#render();
    await saveAnnotations(window.location.pathname, this.#annotations);
  }

  async copyAll(): Promise<void> {
    const active = this.#annotations.filter((a) => a.status === 'active');
    const md = annotationsToMarkdown(active, window.location.href);
    try {
      await navigator.clipboard.writeText(md);
    } catch {
      console.log('[pinpoint] Clipboard unavailable:\n\n' + md);
    }
  }

  async copyOne(id: string): Promise<void> {
    const annotation = this.#annotations.find((a) => a.id === id);
    if (!annotation) return;
    const md = annotationToMarkdown(annotation);
    try {
      await navigator.clipboard.writeText(md);
    } catch {
      console.log('[pinpoint] Clipboard unavailable:\n\n' + md);
    }
  }

  #activeAnnotations(): Annotation[] {
    return this.#annotations.filter((a) => a.status === 'active');
  }

  #resolvedAnnotations(): Annotation[] {
    return this.#annotations.filter((a) => a.status === 'resolved');
  }

  getActiveAnnotations(): Annotation[] {
    return [...this.#activeAnnotations()];
  }

  #requestMode(mode: PinpointMode): void {
    document.dispatchEvent(
      new CustomEvent(EVENTS.MODE_CHANGE, {
        bubbles: true,
        composed: true,
        detail: { mode },
      })
    );
  }

  #requestReview(): void {
    document.dispatchEvent(
      new CustomEvent(EVENTS.OPEN_REVIEW, {
        bubbles: true,
        composed: true,
      })
    );
  }

  #toggleHelp(): void {
    this.#helpOpen = !this.#helpOpen;
    this.#render();
  }

  #toggleAnchorMode(): void {
    this.#requestMode(this.#mode === 'inactive' ? 'active-select' : 'inactive');
  }

  #anchorButtonLabel(): string {
    if (this.#mode === 'inactive') return 'Activate Pinpoint';
    return 'Deactivate Pinpoint';
  }

  #anchorButtonState(): 'inactive' | 'active' | 'review' {
    if (this.#mode === 'inactive') return 'inactive';
    if (this.#mode === 'active-review') return 'review';
    return 'active';
  }

  #render(): void {
    if (!this.#el) return;
    const active = this.#activeAnnotations();
    const resolved = this.#resolvedAnnotations();
    const hasAttention = active.length > 0 || resolved.length > 0;
    const showResolvedToast =
      !this.#showResolvedHistory && resolved.length > 0 && this.#lastResolvedId !== null;
    const reviewOpen = this.#mode === 'active-review';
    const selecting = this.#mode === 'active-select';
    const anchorActive = this.#mode !== 'inactive';
    const helpOpen = anchorActive && this.#helpOpen;

    this.#el.className = [
      `${PPT_PREFIX}toolbar`,
      `${PPT_PREFIX}theme-${this.#theme}`,
      anchorActive ? `${PPT_PREFIX}toolbar--active` : `${PPT_PREFIX}toolbar--inactive`,
      selecting ? `${PPT_PREFIX}toolbar--selecting` : '',
      reviewOpen ? `${PPT_PREFIX}toolbar--review-open` : '',
      helpOpen ? `${PPT_PREFIX}toolbar--help-open` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const activeNumberById = new Map(active.map((annotation, index) => [annotation.id, index + 1]));
    const renderItems = (annotations: Annotation[]) =>
      annotations
        .map(
          (a) => `
      <li class="${PPT_PREFIX}annotation-item" data-id="${a.id}">
        <div class="${PPT_PREFIX}item-meta">
          <span class="${PPT_PREFIX}item-element">${a.selector}</span>
          <div class="${PPT_PREFIX}item-meta-badges">
            ${a.status === 'active' ? `<span class="${PPT_PREFIX}item-note-number">Note ${activeNumberById.get(a.id)}</span>` : ''}
            <span class="${PPT_PREFIX}item-badge ${a.status === 'resolved' ? `${PPT_PREFIX}item-badge--resolved` : ''}">${a.status === 'active' ? 'Open' : 'Done'}</span>
          </div>
        </div>
        ${
          a.surface
            ? `
          <div class="${PPT_PREFIX}item-surface-row">
            <span class="${PPT_PREFIX}item-surface ${a.surface.kind === 'dialog' ? `${PPT_PREFIX}item-surface--dialog` : ''}">${a.surface.label}</span>
          </div>
        `
            : ''
        }
        <span class="${PPT_PREFIX}item-comment">${a.feedback}</span>
        <span class="${PPT_PREFIX}item-context">${a.context || a.path}</span>
        <div class="${PPT_PREFIX}item-actions">
          <button class="${PPT_PREFIX}copy-one" data-id="${a.id}">Copy</button>
          ${a.status === 'active' ? `<button class="${PPT_PREFIX}resolve-one" data-id="${a.id}">Resolve</button>` : ''}
        </div>
      </li>
    `
        )
        .join('');

    const reviewIcon = `
      <svg class="${PPT_PREFIX}anchor-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 5.5h10M5 10h10M5 14.5h6" />
      </svg>
    `;
    const helpIcon = `
      <svg class="${PPT_PREFIX}anchor-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M7.5 7.2a2.6 2.6 0 0 1 5 1c0 1.8-2.5 2.2-2.5 4" />
        <path d="M10 14.9h.01" />
      </svg>
    `;
    const themeIcon =
      this.#theme === 'dark'
        ? `
        <svg class="${PPT_PREFIX}theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path class="${PPT_PREFIX}theme-toggle-moon" d="M15.5 4.5a7.5 7.5 0 1 0 4 13.85A8.5 8.5 0 1 1 15.5 4.5z" />
        </svg>
      `
        : `
        <svg class="${PPT_PREFIX}theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle class="${PPT_PREFIX}theme-toggle-sun-ring" cx="12" cy="12" r="5.25" />
          <path class="${PPT_PREFIX}theme-toggle-sun-rays" d="M12 3.25v2.1M12 18.65v2.1M3.25 12h2.1M18.65 12h2.1M5.82 5.82l1.49 1.49M16.69 16.69l1.49 1.49M5.82 18.18l1.49-1.49M16.69 7.31l1.49-1.49" />
        </svg>
      `;

    const anchorButtonState = this.#anchorButtonState();

    this.#el.innerHTML = `
      <div class="${PPT_PREFIX}anchor-shell ${anchorActive || hasAttention ? `${PPT_PREFIX}anchor-shell--active` : ''}">
        <button class="${PPT_PREFIX}anchor-button" type="button" data-state="${anchorButtonState}" aria-label="${this.#anchorButtonLabel()}">
          <svg class="${PPT_PREFIX}anchor-button-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path class="${PPT_PREFIX}anchor-button-line ${PPT_PREFIX}anchor-button-line--top" d="M7 9h10" />
            <path class="${PPT_PREFIX}anchor-button-line ${PPT_PREFIX}anchor-button-line--bottom" d="M7 15h10" />
            <path class="${PPT_PREFIX}anchor-button-line ${PPT_PREFIX}anchor-button-line--vertical" d="M12 7v10" />
          </svg>
          ${hasAttention ? `<span class="${PPT_PREFIX}anchor-badge ${anchorActive ? `${PPT_PREFIX}anchor-badge--hidden` : ''}">${active.length}</span>` : ''}
        </button>
        ${
          anchorActive
            ? `
          <div class="${PPT_PREFIX}anchor-actions" aria-label="Pinpoint actions">
            <button class="${PPT_PREFIX}anchor-action ${PPT_PREFIX}anchor-action--icon ${reviewOpen ? `${PPT_PREFIX}anchor-action--selected` : ''}" type="button" aria-label="${reviewOpen ? 'Close review panel' : 'Open review panel'}" title="Review">
              ${reviewIcon}
              ${hasAttention ? `<span class="${PPT_PREFIX}anchor-action-badge">${active.length}</span>` : ''}
            </button>
            <button class="${PPT_PREFIX}anchor-action ${PPT_PREFIX}anchor-action--icon ${helpOpen ? `${PPT_PREFIX}anchor-action--selected` : ''}" type="button" aria-label="${helpOpen ? 'Close help panel' : 'Open help panel'}" title="Help">
              ${helpIcon}
            </button>
            <button class="${PPT_PREFIX}theme-toggle" type="button" aria-label="Switch to ${this.#theme === 'dark' ? 'light' : 'dark'} theme" title="${this.#theme === 'dark' ? 'Dark theme' : 'Light theme'}">
              ${themeIcon}
            </button>
          </div>
        `
            : ''
        }
        ${
          helpOpen
            ? `
          <div class="${PPT_PREFIX}help-panel" aria-label="Pinpoint shortcuts">
            <div class="${PPT_PREFIX}help-panel-header">
              <span class="${PPT_PREFIX}help-panel-title">Shortcuts</span>
              <span class="${PPT_PREFIX}help-panel-subtitle">Move faster without leaving the page.</span>
            </div>
            <ul class="${PPT_PREFIX}help-list">
              <li class="${PPT_PREFIX}help-item">
                <span class="${PPT_PREFIX}help-item-label">Toggle selection mode</span>
                <kbd class="${PPT_PREFIX}help-kbd">⌥V</kbd>
              </li>
              <li class="${PPT_PREFIX}help-item">
                <span class="${PPT_PREFIX}help-item-label">Leave review</span>
                <kbd class="${PPT_PREFIX}help-kbd">H</kbd>
              </li>
              <li class="${PPT_PREFIX}help-item">
                <span class="${PPT_PREFIX}help-item-label">Copy prompt</span>
                <kbd class="${PPT_PREFIX}help-kbd">C</kbd>
              </li>
              <li class="${PPT_PREFIX}help-item">
                <span class="${PPT_PREFIX}help-item-label">Clear active notes</span>
                <kbd class="${PPT_PREFIX}help-kbd">D</kbd>
              </li>
            </ul>
          </div>
        `
            : ''
        }
      </div>
      ${
        reviewOpen
          ? `
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
            ${
              showResolvedToast
                ? `
              <li class="${PPT_PREFIX}history-toast">
                <div class="${PPT_PREFIX}history-toast-copy">
                  <span class="${PPT_PREFIX}history-toast-title">Marked resolved</span>
                  <span class="${PPT_PREFIX}history-toast-body">Completed notes are hidden to keep the workspace focused.</span>
                </div>
                <button class="${PPT_PREFIX}history-toggle" type="button">View history</button>
              </li>
            `
                : ''
            }
            ${
              active.length === 0 && resolved.length === 0
                ? `
              <li class="${PPT_PREFIX}empty">
                <div class="${PPT_PREFIX}empty-illustration"></div>
                <h3 class="${PPT_PREFIX}empty-title">Start collecting feedback</h3>
                <p class="${PPT_PREFIX}empty-body">Activate Pinpoint and click any element to add a note.</p>
              </li>
            `
                : ''
            }
            ${
              active.length > 0
                ? `
              <li class="${PPT_PREFIX}section">
                <div class="${PPT_PREFIX}section-header">
                  <span class="${PPT_PREFIX}section-title">Active</span>
                  <span class="${PPT_PREFIX}section-count">${active.length}</span>
                </div>
                <ul class="${PPT_PREFIX}section-list">
                  ${renderItems(active)}
                </ul>
              </li>
            `
                : ''
            }
            ${
              this.#showResolvedHistory && resolved.length > 0
                ? `
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
            `
                : ''
            }
          </ul>
        </aside>
      `
          : ''
      }
    `;

    this.#el
      .querySelector<HTMLButtonElement>(`.${PPT_PREFIX}anchor-button`)
      ?.addEventListener('click', () => {
        this.#toggleAnchorMode();
      });
    this.#el
      .querySelectorAll<HTMLButtonElement>(`.${PPT_PREFIX}anchor-action`)[0]
      ?.addEventListener('click', () => {
        if (reviewOpen) {
          this.#requestMode('active-select');
          return;
        }
        this.#requestReview();
      });
    this.#el
      .querySelectorAll<HTMLButtonElement>(`.${PPT_PREFIX}anchor-action`)[1]
      ?.addEventListener('click', () => {
        this.#toggleHelp();
      });
    this.#el
      .querySelector<HTMLButtonElement>(`.${PPT_PREFIX}theme-toggle`)
      ?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        void this.#toggleTheme();
      });
    this.#el
      .querySelector<HTMLButtonElement>(`.${PPT_PREFIX}toolbar-minimize`)
      ?.addEventListener('click', () => {
        this.#requestMode('active-select');
      });
    this.#el
      .querySelector<HTMLButtonElement>(`.${PPT_PREFIX}copy-all`)
      ?.addEventListener('click', () => this.copyAll());
    this.#el
      .querySelector<HTMLButtonElement>(`.${PPT_PREFIX}clear-active`)
      ?.addEventListener('click', () => this.#clearActive());
    this.#el
      .querySelector<HTMLButtonElement>(`.${PPT_PREFIX}history-toggle`)
      ?.addEventListener('click', () => {
        this.#showResolvedHistory = true;
        this.#render();
      });
    this.#el
      .querySelector<HTMLButtonElement>(`.${PPT_PREFIX}history-hide`)
      ?.addEventListener('click', () => {
        this.#showResolvedHistory = false;
        this.#render();
      });
    this.#el.querySelectorAll<HTMLButtonElement>(`.${PPT_PREFIX}copy-one`).forEach((btn) => {
      btn.addEventListener('click', (e) =>
        this.copyOne((e.currentTarget as HTMLButtonElement).dataset.id!)
      );
    });
    this.#el.querySelectorAll<HTMLButtonElement>(`.${PPT_PREFIX}resolve-one`).forEach((btn) => {
      btn.addEventListener('click', (e) =>
        this.resolve((e.currentTarget as HTMLButtonElement).dataset.id!)
      );
    });
  }

  async #clearActive(): Promise<void> {
    this.#annotations = this.#resolvedAnnotations();
    this.#lastResolvedId = null;
    this.#emitAnnotationsChange();
    this.#render();
    await saveAnnotations(window.location.pathname, this.#annotations);
  }

  #emitAnnotationsChange(): void {
    document.dispatchEvent(
      new CustomEvent(EVENTS.ANNOTATIONS_CHANGE, {
        bubbles: true,
        composed: true,
      })
    );
  }

  async #toggleTheme(): Promise<void> {
    this.#theme = this.#theme === 'dark' ? 'light' : 'dark';
    this.#applyGlobalTheme();
    this.#render();
    await chrome.storage.local.set({ [THEME_STORAGE_KEY]: this.#theme });
  }

  #applyGlobalTheme(): void {
    document.documentElement.setAttribute('data-pinpoint-theme', this.#theme);
  }

  #handleKeyDown(e: KeyboardEvent): void {
    if (this.#mode !== 'active-review' || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }

    const key = e.key.toLowerCase();
    if (key === 'h') {
      e.preventDefault();
      this.#requestMode('active-select');
    }
    if (key === 'd' && this.#activeAnnotations().length > 0) {
      e.preventDefault();
      this.#el?.querySelector<HTMLButtonElement>(`.${PPT_PREFIX}clear-active`)?.click();
    }
    if (key === 'c' && this.#activeAnnotations().length > 0) {
      e.preventDefault();
      this.#el?.querySelector<HTMLButtonElement>(`.${PPT_PREFIX}copy-all`)?.click();
    }
  }
}
