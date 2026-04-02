import { SETTINGS_KEY } from '../constants'
import './settings.css'

async function loadPatterns(): Promise<string[]> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY)
  return (result[SETTINGS_KEY] as string[] | undefined) ?? []
}

async function savePatterns(patterns: string[]): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: patterns })
}

function renderList(patterns: string[]): void {
  const list = document.getElementById('pattern-list') as HTMLUListElement
  list.textContent = ''
  if (patterns.length === 0) {
    const li = document.createElement('li')
    li.className = 'empty'
    li.textContent = 'No patterns added yet.'
    list.appendChild(li)
    return
  }
  patterns.forEach((p, i) => {
    const li = document.createElement('li')
    const code = document.createElement('code')
    code.textContent = p
    const btn = document.createElement('button')
    btn.className = 'remove-btn'
    btn.dataset.index = String(i)
    btn.textContent = 'Remove'
    btn.addEventListener('click', async (e) => {
      const idx = Number((e.currentTarget as HTMLButtonElement).dataset.index)
      await removePattern(idx)
    })
    li.append(code, btn)
    list.appendChild(li)
  })
}

export function isValidPattern(value: string): boolean {
  return /^https?:\/\/.+/.test(value)
}

export async function addPattern(value: string): Promise<boolean> {
  const trimmed = value.trim()
  if (!trimmed || !isValidPattern(trimmed)) return false
  const current = await loadPatterns()
  if (!current.includes(trimmed)) {
    await savePatterns([...current, trimmed])
  }
  renderList(await loadPatterns())
  return true
}

export async function removePattern(index: number): Promise<void> {
  const current = await loadPatterns()
  await savePatterns(current.filter((_, i) => i !== index))
  renderList(await loadPatterns())
}

document.getElementById('add-pattern-form')?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const input = document.getElementById('pattern-input') as HTMLInputElement
  const error = document.getElementById('pattern-error') as HTMLParagraphElement
  const value = input.value.trim()
  error.textContent = ''
  if (!value) return
  const ok = await addPattern(value)
  if (!ok) {
    error.textContent = 'Invalid pattern. Use full URL form, e.g. https://*.example.com/*'
    return
  }
  input.value = ''
})

loadPatterns().then(renderList)
