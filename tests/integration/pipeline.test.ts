// @ts-nocheck
import { getElementPath, identifyElement, getNearbyText } from '../../src/utils/domInspector'
import { annotationsToMarkdown } from '../../src/utils/markdown'

describe('click -> path -> markdown pipeline', () => {
  it('produces correct markdown for a clicked button', () => {
    const app = document.createElement('div')
    app.id = 'app'
    const btn = document.createElement('button')
    btn.className = 'save-btn primary'
    btn.textContent = 'Save Changes'
    app.appendChild(btn)
    document.body.appendChild(app)

    const { name, path } = identifyElement(btn)
    const nearbyText = getNearbyText(btn)
    const annotation = {
      id: '1',
      selector: name,
      path,
      classes: ['save-btn', 'primary'],
      context: nearbyText,
      feedback: 'Change to secondary style',
      status: 'active',
    }
    const md = annotationsToMarkdown([annotation], 'http://localhost:3000/')
    expect(md).toContain('button.save-btn')
    expect(md).toContain('div#app > button.save-btn')
    expect(md).toContain('Save Changes')
    expect(md).toContain('Change to secondary style')
    app.remove()
  })

  it('crosses shadow boundary in generated path', () => {
    const host = document.createElement('c-my-app')
    document.body.appendChild(host)
    const shadow = host.attachShadow({ mode: 'open' })
    const inner = document.createElement('div')
    inner.id = 'content'
    const btn = document.createElement('button')
    btn.className = 'submit-btn'
    inner.appendChild(btn)
    shadow.appendChild(inner)
    const path = getElementPath(btn)
    expect(path).toContain('c-my-app')
    expect(path).toContain('div#content')
    expect(path).toContain('button.submit-btn')
    host.remove()
  })

  it('generates path for an element inside a dialog', () => {
    const dialog = document.createElement('dialog')
    const btn = document.createElement('button')
    btn.className = 'confirm-btn'
    btn.textContent = 'Confirm'
    dialog.appendChild(btn)
    document.body.appendChild(dialog)
    if (typeof dialog.showModal === 'function') dialog.showModal()
    const path = getElementPath(btn)
    expect(path).toContain('button.confirm-btn')
    if (typeof dialog.close === 'function') dialog.close()
    dialog.remove()
  })
})
