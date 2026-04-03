import type { Annotation } from '../types';

const STORAGE_NAMESPACE = 'pinpoint';

function storageKey(pathname: string): string {
  return `${STORAGE_NAMESPACE}:${pathname}`;
}

export async function getAnnotations(pathname: string): Promise<Annotation[]> {
  const key = storageKey(pathname);
  const result = (await chrome.storage.local.get(key)) as Record<string, Annotation[] | undefined>;
  return result[key] ?? [];
}

export async function saveAnnotations(pathname: string, annotations: Annotation[]): Promise<void> {
  const key = storageKey(pathname);
  await chrome.storage.local.set({ [key]: annotations });
}

export async function clearAnnotations(pathname: string): Promise<void> {
  const key = storageKey(pathname);
  await chrome.storage.local.remove(key);
}
