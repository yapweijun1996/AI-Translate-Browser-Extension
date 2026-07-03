// Cross-context DOM helpers. No chrome.* APIs here — usable in content
// scripts, popup, or options alike, and standalone-testable.

/** Escape a string for safe insertion via innerHTML. Never skip this on
 * dynamic content (CODING-STANDARDS hard rule #3). */
export function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
