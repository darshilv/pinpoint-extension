export const PPT_PREFIX = 'ppt-';

export const EVENTS = {
  ELEMENT_CLICK: 'pinpoint:elementclick',
  ANNOTATION_ADD: 'pinpoint:annotationadd',
  ANNOTATION_CANCEL: 'pinpoint:annotationcancel',
  ANNOTATIONS_CHANGE: 'pinpoint:annotationschange',
  MODE_CHANGE: 'pinpoint:modechange',
  OPEN_REVIEW: 'pinpoint:openreview',
} as const;

export const MSG = {
  ACTIVATE: 'PINPOINT_ACTIVATE',
  DEACTIVATE: 'PINPOINT_DEACTIVATE',
} as const;
