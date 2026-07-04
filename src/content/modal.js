// Translation modal box: opened by the trigger icon (T-007), anchored to the
// selection rect on desktop. Below MOBILE_BREAKPOINT it renders as a bottom
// sheet with a drag handle instead (docs/REFERENCE-SNIPPETS.md §7).
//
// Kept chrome-API-free (labels are passed in) so it's standalone-testable,
// same pattern as trigger-icon.js.
//
// This file is the orchestrator: it owns the DOM tree (ensureBox()) and the
// public API main.js imports, but delegates each self-contained concern to
// its own file under modal/ — styles, speak buttons, Explain rendering,
// upsell buttons, drag-to-dismiss, resize, and positioning. Splitting these
// out (2026-07-04) followed several bugs this same file produced by mixing
// unrelated concerns (CSS overflow rules silently fighting the resize
// handles; the Explain body's own scroll cap fighting the shared scroll
// container) — each of those now lives in exactly one file.

import { getShadowRoot, isInsideHost } from './ui-host.js';
import { DISMISS_DRAG_THRESHOLD } from './modal/constants.js';
import { MODAL_CSS } from './modal/styles.js';
import { createSpeakButton, wireSpeakButton, stopActiveSpeechAndClearIndicators } from './modal/speak-button.js';
import {
  createExplainElements,
  hideExplainButton,
  resetExplainBody,
  showExplainButton,
  showExplainDisabled,
  showExplainLoading,
  showExplainError,
  showExplainResult as renderExplainResult,
} from './modal/explain-panel.js';
import { createUpsellElements, hideUpsell, renderUpsellButtons } from './modal/upsell-panel.js';
import { wireDragToDismiss } from './modal/drag-dismiss.js';
import { setSavedSize, onModalResize, applyPendingSavedSize, wireResize } from './modal/resize.js';
import { positionModal } from './modal/position.js';

// Pass-through — main.js's import path (`from './modal.js'`) is unchanged.
export { setSavedSize, onModalResize, showExplainButton, showExplainDisabled, showExplainLoading, showExplainError };

let box = null;
let contentEl = null;
let sourceEl = null;
let sourceTextEl = null;
let sourceSpeakBtn = null;
let targetEl = null;
let targetTextEl = null;
let targetSpeakBtn = null;
let upsellEls = null;

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

  const handle = document.createElement('div');
  handle.className = 'modal-handle';
  handle.setAttribute('aria-hidden', 'true'); // decorative drag affordance only

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', hideModal);

  sourceEl = document.createElement('div');
  sourceEl.className = 'modal-row modal-source';
  sourceTextEl = document.createElement('span');
  sourceTextEl.className = 'modal-row-text';
  sourceSpeakBtn = createSpeakButton();
  sourceEl.append(sourceTextEl, sourceSpeakBtn);

  targetEl = document.createElement('div');
  targetEl.className = 'modal-row modal-target';
  targetTextEl = document.createElement('span');
  targetTextEl.className = 'modal-row-text';
  targetSpeakBtn = createSpeakButton();
  targetEl.append(targetTextEl, targetSpeakBtn);

  const { explainBtn, explainBody } = createExplainElements();
  upsellEls = createUpsellElements();

  const resizeTop = document.createElement('div');
  resizeTop.className = 'modal-resize modal-resize-top';
  resizeTop.setAttribute('aria-hidden', 'true'); // mouse/touch-only affordance, no keyboard equivalent
  const resizeRight = document.createElement('div');
  resizeRight.className = 'modal-resize modal-resize-right';
  resizeRight.setAttribute('aria-hidden', 'true');
  const resizeBottom = document.createElement('div');
  resizeBottom.className = 'modal-resize modal-resize-bottom';
  resizeBottom.setAttribute('aria-hidden', 'true');
  const resizeLeft = document.createElement('div');
  resizeLeft.className = 'modal-resize modal-resize-left';
  resizeLeft.setAttribute('aria-hidden', 'true');

  contentEl = document.createElement('div');
  contentEl.className = 'modal-content';
  contentEl.append(handle, closeBtn, sourceEl, targetEl, explainBtn, explainBody, upsellEls.upsellActions);

  box.append(contentEl, resizeTop, resizeRight, resizeBottom, resizeLeft);
  shadow.appendChild(box);

  wireDragToDismiss(box, handle, { dismissThreshold: DISMISS_DRAG_THRESHOLD, onDismiss: hideModal });
  wireResize(box, contentEl, resizeTop, 'top');
  wireResize(box, contentEl, resizeRight, 'right');
  wireResize(box, contentEl, resizeBottom, 'bottom');
  wireResize(box, contentEl, resizeLeft, 'left');
  applyPendingSavedSize(box);

  document.addEventListener('mousedown', (e) => {
    if (isModalVisible() && !isInsideHost(e.target)) hideModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isModalVisible()) hideModal();
  });

  return box;
}

