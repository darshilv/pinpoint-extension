import type { Annotation, PinpointMode } from '../types';
import { annotationToMarkdown, annotationsToMarkdown } from '../utils/markdown';
import { getAnnotations, saveAnnotations } from '../utils/storage';
import { EVENTS, PPT_PREFIX } from './constants';
import {
  type HistoryGroup,
  type ReviewTab,
  type ToolbarTheme,
  getToolbarClassName,
  renderToolbar,
} from './toolbarView';

const THEME_STORAGE_KEY = 'pinpoint:theme';

export class Toolbar {
  #el: HTMLDivElement | null = null;
  #annotations: Annotation[] = [];
  #helpOpen = false;
  #theme: ToolbarTheme = 'dark';
  #mode: PinpointMode = 'inactive';
  #tab: ReviewTab = 'active';
  #onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  #copyAllFeedback: 'idle' | 'copied' = 'idle';
  #copyAllFeedbackTimeout: number | null = null;
  #copyOneFeedbackId: string | null = null;
  #copyOneFeedbackTimeout: number | null = null;

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
    this.#el.addEventListener('click', (event) => {
      void this.#handleClick(event);
    });
    this.#onKeyDown = (e) => this.#handleKeyDown(e);
    document.addEventListener('keydown', this.#onKeyDown);
    this.#render();
  }

  unmount() {
    if (this.#onKeyDown) document.removeEventListener('keydown', this.#onKeyDown);
    if (this.#copyAllFeedbackTimeout !== null) window.clearTimeout(this.#copyAllFeedbackTimeout);
    if (this.#copyOneFeedbackTimeout !== null) window.clearTimeout(this.#copyOneFeedbackTimeout);
    document.documentElement.removeAttribute('data-pinpoint-theme');
    this.#el?.remove();
    this.#el = null;
  }

  setMode(mode: PinpointMode): void {
    this.#mode = mode;
    if (mode !== 'active-review') {
      this.#helpOpen = false;
      this.#tab = 'active';
    }
    this.#render();
  }

  getAnnotationByPath(elementPath: string): Annotation | null {
    return this.#annotations.find((a) => a.status === 'active' && a.path === elementPath) ?? null;
  }

  async addAnnotation(annotation: Annotation): Promise<void> {
    this.#annotations = [...this.#annotations, annotation];
    this.#tab = 'active';
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

  async copyAll(): Promise<void> {
    const active = this.#activeAnnotations();
    if (active.length === 0) return;

    const markdown = annotationsToMarkdown(active, window.location.href);
    const copied = await this.#writeClipboard(markdown);
    if (!copied) return;

    const copiedAt = Date.now();
    this.#annotations = this.#annotations.map((annotation) =>
      annotation.status === 'active'
        ? {
            ...annotation,
            status: 'resolved',
            resolvedBy: 'copy',
            copiedAt,
          }
        : annotation
    );
    this.#setCopyAllFeedback('copied');
    this.#emitAnnotationsChange();
    this.#render();
    await saveAnnotations(window.location.pathname, this.#annotations);
  }

  async copyOne(id: string): Promise<void> {
    const annotation = this.#annotations.find((a) => a.id === id);
    if (!annotation) return;

    const markdown = annotationToMarkdown(annotation);
    const copied = await this.#writeClipboard(markdown);
    if (!copied) return;

    if (annotation.status === 'resolved') {
      this.#setCopyOneFeedback(id);
      return;
    }

    const copiedAt = Date.now();
    this.#annotations = this.#annotations.map((item) =>
      item.id === id
        ? {
            ...item,
            status: 'resolved',
            resolvedBy: 'copy',
            copiedAt,
          }
        : item
    );
    this.#setCopyOneFeedback(id);
    this.#emitAnnotationsChange();
    this.#render();
    await saveAnnotations(window.location.pathname, this.#annotations);
  }

  async copyHistoryGroup(copiedAt: number): Promise<void> {
    const group = this.#historyGroups().find((entry) => entry.copiedAt === copiedAt);
    if (!group || group.annotations.length === 0) return;

    const markdown = annotationsToMarkdown(group.annotations, window.location.href);
    await this.#writeClipboard(markdown);
  }

  #activeAnnotations(): Annotation[] {
    return this.#annotations.filter((a) => a.status === 'active');
  }

  #historyGroups(): HistoryGroup[] {
    const copied = this.#annotations.filter(
      (a) => a.status === 'resolved' && a.resolvedBy === 'copy' && typeof a.copiedAt === 'number'
    );
    const groups = new Map<number, Annotation[]>();

    copied.forEach((annotation) => {
      const copiedAt = annotation.copiedAt!;
      const current = groups.get(copiedAt) ?? [];
      current.push(annotation);
      groups.set(copiedAt, current);
    });

    return Array.from(groups.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([copiedAt, annotations]) => ({
        copiedAt,
        annotations,
      }));
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

  #setCopyAllFeedback(state: 'idle' | 'copied'): void {
    this.#copyAllFeedback = state;
    if (this.#copyAllFeedbackTimeout !== null) {
      window.clearTimeout(this.#copyAllFeedbackTimeout);
      this.#copyAllFeedbackTimeout = null;
    }
    if (state === 'copied') {
      this.#copyAllFeedbackTimeout = window.setTimeout(() => {
        this.#copyAllFeedback = 'idle';
        this.#render();
      }, 1800);
    }
  }

  #setCopyOneFeedback(id: string | null): void {
    this.#copyOneFeedbackId = id;
    if (this.#copyOneFeedbackTimeout !== null) {
      window.clearTimeout(this.#copyOneFeedbackTimeout);
      this.#copyOneFeedbackTimeout = null;
    }
    if (id) {
      this.#copyOneFeedbackTimeout = window.setTimeout(() => {
        this.#copyOneFeedbackId = null;
        this.#render();
      }, 1800);
    }
    this.#render();
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

  #formatHistoryTimestamp(timestamp: number): string {
    const value = new Date(timestamp);
    const now = new Date();
    const isToday = value.toDateString() === now.toDateString();

    if (isToday) {
      return `Today at ${new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(value)}`;
    }

    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(value);
  }

  async #writeClipboard(markdown: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(markdown);
      return true;
    } catch {
      console.log('[pinpoint] Clipboard unavailable:\n\n' + markdown);
      return false;
    }
  }

  #render(): void {
    if (!this.#el) return;

    const active = this.#activeAnnotations();
    const historyGroups = this.#historyGroups();
    const historyCount = historyGroups.reduce((total, group) => total + group.annotations.length, 0);
    const hasAttention = active.length > 0 || historyCount > 0;
    const reviewOpen = this.#mode === 'active-review';
    const selecting = this.#mode === 'active-select';
    const anchorActive = this.#mode !== 'inactive';
    const helpOpen = anchorActive && this.#helpOpen;
    const isCopySuccessVisible = this.#copyAllFeedback === 'copied';
    const hasActiveAnnotations = active.length > 0;
    const showCollapsedCopy = !anchorActive && (hasActiveAnnotations || isCopySuccessVisible);
    const showExpandedCopy = anchorActive;
    const shouldDisableExpandedCopy = !hasActiveAnnotations && !isCopySuccessVisible;

    const viewState = {
      active,
      historyGroups,
      historyCount,
      hasAttention,
      reviewOpen,
      selecting,
      anchorActive,
      helpOpen,
      isCopySuccessVisible,
      hasActiveAnnotations,
      showCollapsedCopy,
      showExpandedCopy,
      shouldDisableExpandedCopy,
      copyOneFeedbackId: this.#copyOneFeedbackId,
      mode: this.#mode,
      tab: this.#tab,
      theme: this.#theme,
    };

    this.#el.className = getToolbarClassName(viewState);
    this.#el.innerHTML = renderToolbar(viewState, (timestamp) => this.#formatHistoryTimestamp(timestamp));
  }

  async #handleClick(event: Event): Promise<void> {
    if (!this.#el) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button');
    if (!(button instanceof HTMLButtonElement) || !this.#el.contains(button)) return;

    if (button.matches(`.${PPT_PREFIX}anchor-button`)) {
      this.#toggleAnchorMode();
      return;
    }

    if (button.matches(`.${PPT_PREFIX}theme-toggle`)) {
      event.preventDefault();
      event.stopPropagation();
      await this.#toggleTheme();
      return;
    }

    if (button.matches(`.${PPT_PREFIX}toolbar-minimize`)) {
      this.#requestMode('active-select');
      return;
    }

    if (button.matches(`.${PPT_PREFIX}clear-active`)) {
      await this.#clearActive();
      return;
    }

    if (button.matches(`.${PPT_PREFIX}review-tab`)) {
      this.#tab = button.dataset.tab as ReviewTab;
      this.#render();
      return;
    }

    if (button.matches(`.${PPT_PREFIX}copy-one`)) {
      const id = button.dataset.id;
      if (id) await this.copyOne(id);
      return;
    }

    if (button.matches(`.${PPT_PREFIX}history-copy`)) {
      const copiedAt = Number(
        button.closest(`.${PPT_PREFIX}history-group`)?.getAttribute('data-copied-at')
      );
      if (!Number.isNaN(copiedAt)) await this.copyHistoryGroup(copiedAt);
      return;
    }

    if (button.matches(`.${PPT_PREFIX}anchor-copy`)) {
      if (!button.disabled) await this.copyAll();
      return;
    }

    if (button.matches(`.${PPT_PREFIX}anchor-action`)) {
      const actions = Array.from(
        this.#el.querySelectorAll<HTMLButtonElement>(`.${PPT_PREFIX}anchor-action`)
      );
      const actionIndex = actions.indexOf(button);
      if (actionIndex === 0) {
        if (this.#mode === 'active-review') {
          this.#requestMode('active-select');
          return;
        }
        this.#requestReview();
        return;
      }

      if (actionIndex === 1) {
        this.#toggleHelp();
      }
    }
  }

  async #clearActive(): Promise<void> {
    this.#annotations = this.#annotations.filter((annotation) => annotation.status !== 'active');
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
    if (key === 'escape') {
      e.preventDefault();
      this.#requestMode('active-select');
    }
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
