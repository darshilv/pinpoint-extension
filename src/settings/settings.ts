import './settings.css';

import { SETTINGS_KEY } from '../constants';
import { isValidSitePattern, normalizeSitePattern } from '../utils/siteAccess';

type FeedbackTone = 'error' | 'success' | 'info';

async function loadPatterns(): Promise<string[]> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  return (result[SETTINGS_KEY] as string[] | undefined) ?? [];
}

async function savePatterns(patterns: string[]): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: patterns });
}

function setFeedback(message: string, tone: FeedbackTone = 'info'): void {
  const feedback = document.getElementById('pattern-feedback') as HTMLParagraphElement | null;
  if (!feedback) return;
  feedback.textContent = message;
  feedback.dataset.tone = tone;
}

function renderList(patterns: string[]): void {
  const list = document.getElementById('pattern-list') as HTMLUListElement;
  list.textContent = '';
  if (patterns.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No patterns added yet.';
    list.appendChild(li);
    return;
  }
  patterns.forEach((p, i) => {
    const li = document.createElement('li');
    const code = document.createElement('code');
    code.textContent = p;
    const btn = document.createElement('button');
    btn.className = 'remove-btn';
    btn.dataset.index = String(i);
    btn.textContent = 'Remove';
    btn.addEventListener('click', async (e) => {
      const idx = Number((e.currentTarget as HTMLButtonElement).dataset.index);
      await removePattern(idx);
    });
    li.append(code, btn);
    list.appendChild(li);
  });
}

export function isValidPattern(value: string): boolean {
  return isValidSitePattern(value);
}

export async function addPattern(value: string): Promise<boolean> {
  const trimmed = normalizeSitePattern(value);
  if (!trimmed || !isValidPattern(trimmed)) return false;
  const granted = await chrome.permissions.request({ origins: [trimmed] });
  if (!granted) return false;
  const current = await loadPatterns();
  if (!current.includes(trimmed)) {
    await savePatterns([...current, trimmed]);
    setFeedback(`Allowed ${trimmed} for persistent Pinpoint access.`, 'success');
  } else {
    setFeedback(`${trimmed} is already allowed.`, 'info');
  }
  renderList(await loadPatterns());
  return true;
}

export async function removePattern(index: number): Promise<void> {
  const current = await loadPatterns();
  const pattern = current[index];
  if (pattern) await chrome.permissions.remove({ origins: [pattern] });
  await savePatterns(current.filter((_, i) => i !== index));
  renderList(await loadPatterns());
  if (pattern) setFeedback(`Removed persistent access for ${pattern}.`, 'info');
}

document.getElementById('add-pattern-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('pattern-input') as HTMLInputElement;
  const value = input.value.trim();
  setFeedback('');
  if (!value) return;
  const ok = await addPattern(value);
  if (!ok) {
    if (!isValidPattern(value)) {
      setFeedback(
        'Enter a full site pattern like https://app.example.com/* or http://localhost:3000/*.',
        'error'
      );
      return;
    }
    setFeedback(
      'Chrome did not grant persistent access for that site. You can still use Pinpoint once from the toolbar on the current page.',
      'error'
    );
    return;
  }
  input.value = '';
});

loadPatterns().then((patterns) => {
  renderList(patterns);
  setFeedback(
    'Pinpoint uses one-time access by default. Only sites listed here have persistent access.',
    'info'
  );
});
