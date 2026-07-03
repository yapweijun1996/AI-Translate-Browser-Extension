import { MSG } from '../shared/messages.js';
import { onSelection } from './selection.js';

// Content script entry. Selection events feed the trigger icon (T-007);
// until that lands, detected selections are logged so T-006 is verifiable
// on any page.

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

onSelection((text, rect) => {
  console.log('[ai-translate:content] selection detected:', {
    text: text.length > 80 ? `${text.slice(0, 80)}…` : text,
    rect: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null,
  });
});
