import { MSG } from '../shared/messages.js';
import { onSelection } from './selection.js';
import { captureContext } from './context.js';
import { isInsideHost } from './ui-host.js';
import { showTriggerIcon, hideTriggerIcon, isTriggerIconVisible } from './trigger-icon.js';
import { showModal, showResult, showError } from './modal.js';

// Content script entry: selection → trigger icon → modal. Translation is
// requested for real over the message protocol (docs/ARCHITECTURE.md). The
// worker routes TRANSLATE through the engine registry (T-013), but no
// engines are registered yet (that's T-014/T-015/T-016..T-018), so today
// every click surfaces the registry's "no_engine_available" error in the
// modal — that's expected until those land.

console.log('[ai-translate:content] content script loaded on', location.origin);

chrome.runtime
  .sendMessage({ type: MSG.PING, payload: {} })
  .then((res) => {
    console.log('[ai-translate:content] PING response:', res);
  })
  .catch((e) => {
    // Worker may be waking up (MV3 service workers idle out — ARCHITECTURE.md
    // "Service worker lifetime gotcha"); no retry logic yet, just visibility.
    console.warn('[ai-translate:content] PING failed:', e?.message);
  });

async function translateSelection(text, context) {
  showModal(text, lastRect, {
    closeLabel: chrome.i18n.getMessage('modal_close_label'),
    loadingLabel: chrome.i18n.getMessage('modal_loading_text'),
  });
  try {
    // targetLang defaults to the browser's language until real settings
    // land in T-019.
    const res = await chrome.runtime.sendMessage({
      type: MSG.TRANSLATE,
      payload: { text, context, targetLang: navigator.language?.split('-')[0] || 'en' },
    });
    if (res?.ok) {
      showResult(res.data.translated);
    } else {
      // Until the T-021 error mapper lands, surface the raw error.message
      // (dev-facing, e.g. "unhandled message type: TRANSLATE") rather than
      // hiding it — it's the honest current state of the wiring.
      showError(res?.error?.message || chrome.i18n.getMessage('modal_error_generic'));
    }
  } catch (e) {
    showError(e?.message || chrome.i18n.getMessage('modal_error_generic'));
  }
}

let lastRect = null;

onSelection((text, rect) => {
  // Selections made inside our own UI must never trigger the icon.
  if (isInsideHost(window.getSelection()?.anchorNode)) return;
  if (!rect) return;
  lastRect = rect;
  // Captured now, while the selection is still live — by the time the icon
  // is clicked the trigger's mousedown-preventDefault keeps it alive, but
  // there's no guarantee once translateSelection is mid-flight.
  const context = captureContext(text);
  showTriggerIcon(rect, {
    label: chrome.i18n.getMessage('modal_trigger_label'),
    onClick: () => translateSelection(text, context),
  });
});

// The icon follows the selection: gone when the selection collapses, gone on
// scroll (its viewport anchor is stale the moment the page moves). The modal
// stays open independently — it has its own dismissal (Esc / outside / ×).
document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if ((!sel || sel.isCollapsed) && isTriggerIconVisible()) hideTriggerIcon();
});
document.addEventListener('scroll', () => hideTriggerIcon(), { capture: true, passive: true });
