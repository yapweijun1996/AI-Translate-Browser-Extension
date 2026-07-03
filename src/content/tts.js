// Browser-native text-to-speech (Web Speech API) — free, no network call, no
// API key, works entirely inside the page's own window (unlike the on-device
// Translator API, this doesn't need an offscreen document: speechSynthesis
// is a regular Window API a content script already has access to).
//
// Chrome-API-free (a voice preference is passed in, never read from storage
// here) — same pattern as modal.js/trigger-icon.js.

/** True if this browser has any speech synthesis support at all. */
export function isTtsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Find the best available voice for `lang`, preferring an exact stored
 * preference, falling back to any installed voice whose language prefix
 * matches, falling back to null (caller leaves utterance.voice unset — the
 * browser then picks its own default for utterance.lang).
 * @param {string} lang
 * @param {{voiceURI?: string, name?: string, lang?: string}|null} pref
 * @returns {SpeechSynthesisVoice|null}
 */
function findVoice(lang, pref) {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  if (pref?.voiceURI) {
    const exact = voices.find((v) => v.voiceURI === pref.voiceURI);
    if (exact) return exact;
  }
  if (pref?.name && pref?.lang) {
    // voiceURI can be unstable across browser restarts on some platforms —
    // name+lang is the fallback match for a previously-chosen voice.
    const byNameAndLang = voices.find((v) => v.name === pref.name && v.lang === pref.lang);
    if (byNameAndLang) return byNameAndLang;
  }
  if (!lang) return null;
  const prefix = lang.split('-')[0].toLowerCase();
  return voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) || null;
}

/**
 * Speak `text`. Cancels anything currently speaking first — this extension
 * only ever wants one utterance active at a time.
 * @param {string} text
 * @param {string} [lang] BCP-47-ish language code (e.g. 'zh-CN', 'ja'). Omit
 *   to let the browser pick its own default voice — used for the "listen to
 *   original text" button, since the source language isn't reliably known
 *   (no language-detection step feeds into this module).
 * @param {{voiceURI?: string, name?: string, lang?: string}|null} [voicePref]
 * @param {{onStart?: () => void, onEnd?: () => void, onError?: () => void}} [handlers]
 * @returns {boolean} false if TTS isn't supported or text is empty — nothing was queued.
 */
export function speak(text, lang, voicePref, { onStart, onEnd, onError } = {}) {
  if (!isTtsSupported() || !text?.trim()) return false;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  if (lang) utterance.lang = lang;
  const voice = findVoice(lang, voicePref);
  if (voice) utterance.voice = voice;
  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onError?.();

  window.speechSynthesis.speak(utterance);
  return true;
}

/** Stop whatever is currently speaking (no-op if nothing is). */
export function stopSpeaking() {
  if (isTtsSupported()) window.speechSynthesis.cancel();
}

/** True while an utterance queued by this module (or anything else on the page) is playing. */
export function isSpeaking() {
  return isTtsSupported() && window.speechSynthesis.speaking;
}
