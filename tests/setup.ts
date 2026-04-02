// @ts-nocheck
import { chrome } from './__mocks__/chrome'
import { beforeEach } from 'vitest'

global.chrome = chrome

// Reset storage state and mock call history before each test
beforeEach(() => {
  chrome.storage.local._reset()
  chrome.storage.session._reset()
  Object.values(chrome.storage).forEach((area) => {
    Object.values(area).forEach((fn) => fn.mock?.calls && fn.mockClear())
  })
  chrome.runtime.sendMessage.mockClear()
  chrome.tabs.sendMessage.mockClear()
  chrome.tabs.get?.mockClear?.()
  chrome.tabs.query?.mockClear?.()
  chrome.action.setBadgeText.mockClear()
  chrome.action.setBadgeBackgroundColor.mockClear()
  chrome.scripting.executeScript?.mockClear?.()
  chrome.action.onClicked.addListener.mockClear()
  chrome.commands.onCommand.addListener.mockClear()
  chrome.webNavigation.onCompleted.addListener.mockClear()
  chrome.runtime.onMessage.addListener.mockClear()
})
