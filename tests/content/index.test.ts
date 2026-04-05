// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const overlayMock = {
  mount: vi.fn(),
  unmount: vi.fn(),
  setSelectionEnabled: vi.fn(),
  freeze: vi.fn(),
  unfreeze: vi.fn(),
  setLockedHighlight: vi.fn(),
  setAnnotationMarkers: vi.fn(),
};
const toolbarMock = {
  mount: vi.fn(async () => {}),
  unmount: vi.fn(),
  setMode: vi.fn(),
  getAnnotationByPath: vi.fn(() => null),
  getActiveAnnotations: vi.fn(() => []),
  addAnnotation: vi.fn(async () => {}),
  updateAnnotation: vi.fn(async () => {}),
};
const popupMock = {
  mount: vi.fn(),
  unmount: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
};

vi.mock('../../src/content/Overlay', () => ({ Overlay: class MockOverlay { constructor() { return overlayMock; } } }));
vi.mock('../../src/content/Toolbar', () => ({ Toolbar: class MockToolbar { constructor() { return toolbarMock; } } }));
vi.mock('../../src/content/Popup', () => ({ Popup: class MockPopup { constructor() { return popupMock; } } }));
vi.mock('../../src/content/content.css', () => ({}));

import { EVENTS } from '../../src/constants';
import { activate, deactivate } from '../../src/content/index';

