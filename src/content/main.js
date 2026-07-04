import { MSG } from '../shared/messages.js';
import { TARGET_LANG_STORAGE_KEY } from '../shared/languages.js';
import { onSelection } from './selection.js';
import { captureContext } from './context.js';
import { isInsideHost } from './ui-host.js';
import { showTriggerIcon, hideTriggerIcon, isTriggerIconVisible } from './trigger-icon.js';
import {
  showModal,
  showResult,
  showError,
  showUpsell,
  hideModal,
  showExplainButton,
  showExplainDisabled,
  showExplainLoading,
  showExplainResult,
  showExplainError,
  setSavedSize,
  onModalResize,
} from './modal.js';
import { isTtsSupported, speak, stopSpeaking } from './tts.js';
import { TTS_VOICES_STORAGE_KEY, TTS_AUTOPLAY_STORAGE_KEY } from '../shared/settings-keys.js';

// Only read/written here — a single-file setting, so it doesn't belong in
// shared/settings-keys.js (that file is for settings more than one
// unrelated context reads, e.g. the worker + options page).
const MODAL_SIZE_STORAGE_KEY = 'modalSize';

chrome.storage.local.get(MODAL_SIZE_STORAGE_KEY).then((stored) => {
  if (stored[MODAL_SIZE_STORAGE_KEY]) setSavedSize(stored[MODAL_SIZE_STORAGE_KEY]);
});
onModalResize((size) => {
  chrome.storage.local.set({ [MODAL_SIZE_STORAGE_KEY]: size });
});

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

/** The options page's per-target-language voice pick (T-034 TTS), or null if
 * the user never set one for `lang` — tts.js then falls back to the
 * browser's own default voice for that language. */
async function getTtsVoicePref(lang) {
  const stored = await chrome.storage.local.get(TTS_VOICES_STORAGE_KEY);
  return stored[TTS_VOICES_STORAGE_KEY]?.[lang] || null;
}

async function getTtsAutoplay() {
  const stored = await chrome.storage.local.get(TTS_AUTOPLAY_STORAGE_KEY);
  return !!stored[TTS_AUTOPLAY_STORAGE_KEY];
}

/**
 * Build the {speakLabel, onSpeakSource/onSpeakTarget, onStopSpeaking} option
 * bundle showModal()/showResult() expect — omitted entirely (not passed as
 * falsy) when TTS isn't supported, so modal.js's own hidden-by-default
 * button logic takes over with no extra branching here.
 * @param {'source'|'target'} which
 * @param {string} lang omit for source (unknown language — see tts.js)
 */
async function ttsButtonOpts(which, lang) {
  if (!isTtsSupported()) return {};
  const voicePref = lang ? await getTtsVoicePref(lang) : null;
  const key = which === 'source' ? 'onSpeakSource' : 'onSpeakTarget';
  return {
    speakLabel: chrome.i18n.getMessage(which === 'source' ? 'modal_speak_source_label' : 'modal_speak_target_label'),
    // onDone (from modal.js's wireSpeakButton) un-lights the button when the
    // utterance finishes on its own — wired to onError too, so a failed
    // utterance doesn't leave the button stuck in its speaking state either.
    [key]: (text, onDone) => speak(text, lang, voicePref, { onEnd: onDone, onError: onDone }),
    onStopSpeaking: () => stopSpeaking(),
  };
}

function requestTranslate(text, context, targetLang, engineOverride) {
  return chrome.runtime.sendMessage({
    type: MSG.TRANSLATE,
    payload: { text, context, targetLang, engineOverride },
  });
}

function requestExplain(phrase, context, targetLang) {
  return chrome.runtime.sendMessage({
    type: MSG.EXPLAIN,
    // origin scopes the explain cache per-site (T-026, SPEC §6) — computed
    // here since the service worker has no page context of its own.
    payload: { phrase, context, targetLang, origin: location.origin },
  });
}

