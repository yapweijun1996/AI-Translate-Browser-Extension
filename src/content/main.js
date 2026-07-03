import { MSG } from '../shared/messages.js';

// M1 skeleton: prove the content script loads on pages and can round-trip a
// message to the service worker. Selection UX starts at T-006.

console.log('[ai-translate:content] content script loaded on', location.origin);

chrome.runtime
  .sendMessage({ type: MSG.PING, payload: {} })
  .then((res) => {
    console.log('[ai-translate:content] PING response:', res);
  })
  .catch((e) => {
    // Worker may be waking up; a real retry strategy comes with the message
    // client in T-011.
    console.warn('[ai-translate:content] PING failed:', e?.message);
  });
