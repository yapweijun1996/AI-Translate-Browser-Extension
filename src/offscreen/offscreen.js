// Hosts the on-device Translator/LanguageDetector APIs (Chrome 138+). Runs
// only inside the offscreen document (see on-device-protocol.js for why) —
// never import this from the service worker or a content script; `Translator`
// and `LanguageDetector` don't exist in those contexts.

import { OD_MSG } from '../background/engines/on-device-protocol.js';

console.log('[ai-translate:offscreen] offscreen document loaded');

/** @returns {{supported: boolean}} coarse capability check — not per-language-pair. */
async function checkSupport() {
  if (!('Translator' in self) || !('LanguageDetector' in self)) {
    return { supported: false };
  }
  try {
    const availability = await LanguageDetector.availability();
    return { supported: availability !== 'unavailable' };
  } catch {
    return { supported: false };
  }
}

/**
 * Detect the source language, then translate. There's no explicit
 * sourceLanguage in our EngineAdapter contract (translate(text, targetLang)),
 * so LanguageDetector always runs first — this is two on-device model calls
 * per translate(), not one.
 */
async function runTranslate({ text, targetLang }) {
  const detector = await LanguageDetector.create();
  const detected = await detector.detect(text);
  const sourceLanguage = detected?.[0]?.detectedLanguage;
  if (!sourceLanguage || sourceLanguage === 'und') {
    throw Object.assign(new Error('Could not detect the source language.'), {
      code: 'language_detection_failed',
    });
  }

  const availability = await Translator.availability({ sourceLanguage, targetLanguage: targetLang });
  if (availability === 'unavailable') {
    throw Object.assign(
      new Error(`On-device translation from "${sourceLanguage}" to "${targetLang}" isn't supported.`),
      { code: 'unsupported_language_pair' },
    );
  }

  const translator = await Translator.create({
    sourceLanguage,
    targetLanguage: targetLang,
    monitor(m) {
      // Model download progress on first use of a language pair. Not yet
      // relayed to the modal UI (that's a follow-up once there's a UI
      // affordance for it) — logged so it's visible during development.
      m.addEventListener('downloadprogress', (e) => {
        console.log(`[ai-translate:offscreen] model download ${Math.round(e.loaded * 100)}%`);
      });
    },
  });
  return translator.translate(text);
}

/** DOMExceptions from the browser API itself (e.g. missing user activation) don't carry our `.code`. */
function codeFor(e) {
  if (e?.code) return e.code;
  if (e?.name === 'NotAllowedError') return 'unavailable';
  return 'unknown';
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === OD_MSG.CHECK_SUPPORT) {
    checkSupport().then(sendResponse);
    return true;
  }
  if (message?.type === OD_MSG.TRANSLATE) {
    runTranslate(message.payload)
      .then((translated) => sendResponse({ ok: true, translated }))
      .catch((e) => sendResponse({ ok: false, code: codeFor(e), message: e?.message || 'On-device translation failed.' }));
    return true;
  }
  return false; // not ours — the worker's own listener handles everything else
});
