// On-device engine adapter (SPEC §4 "free/private path", ENGINES.md
// "Engine 2"). Free, private, no key, no quota — but the Translator/
// LanguageDetector APIs only exist in a real Document, NOT in the service
// worker (Chrome docs: "not available in Web Workers, due to the complexity
// of establishing a responsible document... to check the Permissions Policy
// status"). So this adapter's job is entirely indirection: keep an offscreen
// document alive and relay requests to it (offscreen.js does the actual API
// calls). capabilities().explain is false — this engine can't power Explain.
//
// OPEN VERIFICATION ITEM (can't be checked outside a real loaded Chrome
// 138+ extension): whether the "transient user activation" Translator.create()
// requires propagates from the content-script click through
// chrome.runtime.sendMessage into an offscreen document, which the user
// never directly interacts with. If it doesn't, translate() will throw
// NotAllowedError, which offscreen.js maps to code 'unavailable' — a clear,
// non-crashing failure, but real-device QA is still owed. Also open: the
// `reasons: ['WORKERS']` passed to chrome.offscreen.createDocument is a
// best-effort pick — the documented Reason enum has no dedicated "on-device
// AI" value; revisit if Chrome adds one.

import { EngineError } from './errors.js';
import { OD_MSG, OFFSCREEN_DOC_PATH } from './on-device-protocol.js';

let ensureDocumentPromise = null;

async function ensureOffscreenDocument() {
  if (!ensureDocumentPromise) {
    ensureDocumentPromise = (async () => {
      if (!chrome.offscreen) {
        throw new EngineError('unavailable', 'chrome.offscreen is not available in this browser.');
      }
      const hasDoc = (await chrome.offscreen.hasDocument?.()) ?? false;
      if (!hasDoc) {
        await chrome.offscreen.createDocument({
          url: OFFSCREEN_DOC_PATH,
          reasons: ['WORKERS'],
          justification:
            'Hosts the on-device Translator/LanguageDetector API, which requires a Document context and is unavailable in the service worker.',
        });
      }
    })();
  }
  return ensureDocumentPromise;
}

async function askOffscreen(type, payload) {
  await ensureOffscreenDocument();
  return chrome.runtime.sendMessage({ type, payload });
}

/** @type {import('./registry.js').EngineAdapter} */
export const onDeviceAdapter = {
  id: 'on-device',
  async isAvailable() {
    try {
      const res = await askOffscreen(OD_MSG.CHECK_SUPPORT, {});
      return !!res?.supported;
    } catch {
      return false;
    }
  },
  capabilities() {
    return { translate: true, explain: false, streaming: false };
  },
  async translate(text, targetLang) {
    let res;
    try {
      res = await askOffscreen(OD_MSG.TRANSLATE, { text, targetLang });
    } catch (e) {
      throw new EngineError('unavailable', e?.message || 'Could not reach the on-device translation host.');
    }
    if (!res?.ok) {
      throw new EngineError(res?.code || 'unknown', res?.message || 'On-device translation failed.');
    }
    return res.translated;
  },
};
