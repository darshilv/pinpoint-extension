import type { Annotation, PinpointMode } from '../types';
import { PPT_PREFIX } from './constants';

export type ToolbarTheme = 'light' | 'dark';
export type ReviewTab = 'active' | 'history';

export interface HistoryGroup {
  copiedAt: number;
  annotations: Annotation[];
}

export interface ToolbarViewState {
  active: Annotation[];
  historyGroups: HistoryGroup[];
  historyCount: number;
  hasAttention: boolean;
  reviewOpen: boolean;
  selecting: boolean;
  anchorActive: boolean;
  helpOpen: boolean;
  isCopySuccessVisible: boolean;
  hasActiveAnnotations: boolean;
  showCollapsedCopy: boolean;
  showExpandedCopy: boolean;
  shouldDisableExpandedCopy: boolean;
  copyOneFeedbackId: string | null;
  mode: PinpointMode;
  tab: ReviewTab;
  theme: ToolbarTheme;
}

function globalCopyIcon(isCopySuccessVisible: boolean): string {
  return isCopySuccessVisible
    ? `
      <svg class="${PPT_PREFIX}toolbar-header-button-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 8.2 6.4 11l6.1-6.4" />
      </svg>
    `
    : `
      <svg class="${PPT_PREFIX}toolbar-header-button-icon" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="5.2" y="3.2" width="7.3" height="9.3" rx="1.6" />
        <path d="M9.8 3.2V2.5a1 1 0 0 0-1-1H3.5a1 1 0 0 0-1 1v7.3a1 1 0 0 0 1 1h.7" />
      </svg>
    `;
}

function reviewIcon(): string {
  return `
    <svg class="${PPT_PREFIX}anchor-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 5.5h10M5 10h10M5 14.5h6" />
    </svg>
  `;
}

function helpIcon(): string {
  return `
    <svg class="${PPT_PREFIX}anchor-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7.5 7.2a2.6 2.6 0 0 1 5 1c0 1.8-2.5 2.2-2.5 4" />
      <path d="M10 14.9h.01" />
    </svg>
  `;
}

function themeIcon(theme: ToolbarTheme): string {
  return theme === 'dark'
    ? `
        <svg class="${PPT_PREFIX}theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path class="${PPT_PREFIX}theme-toggle-moon" d="M15.5 4.5a7.5 7.5 0 1 0 4 13.85A8.5 8.5 0 1 1 15.5 4.5z" />
        </svg>
      `
    : `
        <svg class="${PPT_PREFIX}theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle class="${PPT_PREFIX}theme-toggle-sun-ring" cx="12" cy="12" r="5.25" />
          <path class="${PPT_PREFIX}theme-toggle-sun-rays" d="M12 3.25v2.1M12 18.65v2.1M3.25 12h2.1M18.65 12h2.1M5.82 5.82l1.49 1.49M16.69 16.69l1.49 1.49M5.82 18.18l1.49-1.49M16.69 7.31l1.49-1.49" />
        </svg>
      `;
}

function anchorButtonLabel(mode: PinpointMode): string {
  return mode === 'inactive' ? 'Activate Pinpoint' : 'Deactivate Pinpoint';
}

function anchorButtonState(mode: PinpointMode): 'inactive' | 'active' | 'review' {
  if (mode === 'inactive') return 'inactive';
  if (mode === 'active-review') return 'review';
  return 'active';
}

