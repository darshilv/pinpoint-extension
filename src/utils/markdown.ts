import type { Annotation } from '../types';

/**
 * Converts an annotations array into structured markdown for AI coding agents.
 */
export function annotationsToMarkdown(
  annotations: Annotation[],
  url = window.location.href
): string {
  if (!annotations.length) return '';

  const lines = [
    '## Pinpoint — UI Feedback',
    `**Page:** ${url}`,
    `**Active annotations:** ${annotations.length}`,
    '',
  ];

  annotations.forEach((a, i) => {
    lines.push(`### Annotation ${i + 1}`);
    if (a.selector) lines.push(`**Element:** \`${a.selector}\``);
    if (a.path) lines.push(`**Path:** \`${a.path}\``);
    if (a.context)
      lines.push(`**Context:** "${a.context.slice(0, 80)}${a.context.length > 80 ? '…' : ''}"`);
    lines.push(`**Feedback:** ${a.feedback}`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Converts a single annotation to a standalone markdown block.
 */
export function annotationToMarkdown(a: Annotation): string {
  const lines: string[] = [];
  lines.push(`### ${a.selector}`);
  if (a.path) lines.push(`**Path:** \`${a.path}\``);
  if (a.context)
    lines.push(`**Context:** "${a.context.slice(0, 80)}${a.context.length > 80 ? '…' : ''}"`);
  lines.push(`**Feedback:** ${a.feedback}`);
  lines.push('');
  return lines.join('\n');
}
