import { MSG, ok, err } from '../shared/messages.js';

// M1 skeleton: heartbeat + PING round-trip only.
// Engine adapters, cache, and context menu land in M2/M3 (see task.jsonl).

console.log('[ai-translate:worker] service worker loaded');

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[ai-translate:worker] onInstalled:', details.reason);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message?.type) {
    case MSG.PING:
      sendResponse(ok({ pong: true, from: 'service-worker', time: Date.now() }));
      return false;
    default:
      sendResponse(err('unknown', `unhandled message type: ${message?.type}`));
      return false;
  }
});
