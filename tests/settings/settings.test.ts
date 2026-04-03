// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SETTINGS_KEY } from '../../src/constants';

function mountDom() {
  document.body.innerHTML = `
    <ul id="pattern-list"></ul>
    <form id="add-pattern-form">
      <input id="pattern-input" />
      <button type="submit">Add</button>
    </form>
    <p id="pattern-feedback"></p>
  `;
}

describe('settings URL patterns', () => {
  let settingsModule;

  beforeEach(async () => {
    vi.resetModules();
    mountDom();
    chrome.storage.sync.get.mockResolvedValue({ [SETTINGS_KEY]: [] });
    chrome.storage.sync.set.mockResolvedValue(undefined);
    chrome.permissions.request.mockResolvedValue(true);
    chrome.permissions.remove.mockResolvedValue(true);
    settingsModule = await import('../../src/settings/settings');
  });

  it('adds a valid pattern', async () => {
    chrome.storage.sync.get
      .mockResolvedValueOnce({ [SETTINGS_KEY]: [] })
      .mockResolvedValueOnce({ [SETTINGS_KEY]: [] })
      .mockResolvedValueOnce({ [SETTINGS_KEY]: ['https://*.mycompany.com/*'] });
    await settingsModule.addPattern('https://*.mycompany.com/*');
    expect(chrome.permissions.request).toHaveBeenCalledWith({
      origins: ['https://*.mycompany.com/*'],
    });
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      [SETTINGS_KEY]: ['https://*.mycompany.com/*'],
    });
    expect(document.getElementById('pattern-feedback')?.textContent).toContain(
      'Allowed https://*.mycompany.com/*'
    );
  });

  it('rejects invalid pattern and shows error', async () => {
    expect(settingsModule.isValidPattern('localhost:*')).toBe(false);
    const ok = await settingsModule.addPattern('localhost:*');
    expect(ok).toBe(false);
  });

  it('ignores duplicates', async () => {
    chrome.storage.sync.get.mockResolvedValue({ [SETTINGS_KEY]: ['https://*.mycompany.com/*'] });
    await settingsModule.addPattern('https://*.mycompany.com/*');
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  it('does not save when permission is denied', async () => {
    chrome.permissions.request.mockResolvedValue(false);
    const ok = await settingsModule.addPattern('https://app.mycompany.com/*');
    expect(ok).toBe(false);
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  it('removes existing pattern', async () => {
    chrome.storage.sync.get
      .mockResolvedValueOnce({ [SETTINGS_KEY]: ['https://*.mycompany.com/*'] })
      .mockResolvedValueOnce({ [SETTINGS_KEY]: ['https://*.mycompany.com/*'] })
      .mockResolvedValueOnce({ [SETTINGS_KEY]: ['https://*.mycompany.com/*'] })
      .mockResolvedValueOnce({ [SETTINGS_KEY]: [] });
    await settingsModule.removePattern(0);
    expect(chrome.permissions.remove).toHaveBeenCalledWith({
      origins: ['https://*.mycompany.com/*'],
    });
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ [SETTINGS_KEY]: [] });
    expect(document.getElementById('pattern-feedback')?.textContent).toContain(
      'Removed persistent access'
    );
  });
});
