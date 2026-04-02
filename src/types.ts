export type AnnotationStatus = 'active' | 'resolved'
export type PinpointMode = 'inactive' | 'active-select' | 'active-review'

export interface AnnotationRect {
  x: number
  y: number
  width: number
  height: number
}

export interface AnnotationSurface {
  kind: 'dialog' | 'page'
  label: string
}

export interface AnnotationMarker {
  id: string
  number: number
  rect: AnnotationRect
  surface?: AnnotationSurface
}

export interface Annotation {
  id: string
  selector: string
  path: string
  classes: string[]
  context: string
  surface?: AnnotationSurface
  feedback: string
  status: AnnotationStatus
  rect?: AnnotationRect
  createdAt?: number
  url?: string
}

export interface ElementClickDetail {
  element: Element
  rect: AnnotationRect
  selector: string
  path: string
  classes: string[]
  context: string
  surface: AnnotationSurface
}