function renderAnnotationItems(
  annotations: Annotation[],
  activeNumberById: Map<string, number>,
  copyOneFeedbackId: string | null
): string {
  return annotations
    .map((annotation) => {
      const showCopyOneFeedback = copyOneFeedbackId === annotation.id;
      const copyOneIcon = showCopyOneFeedback
        ? `
          <svg class="${PPT_PREFIX}toolbar-header-button-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 8.2 6.4 11l6.1-6.4" />
          </svg>
        `
        : '';

      return `
      <li class="${PPT_PREFIX}annotation-item" data-id="${annotation.id}">
        <div class="${PPT_PREFIX}item-meta">
          <span class="${PPT_PREFIX}item-element">${annotation.selector}</span>
          <div class="${PPT_PREFIX}item-meta-badges">
            ${
              annotation.status === 'active'
                ? `<span class="${PPT_PREFIX}item-note-number">Note ${activeNumberById.get(annotation.id)}</span>`
                : ''
            }
            ${annotation.status === 'active' ? `<span class="${PPT_PREFIX}item-badge">Open</span>` : ''}
          </div>
        </div>
        ${
          annotation.surface && annotation.surface.kind !== 'page'
            ? `
          <div class="${PPT_PREFIX}item-surface-row">
            <span class="${PPT_PREFIX}item-surface ${annotation.surface.kind === 'dialog' ? `${PPT_PREFIX}item-surface--dialog` : ''}">${annotation.surface.label}</span>
          </div>
        `
            : ''
        }
        <span class="${PPT_PREFIX}item-comment">${annotation.feedback}</span>
        <span class="${PPT_PREFIX}item-context">${annotation.context || annotation.path}</span>
        <div class="${PPT_PREFIX}item-actions">
          ${
            annotation.status === 'active'
              ? `<button class="${PPT_PREFIX}copy-one" data-id="${annotation.id}">Copy</button>`
              : `<button class="${PPT_PREFIX}copy-one ${showCopyOneFeedback ? `${PPT_PREFIX}copy-one--success` : ''}" data-id="${annotation.id}">${copyOneIcon}<span>${showCopyOneFeedback ? 'Copied' : 'Copy again'}</span></button>`
          }
        </div>
      </li>
    `;
    })
    .join('');
}

