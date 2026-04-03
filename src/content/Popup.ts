import type { AnnotationRect } from '../types';
import { EVENTS, PPT_PREFIX } from './constants';

const POPUP_GAP = 12;
const POPUP_VIEWPORT_MARGIN = 12;

export class Popup {
  #el: HTMLDivElement | null = null;
  #existing: { id: string; feedback: string } | null = null;
  #onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  #visible = false;

  mount() {
    this.#el = document.createElement('div');
    this.#el.className = `${PPT_PREFIX}popup`;
    this.#el.style.display = 'none';
    this.#el.innerHTML = `
      <form class="${PPT_PREFIX}popup-form">
        <div class="${PPT_PREFIX}popup-header">
          <p class="${PPT_PREFIX}popup-eyebrow">Pinpoint note</p>
          <button type="button" class="${PPT_PREFIX}popup-close" aria-label="Close note composer">×</button>
        </div>
        <p class="${PPT_PREFIX}popup-helper"></p>
        <textarea class="${PPT_PREFIX}popup-textarea" placeholder="Capture what would change, describe the issue, the intended outcome, or the exact UI adjustment you want." rows="4"></textarea>
        <div class="${PPT_PREFIX}popup-actions">
          <button type="button" class="${PPT_PREFIX}popup-cancel">Cancel</button>
          <button type="submit" class="${PPT_PREFIX}popup-submit">Add</button>
        </div>
      </form>
    `;
    document.body.appendChild(this.#el);

    this.#el
      .querySelector<HTMLFormElement>(`.${PPT_PREFIX}popup-form`)!
      .addEventListener('submit', (e) => {
        e.preventDefault();
        const feedback = this.#el!.querySelector<HTMLTextAreaElement>(
          `.${PPT_PREFIX}popup-textarea`
        )!.value.trim();
        if (!feedback) return;
        document.dispatchEvent(
          new CustomEvent(EVENTS.ANNOTATION_ADD, {
            bubbles: true,
            composed: true,
            detail: { feedback, existingId: this.#existing?.id ?? null },
          })
        );
        this.hide();
      });

    this.#el
      .querySelector<HTMLButtonElement>(`.${PPT_PREFIX}popup-cancel`)!
      .addEventListener('click', () => this.hide(true));
    this.#el
      .querySelector<HTMLButtonElement>(`.${PPT_PREFIX}popup-close`)!
      .addEventListener('click', () => this.hide(true));

    this.#onKeyDown = (e) => {
      if (e.key === 'Escape' && this.#visible) this.hide(true);
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && this.#el?.style.display !== 'none') {
        this.#el
          ?.querySelector<HTMLFormElement>(`.${PPT_PREFIX}popup-form`)
          ?.dispatchEvent(new Event('submit'));
      }
    };
    document.addEventListener('keydown', this.#onKeyDown);
  }

  show(
    rect: AnnotationRect,
    existing: { id: string; feedback: string } | null,
    options: { noteNumber: number; selectorPath: string }
  ) {
    this.#existing = existing;
    const textarea = this.#el!.querySelector<HTMLTextAreaElement>(`.${PPT_PREFIX}popup-textarea`)!;
    const submitBtn = this.#el!.querySelector<HTMLButtonElement>(`.${PPT_PREFIX}popup-submit`)!;
    const helper = this.#el!.querySelector<HTMLElement>(`.${PPT_PREFIX}popup-helper`)!;

    textarea.value = existing?.feedback ?? '';
    submitBtn.textContent = existing ? 'Update' : 'Add';
    helper.textContent = options.selectorPath;

    this.#el!.style.cssText = 'display:block;position:fixed;top:0;left:0;visibility:hidden';
    const popupRect = this.#el!.getBoundingClientRect();
    const fitsBelow =
      rect.y + rect.height + POPUP_GAP + popupRect.height <=
      window.innerHeight - POPUP_VIEWPORT_MARGIN;
    const preferredTop = fitsBelow
      ? rect.y + rect.height + POPUP_GAP
      : rect.y - popupRect.height - POPUP_GAP;
    const top = Math.max(
      POPUP_VIEWPORT_MARGIN,
      Math.min(window.innerHeight - popupRect.height - POPUP_VIEWPORT_MARGIN, preferredTop)
    );
    const preferredLeft = rect.x + Math.min(rect.width / 2, 48) - popupRect.width / 2;
    const left = Math.max(
      POPUP_VIEWPORT_MARGIN,
      Math.min(window.innerWidth - popupRect.width - POPUP_VIEWPORT_MARGIN, preferredLeft)
    );
    this.#el!.style.cssText = `display:block;position:fixed;top:${top}px;left:${left}px`;
    this.#visible = true;

    textarea.focus();
  }

  hide(emitCancel = false) {
    if (!this.#el) return;
    this.#el.style.display = 'none';
    this.#existing = null;
    const wasVisible = this.#visible;
    this.#visible = false;
    if (emitCancel && wasVisible) {
      document.dispatchEvent(
        new CustomEvent(EVENTS.ANNOTATION_CANCEL, {
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  unmount() {
    if (this.#onKeyDown) document.removeEventListener('keydown', this.#onKeyDown);
    this.#el?.remove();
    this.#el = null;
  }
}
