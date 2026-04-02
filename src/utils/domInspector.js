/**
 * Gets a CSS selector path for an element, crossing shadow DOM boundaries.
 */
export function getElementPath(target, maxDepth = 6) {
  const parts = []
  let el = target
  let depth = 0
  while (el && el !== document.body && depth < maxDepth) {
    let selector = el.tagName.toLowerCase()
    if (el.id) {
      selector += `#${el.id}`
    } else if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).slice(0, 2).join('.')
      if (classes) selector += `.${classes}`
    }
    parts.unshift(selector)
    const root = el.getRootNode()
    el = el.parentElement || (root instanceof ShadowRoot ? root.host : null)
    depth++
  }
  return parts.join(' > ')
}

/**
 * Returns a human-readable name and selector path for an element.
 */
export function identifyElement(target) {
  const tagName = target.tagName.toLowerCase()
  const id = target.id ? `#${target.id}` : ''
  const classes = getElementClasses(target)
  const firstClass = classes ? `.${classes.split(' ')[0]}` : ''
  const name = `${tagName}${id}${firstClass}`
  return { name, path: getElementPath(target) }
}

/**
 * Returns CSS class names from an element as a space-separated string.
 */
export function getElementClasses(target) {
  if (!target.className || typeof target.className !== 'string') return ''
  return target.className.trim().replace(/\s+/g, ' ')
}

/**
 * Gets nearby text content for annotation context.
 */
export function getNearbyText(element) {
  return (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120)
}
