// Translation modal box: opened by the trigger icon (T-007), anchored to the
// selection rect. Desktop positioning only — the mobile bottom-sheet variant
// is T-009 (see docs/REFERENCE-SNIPPETS.md §7 for both patterns).
//
// Kept chrome-API-free (labels are passed in) so it's standalone-testable,
// same pattern as trigger-icon.js.

import { getShadowRoot, isInsideHost } from './ui-host.js';

// This module renders all dynamic text via .textContent (never innerHTML),
// so no escaping helper is needed here — see shared/dom.js for when
// richer HTML rendering (Explain, T-025) requires escapeHtml().

const BOX_WIDTH = 340;
const EDGE_MARGIN = 12;
const GAP = 8;

const MODAL_CSS = `
  .modal {
    position: fixed;
    display: none;
    width: ${BOX_WIDTH}px;
    max-width: calc(100vw - ${EDGE_MARGIN * 2}px);
    background: #fff;
    color: #1a1a1a;
    border-radius: 10px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);
    padding: 14px 16px;
    font-size: 14px;
    line-height: 1.45;
  }
  .modal.visible {
    display: block;
  }
  .modal-close {
    position: absolute;
    top: 6px;
    right: 8px;
    border: none;
    background: none;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    color: #888;
    padding: 4px;
  }
  .modal-close:hover {
    color: #222;
  }
  .modal-row {
    margin-right: 20px;
  }
  .modal-source {
    color: #444;
    margin-bottom: 8px;
    word-break: break-word;
  }
  .modal-target {
    font-weight: 500;
    word-break: break-word;
    min-height: 1.4em;
  }
  .modal-target.is-loading {
    color: #888;
    font-weight: normal;
  }
  .modal-target.is-error {
    color: #b3261e;
    font-weight: normal;
  }
  .modal-explain-btn {
    margin-top: 10px;
    border: 1px solid #d0d0d0;
    background: #f7f7f8;
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 13px;
    cursor: pointer;
    color: #333;
  }
  .modal-explain-btn:hover {
    background: #efeff1;
  }
`;

let box = null;
let sourceEl = null;
let targetEl = null;
let explainBtn = null;

function ensureBox() {
  if (box) return box;
  const shadow = getShadowRoot();
  const style = document.createElement('style');
  style.textContent = MODAL_CSS;
  shadow.appendChild(style);

  box = document.createElement('div');
  box.className = 'modal';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-live', 'polite');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', hideModal);

  sourceEl = document.createElement('div');
  sourceEl.className = 'modal-row modal-source';

  targetEl = document.createElement('div');
  targetEl.className = 'modal-row modal-target';

  explainBtn = document.createElement('button');
  explainBtn.type = 'button';
  explainBtn.className = 'modal-explain-btn';
  explainBtn.hidden = true; // wired up in T-004 (Explain feature)

  box.append(closeBtn, sourceEl, targetEl, explainBtn);
  shadow.appendChild(box);

  document.addEventListener('mousedown', (e) => {
    if (isModalVisible() && !isInsideHost(e.target)) hideModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isModalVisible()) hideModal();
  });

  return box;
}

function position(rect) {
  // Measure with the box already in normal flow (visible, off in a corner)
  // so offsetWidth/offsetHeight reflect real content, then place it.
  box.style.left = '-9999px';
  box.style.top = '0px';
  box.classList.add('visible');
  const boxHeight = box.offsetHeight;
  const boxWidth = box.offsetWidth;

  let left = rect.left;
  if (left + boxWidth + EDGE_MARGIN > window.innerWidth) {
    left = window.innerWidth - boxWidth - EDGE_MARGIN;
  }
  if (left < EDGE_MARGIN) left = EDGE_MARGIN;

  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const flipUp = spaceBelow < boxHeight + GAP && spaceAbove > spaceBelow;
  const top = flipUp ? rect.top - boxHeight - GAP : rect.bottom + GAP;

  box.style.left = `${left}px`;
  box.style.top = `${Math.max(EDGE_MARGIN, top)}px`;
}

/**
 * Open the modal anchored to `rect`, showing `sourceText` and a loading state.
 * @param {string} sourceText
 * @param {DOMRect} rect selection bounding rect from the detector
 * @param {{closeLabel: string, loadingLabel: string}} labels
 */
export function showModal(sourceText, rect, { closeLabel, loadingLabel }) {
  if (!rect) return;
  ensureBox();
  box.querySelector('.modal-close').setAttribute('aria-label', closeLabel);
  sourceEl.textContent = sourceText;
  targetEl.textContent = loadingLabel;
  targetEl.className = 'modal-row modal-target is-loading';
  explainBtn.hidden = true;
  position(rect);
}

/** Render a successful translation result. */
export function showResult(translatedText) {
  if (!targetEl) return;
  targetEl.textContent = translatedText || '';
  targetEl.className = 'modal-row modal-target';
}

/** Render a friendly error message in place of the result. */
export function showError(message) {
  if (!targetEl) return;
  targetEl.textContent = message;
  targetEl.className = 'modal-row modal-target is-error';
}

export function hideModal() {
  if (box) box.classList.remove('visible');
}

export function isModalVisible() {
  return !!box && box.classList.contains('visible');
}
