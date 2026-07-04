// The 🔊 speak button — used for both the source-text row and the
// translated-text row, each wired independently via wireSpeakButton().
// Owns the "which button is currently lit" bookkeeping so hideModal() (in
// modal.js) can stop speech and clear the lit state via one call instead of
// modal.js needing to know how a speak button's internals work.

// Static, trusted markup (no dynamic content) — safe for innerHTML, same
// reasoning as trigger-icon.js's ICON_SVG. Simple speaker glyph.
const SPEAK_ICON_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9H4z" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7" />
  </svg>`;

// Set on every wireSpeakButton() call — stopActiveSpeechAndClearIndicators()
// uses it to stop any in-progress speech on Esc/outside-click/× close paths,
// which don't route through main.js.
let activeOnStop = null;

/**
 * Build one speak button. Starts hidden; the caller (modal.js's
 * showModal/showResult) reveals it once there's real text to speak and TTS
 * is actually supported.
 */
export function createSpeakButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'modal-speak-btn';
  btn.innerHTML = SPEAK_ICON_SVG;
  btn.hidden = true;
  return btn;
}

/**
 * Wire a speak button to toggle play/stop for `text`. onSpeak must return
 * true if it actually started speaking (mirrors tts.js's speak() return
 * value) and call the `onDone` it's handed when the utterance finishes on
 * its own — without that, the button would stay lit in its "speaking" state
 * forever after natural playback end, and replaying would take two clicks
 * (a no-op "stop" first). main.js supplies onSpeak/onStop (via modal.js) —
 * this module never imports tts.js itself, staying chrome-API-free.
 * @param {HTMLElement} root the modal box — used to find and un-light any
 *   OTHER speak button before this one starts (only one utterance plays at
 *   a time; tts.js cancels any other before starting a new one).
 * @param {HTMLButtonElement} btn
 * @param {string} text
 * @param {string} label i18n accessible name
 * @param {(text: string, onDone: () => void) => boolean} onSpeak
 * @param {() => void} onStop
 */
export function wireSpeakButton(root, btn, text, label, onSpeak, onStop) {
  btn.hidden = false;
  btn.setAttribute('aria-label', label);
  btn.title = label;
  // Stale state from a previous open/wiring must not leak into this one.
  btn.classList.remove('is-speaking');
  activeOnStop = onStop;
  btn.onclick = () => {
    if (btn.classList.contains('is-speaking')) {
      onStop();
      btn.classList.remove('is-speaking');
      return;
    }
    root.querySelectorAll('.modal-speak-btn.is-speaking').forEach((b) => b.classList.remove('is-speaking'));
    if (onSpeak(text, () => btn.classList.remove('is-speaking'))) btn.classList.add('is-speaking');
  };
}

/** Stop whatever is speaking and un-light every speak button in `root` — for modal.js's hideModal(). */
export function stopActiveSpeechAndClearIndicators(root) {
  activeOnStop?.();
  root.querySelectorAll('.modal-speak-btn.is-speaking').forEach((b) => b.classList.remove('is-speaking'));
}
