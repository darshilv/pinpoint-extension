import { annotationsToMarkdown, annotationToMarkdown } from '../../src/utils/markdown.js'

const annotation = {
  id: '1',
  selector: 'button.primary',
  path: 'div#app > button.primary',
  classes: ['primary', 'large'],
  context: 'Save Changes',
  feedback: 'Change button color to blue',
  status: 'active',
}

describe('annotationToMarkdown', () => {
  it('includes selector as heading', () => {
    const md = annotationToMarkdown(annotation)
    expect(md).toContain('### button.primary')
  })

  it('includes element path', () => {
    const md = annotationToMarkdown(annotation)
    expect(md).toContain('`div#app > button.primary`')
  })

  it('includes context text', () => {
    const md = annotationToMarkdown(annotation)
    expect(md).toContain('"Save Changes"')
  })

  it('includes feedback', () => {
    const md = annotationToMarkdown(annotation)
    expect(md).toContain('Change button color to blue')
  })

  it('truncates context at 80 characters with ellipsis', () => {
    const a = { ...annotation, context: 'a'.repeat(100) }
    const md = annotationToMarkdown(a)
    expect(md).toContain('…')
    const contextLine = md.split('\n').find(l => l.startsWith('**Context:**'))
    expect(contextLine.length).toBeLessThan(100)
  })

  it('omits context line when context is empty', () => {
    const a = { ...annotation, context: '' }
    const md = annotationToMarkdown(a)
    expect(md).not.toContain('**Context:**')
  })
})

describe('annotationsToMarkdown', () => {
  it('returns empty string for empty array', () => {
    expect(annotationsToMarkdown([])).toBe('')
  })

  it('includes Pinpoint header', () => {
    const md = annotationsToMarkdown([annotation], 'https://example.com/page')
    expect(md).toContain('Pinpoint')
  })

  it('includes page URL', () => {
    const md = annotationsToMarkdown([annotation], 'https://example.com/page')
    expect(md).toContain('https://example.com/page')
  })

  it('includes annotation count', () => {
    const md = annotationsToMarkdown([annotation, annotation], 'https://example.com')
    expect(md).toContain('2')
  })

  it('renders all annotations', () => {
    const a2 = { ...annotation, id: '2', selector: 'input.search', feedback: 'Add placeholder' }
    const md = annotationsToMarkdown([annotation, a2], 'https://example.com')
    expect(md).toContain('button.primary')
    expect(md).toContain('input.search')
  })
})
