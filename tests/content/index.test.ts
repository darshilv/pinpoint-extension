// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest'

const overlayMock = {
  mount: vi.fn(),
  unmount: vi.fn(),
  freeze: vi.fn(),
  unfreeze: vi.fn(),
}
const toolbarMock = {
  mount: vi.fn(async () => {}),
  unmount: vi.fn(),
  getAnnotationByPath: vi.fn(() => null),
  addAnnotation: vi.fn(async () => {}),
  updateAnnotation: vi.fn(async () => {}),
}
const popupMock = {
  mount: vi.fn(),
  unmount: vi.fn(),
  show: vi.fn(),
}

vi.mock('../../src/content/Overlay', () => ({ Overlay: vi.fn(() => overlayMock) }))
vi.mock('../../src/content/Toolbar', () => ({ Toolbar: vi.fn(() => toolbarMock) }))
vi.mock('../../src/content/Popup', () => ({ Popup: vi.fn(() => popupMock) }))
vi.mock('../../src/content/content.css', () => ({}))

import { EVENTS } from '../../src/constants'
import { activate, deactivate } from '../../src/content/index'

describe('content coordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deactivate()
  })

  it('elementclick freezes overlay and opens popup', async () => {
    toolbarMock.getAnnotationByPath.mockReturnValue({ id: 'existing', feedback: 'old' })
    await activate()
    const rect = { x: 1, y: 2, width: 3, height: 4 }
    document.dispatchEvent(new CustomEvent(EVENTS.ELEMENT_CLICK, {
      detail: { selector: 'button.a', path: 'div > button.a', classes: ['a'], context: 'Save', rect },
    }))
    expect(overlayMock.freeze).toHaveBeenCalled()
    expect(toolbarMock.getAnnotationByPath).toHaveBeenCalledWith('div > button.a')
    expect(popupMock.show).toHaveBeenCalledWith(rect, { id: 'existing', feedback: 'old' })
  })

  it('annotationadd with existingId calls updateAnnotation', async () => {
    await activate()
    document.dispatchEvent(new CustomEvent(EVENTS.ANNOTATION_ADD, {
      detail: { feedback: 'updated', existingId: 'abc' },
    }))
    await Promise.resolve()
    expect(toolbarMock.updateAnnotation).toHaveBeenCalledWith('abc', 'updated')
    expect(overlayMock.unfreeze).toHaveBeenCalled()
  })

  it('annotationadd without existingId calls addAnnotation with canonical fields', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('uuid-1')
    vi.spyOn(Date, 'now').mockReturnValue(123)
    await activate()
    document.dispatchEvent(new CustomEvent(EVENTS.ELEMENT_CLICK, {
      detail: {
        selector: 'button.a',
        path: 'div > button.a',
        classes: ['a'],
        context: 'Save',
        rect: { x: 1, y: 2, width: 3, height: 4 },
      },
    }))
    document.dispatchEvent(new CustomEvent(EVENTS.ANNOTATION_ADD, {
      detail: { feedback: 'new item', existingId: null },
    }))
    await Promise.resolve()
    expect(toolbarMock.addAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'uuid-1',
        selector: 'button.a',
        path: 'div > button.a',
        classes: ['a'],
        context: 'Save',
        feedback: 'new item',
        status: 'active',
        createdAt: 123,
      }),
    )
  })

  it('deactivate removes listeners and unmounts components', async () => {
    await activate()
    deactivate()
    expect(overlayMock.unmount).toHaveBeenCalled()
    expect(toolbarMock.unmount).toHaveBeenCalled()
    expect(popupMock.unmount).toHaveBeenCalled()
  })
})
