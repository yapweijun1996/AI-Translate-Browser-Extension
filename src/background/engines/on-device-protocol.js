// Internal message protocol between the on-device engine adapter (running in
// the service worker) and the offscreen document that actually hosts the
// Translator/LanguageDetector APIs. This is NOT part of the public
// content-script-facing protocol (shared/messages.js) — content scripts
// never talk to the offscreen document directly, only through the worker,
// same as every other engine.

export const OFFSCREEN_DOC_PATH = 'src/offscreen/offscreen.html';

export const OD_MSG = {
  CHECK_SUPPORT: 'OD_CHECK_SUPPORT',
  TRANSLATE: 'OD_TRANSLATE',
};
