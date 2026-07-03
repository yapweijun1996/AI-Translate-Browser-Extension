import { MSG } from '../shared/messages.js';
import { TARGET_LANG_STORAGE_KEY } from '../shared/languages.js';
import { onSelection } from './selection.js';
import { captureContext } from './context.js';
import { isInsideHost } from './ui-host.js';
import { showTriggerIcon, hideTriggerIcon, isTriggerIconVisible } from './trigger-icon.js';
import { showModal, showResult, showError, showUpsell, hideModal } from './modal.js';

// Content script entry: selection → trigger icon → modal. Translation is
// requested for real over the message protocol (docs/ARCHITECTURE.md) and
// routed through the engine registry (T-013). On trial_quota_exhausted
// (T-021's error mapper), the modal shows the BYOK upsell (T-022, SPEC §9)
// instead of a plain error.

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

async function getTargetLang() {
  // Settings-driven target language (T-019 options page), falling back to
  // the browser's own language if the user hasn't picked one.
  const stored = await chrome.storage.local.get(TARGET_LANG_STORAGE_KEY);
  return stored[TARGET_LANG_STORAGE_KEY] || navigator.language?.split('-')[0] || 'en';
}

function requestTranslate(text, context, targetLang, engineOverride) {
  return chrome.runtime.sendMessage({
    type: MSG.TRANSLATE,
    payload: { text, context, targetLang, engineOverride },
  });
}

/**
 * The trial gateway's free daily allowance ran out. Show the upsell instead
 * of a plain error (SPEC §4/§9): open Settings, try again tomorrow, or (if
 * the on-device engine happens to be available right now) translate this
 * one selection with it immediately as a free alternative.
 */
async function showTrialQuotaUpsell(text, context, targetLang) {
  let onDeviceAvailable = false;
  try {
    const listRes = await chrome.runtime.sendMessage({ type: MSG.LIST_ENGINES, payload: {} });
    onDeviceAvailable = !!listRes?.ok && listRes.data.engines.some((e) => e.id === 'on-device' && e.available);
  } catch {
    // If we can't even ask, just omit the on-device option — the other two
    // upsell actions (settings / dismiss) don't depend on this.
  }

  showUpsell(chrome.i18n.getMessage('error_trial_quota_exhausted'), {
    settingsLabel: chrome.i18n.getMessage('error_upsell_settings_button'),
    dismissLabel: chrome.i18n.getMessage('error_upsell_dismiss_button'),
    onSettings: () => chrome.runtime.openOptionsPage(),
    onDismiss: () => hideModal(),
    ...(onDeviceAvailable && {
      onDeviceLabel: chrome.i18n.getMessage('error_upsell_on_device_button'),
      onUseOnDevice: async () => {
        showModal(text, lastRect, {
          closeLabel: chrome.i18n.getMessage('modal_close_label'),
          loadingLabel: chrome.i18n.getMessage('modal_loading_text'),
        });
        const res = await requestTranslate(text, context, targetLang, 'on-device');
        if (res?.ok) {
          showResult(res.data.translated);
        } else {
          showError(res?.error?.message || chrome.i18n.getMessage('error_generic'));
        }
      },
    }),
  });
}

async function translateSelection(text, context) {
  showModal(text, lastRect, {
    closeLabel: chrome.i18n.getMessage('modal_close_label'),
    loadingLabel: chrome.i18n.getMessage('modal_loading_text'),
  });
  try {
    const targetLang = await getTargetLang();
    const res = await requestTranslate(text, context, targetLang);
    if (res?.ok) {
      showResult(res.data.translated);
    } else if (res?.error?.code === 'trial_quota_exhausted') {
      await showTrialQuotaUpsell(text, context, targetLang);
    } else {
      showError(res?.error?.message || chrome.i18n.getMessage('error_generic'));
    }
  } catch (e) {
    showError(e?.message || chrome.i18n.getMessage('error_generic'));
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
