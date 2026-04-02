import { MSG, SETTINGS_KEY } from '../constants'

const activeTabs = new Set<number>()
const manuallyDeactivatedTabs = new Set<number>()

chrome.action.onClicked.addListener(async (tab) => {
  if (typeof tab.id === 'number') await toggleTab(tab.id)
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-pinpoint') return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (typeof tab?.id === 'number') await toggleTab(tab.id)
})

chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return
  if (manuallyDeactivatedTabs.has(details.tabId)) return
  const tab = await chrome.tabs.get(details.tabId)
  const patterns = await getUrlPatterns()
  if (patterns.some((p) => matchesPattern(p, tab.url ?? ''))) {
    await activateTab(details.tabId)
  }
})

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === MSG.GET_STATE) {
    sendResponse({ active: activeTabs.has(sender.tab?.id ?? -1) })
  }
  return true
})

export async function toggleTab(tabId: number): Promise<void> {
  if (activeTabs.has(tabId)) {
    await deactivateTab(tabId, true)
  } else {
    manuallyDeactivatedTabs.delete(tabId)
    await activateTab(tabId)
  }
}

export async function activateTab(tabId: number): Promise<void> {
  activeTabs.add(tabId)
  await chrome.action.setBadgeText({ text: 'ON', tabId })
  await chrome.action.setBadgeBackgroundColor({ color: '#0070d2', tabId })
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  }).catch(() => {})
  await chrome.tabs.sendMessage(tabId, { type: MSG.ACTIVATE }).catch(() => {})
}

export async function deactivateTab(tabId: number, manual = false): Promise<void> {
  activeTabs.delete(tabId)
  if (manual) manuallyDeactivatedTabs.add(tabId)
  await chrome.action.setBadgeText({ text: '', tabId })
  await chrome.tabs.sendMessage(tabId, { type: MSG.DEACTIVATE }).catch(() => {})
}

export async function getUrlPatterns(): Promise<string[]> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY)
  return (result[SETTINGS_KEY] as string[] | undefined) ?? []
}

export function matchesPattern(pattern: string, url: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`).test(url)
}

export function __resetStateForTests(): void {
  activeTabs.clear()
  manuallyDeactivatedTabs.clear()
}
