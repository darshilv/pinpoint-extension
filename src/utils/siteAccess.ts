export function normalizeSitePattern(value: string): string {
  return value.trim();
}

export function isValidSitePattern(value: string): boolean {
  return /^https?:\/\/(\*\.)?[^/*]+(?::\*)?(?:\/\*)$/.test(normalizeSitePattern(value));
}

export function originPatternFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return `${parsed.origin}/*`;
  } catch {
    return null;
  }
}

function isRequestableSiteUrl(url: string): boolean {
  return originPatternFromUrl(url) !== null;
}
