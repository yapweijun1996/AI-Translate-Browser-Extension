import { MSG } from '../shared/messages.js';
import { onSelection } from './selection.js';
import { isInsideHost } from './ui-host.js';
import { showTriggerIcon, hideTriggerIcon, isTriggerIconVisible } from './trigger-icon.js';

// Content script entry: selection → trigger icon. Clicking the icon opens
// the translation modal (T-008); until that lands it logs the pending text.

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

let pendingText = '';

onSelection((text, rect) => {
  // Selections made inside our own UI must never trigger the icon.
  if (isInsideHost(window.getSelection()?.anchorNode)) return;
  if (!rect) return;
  pendingText = text;
  showTriggerIcon(rect, {
    label: chrome.i18n.getMessage('modal_trigger_label'),
    onClick: () => {
      // T-008 opens the modal here; translation starts on click, not on
      // selection (SPEC §2).
      console.log('[ai-translate:content] trigger clicked for:', pendingText.slice(0, 80));
    },
  });
});

// The icon follows the selection: gone when the selection collapses, gone on
// scroll (its viewport anchor is stale the moment the page moves).
document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if ((!sel || sel.isCollapsed) && isTriggerIconVisible()) hideTriggerIcon();
});
document.addEventListener('scroll', () => hideTriggerIcon(), { capture: true, passive: true });
