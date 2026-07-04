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
 * @param {object} sectionLabels also carries expandAllLabel/collapseAllLabel (main.js)
 * @param {{defaultExpanded?: boolean, onToggleAll?: (expanded: boolean) => void}} [opts]
 *   defaultExpanded: the user's saved starting state for collapsible sections.
 *   onToggleAll: called ONLY by the explicit toggle-all control, with the new
 *   aggregate state, so main.js can persist it as the future default —
 *   individual per-section clicks never call this (see wireExplainCollapsibles).
 */
export function showExplainResult(headword, payload, sectionLabels, opts = {}) {
  if (!explainBody) return;
  explainBtn.disabled = false;
  explainBody.className = 'modal-explain-body';
  explainBody.innerHTML = renderExplainHtml(headword, payload, sectionLabels, opts.defaultExpanded);
  explainBody.hidden = false;
  wireExplainCollapsibles(sectionLabels, opts.onToggleAll);
}

/**
 * Click-to-toggle for individual `.explain-block.is-collapsible` sections,
 * plus the "expand all/collapse all" control rendered above them (omitted
 * entirely by explain-render.js when there's nothing collapsible to toggle).
 * @param {{expandAllLabel: string, collapseAllLabel: string}} sectionLabels
 * @param {(expanded: boolean) => void} [onToggleAll]
 */
function wireExplainCollapsibles(sectionLabels, onToggleAll) {
  const blocks = explainBody.querySelectorAll('.explain-block.is-collapsible');
  const toggleAllEl = explainBody.querySelector('.explain-toggle-all');

  // Reflects individual clicks back onto the toggle-all control's label —
  // if the user has manually left even one section collapsed, the control
  // should still offer "expand all", not claim everything's already open.
  const syncToggleAllLabel = () => {
    if (!toggleAllEl) return;
    const allExpanded = [...blocks].every((b) => b.dataset.collapsed !== '1');
    toggleAllEl.dataset.expanded = allExpanded ? '1' : '0';
    toggleAllEl.textContent = allExpanded ? sectionLabels.collapseAllLabel : sectionLabels.expandAllLabel;
  };

  blocks.forEach((b) => {
    const label = b.querySelector('.explain-label');
    label.addEventListener('click', () => {
      const collapsed = b.dataset.collapsed === '1';
      b.dataset.collapsed = collapsed ? '0' : '1';
      const toggle = b.querySelector('.explain-toggle');
      if (toggle) toggle.textContent = collapsed ? '−' : '+';
      syncToggleAllLabel();
    });
  });

  toggleAllEl?.addEventListener('click', () => {
    // Any section still collapsed means "expand all" is the next action;
    // only when every section is already open does the control collapse
    // everything instead — the standard expand-all/collapse-all convention.
    const expandAll = [...blocks].some((b) => b.dataset.collapsed === '1');
    blocks.forEach((b) => {
      b.dataset.collapsed = expandAll ? '0' : '1';
      const toggle = b.querySelector('.explain-toggle');
      if (toggle) toggle.textContent = expandAll ? '−' : '+';
    });
    toggleAllEl.dataset.expanded = expandAll ? '1' : '0';
    toggleAllEl.textContent = expandAll ? sectionLabels.collapseAllLabel : sectionLabels.expandAllLabel;
    onToggleAll?.(expandAll);
  });
}