describe('content coordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toolbarMock.getActiveAnnotations.mockReturnValue([]);
    deactivate();
  });

  it('elementclick freezes overlay and opens popup', async () => {
    toolbarMock.getAnnotationByPath.mockReturnValue({ id: 'existing', feedback: 'old' });
    toolbarMock.getActiveAnnotations.mockReturnValue([{ id: 'existing', feedback: 'old' }]);
    await activate();
    const rect = { x: 1, y: 2, width: 3, height: 4 };
    const surface = { kind: 'dialog', label: 'Dialog: Invite people' };
    document.dispatchEvent(
      new CustomEvent(EVENTS.ELEMENT_CLICK, {
        detail: {
          selector: 'button.a',
          path: 'div > button.a',
          classes: ['a'],
          context: 'Save',
          rect,
          surface,
        },
      })
    );
    expect(overlayMock.freeze).toHaveBeenCalled();
    expect(toolbarMock.getAnnotationByPath).toHaveBeenCalledWith('div > button.a');
    expect(overlayMock.setLockedHighlight).toHaveBeenCalledWith(rect);
    expect(popupMock.show).toHaveBeenCalledWith(
      rect,
      { id: 'existing', feedback: 'old' },
      { noteNumber: 1, selectorPath: 'div > button.a' }
    );
  });

  it('starts in inactive mode on activation', async () => {
    await activate();

    expect(toolbarMock.setMode).toHaveBeenCalledWith('inactive');
    expect(overlayMock.setSelectionEnabled).toHaveBeenCalledWith(false);
  });

  it('annotationadd with existingId calls updateAnnotation', async () => {
    await activate();
    document.dispatchEvent(
      new CustomEvent(EVENTS.MODE_CHANGE, {
        detail: { mode: 'active-select' },
      })
    );
    document.dispatchEvent(
      new CustomEvent(EVENTS.ELEMENT_CLICK, {
        detail: {
          selector: 'button.a',
          path: 'div > button.a',
          classes: ['a'],
          context: 'Save',
          surface: { kind: 'page', label: 'Page' },
          rect: { x: 1, y: 2, width: 3, height: 4 },
        },
      })
    );
    document.dispatchEvent(
      new CustomEvent(EVENTS.ANNOTATION_ADD, {
        detail: { feedback: 'updated', existingId: 'abc' },
      })
    );
    await flushAsyncWork();
    expect(toolbarMock.updateAnnotation).toHaveBeenCalledWith('abc', 'updated');
    expect(overlayMock.setLockedHighlight).toHaveBeenCalledWith(null);
    expect(toolbarMock.setMode).toHaveBeenLastCalledWith('active-select');
    expect(overlayMock.setSelectionEnabled).toHaveBeenLastCalledWith(true);
    expect(overlayMock.unfreeze).toHaveBeenCalled();
  });

  it('annotationadd without existingId calls addAnnotation with canonical fields', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('uuid-1');
    vi.spyOn(Date, 'now').mockReturnValue(123);
    await activate();
    document.dispatchEvent(
      new CustomEvent(EVENTS.ELEMENT_CLICK, {
        detail: {
          selector: 'button.a',
          path: 'div > button.a',
          classes: ['a'],
          context: 'Save',
          surface: { kind: 'page', label: 'Page' },
          rect: { x: 1, y: 2, width: 3, height: 4 },
        },
      })
    );
    document.dispatchEvent(
      new CustomEvent(EVENTS.ANNOTATION_ADD, {
        detail: { feedback: 'new item', existingId: null },
      })
    );
    await flushAsyncWork();
    expect(toolbarMock.addAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'uuid-1',
        selector: 'button.a',
        path: 'div > button.a',
        classes: ['a'],
        context: 'Save',
        surface: { kind: 'page', label: 'Page' },
        feedback: 'new item',
        status: 'active',
        createdAt: 123,
      })
    );
    expect(overlayMock.setLockedHighlight).toHaveBeenCalledWith(null);
  });

  it('opens review mode when requested by the toolbar', async () => {
    await activate();

    document.dispatchEvent(new CustomEvent(EVENTS.OPEN_REVIEW));

    expect(toolbarMock.setMode).toHaveBeenCalledWith('active-review');
    expect(overlayMock.setSelectionEnabled).toHaveBeenCalledWith(false);
    expect(overlayMock.freeze).toHaveBeenCalled();
  });

  it('restores active-select mode when popup is cancelled', async () => {
    await activate();

    document.dispatchEvent(new CustomEvent(EVENTS.ANNOTATION_CANCEL));

    expect(toolbarMock.setMode).toHaveBeenCalledWith('active-select');
    expect(overlayMock.setSelectionEnabled).toHaveBeenCalledWith(true);
  });

  it('enters active-select mode when Option+V is pressed', async () => {
    await activate();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '√', code: 'KeyV', altKey: true, bubbles: true })
    );

    expect(toolbarMock.setMode).toHaveBeenCalledWith('active-select');
    expect(overlayMock.setSelectionEnabled).toHaveBeenCalledWith(true);
    expect(overlayMock.unfreeze).toHaveBeenCalled();
  });

  it('returns to inactive when Option+V is pressed from active-select mode', async () => {
    await activate();
    document.dispatchEvent(
      new CustomEvent(EVENTS.MODE_CHANGE, { detail: { mode: 'active-select' } })
    );
    vi.clearAllMocks();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '√', code: 'KeyV', altKey: true, bubbles: true })
    );

    expect(toolbarMock.setMode).toHaveBeenCalledWith('inactive');
    expect(overlayMock.setSelectionEnabled).toHaveBeenCalledWith(false);
    expect(overlayMock.freeze).toHaveBeenCalled();
  });

  it('returns to active-select when Option+V is pressed from review mode', async () => {
    await activate();
    document.dispatchEvent(
      new CustomEvent(EVENTS.MODE_CHANGE, { detail: { mode: 'active-review' } })
    );
    vi.clearAllMocks();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '√', code: 'KeyV', altKey: true, bubbles: true })
    );

    expect(toolbarMock.setMode).toHaveBeenCalledWith('active-select');
    expect(overlayMock.setSelectionEnabled).toHaveBeenCalledWith(true);
    expect(overlayMock.unfreeze).toHaveBeenCalled();
  });

  it('ignores Option+V while typing in an input', async () => {
    await activate();
    vi.clearAllMocks();

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: '√', code: 'KeyV', altKey: true, bubbles: true })
    );

    expect(toolbarMock.setMode).not.toHaveBeenCalledWith('active-select');
    input.remove();
  });

  it('deactivate removes listeners and unmounts components', async () => {
    await activate();
    deactivate();
    expect(overlayMock.unmount).toHaveBeenCalled();
    expect(toolbarMock.unmount).toHaveBeenCalled();
    expect(popupMock.unmount).toHaveBeenCalled();
  });
});
