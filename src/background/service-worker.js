import { MSG, ok, err } from '../shared/messages.js';
import { registerEngine, listEngines, translate, explain, getActiveEngine } from './engines/registry.js';
import { trialGatewayAdapter } from './engines/trial-gateway.js';
import { onDeviceAdapter } from './engines/on-device.js';
import { geminiAdapter } from './engines/gemini.js';
import { openaiAdapter } from './engines/openai.js';
import { deepseekAdapter } from './engines/deepseek.js';
import { OD_MSG } from './engines/on-device-protocol.js';

// explain() still resolves through the registry to "no engine available"
// until an engine with explain capability lands (T-024). See docs/ENGINES.md.
registerEngine(trialGatewayAdapter);
registerEngine(onDeviceAdapter);
registerEngine(geminiAdapter);
registerEngine(openaiAdapter);
registerEngine(deepseekAdapter);

console.log('[ai-translate:worker] service worker loaded');

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[ai-translate:worker] onInstalled:', details.reason);
});

async function handleTranslate(payload, sendResponse) {
  try {
    // registry.translate() already returns {translated, engine, cached} —
    // the exact shape docs/ARCHITECTURE.md documents for this response.
    // engineOverride (optional) is T-022's one-shot "use on-device instead"
    // retry from the trial-quota upsell — never touches persistent settings.
    const result = await translate(payload?.text, payload?.targetLang, {
      context: payload?.context,
      engineOverride: payload?.engineOverride,
    });
    sendResponse(ok(result));
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

/** For the options page's engine picker (T-019) — includes each engine's
 * live availability, since that can depend on things (a configured key, an
 * on-device model being downloadable) the options page can't check itself. */
async function handleListEngines(sendResponse) {
  const engines = await Promise.all(
    listEngines().map(async (engine) => ({
      id: engine.id,
      available: await engine.isAvailable(),
      capabilities: engine.capabilities(),
    })),
  );
  sendResponse(ok({ engines }));
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
    case MSG.LIST_ENGINES:
      handleListEngines(sendResponse);
      return true;
    default:
      // OD_MSG.* (CHECK_SUPPORT/TRANSLATE) are the worker's own messages TO
      // the offscreen document — chrome.runtime.sendMessage broadcasts to
      // every listener in the extension, including the sender's own, so
      // this listener sees them too. It must NOT respond to them: if it did,
      // this synchronous error would win the race and the offscreen
      // document's real response would never reach the caller. Ignoring
      // them (no sendResponse, return false) lets the offscreen document's
      // listener answer instead.
      if (Object.values(OD_MSG).includes(message?.type)) return false;
      sendResponse(err('unknown', `unhandled message type: ${message?.type}`));
      return false;
  }
});
