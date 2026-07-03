// Translation modal box: opened by the trigger icon (T-007), anchored to the
// selection rect on desktop. Below MOBILE_BREAKPOINT it renders as a bottom
// sheet with a drag handle instead (docs/REFERENCE-SNIPPETS.md §7).
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
const MOBILE_BREAKPOINT = 640;
const DISMISS_DRAG_THRESHOLD = 80;

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
    transition: transform 0.2s ease;
  }
  .modal.visible {
    display: block;
  }
  .modal.is-sheet {
    width: auto;
    max-width: none;
    left: 0;
    right: 0;
    bottom: 0;
    top: auto;
    border-radius: 14px 14px 0 0;
    padding-top: 20px;
    padding-bottom: max(14px, env(safe-area-inset-bottom));
  }
  .modal-handle {
    display: none;
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: #d5d5d8;
    touch-action: none;
  }
  .modal.is-sheet .modal-handle {
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
  .modal-upsell-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 10px;
  }
  .modal-upsell-btn {
    border: 1px solid #d0d0d0;
    background: #f7f7f8;
    border-radius: 6px;
    padding: 7px 10px;
    font-size: 13px;
    cursor: pointer;
    color: #333;
    text-align: center;
  }
  .modal-upsell-btn:hover {
    background: #efeff1;
  }
  .modal-upsell-btn-primary {
    background: #2563eb;
    border-color: #2563eb;
    color: #fff;
  }
  .modal-upsell-btn-primary:hover {
    background: #1d4ed8;
  }
`;

let box = null;
let sourceEl = null;
let targetEl = null;
let explainBtn = null;
let upsellActions = null;
let upsellSettingsBtn = null;
let upsellOnDeviceBtn = null;
let upsellDismissBtn = null;

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

  targetEl = document.createElement('div');
  targetEl.className = 'modal-row modal-target';

  explainBtn = document.createElement('button');
  explainBtn.type = 'button';
  explainBtn.className = 'modal-explain-btn';
  explainBtn.hidden = true; // wired up in T-004 (Explain feature)

  // Trial-quota upsell (T-022): shown instead of a plain error when the
  // trial gateway's daily allowance runs out. Buttons are wired per-call in
  // showUpsell() since their behavior (open options / retry on-device /
  // dismiss) is supplied by main.js, not this chrome-API-free module.
  upsellActions = document.createElement('div');
  upsellActions.className = 'modal-upsell-actions';
  upsellActions.hidden = true;

  upsellSettingsBtn = document.createElement('button');
  upsellSettingsBtn.type = 'button';
  upsellSettingsBtn.className = 'modal-upsell-btn modal-upsell-btn-primary';

  upsellOnDeviceBtn = document.createElement('button');
  upsellOnDeviceBtn.type = 'button';
  upsellOnDeviceBtn.className = 'modal-upsell-btn';
  upsellOnDeviceBtn.hidden = true; // shown only when on-device is available

  upsellDismissBtn = document.createElement('button');
  upsellDismissBtn.type = 'button';
  upsellDismissBtn.className = 'modal-upsell-btn';

  upsellActions.append(upsellSettingsBtn, upsellOnDeviceBtn, upsellDismissBtn);

  box.append(handle, closeBtn, sourceEl, targetEl, explainBtn, upsellActions);
  shadow.appendChild(box);

  wireDragToDismiss(handle);

  document.addEventListener('mousedown', (e) => {
    if (isModalVisible() && !isInsideHost(e.target)) hideModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isModalVisible()) hideModal();
  });

  return box;
}

function isMobileViewport() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function position(rect) {
  // Any leftover drag transform from a previous open must not carry over.
  box.style.transform = '';

  if (isMobileViewport()) {
    box.classList.add('is-sheet');
    box.style.left = '';
    box.style.top = '';
    box.classList.add('visible');
    return;
  }
  box.classList.remove('is-sheet');

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
 * Drag-to-dismiss on the handle (bottom-sheet mode only — desktop simply
 * never triggers these gestures in practice, but the listeners are harmless
 * either way). Supports touch and mouse so it's testable on desktop too.
 */
function wireDragToDismiss(handle) {
  let startY = 0;
  let dy = 0;
  let dragging = false;

  const pointY = (e) => e.touches?.[0]?.clientY ?? e.clientY;

  const onStart = (e) => {
    dragging = true;
    startY = pointY(e);
    dy = 0;
    box.style.transition = 'none';
  };
  const onMove = (e) => {
    if (!dragging) return;
    dy = Math.max(0, pointY(e) - startY);
    box.style.transform = `translateY(${dy}px)`;
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    box.style.transition = '';
    if (dy > DISMISS_DRAG_THRESHOLD) {
      hideModal();
    } else {
      box.style.transform = '';
    }
  };

  handle.addEventListener('touchstart', onStart, { passive: true });
  handle.addEventListener('touchmove', onMove, { passive: true });
  handle.addEventListener('touchend', onEnd);
  handle.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
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
  upsellActions.hidden = true;
  position(rect);
}

/** Render a successful translation result. */
export function showResult(translatedText) {
  if (!targetEl) return;
  targetEl.textContent = translatedText || '';
  targetEl.className = 'modal-row modal-target';
  upsellActions.hidden = true;
}

/** Render a friendly error message in place of the result. */
export function showError(message) {
  if (!targetEl) return;
  targetEl.textContent = message;
  targetEl.className = 'modal-row modal-target is-error';
  upsellActions.hidden = true;
}

/**
 * Render the trial-quota-exhausted upsell in place of a plain error: a
 * headline message plus up to three actions. Callbacks (not chrome APIs)
 * are supplied by main.js so this module stays chrome-free (SPEC/CODING-
 * STANDARDS: content-script UI never touches chrome.* directly except
 * through main.js's message layer).
 * @param {string} message headline text (e.g. "today's free quota is used up")
 * @param {object} opts
 * @param {string} opts.settingsLabel
 * @param {string} opts.dismissLabel
 * @param {() => void} opts.onSettings
 * @param {() => void} opts.onDismiss
 * @param {string} [opts.onDeviceLabel] only needed when onUseOnDevice is provided
 * @param {() => void} [opts.onUseOnDevice] omit entirely to hide the on-device button
 */
export function showUpsell(message, { settingsLabel, dismissLabel, onSettings, onDismiss, onDeviceLabel, onUseOnDevice }) {
  if (!targetEl) return;
  targetEl.textContent = message;
  targetEl.className = 'modal-row modal-target is-error';
  explainBtn.hidden = true;

  upsellSettingsBtn.textContent = settingsLabel;
  upsellSettingsBtn.onclick = () => onSettings?.();

  upsellDismissBtn.textContent = dismissLabel;
  upsellDismissBtn.onclick = () => onDismiss?.();

  if (onUseOnDevice) {
    upsellOnDeviceBtn.textContent = onDeviceLabel;
    upsellOnDeviceBtn.hidden = false;
    upsellOnDeviceBtn.onclick = () => onUseOnDevice();
  } else {
    upsellOnDeviceBtn.hidden = true;
    upsellOnDeviceBtn.onclick = null;
  }

  upsellActions.hidden = false;
}

export function hideModal() {
  if (box) box.classList.remove('visible');
}

export function isModalVisible() {
  return !!box && box.classList.contains('visible');
}
