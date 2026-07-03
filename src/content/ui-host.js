// Shadow DOM host for all in-page UI (trigger icon, modal).
// One custom-named element on documentElement (survives frameworks replacing
// <body>), with an open shadow root and a CSS reset so hostile page styles
// can't leak in and ours can't leak out.

let host = null;
let shadow = null;

const RESET_CSS = `
  :host {
    all: initial;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, sans-serif;
  }
`;

/**
 * Get (creating on first use) the extension's shadow root on this page.
 * @returns {ShadowRoot}
 */
export function getShadowRoot() {
  if (shadow) return shadow;
  host = document.createElement('ai-translate-host');
  // The host itself occupies no space and sits above everything; children
  // position themselves with position:fixed viewport coordinates.
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
  shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = RESET_CSS;
  shadow.appendChild(style);
  document.documentElement.appendChild(host);
  return shadow;
}

/**
 * True when the node lives inside our UI — used to ignore selections the
 * user makes within the extension's own widgets.
 * @param {Node|null} node
 * @returns {boolean}
 */
export function isInsideHost(node) {
  return !!host && !!node && host.contains(node);
}