/** i18n labels for showExplainResult()'s section headings — read fresh each
 * call rather than cached at module scope so a UI-language change (browser
 * restart) is always picked up. */
function explainSectionLabels() {
  return {
    definitionLabel: chrome.i18n.getMessage('explain_section_definition'),
    contextLabel: chrome.i18n.getMessage('explain_section_context'),
    examplesLabel: chrome.i18n.getMessage('explain_section_examples'),
    collocationsLabel: chrome.i18n.getMessage('explain_section_collocations'),
    wordFamilyLabel: chrome.i18n.getMessage('explain_section_word_family'),
    synonymsLabel: chrome.i18n.getMessage('explain_section_synonyms'),
    antonymsLabel: chrome.i18n.getMessage('explain_section_antonyms'),
    memoryTipLabel: chrome.i18n.getMessage('explain_section_memory_tip'),
  };
}

// Bumped at the start of every translateSelection() call; each call captures
// its own value and checks it again after every await before touching the
// modal. The modal is a single reused instance (module-level singleton in
// modal.js), not one per translation — nothing previously stopped an older,
// slower translation's response from landing (and rendering) after a newer
// selection had already replaced it, silently overwriting what the user is
// currently looking at with a stale result. Selecting and translating two
// things in quick succession (a very ordinary thing to do) could trigger
// this; there was no reproduction needed to see it in the code, just two
// concurrent async chains writing into the same module-level DOM.
let requestSeq = 0;

/**
 * Wire the Explain button for the phrase currently shown in the modal,
 * gated by whether the active engine actually supports Explain (T-026,
 * SPEC §4: "hide or disable the Explain button with a hint to configure an
 * LLM key" when the only working engine is on-device). Fails closed — if
 * capability can't even be checked, show the disabled hint rather than a
 * button likely to error.
 * @param {number} requestId this translation's stamp from translateSelection() —
 *   checked after every await so a newer translation's modal state is never
 *   overwritten by this one finishing late.
 */
async function offerExplain(text, context, targetLang, requestId) {
  let canExplain = false;
  try {
    const capRes = await chrome.runtime.sendMessage({ type: MSG.GET_CAPABILITIES, payload: {} });
    canExplain = !!capRes?.ok && !!capRes.data.canExplain;
  } catch {
    // Leave canExplain false — see fail-closed note above.
  }
  if (requestId !== requestSeq) return; // a newer translation has since replaced the modal

  if (!canExplain) {
    showExplainDisabled(
      chrome.i18n.getMessage('modal_explain_button'),
      chrome.i18n.getMessage('modal_explain_disabled_hint'),
    );
    return;
  }

  showExplainButton(chrome.i18n.getMessage('modal_explain_button'), async () => {
    showExplainLoading(chrome.i18n.getMessage('modal_explain_loading'));
    try {
      const res = await requestExplain(text, context, targetLang);
      if (requestId !== requestSeq) return; // ditto — a newer translation may have started mid-request
      if (res?.ok) {
        showExplainResult(text, res.data, explainSectionLabels());
      } else {
        showExplainError(res?.error?.message || chrome.i18n.getMessage('error_generic'));
      }
    } catch (e) {
      if (requestId !== requestSeq) return;
      showExplainError(e?.message || chrome.i18n.getMessage('error_generic'));
    }
  });
}

/**
 * The trial gateway's free daily allowance ran out. Show the upsell instead
 * of a plain error (SPEC §4/§9): open Settings, try again tomorrow, or (if
 * the on-device engine happens to be available right now) translate this
 * one selection with it immediately as a free alternative.
 * @param {number} requestId see offerExplain's doc — same staleness guard.
 */
