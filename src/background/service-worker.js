import { MSG, ok, err } from '../shared/messages.js';
import { translate, explain, getActiveEngine } from './engines/registry.js';

// Engine adapters (trial gateway T-014, on-device T-015, BYOK T-016..T-018)
// and the cache (T-020) aren't registered yet — every TRANSLATE/EXPLAIN
// currently resolves through the registry to a "no engine available" error,
// which is the honest state until those land. See docs/ENGINES.md.

console.log('[ai-translate:worker] service worker loaded');

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[ai-translate:worker] onInstalled:', details.reason);
});

async function handleTranslate(payload, sendResponse) {
  try {
    const translated = await translate(payload?.text, payload?.targetLang, { context: payload?.context });
    sendResponse(ok({ translated }));
  } catch (e) {
    sendResponse(err(e.code || 'unknown', e.message));
  }
}

async function handleExplain(payload, sendResponse) {
  try {
    const result = await explain(payload?.phrase, payload?.targetLang, { context: payload?.context });
    sendResponse(ok(result));
  } catch (e) {
    sendResponse(err(e.code || 'unknown', e.message));
  }
}

async function handleGetCapabilities(sendResponse) {
  const engine = await getActiveEngine();
  sendResponse(
    ok({
      canTranslate: !!engine,
      canExplain: !!engine?.capabilities().explain,
      engine: engine?.id ?? null,
    }),
  );
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message?.type) {
    case MSG.PING:
      sendResponse(ok({ pong: true, from: 'service-worker', time: Date.now() }));
      return false;
    case MSG.TRANSLATE:
      handleTranslate(message.payload, sendResponse);
      return true; // sendResponse fires asynchronously — keep the channel open
    case MSG.EXPLAIN:
      handleExplain(message.payload, sendResponse);
      return true;
    case MSG.GET_CAPABILITIES:
      handleGetCapabilities(sendResponse);
      return true;
    default:
      sendResponse(err('unknown', `unhandled message type: ${message?.type}`));
      return false;
  }
});
