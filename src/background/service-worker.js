import { MSG, ok, err } from '../shared/messages.js';
import { registerEngine, translate, explain, getActiveEngine } from './engines/registry.js';
import { trialGatewayAdapter } from './engines/trial-gateway.js';

// On-device (T-015) and BYOK (T-016..T-018) adapters, and the cache (T-020),
// aren't registered yet. The trial gateway (T-014) is the first real engine —
// translate() now returns real results; explain() still resolves through the
// registry to "no engine available" until an engine with explain capability
// lands (T-024). See docs/ENGINES.md.
registerEngine(trialGatewayAdapter);

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