export function getToolbarClassName(state: ToolbarViewState): string {
  return [
    `${PPT_PREFIX}toolbar`,
    `${PPT_PREFIX}theme-${state.theme}`,
    state.anchorActive ? `${PPT_PREFIX}toolbar--active` : `${PPT_PREFIX}toolbar--inactive`,
    state.selecting ? `${PPT_PREFIX}toolbar--selecting` : '',
    state.reviewOpen ? `${PPT_PREFIX}toolbar--review-open` : '',
    state.helpOpen ? `${PPT_PREFIX}toolbar--help-open` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function renderToolbar(state: ToolbarViewState, formatHistoryTimestamp: (timestamp: number) => string): string {
  const activeNumberById = new Map(state.active.map((annotation, index) => [annotation.id, index + 1]));
  const copyIcon = globalCopyIcon(state.isCopySuccessVisible);
  const globalCopyTitle = state.hasActiveAnnotations ? 'Copy active annotations' : 'Nothing to copy';

  return `
      <div class="${PPT_PREFIX}anchor-shell ${state.anchorActive || state.hasAttention ? `${PPT_PREFIX}anchor-shell--active` : ''}">
        ${
          state.showCollapsedCopy
            ? `
          <button class="${PPT_PREFIX}anchor-copy ${PPT_PREFIX}anchor-copy--collapsed ${state.isCopySuccessVisible ? `${PPT_PREFIX}anchor-copy--success` : ''}" type="button" aria-label="${globalCopyTitle}" title="${globalCopyTitle}">
            ${copyIcon}
            ${state.hasActiveAnnotations ? `<span class="${PPT_PREFIX}anchor-copy-badge">${state.active.length}</span>` : ''}
          </button>
        `
            : ''
        }
        ${
          state.anchorActive
            ? `
          <div class="${PPT_PREFIX}anchor-actions" aria-label="Pinpoint actions">
            ${
              state.showExpandedCopy
                ? `
              <button class="${PPT_PREFIX}anchor-copy ${PPT_PREFIX}anchor-copy--expanded ${state.isCopySuccessVisible ? `${PPT_PREFIX}anchor-copy--success` : ''}" type="button" aria-label="${globalCopyTitle}" title="${globalCopyTitle}" ${state.shouldDisableExpandedCopy ? 'disabled' : ''}>
                ${copyIcon}
                ${state.hasActiveAnnotations ? `<span class="${PPT_PREFIX}anchor-action-badge ${PPT_PREFIX}anchor-copy-badge">${state.active.length}</span>` : ''}
              </button>
            `
                : ''
            }
            <button class="${PPT_PREFIX}anchor-action ${PPT_PREFIX}anchor-action--icon ${state.reviewOpen ? `${PPT_PREFIX}anchor-action--selected` : ''}" type="button" aria-label="${state.reviewOpen ? 'Close review panel' : 'Open review panel'}" title="Review">
              ${reviewIcon()}
            </button>
            <button class="${PPT_PREFIX}anchor-action ${PPT_PREFIX}anchor-action--icon ${state.helpOpen ? `${PPT_PREFIX}anchor-action--selected` : ''}" type="button" aria-label="${state.helpOpen ? 'Close help panel' : 'Open help panel'}" title="Help">
              ${helpIcon()}
            </button>
            <button class="${PPT_PREFIX}theme-toggle" type="button" aria-label="Switch to ${state.theme === 'dark' ? 'light' : 'dark'} theme" title="${state.theme === 'dark' ? 'Dark theme' : 'Light theme'}">
              ${themeIcon(state.theme)}
            </button>
          </div>
        `
            : ''
        }
        <button class="${PPT_PREFIX}anchor-button" type="button" data-state="${anchorButtonState(state.mode)}" aria-label="${anchorButtonLabel(state.mode)}">
          <svg class="${PPT_PREFIX}anchor-button-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path class="${PPT_PREFIX}anchor-button-line ${PPT_PREFIX}anchor-button-line--top" d="M7 9h10" />
            <path class="${PPT_PREFIX}anchor-button-line ${PPT_PREFIX}anchor-button-line--bottom" d="M7 15h10" />
            <path class="${PPT_PREFIX}anchor-button-line ${PPT_PREFIX}anchor-button-line--vertical" d="M12 7v10" />
          </svg>
        </button>
        ${
          state.helpOpen
            ? `
          <div class="${PPT_PREFIX}help-panel" aria-label="Pinpoint shortcuts">
            <div class="${PPT_PREFIX}help-panel-header">
              <span class="${PPT_PREFIX}help-panel-title">Shortcuts</span>
              <span class="${PPT_PREFIX}help-panel-subtitle">Move faster without leaving the page.</span>
            </div>
            <ul class="${PPT_PREFIX}help-list">
              <li class="${PPT_PREFIX}help-item">
                <span class="${PPT_PREFIX}help-item-label">Toggle selection mode</span>
                <kbd class="${PPT_PREFIX}help-kbd">⌥V</kbd>
              </li>
              <li class="${PPT_PREFIX}help-item">
                <span class="${PPT_PREFIX}help-item-label">Leave review</span>
                <kbd class="${PPT_PREFIX}help-kbd">H</kbd>
              </li>
              <li class="${PPT_PREFIX}help-item">
                <span class="${PPT_PREFIX}help-item-label">Copy prompt</span>
                <kbd class="${PPT_PREFIX}help-kbd">C</kbd>
              </li>
              <li class="${PPT_PREFIX}help-item">
                <span class="${PPT_PREFIX}help-item-label">Clear active notes</span>
                <kbd class="${PPT_PREFIX}help-kbd">D</kbd>
              </li>
            </ul>
          </div>
        `
            : ''
        }
      </div>
      ${
        state.reviewOpen
          ? `
        <aside class="${PPT_PREFIX}review-panel" aria-label="Pinpoint review panel">
          <div class="${PPT_PREFIX}toolbar-header">
            <div class="${PPT_PREFIX}toolbar-brand">
              <h2 class="${PPT_PREFIX}toolbar-title">Pinpoint</h2>
              <p class="${PPT_PREFIX}toolbar-status">${state.active.length} active note${state.active.length === 1 ? '' : 's'}</p>
            </div>
            <div class="${PPT_PREFIX}toolbar-header-actions">
              <button class="${PPT_PREFIX}anchor-copy ${PPT_PREFIX}copy-all ${state.isCopySuccessVisible ? `${PPT_PREFIX}anchor-copy--success` : ''}" type="button" aria-label="${globalCopyTitle}" title="${globalCopyTitle}" ${state.shouldDisableExpandedCopy ? 'disabled' : ''}>
                ${copyIcon}
                ${state.hasActiveAnnotations ? `<span class="${PPT_PREFIX}anchor-copy-badge">${state.active.length}</span>` : ''}
              </button>
              <button class="${PPT_PREFIX}toolbar-header-button ${PPT_PREFIX}clear-active" ${state.active.length === 0 ? 'disabled' : ''}>Clear</button>
              <button class="${PPT_PREFIX}toolbar-header-button ${PPT_PREFIX}toolbar-minimize ${PPT_PREFIX}toolbar-header-button--icon" type="button" aria-label="Close review panel">×</button>
            </div>
          </div>
          <div class="${PPT_PREFIX}review-tabs" role="tablist" aria-label="Review sections">
            <button class="${PPT_PREFIX}review-tab ${state.tab === 'active' ? `${PPT_PREFIX}review-tab--active` : ''}" type="button" role="tab" aria-selected="${state.tab === 'active'}" data-tab="active">
              <span>Active</span>
              <span class="${PPT_PREFIX}section-count">${state.active.length}</span>
            </button>
            <button class="${PPT_PREFIX}review-tab ${state.tab === 'history' ? `${PPT_PREFIX}review-tab--active` : ''}" type="button" role="tab" aria-selected="${state.tab === 'history'}" data-tab="history">
              <span>History</span>
              <span class="${PPT_PREFIX}section-count">${state.historyCount}</span>
            </button>
          </div>
          <ul class="${PPT_PREFIX}list">
            ${
              state.tab === 'active'
                ? state.active.length === 0
                  ? `
              <li class="${PPT_PREFIX}empty">
                <div class="${PPT_PREFIX}empty-illustration"></div>
                <h3 class="${PPT_PREFIX}empty-title">Start collecting feedback</h3>
                <p class="${PPT_PREFIX}empty-body">Activate Pinpoint and click any element to add a note.</p>
              </li>
            `
                  : `
              <li class="${PPT_PREFIX}section">
                <div class="${PPT_PREFIX}section-header">
                  <span class="${PPT_PREFIX}section-title">Active</span>
                  <span class="${PPT_PREFIX}section-count">${state.active.length}</span>
                </div>
                <ul class="${PPT_PREFIX}section-list">
                  ${renderAnnotationItems(state.active, activeNumberById, state.copyOneFeedbackId)}
                </ul>
              </li>
            `
                : state.historyCount === 0
                  ? `
              <li class="${PPT_PREFIX}empty">
                <div class="${PPT_PREFIX}empty-illustration"></div>
                <h3 class="${PPT_PREFIX}empty-title">No copied history yet</h3>
                <p class="${PPT_PREFIX}empty-body">Copied notes will appear here in timestamped groups.</p>
              </li>
            `
                  : state.historyGroups
                      .map(
                        (group) => `
              <li class="${PPT_PREFIX}section ${PPT_PREFIX}history-group" data-copied-at="${group.copiedAt}">
                <div class="${PPT_PREFIX}section-header">
                  <div class="${PPT_PREFIX}section-header-copy">
                    <span class="${PPT_PREFIX}section-title">${formatHistoryTimestamp(group.copiedAt)}</span>
                    <span class="${PPT_PREFIX}section-subtitle">${group.annotations.length} annotation${group.annotations.length === 1 ? '' : 's'}</span>
                  </div>
                  <button class="${PPT_PREFIX}anchor-copy ${PPT_PREFIX}history-copy" type="button" aria-label="Copy this history group" title="Copy this history group">
                    ${copyIcon}
                    <span class="${PPT_PREFIX}anchor-copy-badge">${group.annotations.length}</span>
                  </button>
                </div>
                <ul class="${PPT_PREFIX}section-list">
                  ${renderAnnotationItems(group.annotations, activeNumberById, state.copyOneFeedbackId)}
                </ul>
              </li>
            `
                      )
                      .join('')
            }
          </ul>
        </aside>
      `
          : ''
      }
    `;
}