/**
 * Open the modal anchored to `rect`, showing `sourceText` and a loading state.
 * @param {string} sourceText
 * @param {DOMRect} rect selection bounding rect from the detector
 * @param {{closeLabel: string, loadingLabel: string, speakLabel?: string, onSpeakSource?: (text: string, onDone: () => void) => boolean, onStopSpeaking?: () => void}} labels
 *   onSpeakSource/onStopSpeaking are omitted entirely (not just falsy) when TTS isn't supported —
 *   same fail-closed convention as onUseOnDevice in showUpsell(). onSpeakSource must invoke
 *   onDone when playback finishes on its own (see modal/speak-button.js).
 */
export function showModal(sourceText, rect, { closeLabel, loadingLabel, speakLabel, onSpeakSource, onStopSpeaking }) {
  if (!rect) return;
  ensureBox();
  // The box is reused across translations (not recreated) — if the user
  // scrolled down while reading a previous long Explain payload, that
  // scroll position would otherwise carry over and make this fresh
  // translation look cut off at the top instead of starting from it.
  contentEl.scrollTop = 0;
  box.querySelector('.modal-close').setAttribute('aria-label', closeLabel);
  sourceTextEl.textContent = sourceText;
  if (onSpeakSource) {
    wireSpeakButton(box, sourceSpeakBtn, sourceText, speakLabel, onSpeakSource, onStopSpeaking);
  } else {
    sourceSpeakBtn.hidden = true;
  }
  targetTextEl.textContent = loadingLabel;
  targetEl.className = 'modal-row modal-target is-loading';
  targetSpeakBtn.hidden = true;
  hideExplainButton();
  resetExplainBody();
  hideUpsell(upsellEls);
  positionModal(box, contentEl, rect);
}

/**
 * Render a successful translation result.
 * @param {string} translatedText
 * @param {{speakLabel?: string, onSpeakTarget?: (text: string, onDone: () => void) => boolean, onStopSpeaking?: () => void}} [opts]
 *   Same omit-when-unsupported and onDone conventions as showModal's onSpeakSource.
 */
export function showResult(translatedText, { speakLabel, onSpeakTarget, onStopSpeaking } = {}) {
  if (!targetEl) return;
  targetTextEl.textContent = translatedText || '';
  targetEl.className = 'modal-row modal-target';
  if (onSpeakTarget && translatedText) {
    wireSpeakButton(box, targetSpeakBtn, translatedText, speakLabel, onSpeakTarget, onStopSpeaking);
  } else {
    targetSpeakBtn.hidden = true;
  }
  resetExplainBody();
  hideUpsell(upsellEls);
}

/** Render a friendly error message in place of the result. */
export function showError(message) {
  if (!targetEl) return;
  targetTextEl.textContent = message;
  targetEl.className = 'modal-row modal-target is-error';
  targetSpeakBtn.hidden = true;
  resetExplainBody();
  hideUpsell(upsellEls);
}

/**
 * Render the trial-quota-exhausted upsell in place of a plain error: a
 * headline message plus up to three actions. Callbacks (not chrome APIs)
 * are supplied by main.js so this module stays chrome-free (SPEC/CODING-
 * STANDARDS: content-script UI never touches chrome.* directly except
 * through main.js's message layer).
 * @param {string} message headline text (e.g. "today's free quota is used up")
 * @param {object} opts see modal/upsell-panel.js's renderUpsellButtons for the shape
 */
export function showUpsell(message, opts) {
  if (!targetEl) return;
  targetTextEl.textContent = message;
  targetEl.className = 'modal-row modal-target is-error';
  targetSpeakBtn.hidden = true;
  hideExplainButton();
  resetExplainBody();
  renderUpsellButtons(upsellEls, opts);
}

/**
 * Render the SPEC §5 explain payload — see modal/explain-render.js for the
 * HTML shape. Thin wrapper around explain-panel.js's own version purely to
 * add the scroll-to-top reset, which is this file's concern (contentEl is
 * private to modal.js), not explain-panel's.
 */
export function showExplainResult(headword, payload, sectionLabels) {
  // Same reasoning as showModal()'s reset: show the explanation starting
  // from its own top, not wherever the container happened to be scrolled.
  contentEl.scrollTop = 0;
  renderExplainResult(headword, payload, sectionLabels);
}

export function hideModal() {
  if (!box) return;
  box.classList.remove('visible');
  // Closing via Esc/outside-click/× doesn't go through main.js, so this
  // module has to remember how to stop speech itself rather than relying on
  // the caller to notice the modal closed. Clears the buttons' speaking
  // look too — it would otherwise still be lit on the next open.
  stopActiveSpeechAndClearIndicators(box);
}

export function isModalVisible() {
  return !!box && box.classList.contains('visible');
}
