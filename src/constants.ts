// CSS class prefix for all Pinpoint-injected DOM elements.
// Used to exclude annotator elements from overlay hover/click detection.
export const PPT_PREFIX = 'ppt-'

// Custom event names dispatched on document
export const EVENTS = {
  ELEMENT_CLICK: 'pinpoint:elementclick',
  ANNOTATION_ADD: 'pinpoint:annotationadd',
  ANNOTATION_CANCEL: 'pinpoint:annotationcancel',
  MODE_CHANGE: 'pinpoint:modechange',
  OPEN_REVIEW: 'pinpoint:openreview',
} as const

// chrome.storage keys
export const STORAGE_NAMESPACE = 'pinpoint'
export const SETTINGS_KEY = 'pinpoint:settings'

// Messages between content script and service worker
export const MSG = {
  ACTIVATE: 'PINPOINT_ACTIVATE',
  DEACTIVATE: 'PINPOINT_DEACTIVATE',
  GET_STATE: 'PINPOINT_GET_STATE',
} as const
