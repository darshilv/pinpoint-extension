// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MSG, SETTINGS_KEY } from '../../src/constants'

describe('service worker', () => {
  beforeEach(async () => {
    vi.resetModules()
    await import('../../src/background/service-worker')
  })

  it('icon click toggles on then off', async () => {
    const onClicked = chrome.action.onClicked.addListener.mock.calls[0][0]
    await onClicked({ id: 5 })
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'ON', tabId: 5 })
    expect(chrome.scripting.insertCSS).toHaveBeenCalledWith({
      target: { tabId: 5 },
      files: ['content.css'],
    })
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 5 },
      files: ['content.js'],
    })
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(5, { type: MSG.ACTIVATE })

    await onClicked({ id: 5 })
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '', tabId: 5 })
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(5, { type: MSG.DEACTIVATE })
  })

  it('hotkey toggles active tab', async () => {
    chrome.tabs.query.mockResolvedValue([{ id: 9 }])
    const onCommand = chrome.commands.onCommand.addListener.mock.calls[0][0]
    await onCommand('toggle-pinpoint')
    expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true })
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'ON', tabId: 9 })
  })

  it('manual deactivation blocks URL auto-reactivation, then manual reactivation clears override', async () => {
    const onClicked = chrome.action.onClicked.addListener.mock.calls[0][0]
    const onNav = chrome.webNavigation.onCompleted.addListener.mock.calls[0][0]

    chrome.storage.sync.get.mockResolvedValue({ [SETTINGS_KEY]: ['https://*.example.com/*'] })
    chrome.tabs.get.mockResolvedValue({ id: 7, url: 'https://app.example.com/home' })

    await onClicked({ id: 7 }) // on
    await onClicked({ id: 7 }) // off manually (override set)
    chrome.tabs.sendMessage.mockClear()

    await onNav({ frameId: 0, tabId: 7 })
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()

    await onClicked({ id: 7 }) // manual on clears override
    chrome.tabs.sendMessage.mockClear()
    await onNav({ frameId: 0, tabId: 7 })
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, { type: MSG.ACTIVATE })
  })

  it('matchesPattern performs full URL matching', async () => {
    const { matchesPattern } = await import('../../src/background/service-worker')
    expect(matchesPattern('https://*.mycompany.com/*', 'https://app.mycompany.com/x')).toBe(true)
    expect(matchesPattern('http://localhost:*/*', 'http://localhost:3000/page')).toBe(true)
    expect(matchesPattern('https://*.mycompany.com/*', 'http://app.mycompany.com/x')).toBe(false)
  })
})
