export type AnnotationStatus = 'active' | 'resolved'

export interface AnnotationRect {
  x: number
  y: number
  width: number
  height: number
}

export interface Annotation {
  id: string
  selector: string
  path: string
  classes: string[]
  context: string
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
}
