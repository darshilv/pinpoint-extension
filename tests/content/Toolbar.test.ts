// @ts-nocheck
import { EVENTS, PPT_PREFIX } from '../../src/constants';
import { Toolbar } from '../../src/content/Toolbar';

const makeAnnotation = (overrides = {}) => ({
  id: crypto.randomUUID(),
  selector: 'button.primary',
  path: 'div > button.primary',
  classes: ['primary'],
  context: 'Save',
  surface: { kind: 'page', label: 'Page' },
  feedback: 'Change color',
  status: 'active',
  createdAt: Date.now(),
  url: 'http://localhost/',
  rect: { x: 10, y: 10, width: 100, height: 40 },
  ...overrides,
});

async function flushUi() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('Toolbar', () => {
  let toolbar;

  beforeEach(async () => {
    toolbar = new Toolbar();
    await toolbar.mount();
  });

  afterEach(() => {
    toolbar.unmount();
  });

  it('injects toolbar element into document', () => {
    const el = document.querySelector(`.${PPT_PREFIX}toolbar`);
    expect(el).not.toBeNull();
  });

  it('starts with only the anchor button visible', () => {
    expect(document.querySelector(`.${PPT_PREFIX}anchor-button`)).not.toBeNull();
    expect(document.querySelector(`.${PPT_PREFIX}anchor-copy--collapsed`)).toBeNull();
    expect(document.querySelector(`.${PPT_PREFIX}anchor-actions`)).toBeNull();
    expect(document.querySelector(`.${PPT_PREFIX}review-panel`)).toBeNull();
  });

  it('shows the collapsed copy button when active annotations exist and toolbar is inactive', async () => {
    await toolbar.addAnnotation(makeAnnotation());

    expect(document.querySelector(`.${PPT_PREFIX}anchor-copy--collapsed`)).not.toBeNull();
    expect(document.querySelector(`.${PPT_PREFIX}anchor-copy-badge`)?.textContent).toBe('1');
    expect(document.querySelector(`.${PPT_PREFIX}anchor-badge`)).toBeNull();
  });

  it('restores persisted annotations from storage on mount', async () => {
    const saved = [makeAnnotation()];
    await chrome.storage.local.set({ 'pinpoint:/': saved });

    const t2 = new Toolbar();
    await t2.mount();
    t2.setMode('active-review');

    const list = document.querySelectorAll(
      `.${PPT_PREFIX}review-panel .${PPT_PREFIX}annotation-item`
    );
    expect(list.length).toBeGreaterThan(0);
    t2.unmount();
  });

  describe('mode rendering', () => {
    it('shows quick actions in active-select mode with disabled copy when empty', () => {
      toolbar.setMode('active-select');

      expect(document.querySelector(`.${PPT_PREFIX}anchor-actions`)).not.toBeNull();
      expect(document.querySelector(`.${PPT_PREFIX}anchor-copy--expanded`)).not.toBeNull();
      expect(document.querySelector(`.${PPT_PREFIX}anchor-copy--expanded`)?.hasAttribute('disabled')).toBe(true);
      expect(document.querySelector(`.${PPT_PREFIX}theme-toggle`)).not.toBeNull();
      expect(document.querySelector(`.${PPT_PREFIX}review-panel`)).toBeNull();
      expect(document.querySelector(`.${PPT_PREFIX}toolbar`)?.className).toContain(
        `${PPT_PREFIX}toolbar--active`
      );
    });

    it('keeps the expanded copy button icon-only and uses its badge for count', async () => {
      await toolbar.addAnnotation(makeAnnotation());
      toolbar.setMode('active-select');

      expect(document.querySelector(`.${PPT_PREFIX}anchor-copy-label`)).toBeNull();
      expect(document.querySelector(`.${PPT_PREFIX}anchor-copy--expanded`)?.textContent?.trim()).toBe(
        '1'
      );
      expect(document.querySelectorAll(`.${PPT_PREFIX}anchor-action-badge`).length).toBe(1);
      expect(document.querySelector(`.${PPT_PREFIX}anchor-badge`)).toBeNull();
    });

    it('shows the side review panel in active-review mode', async () => {
      await toolbar.addAnnotation(makeAnnotation());
      toolbar.setMode('active-review');

      expect(document.querySelector(`.${PPT_PREFIX}review-panel`)).not.toBeNull();
      expect(document.querySelector(`.${PPT_PREFIX}toolbar-title`)?.textContent).toBe('Pinpoint');
      expect(document.querySelector(`.${PPT_PREFIX}review-tab--active`)?.textContent).toContain(
        'Active'
      );
    });
  });

  describe('events', () => {
    it('requests active-select mode when the anchor is clicked', () => {
      let received = null;
      document.addEventListener(
        EVENTS.MODE_CHANGE,
        (e) => {
          received = e;
        },
        { once: true }
      );

      document.querySelector(`.${PPT_PREFIX}anchor-button`)?.click();

      expect(received?.detail.mode).toBe('active-select');
    });

    it('requests review mode from the review action', () => {
      toolbar.setMode('active-select');
      let received = null;
      document.addEventListener(
        EVENTS.OPEN_REVIEW,
        (e) => {
          received = e;
        },
        { once: true }
      );

      document.querySelectorAll(`.${PPT_PREFIX}anchor-action`)[0]?.click();

      expect(received).not.toBeNull();
    });
  });

  describe('copy flows', () => {
    it('keeps the collapsed copy button visible in success state after copying', async () => {
      const writeMock = vi.fn(async () => {});
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeMock },
        configurable: true,
      });

      await toolbar.addAnnotation(makeAnnotation({ feedback: 'Collapsed copy feedback' }));
      document.querySelector(`.${PPT_PREFIX}anchor-copy--collapsed`)?.click();
      await flushUi();

      const collapsedCopy = document.querySelector(`.${PPT_PREFIX}anchor-copy--collapsed`);
      expect(collapsedCopy).not.toBeNull();
      expect(collapsedCopy?.className).toContain(`${PPT_PREFIX}anchor-copy--success`);
    });

    it('writes active annotations as markdown to clipboard and moves them into history', async () => {
      const writeMock = vi.fn(async () => {});
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeMock },
        configurable: true,
      });
      vi.spyOn(Date, 'now').mockReturnValue(1111);

      await toolbar.addAnnotation(makeAnnotation({ feedback: 'Fix alignment' }));
      await toolbar.addAnnotation(makeAnnotation({ feedback: 'Update padding' }));
      await toolbar.copyAll();
      toolbar.setMode('active-review');

      expect(writeMock).toHaveBeenCalledWith(expect.stringContaining('Fix alignment'));
      expect(document.querySelector(`.${PPT_PREFIX}review-tab[data-tab="active"]`)?.textContent).toContain('0');

      document.querySelector(`.${PPT_PREFIX}review-tab[data-tab="history"]`)?.click();
      expect(document.querySelectorAll(`.${PPT_PREFIX}history-group`).length).toBe(1);
      expect(document.querySelector(`.${PPT_PREFIX}section-subtitle`)?.textContent).toBe(
        '2 annotations'
      );
    });

    it('does not mutate annotations when clipboard write fails', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn(async () => Promise.reject(new Error('nope'))) },
        configurable: true,
      });

      await toolbar.addAnnotation(makeAnnotation({ feedback: 'Keep me active' }));
      await toolbar.copyAll();
      toolbar.setMode('active-review');

      expect(document.querySelector(`.${PPT_PREFIX}review-tab[data-tab="active"]`)?.textContent).toContain('1');
    });

    it('keeps per-item copy and creates a one-item history group', async () => {
      const writeMock = vi.fn(async () => {});
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeMock },
        configurable: true,
      });
      vi.spyOn(Date, 'now').mockReturnValue(2222);

      await toolbar.addAnnotation(makeAnnotation({ feedback: 'Single copy item' }));
      toolbar.setMode('active-review');

      document.querySelector(`.${PPT_PREFIX}copy-one`)?.click();
      await flushUi();

      document.querySelector(`.${PPT_PREFIX}review-tab[data-tab="history"]`)?.click();
      expect(writeMock).toHaveBeenCalledWith(expect.stringContaining('Single copy item'));
      expect(document.querySelectorAll(`.${PPT_PREFIX}history-group`).length).toBe(1);
      expect(document.querySelector(`.${PPT_PREFIX}section-subtitle`)?.textContent).toBe(
        '1 annotation'
      );
    });

    it('lets history items be copied again without changing their grouping', async () => {
      const writeMock = vi.fn(async () => {});
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeMock },
        configurable: true,
      });
      vi.spyOn(Date, 'now').mockReturnValue(3333);

      await toolbar.addAnnotation(makeAnnotation({ feedback: 'Reusable history item' }));
      await toolbar.copyAll();
      toolbar.setMode('active-review');
      document.querySelector(`.${PPT_PREFIX}review-tab[data-tab="history"]`)?.click();

      document.querySelector(`.${PPT_PREFIX}copy-one`)?.click();
      await flushUi();

      expect(writeMock).toHaveBeenLastCalledWith(expect.stringContaining('Reusable history item'));
      expect(document.querySelectorAll(`.${PPT_PREFIX}history-group`).length).toBe(1);
      expect(document.querySelector(`.${PPT_PREFIX}section-subtitle`)?.textContent).toBe(
        '1 annotation'
      );
      expect(document.querySelector(`.${PPT_PREFIX}copy-one`)?.textContent).toContain('Copied');
      expect(document.querySelector(`.${PPT_PREFIX}copy-one`)?.className).toContain(
        `${PPT_PREFIX}copy-one--success`
      );
    });

    it('copies only the selected history group from the group-level copy button', async () => {
      const writeMock = vi.fn(async () => {});
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeMock },
        configurable: true,
      });
      await toolbar.addAnnotation(
        makeAnnotation({
          feedback: 'First group item',
          status: 'resolved',
          resolvedBy: 'copy',
          copiedAt: 1000,
        })
      );
      await toolbar.addAnnotation(
        makeAnnotation({
          feedback: 'Second group item',
          status: 'resolved',
          resolvedBy: 'copy',
          copiedAt: 2000,
        })
      );
      toolbar.setMode('active-review');
      document.querySelector(`.${PPT_PREFIX}review-tab[data-tab="history"]`)?.click();

      const historyGroups = document.querySelectorAll(`.${PPT_PREFIX}history-group`);
      historyGroups[1]
        ?.querySelector(`.${PPT_PREFIX}history-copy`)
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushUi();

      const lastCall = writeMock.mock.calls.at(-1)?.[0] ?? '';
      expect(lastCall).toContain('First group item');
      expect(lastCall).not.toContain('Second group item');
    });

    it('shows copied feedback state on the global copy button', async () => {
      const writeMock = vi.fn(async () => {});
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeMock },
        configurable: true,
      });

      await toolbar.addAnnotation(makeAnnotation());
      toolbar.setMode('active-select');
      document.querySelector(`.${PPT_PREFIX}anchor-copy--expanded`)?.click();
      await flushUi();

      expect(document.querySelector(`.${PPT_PREFIX}anchor-copy--expanded`)?.className).toContain(
        `${PPT_PREFIX}anchor-copy--success`
      );
    });

    it('keeps the expanded copy button enabled during the success state', async () => {
      const writeMock = vi.fn(async () => {});
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeMock },
        configurable: true,
      });

      await toolbar.addAnnotation(makeAnnotation({ feedback: 'Expanded success feedback' }));
      toolbar.setMode('active-select');
      document.querySelector(`.${PPT_PREFIX}anchor-copy--expanded`)?.click();
      await flushUi();

      const expandedCopy = document.querySelector(`.${PPT_PREFIX}anchor-copy--expanded`);
      expect(expandedCopy).not.toBeNull();
      expect(expandedCopy?.className).toContain(`${PPT_PREFIX}anchor-copy--success`);
      expect(expandedCopy?.hasAttribute('disabled')).toBe(false);
    });
  });

  describe('review panel', () => {
    it('shows active and history tabs with counts', async () => {
      await toolbar.addAnnotation(makeAnnotation());
      await toolbar.addAnnotation(makeAnnotation({ status: 'resolved', resolvedBy: 'copy', copiedAt: 1234 }));
      toolbar.setMode('active-review');

      expect(document.querySelector(`.${PPT_PREFIX}review-tab[data-tab="active"]`)?.textContent).toContain('1');
      expect(document.querySelector(`.${PPT_PREFIX}review-tab[data-tab="history"]`)?.textContent).toContain('1');
    });

    it('does not show a resolve action on annotation cards', async () => {
      await toolbar.addAnnotation(makeAnnotation());
      toolbar.setMode('active-review');

      expect(document.querySelector(`.${PPT_PREFIX}resolve-one`)).toBeNull();
    });

    it('does not show copied or page pills on history cards', async () => {
      await toolbar.addAnnotation(makeAnnotation({ feedback: 'History card cleanup' }));
      await toolbar.copyAll();
      toolbar.setMode('active-review');
      document.querySelector(`.${PPT_PREFIX}review-tab[data-tab="history"]`)?.click();

      const historyCard = document.querySelector(`.${PPT_PREFIX}annotation-item`);
      expect(historyCard?.textContent).not.toContain('COPIED');
      expect(historyCard?.textContent).not.toContain('PAGE');
    });
  });

  describe('theme toggle', () => {
    it('applies the persisted theme to the document root', async () => {
      await chrome.storage.local.set({ 'pinpoint:theme': 'light' });

      toolbar.unmount();
      toolbar = new Toolbar();
      await toolbar.mount();

      expect(document.documentElement.getAttribute('data-pinpoint-theme')).toBe('light');
    });
  });

  describe('keyboard shortcuts', () => {
    it('closes review mode when Escape is pressed', async () => {
      await toolbar.addAnnotation(makeAnnotation());
      toolbar.setMode('active-review');

      let received = null;
      document.addEventListener(
        EVENTS.MODE_CHANGE,
        (e) => {
          received = e;
        },
        { once: true }
      );

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(received?.detail.mode).toBe('active-select');
    });

    it('closes review mode when h is pressed', async () => {
      await toolbar.addAnnotation(makeAnnotation());
      toolbar.setMode('active-review');

      let received = null;
      document.addEventListener(
        EVENTS.MODE_CHANGE,
        (e) => {
          received = e;
        },
        { once: true }
      );

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));

      expect(received?.detail.mode).toBe('active-select');
    });

    it('copies active annotations when c is pressed', async () => {
      const writeMock = vi.fn(async () => {});
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeMock },
        configurable: true,
      });
      await toolbar.addAnnotation(makeAnnotation({ feedback: 'Use shortcut copy' }));
      toolbar.setMode('active-review');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
      await Promise.resolve();

      expect(writeMock).toHaveBeenCalledWith(expect.stringContaining('Use shortcut copy'));
    });
  });
});
