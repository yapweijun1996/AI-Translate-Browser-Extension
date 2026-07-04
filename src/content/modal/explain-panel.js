// The Explain button + its expandable body — owns explainBtn/explainBody as
// its own module state (created once via createExplainElements(), then
// every exported function operates on those same refs). modal.js never
// reaches into these elements directly; it only calls this module's
// lifecycle functions, so there's exactly one place that knows what state
// the Explain UI can be in.

import { renderExplainHtml } from './explain-render.js';

let explainBtn = null;
let explainBody = null;

/** Create the Explain button + body once; modal.js appends the returned elements into the DOM tree. */
export function createExplainElements() {
  explainBtn = document.createElement('button');
  explainBtn.type = 'button';
  explainBtn.className = 'modal-explain-btn';
  explainBtn.hidden = true; // shown (enabled or disabled-with-hint) by main.js after a successful
  // translation, based on GET_CAPABILITIES' canExplain (T-026)

  explainBody = document.createElement('div');
  explainBody.className = 'modal-explain-body';
  explainBody.hidden = true;

  return { explainBtn, explainBody };
}

/** Hide the Explain button outright — used when a new translation starts or the upsell shows. */
export function hideExplainButton() {
  explainBtn.hidden = true;
}

export function resetExplainBody() {
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
 * Render the Explain payload (see explain-render.js for the HTML shape).
 * @param {string} headword
 * @param {object} payload
 * @param {object} sectionLabels
 */
export function showExplainResult(headword, payload, sectionLabels) {
  if (!explainBody) return;
  explainBtn.disabled = false;
  explainBody.className = 'modal-explain-body';
  explainBody.innerHTML = renderExplainHtml(headword, payload, sectionLabels);
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
