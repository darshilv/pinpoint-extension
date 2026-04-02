import { Overlay } from './Overlay'
import { Toolbar } from './Toolbar'
import { Popup } from './Popup'
import { EVENTS, MSG } from './constants'
import type { Annotation, ElementClickDetail, PinpointMode } from '../types'
import './content.css'

let overlay: Overlay | null = null
let toolbar: Toolbar | null = null
let popup: Popup | null = null
let pendingElementData: Omit<Annotation, 'id' | 'feedback' | 'status' | 'createdAt'> | null = null
let mode: PinpointMode = 'inactive'

function syncAnnotationMarkers(): void {
  if (!overlay || !toolbar) return
  const markers = toolbar.getActiveAnnotations().map((annotation, index) => ({
    id: annotation.id,
    number: index + 1,
    rect: annotation.rect ?? { x: 0, y: 0, width: 0, height: 0 },
    surface: annotation.surface,
  }))
  overlay.setAnnotationMarkers(markers)
}

function setMode(nextMode: PinpointMode): void {
  mode = nextMode
  toolbar?.setMode(nextMode)
  overlay?.setSelectionEnabled(nextMode === 'active-select')
  if (nextMode !== 'active-select') overlay?.freeze()
  if (nextMode === 'active-select') overlay?.unfreeze()
}

function handleElementClick(e: Event): void {
  if (!overlay || !toolbar || !popup) return
  const detail = (e as CustomEvent<ElementClickDetail>).detail
  const existing = toolbar.getAnnotationByPath(detail.path)
  const active = toolbar.getActiveAnnotations()
  const existingIndex = existing ? active.findIndex(annotation => annotation.id === existing.id) : -1
  const noteNumber = existingIndex >= 0 ? existingIndex + 1 : active.length + 1
  pendingElementData = {
    selector: detail.selector,
    path: detail.path,
    classes: detail.classes,
    context: detail.context,
    surface: detail.surface,
    rect: detail.rect,
    url: window.location.href,
  }
  overlay.setLockedHighlight(detail.rect)
  overlay.freeze()
  popup.show(detail.rect, existing, {
    noteNumber,
    selectorPath: detail.path,
  })
}

async function handleAnnotationAdd(e: Event): Promise<void> {
  if (!overlay || !toolbar) return
  const { feedback, existingId } = (e as CustomEvent<{ feedback: string; existingId: string | null }>).detail

  if (existingId) {
    await toolbar.updateAnnotation(existingId, feedback)
  } else if (pendingElementData) {
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      feedback,
      ...pendingElementData,
      status: 'active',
      createdAt: Date.now(),
    }
    await toolbar.addAnnotation(annotation)
  }
  syncAnnotationMarkers()
  overlay.setLockedHighlight(null)
  pendingElementData = null
  setMode('active-select')
}

function handleAnnotationCancel(): void {
  overlay?.setLockedHighlight(null)
  pendingElementData = null
  setMode('active-select')
}

function handleModeChange(e: Event): void {
  const nextMode = (e as CustomEvent<{ mode: PinpointMode }>).detail.mode
  setMode(nextMode)
}

function handleOpenReview(): void {
  setMode('active-review')
}

function handleAnnotationsChange(): void {
  syncAnnotationMarkers()
}

export async function activate(): Promise<void> {
  if (overlay) return
  overlay = new Overlay()
  toolbar = new Toolbar()
  popup = new Popup()
  overlay.mount()
  await toolbar.mount()
  popup.mount()
  syncAnnotationMarkers()
  setMode('inactive')
  document.addEventListener(EVENTS.ELEMENT_CLICK, handleElementClick as EventListener)
  document.addEventListener(EVENTS.ANNOTATION_ADD, handleAnnotationAdd as EventListener)
  document.addEventListener(EVENTS.ANNOTATION_CANCEL, handleAnnotationCancel as EventListener)
  document.addEventListener(EVENTS.ANNOTATIONS_CHANGE, handleAnnotationsChange as EventListener)
  document.addEventListener(EVENTS.MODE_CHANGE, handleModeChange as EventListener)
  document.addEventListener(EVENTS.OPEN_REVIEW, handleOpenReview as EventListener)
}

export function deactivate(): void {
  if (!overlay || !toolbar || !popup) return
  document.removeEventListener(EVENTS.ELEMENT_CLICK, handleElementClick as EventListener)
  document.removeEventListener(EVENTS.ANNOTATION_ADD, handleAnnotationAdd as EventListener)
  document.removeEventListener(EVENTS.ANNOTATION_CANCEL, handleAnnotationCancel as EventListener)
  document.removeEventListener(EVENTS.ANNOTATIONS_CHANGE, handleAnnotationsChange as EventListener)
  document.removeEventListener(EVENTS.MODE_CHANGE, handleModeChange as EventListener)
  document.removeEventListener(EVENTS.OPEN_REVIEW, handleOpenReview as EventListener)
  popup.hide()
  overlay.unmount()
  toolbar.unmount()
  popup.unmount()
  overlay = null
  toolbar = null
  popup = null
  pendingElementData = null
  mode = 'inactive'
}

chrome.runtime.onMessage.addListener((msg: { type?: string }) => {
  if (msg.type === MSG.ACTIVATE) activate()
  if (msg.type === MSG.DEACTIVATE) deactivate()
})
