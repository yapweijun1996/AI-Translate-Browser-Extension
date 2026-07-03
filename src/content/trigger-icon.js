// Floating trigger icon: appears near the end of a text selection; clicking
// it is what starts a translation (icon-first UX, SPEC §2). This module owns
// only the icon — the modal it opens is T-008.

import { getShadowRoot } from './ui-host.js';

const ICON_SIZE = 28;
const OFFSET = 6;
const EDGE_MARGIN = 8;

// Static, trusted markup (no dynamic content) — safe for innerHTML.
const ICON_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 5h7" /><path d="M7.5 3v2" />
    <path d="M5 8c1.5 3 4 5.5 7 7" /><path d="M11 8c-1 2.5-3.5 5-6.5 7" />
    <path d="M13 20l4-9 4 9" /><path d="M14.5 17h5" />
  </svg>`;

const ICON_CSS = `
  .trigger-icon {
    position: fixed;
    width: ${ICON_SIZE}px;
    height: ${ICON_SIZE}px;
    border: none;
    border-radius: 50%;
    background: #2563eb;
    color: #fff;
    cursor: pointer;
    display: none;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }
  .trigger-icon.visible {
    display: flex;
  }
  .trigger-icon:hover {
    background: #1d4ed8;
  }
  .trigger-icon svg {
    width: 16px;
    height: 16px;
    display: block;
  }
`;

let btn = null;
let onClickCb = null;

function ensureButton() {
  if (btn) return btn;
  const shadow = getShadowRoot();
  const style = document.createElement('style');
  style.textContent = ICON_CSS;
  shadow.appendChild(style);

  btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'trigger-icon';
  btn.innerHTML = ICON_SVG;

  // preventDefault on mousedown so clicking the icon neither steals focus
  // from the page nor collapses the selection we're about to translate.
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideTriggerIcon();
    onClickCb?.();
  });
  shadow.appendChild(btn);
  return btn;
}

/**
 * Show the icon near the end of the selection rect (viewport coordinates),
 * clamped to stay on screen.
 * @param {DOMRect} rect selection bounding rect from the detector
 * @param {{label: string, onClick: () => void}} opts
 *   label: localized accessible name; onClick: fires when the user clicks.
 */
export function showTriggerIcon(rect, { label, onClick }) {
  if (!rect) return;
  const el = ensureButton();
  onClickCb = onClick;
  el.setAttribute('aria-label', label);
  el.setAttribute('title', label);

  let x = rect.right + OFFSET;
  let y = rect.bottom + OFFSET;
  x = Math.max(EDGE_MARGIN, Math.min(x, window.innerWidth - ICON_SIZE - EDGE_MARGIN));
  y = Math.max(EDGE_MARGIN, Math.min(y, window.innerHeight - ICON_SIZE - EDGE_MARGIN));
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.classList.add('visible');
}

export function hideTriggerIcon() {
  if (btn) btn.classList.remove('visible');
}

/** True while the icon is on screen. */
export function isTriggerIconVisible() {
  return !!btn && btn.classList.contains('visible');
}
