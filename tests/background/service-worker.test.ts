// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MSG, SETTINGS_KEY } from '../../src/constants';

describe('service worker', () => {
  beforeEach(async () => {
    vi.resetModules();
    await import('../../src/background/service-worker');
  });

  it('icon click toggles on then off', async () => {
    const onClicked = chrome.action.onClicked.addListener.mock.calls[0][0];
    chrome.permissions.contains.mockResolvedValue(false);
    chrome.permissions.request.mockResolvedValue(true);
    chrome.storage.sync.get.mockResolvedValue({ [SETTINGS_KEY]: [] });
    await onClicked({ id: 5, url: 'https://app.example.com/workspace' });
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'ON', tabId: 5 });
    expect(chrome.scripting.insertCSS).toHaveBeenCalledWith({
      target: { tabId: 5 },
      files: ['content.css'],
    });
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 5 },
      files: ['content.js'],
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(5, { type: MSG.ACTIVATE });
    expect(chrome.permissions.request).toHaveBeenCalledWith({
      origins: ['https://app.example.com/*'],
    });
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      [SETTINGS_KEY]: ['https://app.example.com/*'],
    });

    await onClicked({ id: 5, url: 'https://app.example.com/workspace' });
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '', tabId: 5 });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(5, { type: MSG.DEACTIVATE });
  });

  it('manual deactivation blocks URL auto-reactivation, then manual reactivation clears override', async () => {
    const onClicked = chrome.action.onClicked.addListener.mock.calls[0][0];
    const onNav = chrome.webNavigation.onCompleted.addListener.mock.calls[0][0];

    chrome.storage.sync.get.mockResolvedValue({ [SETTINGS_KEY]: ['https://app.example.com/*'] });
    chrome.tabs.get.mockResolvedValue({ id: 7, url: 'https://app.example.com/home' });
    chrome.permissions.contains.mockResolvedValue(true);

    await onClicked({ id: 7, url: 'https://app.example.com/home' }); // on
    await onClicked({ id: 7, url: 'https://app.example.com/home' }); // off manually (override set)
    chrome.tabs.sendMessage.mockClear();

    await onNav({ frameId: 0, tabId: 7 });
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();

    await onClicked({ id: 7, url: 'https://app.example.com/home' }); // manual on clears override
    chrome.tabs.sendMessage.mockClear();
    await onNav({ frameId: 0, tabId: 7 });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, { type: MSG.ACTIVATE });
  });

  it('does not auto-activate without a stored permission grant', async () => {
    const onNav = chrome.webNavigation.onCompleted.addListener.mock.calls[0][0];
    chrome.storage.sync.get.mockResolvedValue({ [SETTINGS_KEY]: ['https://app.example.com/*'] });
    chrome.tabs.get.mockResolvedValue({ id: 7, url: 'https://app.example.com/home' });
    chrome.permissions.contains.mockResolvedValue(false);

    await onNav({ frameId: 0, tabId: 7 });
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('matchesPattern performs full URL matching', async () => {
    const { matchesPattern } = await import('../../src/background/service-worker');
    expect(matchesPattern('https://*.mycompany.com/*', 'https://app.mycompany.com/x')).toBe(true);
    expect(matchesPattern('http://localhost:*/*', 'http://localhost:3000/page')).toBe(true);
    expect(matchesPattern('https://*.mycompany.com/*', 'http://app.mycompany.com/x')).toBe(false);
  });
});
