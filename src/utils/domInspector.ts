/**
 * Gets a CSS selector path for an element, crossing shadow DOM boundaries.
 */
export function getElementPath(target: Element, maxDepth = 6): string {
  const parts: string[] = []
  let el: Element | null = target
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
export function identifyElement(target: Element): { name: string; path: string } {
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
export function getElementClasses(target: Element): string {
  const className = (target as HTMLElement | SVGElement).className
  if (typeof className !== 'string') return ''
  return className.trim().replace(/\s+/g, ' ')
}

/**
 * Gets nearby text content for annotation context.
 */
export function getNearbyText(element: Element): string {
  return (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120)
}
