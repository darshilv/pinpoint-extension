// @ts-nocheck
import { vi } from 'vitest'

function createStorageArea() {
  const data = {}
  return {
    get: vi.fn(async (keys) => {
      if (typeof keys === 'string') return { [keys]: data[keys] }
      if (Array.isArray(keys)) return Object.fromEntries(keys.map((k) => [k, data[k]]))
      return { ...data }
    }),
    set: vi.fn(async (items) => {
      Object.assign(data, items)
    }),
    remove: vi.fn(async (keys) => {
      const ks = Array.isArray(keys) ? keys : [keys]
      ks.forEach((k) => delete data[k])
    }),
    clear: vi.fn(async () => {
      Object.keys(data).forEach((k) => delete data[k])
    }),
    _reset() {
      Object.keys(data).forEach((k) => delete data[k])
    },
  }
}

export const chrome = {
  storage: {
    local: createStorageArea(),
    session: createStorageArea(),
    sync: createStorageArea(),
  },
  runtime: {
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    sendMessage: vi.fn(async () => {}),
    getURL: vi.fn((path) => `chrome-extension://test/${path}`),
  },
  permissions: {
    contains: vi.fn(async () => false),
    request: vi.fn(async () => true),
    remove: vi.fn(async () => true),
  },
  tabs: {
    query: vi.fn(async () => []),
    sendMessage: vi.fn(async () => {}),
    get: vi.fn(async () => ({})),
  },
  commands: {
    onCommand: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  webNavigation: {
    onCompleted: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  scripting: {
    insertCSS: vi.fn(async () => {}),
    executeScript: vi.fn(async () => {}),
  },
  action: {
    onClicked: { addListener: vi.fn(), removeListener: vi.fn() },
    setBadgeText: vi.fn(async () => {}),
    setBadgeBackgroundColor: vi.fn(async () => {}),
  },
}
