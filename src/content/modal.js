// Translation modal box: opened by the trigger icon (T-007), anchored to the
// selection rect on desktop. Below MOBILE_BREAKPOINT it renders as a bottom
// sheet with a drag handle instead (docs/REFERENCE-SNIPPETS.md §7).
//
// Kept chrome-API-free (labels are passed in) so it's standalone-testable,
// same pattern as trigger-icon.js.

import { getShadowRoot, isInsideHost } from './ui-host.js';
import { escapeHtml } from '../shared/dom.js';

// Everything except the Explain payload (T-025) renders via .textContent.
// The Explain block is the one place this module uses innerHTML — SPEC §5's
// payload has real structure (badges, examples, collapsible sections) that
// would be painful to build as ~50 createElement calls, so it's built as an
// HTML string with every dynamic value passed through escapeHtml() first.

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
  .modal-explain-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .modal-explain-btn:disabled:hover {
    background: #f7f7f8;
  }
  .modal-upsell-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 10px;
  }
  .modal-upsell-actions[hidden] {
    display: none;
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
  .modal-explain-body {
    margin-top: 10px;
    max-height: 320px;
    overflow-y: auto;
    font-size: 13px;
  }
  .modal-explain-body.is-loading,
  .modal-explain-body.is-error {
    color: #888;
  }
  .modal-explain-body.is-error {
    color: #b3261e;
  }
  .explain-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .explain-headword {
    font-weight: 600;
    font-size: 14px;
  }
  .explain-phonetic {
    margin-left: 6px;
    color: #777;
    font-size: 12px;
  }
  .badge {
    display: inline-block;
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 8px;
    background: #eee;
    color: #555;
    margin-left: 4px;
  }
  .badge-cefr {
    background: #e3ecfb;
    color: #1d4ed8;
  }
  .badge-sm {
    font-size: 10px;
  }
  .explain-block {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #eee;
  }
  .explain-label {
    font-weight: 600;
    color: #444;
    font-size: 12px;
    margin-bottom: 3px;
  }
  .explain-block.is-collapsible .explain-label {
    cursor: pointer;
    user-select: none;
  }
  .explain-toggle {
    color: #999;
    font-weight: normal;
  }
  .explain-block.is-collapsible[data-collapsed='1'] .explain-body-text {
    display: none;
  }
  .explain-def-src {
    color: #444;
  }
  .explain-def-tgt {
    color: #1a1a1a;
    margin-top: 2px;
  }
  .explain-example {
    margin-top: 6px;
  }
  .explain-example-src {
    color: #444;
  }
  .explain-example-tgt {
    color: #1a1a1a;
  }
  .explain-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .chip {
    background: #f3f3f4;
    border-radius: 10px;
    padding: 2px 8px;
    font-size: 12px;
    color: #444;
  }
  .explain-list {
    margin: 0;
    padding-left: 18px;
  }
  .muted {
    color: #888;
  }
`;

let box = null;
let sourceEl = null;
let targetEl = null;
let explainBtn = null;
let explainBody = null;
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
  explainBtn.hidden = true; // shown (enabled or disabled-with-hint) by main.js after a successful
  // translation, based on GET_CAPABILITIES' canExplain (T-026)

  explainBody = document.createElement('div');
  explainBody.className = 'modal-explain-body';
  explainBody.hidden = true;

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

  box.append(handle, closeBtn, sourceEl, targetEl, explainBtn, explainBody, upsellActions);
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
  resetExplainBody();
  upsellActions.hidden = true;
  position(rect);
}

/** Render a successful translation result. */
export function showResult(translatedText) {
  if (!targetEl) return;
  targetEl.textContent = translatedText || '';
  targetEl.className = 'modal-row modal-target';
  resetExplainBody();
  upsellActions.hidden = true;
}

/** Render a friendly error message in place of the result. */
export function showError(message) {
  if (!targetEl) return;
  targetEl.textContent = message;
  targetEl.className = 'modal-row modal-target is-error';
  resetExplainBody();
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
  resetExplainBody();

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

function resetExplainBody() {
  explainBody.hidden = true;
  explainBody.className = 'modal-explain-body';
  explainBody.innerHTML = '';
}

/**
 * Show the Explain button, enabled, after a successful translation on an
 * engine that supports it. main.js decides which of this or
 * showExplainDisabled() to call, based on GET_CAPABILITIES (T-026).
 * @param {string} label i18n "Explain" button text
 * @param {() => void} onClick
 */
export function showExplainButton(label, onClick) {
  if (!explainBtn) return;
  explainBtn.textContent = label;
  explainBtn.disabled = false;
  explainBtn.title = '';
  explainBtn.hidden = false;
  explainBtn.onclick = () => onClick();
}

/**
 * Show the Explain button in a disabled state with a hint (SPEC §4: "hide
 * or disable the Explain button with a hint to configure an LLM key" when
 * the active engine is on-device-only). Disabled rather than hidden so the
 * feature stays discoverable.
 * @param {string} label i18n "Explain" button text
 * @param {string} hint i18n tooltip explaining why it's disabled
 */
export function showExplainDisabled(label, hint) {
  if (!explainBtn) return;
  explainBtn.textContent = label;
  explainBtn.disabled = true;
  explainBtn.title = hint;
  explainBtn.hidden = false;
  explainBtn.onclick = null;
}

/** Loading state while the EXPLAIN request is in flight — disables the button so it can't double-fire. */
export function showExplainLoading(loadingLabel) {
  if (!explainBody) return;
  explainBtn.disabled = true;
  explainBody.className = 'modal-explain-body is-loading';
  explainBody.textContent = loadingLabel;
  explainBody.hidden = false;
}

/** Friendly error in place of the explain payload (e.g. explain_unsupported, network failure). */
export function showExplainError(message) {
  if (!explainBody) return;
  explainBtn.disabled = false;
  explainBody.className = 'modal-explain-body is-error';
  explainBody.textContent = message;
  explainBody.hidden = false;
}

/**
 * Render the SPEC §5 explain payload: headword + phonetic + POS/CEFR
 * badges, dual-language definitions, in-context meaning, graded examples,
 * and collapsible collocations/word-family/synonyms/antonyms/memory-tip.
 * Every dynamic value is escaped — this is the one place in this module
 * that uses innerHTML (see the file-header comment).
 * @param {string} headword the originally-selected phrase (already shown in sourceEl, repeated here as the Explain block's own heading)
 * @param {object} payload SPEC §5 shape from EXPLAIN — schemaVersion, phonetic, partOfSpeech, cefrLevel, definitionSrc, definitionTgt, context, examples[], collocations[], wordFamily[], synonyms[], antonyms[], memoryTip
 * @param {{collocationsLabel: string, wordFamilyLabel: string, synonymsLabel: string, antonymsLabel: string, memoryTipLabel: string, definitionLabel: string, examplesLabel: string, contextLabel: string}} sectionLabels i18n labels for each block (T-025 doesn't hardcode English)
 */
export function showExplainResult(headword, payload, sectionLabels) {
  if (!explainBody) return;
  explainBtn.disabled = false;

  const block = (body, opts = {}) =>
    body
      ? `<div class="explain-block${opts.collapsible ? ' is-collapsible' : ''}"${
          opts.collapsible ? ' data-collapsed="1"' : ''
        }>
           <div class="explain-label">${escapeHtml(opts.label || '')}${opts.collapsible ? ' <span class="explain-toggle">+</span>' : ''}</div>
           <div class="explain-body-text">${body}</div>
         </div>`
      : '';

  const head = `
    <div class="explain-head">
      <div>
        <span class="explain-headword">${escapeHtml(headword)}</span>
        ${payload.phonetic ? `<span class="explain-phonetic">${escapeHtml(payload.phonetic)}</span>` : ''}
      </div>
      <div>
        ${payload.partOfSpeech ? `<span class="badge">${escapeHtml(payload.partOfSpeech)}</span>` : ''}
        ${payload.cefrLevel && payload.cefrLevel !== 'unknown' ? `<span class="badge badge-cefr">${escapeHtml(payload.cefrLevel)}</span>` : ''}
      </div>
    </div>`;

  const definitions =
    payload.definitionSrc || payload.definitionTgt
      ? block(
          `${payload.definitionSrc ? `<div class="explain-def-src">${escapeHtml(payload.definitionSrc)}</div>` : ''}${
            payload.definitionTgt ? `<div class="explain-def-tgt">${escapeHtml(payload.definitionTgt)}</div>` : ''
          }`,
          { label: sectionLabels.definitionLabel },
        )
      : '';

  const context = payload.context ? block(escapeHtml(payload.context), { label: sectionLabels.contextLabel }) : '';

  const examples = payload.examples?.length
    ? block(
        payload.examples
          .map(
            (e) => `
          <div class="explain-example">
            ${e.level ? `<span class="badge badge-cefr badge-sm">${escapeHtml(e.level)}</span>` : ''}
            <div class="explain-example-src">${escapeHtml(e.src)}</div>
            <div class="explain-example-tgt">${escapeHtml(e.tgt)}</div>
          </div>`,
          )
          .join(''),
        { label: sectionLabels.examplesLabel },
      )
    : '';

  const collocations = payload.collocations?.length
    ? block(
        `<div class="explain-chips">${payload.collocations.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join('')}</div>`,
        { label: sectionLabels.collocationsLabel, collapsible: true },
      )
    : '';

  const wordFamily = payload.wordFamily?.length
    ? block(
        `<ul class="explain-list">${payload.wordFamily
          .map(
            (w) =>
              `<li><strong>${escapeHtml(w.word)}</strong>${w.pos ? ` <span class="muted">(${escapeHtml(w.pos)})</span>` : ''}${w.meaning ? ` — ${escapeHtml(w.meaning)}` : ''}</li>`,
          )
          .join('')}</ul>`,
        { label: sectionLabels.wordFamilyLabel, collapsible: true },
      )
    : '';

  const synonyms = payload.synonyms?.length
    ? block(
        `<ul class="explain-list">${payload.synonyms
          .map(
            (s) =>
              `<li><strong>${escapeHtml(s.word)}</strong>${s.note ? ` — <span class="muted">${escapeHtml(s.note)}</span>` : ''}</li>`,
          )
          .join('')}</ul>`,
        { label: sectionLabels.synonymsLabel, collapsible: true },
      )
    : '';

  const antonyms = payload.antonyms?.length
    ? block(
        `<div class="explain-chips">${payload.antonyms.map((a) => `<span class="chip">${escapeHtml(a)}</span>`).join('')}</div>`,
        { label: sectionLabels.antonymsLabel, collapsible: true },
      )
    : '';

  const memoryTip = payload.memoryTip
    ? block(escapeHtml(payload.memoryTip), { label: sectionLabels.memoryTipLabel, collapsible: true })
    : '';

  explainBody.className = 'modal-explain-body';
  explainBody.innerHTML = head + definitions + context + examples + collocations + wordFamily + synonyms + antonyms + memoryTip;
  explainBody.hidden = false;
  wireExplainCollapsibles();
}

/** Click-to-toggle for `.explain-block.is-collapsible` sections. */
function wireExplainCollapsibles() {
  explainBody.querySelectorAll('.explain-block.is-collapsible .explain-label').forEach((label) => {
    label.addEventListener('click', () => {
      const b = label.parentElement;
      const collapsed = b.dataset.collapsed === '1';
      b.dataset.collapsed = collapsed ? '0' : '1';
      const toggle = b.querySelector('.explain-toggle');
      if (toggle) toggle.textContent = collapsed ? '−' : '+';
    });
  });
}

export function hideModal() {
  if (box) box.classList.remove('visible');
}

export function isModalVisible() {
  return !!box && box.classList.contains('visible');
}
