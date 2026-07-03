// Tiny data-i18n walker: fills every [data-i18n] element's textContent from
// _locales messages. Also sets <title> from ext_name when the page has none.
// Usable in popup/options/content-script UI alike.

export function applyI18n(root) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    const key = el.dataset.i18n;
    const msg = chrome.i18n.getMessage(key);
    if (msg) {
      el.textContent = msg;
    } else {
      console.warn('[ai-translate:i18n] missing message key:', key);
    }
  }
  if (root === document && !document.title) {
    document.title = chrome.i18n.getMessage('ext_name');
  }
}
