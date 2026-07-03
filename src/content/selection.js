// Selection detector — port of docs/REFERENCE-SNIPPETS.md §1.
// Watches for the user finishing a text selection (mouse or touch) and calls
// the handler with the selected text and its bounding rect. The trigger icon
// (T-007) subscribes to this; nothing here touches the network or the worker.

const DEBOUNCE_MS = 250;
const MIN_TEXT_LENGTH = 2;

/**
 * Start watching for completed text selections on this page.
 *
 * Behavior:
 * - Debounced 250ms after mouseup/touchend, so it fires once per gesture.
 * - Ignores collapsed selections and selections shorter than 2 characters.
 * - Won't re-fire for the same text twice in a row; collapsing the selection
 *   (via selectionchange) resets that, so re-selecting the same text fires again.
 *
 * @param {(text: string, rect: DOMRect|null) => void} handler
 *   Called with the selected text and the selection range's bounding rect
 *   (viewport coordinates; null if the rect can't be read).
 * @returns {() => void} stop — removes all listeners (used by tests/teardown).
 */
export function onSelection(handler) {
  let timer = null;
  let lastText = '';

  const fire = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (!text || text === lastText) return;
    if (text.length < MIN_TEXT_LENGTH) return;
    let rect = null;
    try {
      rect = sel.getRangeAt(0).getBoundingClientRect();
    } catch {
      // Selection disappeared between the event and the debounce tick — still
      // report the text; the icon will fall back to cursor positioning.
    }
    lastText = text;
    handler(text, rect);
  };

  const debounced = () => {
    clearTimeout(timer);
    timer = setTimeout(fire, DEBOUNCE_MS);
  };

  const onSelectionChange = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) lastText = '';
  };

  document.addEventListener('mouseup', debounced);
  document.addEventListener('touchend', debounced);
  document.addEventListener('selectionchange', onSelectionChange);

  return function stop() {
    clearTimeout(timer);
    document.removeEventListener('mouseup', debounced);
    document.removeEventListener('touchend', debounced);
    document.removeEventListener('selectionchange', onSelectionChange);
  };
}