async function showTrialQuotaUpsell(text, context, targetLang, requestId) {
  let onDeviceAvailable = false;
  try {
    const listRes = await chrome.runtime.sendMessage({ type: MSG.LIST_ENGINES, payload: {} });
    onDeviceAvailable = !!listRes?.ok && listRes.data.engines.some((e) => e.id === 'on-device' && e.available);
  } catch {
    // If we can't even ask, just omit the on-device option — the other two
    // upsell actions (settings / dismiss) don't depend on this.
  }
  if (requestId !== requestSeq) return; // a newer translation has since replaced the modal

  showUpsell(chrome.i18n.getMessage('error_trial_quota_exhausted'), {
    settingsLabel: chrome.i18n.getMessage('error_upsell_settings_button'),
    dismissLabel: chrome.i18n.getMessage('error_upsell_dismiss_button'),
    onSettings: () => chrome.runtime.openOptionsPage(),
    onDismiss: () => hideModal(),
    ...(onDeviceAvailable && {
      onDeviceLabel: chrome.i18n.getMessage('error_upsell_on_device_button'),
      onUseOnDevice: async () => {
        // A fresh request in its own right (retrying via a different
        // engine) — bump the sequence so a newer selection made while this
        // is in flight correctly supersedes it too, same as any other
        // translation.
        const retryId = ++requestSeq;
        showModal(text, lastRect, {
          closeLabel: chrome.i18n.getMessage('modal_close_label'),
          loadingLabel: chrome.i18n.getMessage('modal_loading_text'),
          ...(await ttsButtonOpts('source')),
        });
        const res = await requestTranslate(text, context, targetLang, 'on-device');
        if (retryId !== requestSeq) return;
        if (res?.ok) {
          // No offerExplain() here: this retry deliberately forces the
          // on-device engine, which never supports Explain (docs/ENGINES.md)
          // — unlike the main flow below, there's no ambiguity to defer to
          // T-026's capability gating.
          showResult(res.data.translated, await ttsButtonOpts('target', targetLang));
        } else {
          showError(res?.error?.message || chrome.i18n.getMessage('error_generic'));
        }
      },
    }),
  });
}

async function translateSelection(text, context) {
  // Claim this as the current translation before anything async happens —
  // any earlier call still in flight will see requestSeq has moved on and
  // stop short of rendering its (now stale) result over this one.
  const requestId = ++requestSeq;
  showModal(text, lastRect, {
    closeLabel: chrome.i18n.getMessage('modal_close_label'),
    loadingLabel: chrome.i18n.getMessage('modal_loading_text'),
    ...(await ttsButtonOpts('source')),
  });
  try {
    const targetLang = await getTargetLang();
    const res = await requestTranslate(text, context, targetLang);
    if (requestId !== requestSeq) return; // superseded while the request was in flight
    if (res?.ok) {
      showResult(res.data.translated, await ttsButtonOpts('target', targetLang));
      if (requestId !== requestSeq) return; // ttsButtonOpts awaits storage reads too
      if (isTtsSupported() && (await getTtsAutoplay())) {
        if (requestId !== requestSeq) return;
        speak(res.data.translated, targetLang, await getTtsVoicePref(targetLang));
      }
      offerExplain(text, context, targetLang, requestId);
    } else if (res?.error?.code === 'trial_quota_exhausted') {
      await showTrialQuotaUpsell(text, context, targetLang, requestId);
    } else {
      showError(res?.error?.message || chrome.i18n.getMessage('error_generic'));
    }
  } catch (e) {
    if (requestId !== requestSeq) return;
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

// T-029: "Translate selection" in the native right-click menu re-enters the
// exact same pipeline the trigger icon uses. The worker targets only this
// tab (chrome.tabs.sendMessage), but every content script's onMessage
// listener still sees every OTHER message broadcast extension-wide via
// chrome.runtime.sendMessage — hence the exact-type check below.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== MSG.MENU_TRANSLATE_SELECTION) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const text = message.payload?.text || sel.toString().trim();
  if (!text) return;
  let rect;
  try {
    rect = sel.getRangeAt(0).getBoundingClientRect();
  } catch {
    return; // no rect to anchor the modal to (showModal is a no-op without one, same as onSelection above)
  }
  lastRect = rect;
  translateSelection(text, captureContext(text));
});
