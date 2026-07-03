// Context capture — port of docs/REFERENCE-SNIPPETS.md §2.
// Grabs the paragraph surrounding the current selection so translate/explain
// requests aren't limited to the bare selected phrase (needed for accurate
// in-context meaning, especially for Explain in T-004/T-024).

const MIN_CONTEXT_LENGTH = 200;
const MAX_CONTEXT_LENGTH = 1200;

/**
 * Capture the surrounding paragraph for the current selection.
 *
 * Walks up from the selection's common ancestor until it finds an element
 * with "enough" text (so a selection inside a single <b> or <span> still
 * pulls in its containing paragraph), then truncates. Falls back to the
 * selected text itself if the DOM can't be read for any reason — this must
 * never throw, since it runs on arbitrary, possibly-hostile page markup.
 *
 * @param {string} selectedText the text the user selected (used as fallback)
 * @returns {string} surrounding context, max 1200 chars
 */
export function captureContext(selectedText) {
  try {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return selectedText;
    let node = sel.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    // Walk up until we have a block with enough text, but don't grab the
    // whole page — an unbounded walk would turn every selection's context
    // into the entire document body on thinly-nested pages.
    while (node && node.innerText && node.innerText.length < MIN_CONTEXT_LENGTH && node.parentElement) {
      node = node.parentElement;
    }
    return (node?.innerText || selectedText).slice(0, MAX_CONTEXT_LENGTH);
  } catch {
    return selectedText;
  }
}
