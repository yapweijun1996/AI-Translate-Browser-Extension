// Translation modal box: opened by the trigger icon (T-007), anchored to the
// selection rect on desktop. Below MOBILE_BREAKPOINT it renders as a bottom
// sheet with a drag handle instead (docs/REFERENCE-SNIPPETS.md §7).
//
// Kept chrome-API-free (labels are passed in) so it's standalone-testable,
// same pattern as trigger-icon.js.

import { getShadowRoot, isInsideHost } from './ui-host.js';
import { escapeHtml } from '../shared/dom.js';

// Everything except the Explain payload (T-025) renders via .textContent.
// The Explain block is the one place this module uses innerHTML — SPEC §5's
// payload has real structure (badges, examples, collapsible sections) that
// would be painful to build as ~50 createElement calls, so it's built as an
// HTML string with every dynamic value passed through escapeHtml() first.

// Static, trusted markup (no dynamic content) — safe for innerHTML, same
// reasoning as trigger-icon.js's ICON_SVG. Simple speaker glyph: reused for
// both the source-text and translation speak buttons.
const SPEAK_ICON_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9H4z" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7" />
  </svg>`;

const BOX_WIDTH = 340;
const EDGE_MARGIN = 12;
const GAP = 8;
const MOBILE_BREAKPOINT = 640;
const DISMISS_DRAG_THRESHOLD = 80;
const RESIZE_HANDLE_THICKNESS = 8;
const MIN_BOX_WIDTH = 260;
const MIN_BOX_HEIGHT = 160;

const MODAL_CSS = `
  .modal {
    position: fixed;
    display: none;
    width: ${BOX_WIDTH}px;
    max-width: calc(100vw - ${EDGE_MARGIN * 2}px);
    max-height: calc(100vh - ${EDGE_MARGIN * 2}px);
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);
    transition: transform 0.2s ease;
  }
  .modal.visible {
    display: block;
  }
  .modal.is-sheet {
    width: auto;
    max-width: none;
    left: 0;
    right: 0;
    bottom: 0;
    top: auto;
    border-radius: 14px 14px 0 0;
  }
  /* The scrollable card content, separate from .modal itself — .modal stays
     overflow:visible so the resize handles below (deliberately positioned
     straddling its edges) stay hit-testable; overflow:hidden/auto on .modal
     directly would clip them the same way it clipped the upsell-buttons
     hidden-attribute bug earlier in this file's history. */
  .modal-content {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    overflow: hidden auto;
    border-radius: inherit;
    color: #1a1a1a;
    padding: 14px 16px;
    font-size: 14px;
    line-height: 1.45;
  }
  .modal.is-sheet .modal-content {
    padding-top: 20px;
    padding-bottom: max(14px, env(safe-area-inset-bottom));
  }
  .modal-handle {
    display: none;
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: #d5d5d8;
    touch-action: none;
  }
  .modal.is-sheet .modal-handle {
    display: block;
  }
  .modal-resize {
    position: absolute;
    touch-action: none;
  }
  /* Invisible by default (the handle itself is a bare hit-target strip
     straddling the box edge) — ::before is the actual visual grip, a short
     bar centered on the edge that only appears on hover/active so the box
     stays visually clean while still being discoverable once the user's
     cursor is anywhere near an edge (the cursor: *-resize change alone,
     with zero visual cue on the box itself, is easy to miss). */
  .modal-resize::before {
    content: '';
    position: absolute;
    background: #2563eb;
    opacity: 0;
    border-radius: 2px;
    transition: opacity 0.12s ease;
  }
  .modal-resize:hover::before,
  .modal-resize.is-active::before {
    opacity: 0.55;
  }
  .modal-resize-top,
  .modal-resize-bottom {
    left: 0;
    right: 0;
    height: ${RESIZE_HANDLE_THICKNESS}px;
    cursor: ns-resize;
  }
  .modal-resize-top {
    top: -${RESIZE_HANDLE_THICKNESS / 2}px;
  }
  .modal-resize-bottom {
    bottom: -${RESIZE_HANDLE_THICKNESS / 2}px;
  }
  .modal-resize-top::before,
  .modal-resize-bottom::before {
    left: 30%;
    right: 30%;
    height: 3px;
    top: 50%;
    transform: translateY(-50%);
  }
  .modal-resize-left,
  .modal-resize-right {
    top: 0;
    bottom: 0;
    width: ${RESIZE_HANDLE_THICKNESS}px;
    cursor: ew-resize;
  }
  .modal-resize-left {
    left: -${RESIZE_HANDLE_THICKNESS / 2}px;
  }
  .modal-resize-right {
    right: -${RESIZE_HANDLE_THICKNESS / 2}px;
  }
  .modal-resize-left::before,
  .modal-resize-right::before {
    top: 30%;
    bottom: 30%;
    width: 3px;
    left: 50%;
    transform: translateX(-50%);
  }
  .modal.is-sheet .modal-resize {
    display: none;
  }
  .modal-close {
    position: absolute;
    top: 6px;
    right: 8px;
    border: none;
    background: none;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    color: #888;
    padding: 4px;
  }
  .modal-close:hover {
    color: #222;
  }
  .modal-row {
    margin-right: 20px;
  }
  .modal-source {
    color: #444;
    margin-bottom: 8px;
    word-break: break-word;
  }
  .modal-target {
    font-weight: 500;
    word-break: break-word;
    min-height: 1.4em;
  }
  .modal-target.is-loading {
    color: #888;
    font-weight: normal;
  }
  .modal-target.is-error {
    color: #b3261e;
    font-weight: normal;
  }
  .modal-row-text {
    display: inline;
  }
  .modal-speak-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    margin-left: 4px;
    padding: 0;
    border: none;
    background: transparent;
    color: #888;
    cursor: pointer;
    border-radius: 4px;
    vertical-align: -4px;
  }
  .modal-speak-btn:hover {
    background: #eef1f5;
    color: #2563eb;
  }
  .modal-speak-btn.is-speaking {
    color: #2563eb;
  }
  .modal-speak-btn svg {
    width: 14px;
    height: 14px;
  }
  .modal-explain-btn {
    margin-top: 10px;
    border: 1px solid #d0d0d0;
    background: #f7f7f8;
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 13px;
    cursor: pointer;
    color: #333;
  }
  .modal-explain-btn:hover {
    background: #efeff1;
  }
  .modal-explain-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .modal-explain-btn:disabled:hover {
    background: #f7f7f8;
  }
  .modal-upsell-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 10px;
  }
  .modal-upsell-actions[hidden] {
    display: none;
  }
  .modal-upsell-btn {
    border: 1px solid #d0d0d0;
    background: #f7f7f8;
    border-radius: 6px;
    padding: 7px 10px;
    font-size: 13px;
    cursor: pointer;
    color: #333;
    text-align: center;
  }
  .modal-upsell-btn:hover {
    background: #efeff1;
  }
  .modal-upsell-btn-primary {
    background: #2563eb;
    border-color: #2563eb;
    color: #fff;
  }
  .modal-upsell-btn-primary:hover {
    background: #1d4ed8;
  }
  .modal-explain-body {
    margin-top: 10px;
    max-height: 320px;
    overflow-y: auto;
    font-size: 13px;
  }
  .modal-explain-body.is-loading,
  .modal-explain-body.is-error {
    color: #888;
  }
  .modal-explain-body.is-error {
    color: #b3261e;
  }
  .explain-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .explain-headword {
    font-weight: 600;
    font-size: 14px;
  }
  .explain-phonetic {
    margin-left: 6px;
    color: #777;
    font-size: 12px;
  }
  .badge {
    display: inline-block;
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 8px;
    background: #eee;
    color: #555;
    margin-left: 4px;
  }
  .badge-cefr {
    background: #e3ecfb;
    color: #1d4ed8;
  }
  .badge-sm {
    font-size: 10px;
  }
  .explain-block {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #eee;
  }
  .explain-label {
    font-weight: 600;
    color: #444;
    font-size: 12px;
    margin-bottom: 3px;
  }
  .explain-block.is-collapsible .explain-label {
    cursor: pointer;
    user-select: none;
  }
  .explain-toggle {
    color: #999;
    font-weight: normal;
  }
  .explain-block.is-collapsible[data-collapsed='1'] .explain-body-text {
    display: none;
  }
  .explain-def-src {
    color: #444;
  }
  .explain-def-tgt {
    color: #1a1a1a;
    margin-top: 2px;
  }
  .explain-example {
    margin-top: 6px;
  }
  .explain-example-src {
    color: #444;
  }
  .explain-example-tgt {
    color: #1a1a1a;
  }
  .explain-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .chip {
    background: #f3f3f4;
    border-radius: 10px;
    padding: 2px 8px;
    font-size: 12px;
    color: #444;
  }
  .explain-list {
    margin: 0;
    padding-left: 18px;
  }
  .muted {
    color: #888;
  }
`;

let box = null;
let sourceEl = null;
let sourceTextEl = null;
let sourceSpeakBtn = null;
let targetEl = null;
let targetTextEl = null;
let targetSpeakBtn = null;
let explainBtn = null;
let explainBody = null;
let upsellActions = null;
let upsellSettingsBtn = null;
let upsellOnDeviceBtn = null;
let upsellDismissBtn = null;

// Manual resize (desktop only — the mobile is-sheet variant keeps its own
// drag-to-dismiss handle instead, see wireDragToDismiss). Size is restored
// once per page load via setSavedSize() (called by main.js after reading
// chrome.storage.local — this module stays chrome-API-free, same rule as
// everywhere else in this file) and reported back via onModalResize()'s
// callback so main.js can persist whatever the user last dragged it to.
let pendingSavedSize = null;
let resizeCb = null;

// The user's chosen height is a CAP, not a fixed size: dragging the top/
// bottom edge sets how tall the box is allowed to get, but the box still
// shrinks to fit whatever content it currently has. Without this, dragging
// the box tall once (e.g. for a long Explain payload) would leave a large
// blank gap under every later, shorter translation for the rest of the page
// session. Width has no equivalent problem (extra width is just breathing
// room, not an obvious visual gap) so it stays a fixed, sticky size.
let userHeightCap = null;

// Set on every wireSpeakButton() call — hideModal() uses it to stop any
// in-progress speech on Esc/outside-click/× close paths, which don't route
// through main.js.
let stopSpeakingCb = null;

/**
 * Restore the user's last manually-chosen box size, applied the next time
 * the box is created on this page. Call once at content-script startup.
 * @param {{width: number, height: number}|null} size
 */
export function setSavedSize(size) {
  pendingSavedSize = size;
}

/**
 * Register a callback fired (with {width, height}) whenever the user
 * finishes dragging a resize handle, so the caller can persist it.
 * @param {(size: {width: number, height: number}) => void} cb
 */
export function onModalResize(cb) {
  resizeCb = cb;
}

/**
 * Build one speak (🔊) button — used for both the source-text row and the
 * translated-text row, each wired independently via wireSpeakButton() below.
 * Starts hidden; the caller (showModal/showResult) reveals it once there's
 * real text to speak and TTS is actually supported.
 */
function createSpeakButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'modal-speak-btn';
  btn.innerHTML = SPEAK_ICON_SVG;
  btn.hidden = true;
  return btn;
}

/**
 * Wire a speak button to toggle play/stop for `text`. onSpeak must return
 * true if it actually started speaking (mirrors tts.js's speak() return
 * value) — main.js supplies onSpeak/onStop since this module stays
 * chrome-API-free and doesn't import tts.js itself.
 * @param {HTMLButtonElement} btn
 * @param {string} text
 * @param {string} label i18n accessible name
 * @param {(text: string) => boolean} onSpeak
 * @param {() => void} onStop
 */
function wireSpeakButton(btn, text, label, onSpeak, onStop) {
  btn.hidden = false;
  btn.setAttribute('aria-label', label);
  btn.title = label;
  stopSpeakingCb = onStop;
  btn.onclick = () => {
    if (btn.classList.contains('is-speaking')) {
      onStop();
      btn.classList.remove('is-speaking');
      return;
    }
    // Only one utterance plays at a time (tts.js cancels any other before
    // starting) — drop the "speaking" look from whichever button had it.
    box.querySelectorAll('.modal-speak-btn.is-speaking').forEach((b) => b.classList.remove('is-speaking'));
    if (onSpeak(text)) btn.classList.add('is-speaking');
  };
}

function ensureBox() {
  if (box) return box;
  const shadow = getShadowRoot();
  const style = document.createElement('style');
  style.textContent = MODAL_CSS;
  shadow.appendChild(style);

  box = document.createElement('div');
  box.className = 'modal';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-live', 'polite');

  const handle = document.createElement('div');
  handle.className = 'modal-handle';
  handle.setAttribute('aria-hidden', 'true'); // decorative drag affordance only

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', hideModal);

  sourceEl = document.createElement('div');
  sourceEl.className = 'modal-row modal-source';
  sourceTextEl = document.createElement('span');
  sourceTextEl.className = 'modal-row-text';
  sourceSpeakBtn = createSpeakButton();
  sourceEl.append(sourceTextEl, sourceSpeakBtn);

  targetEl = document.createElement('div');
  targetEl.className = 'modal-row modal-target';
  targetTextEl = document.createElement('span');
  targetTextEl.className = 'modal-row-text';
  targetSpeakBtn = createSpeakButton();
  targetEl.append(targetTextEl, targetSpeakBtn);

  explainBtn = document.createElement('button');
  explainBtn.type = 'button';
  explainBtn.className = 'modal-explain-btn';
  explainBtn.hidden = true; // shown (enabled or disabled-with-hint) by main.js after a successful
  // translation, based on GET_CAPABILITIES' canExplain (T-026)

  explainBody = document.createElement('div');
  explainBody.className = 'modal-explain-body';
  explainBody.hidden = true;

  // Trial-quota upsell (T-022): shown instead of a plain error when the
  // trial gateway's daily allowance runs out. Buttons are wired per-call in
  // showUpsell() since their behavior (open options / retry on-device /
  // dismiss) is supplied by main.js, not this chrome-API-free module.
  upsellActions = document.createElement('div');
  upsellActions.className = 'modal-upsell-actions';
  upsellActions.hidden = true;

  upsellSettingsBtn = document.createElement('button');
  upsellSettingsBtn.type = 'button';
  upsellSettingsBtn.className = 'modal-upsell-btn modal-upsell-btn-primary';

  upsellOnDeviceBtn = document.createElement('button');
  upsellOnDeviceBtn.type = 'button';
  upsellOnDeviceBtn.className = 'modal-upsell-btn';
  upsellOnDeviceBtn.hidden = true; // shown only when on-device is available

  upsellDismissBtn = document.createElement('button');
  upsellDismissBtn.type = 'button';
  upsellDismissBtn.className = 'modal-upsell-btn';

  upsellActions.append(upsellSettingsBtn, upsellOnDeviceBtn, upsellDismissBtn);

  const resizeTop = document.createElement('div');
  resizeTop.className = 'modal-resize modal-resize-top';
  resizeTop.setAttribute('aria-hidden', 'true'); // mouse/touch-only affordance, no keyboard equivalent
  const resizeRight = document.createElement('div');
  resizeRight.className = 'modal-resize modal-resize-right';
  resizeRight.setAttribute('aria-hidden', 'true');
  const resizeBottom = document.createElement('div');
  resizeBottom.className = 'modal-resize modal-resize-bottom';
  resizeBottom.setAttribute('aria-hidden', 'true');
  const resizeLeft = document.createElement('div');
  resizeLeft.className = 'modal-resize modal-resize-left';
  resizeLeft.setAttribute('aria-hidden', 'true');

  const content = document.createElement('div');
  content.className = 'modal-content';
  content.append(handle, closeBtn, sourceEl, targetEl, explainBtn, explainBody, upsellActions);

  box.append(content, resizeTop, resizeRight, resizeBottom, resizeLeft);
  shadow.appendChild(box);

  wireDragToDismiss(handle);
  wireResize(resizeTop, 'top');
  wireResize(resizeRight, 'right');
  wireResize(resizeBottom, 'bottom');
  wireResize(resizeLeft, 'left');

  if (pendingSavedSize?.width) {
    box.style.width = `${pendingSavedSize.width}px`;
  }
  if (pendingSavedSize?.height) {
    userHeightCap = pendingSavedSize.height;
  }

  document.addEventListener('mousedown', (e) => {
    if (isModalVisible() && !isInsideHost(e.target)) hideModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isModalVisible()) hideModal();
  });

  return box;
}

function isMobileViewport() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function position(rect) {
  // Any leftover drag transform from a previous open must not carry over.
  box.style.transform = '';
  // Reset before measuring — a stale cap from a previous open would
  // otherwise clip the natural-size measurement below.
  box.style.maxHeight = '';

  if (isMobileViewport()) {
    box.classList.add('is-sheet');
    box.style.left = '';
    box.style.top = '';
    // A prior desktop resize may have left inline width/height/left set —
    // those would win over .is-sheet's CSS (author inline beats class rules
    // regardless of viewport), breaking the full-width bottom-sheet layout.
    box.style.width = '';
    box.style.height = '';
    box.classList.add('visible');
    return;
  }
  box.classList.remove('is-sheet');

  // Measure with the box already in normal flow (visible, off in a corner)
  // so offsetWidth/offsetHeight reflect real content, then place it.
  box.style.left = '-9999px';
  box.style.top = '0px';
  box.classList.add('visible');
  const boxHeight = box.offsetHeight;
  const boxWidth = box.offsetWidth;

  let left = rect.left;
  if (left + boxWidth + EDGE_MARGIN > window.innerWidth) {
    left = window.innerWidth - boxWidth - EDGE_MARGIN;
  }
  if (left < EDGE_MARGIN) left = EDGE_MARGIN;

  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const flipUp = spaceBelow < boxHeight + GAP && spaceAbove > spaceBelow;
  const top = Math.max(EDGE_MARGIN, flipUp ? rect.top - boxHeight - GAP : rect.bottom + GAP);

  // The box is measured at whatever size its CURRENT content needs (still
  // just source text + a loading spinner at this point) — the translation
  // result and, later, the Explain payload both arrive after this and grow
  // it further. Without a position-relative cap, that growth silently pushes
  // the box past the viewport edge with no way to reach the rest of it. Cap
  // strictly to the room available below this top (no floor — a floor would
  // reintroduce the exact overflow this exists to prevent) so growth always
  // scrolls inside the box (via .modal's overflow-y) instead of running
  // off-screen, even in the worst case of a selection right at the edge.
  // If the user has also manually dragged a height cap (userHeightCap), the
  // effective limit is whichever is smaller — the box never grows past the
  // viewport even if the user's chosen cap would technically allow more.
  const viewportCap = window.innerHeight - top - EDGE_MARGIN;
  box.style.maxHeight = `${userHeightCap != null ? Math.min(viewportCap, userHeightCap) : viewportCap}px`;

  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
}

/**
 * Drag-to-dismiss on the handle (bottom-sheet mode only — desktop simply
 * never triggers these gestures in practice, but the listeners are harmless
 * either way). Supports touch and mouse so it's testable on desktop too.
 */
function wireDragToDismiss(handle) {
  let startY = 0;
  let dy = 0;
  let dragging = false;

  const pointY = (e) => e.touches?.[0]?.clientY ?? e.clientY;

  const onStart = (e) => {
    dragging = true;
    startY = pointY(e);
    dy = 0;
    box.style.transition = 'none';
  };
  const onMove = (e) => {
    if (!dragging) return;
    dy = Math.max(0, pointY(e) - startY);
    box.style.transform = `translateY(${dy}px)`;
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    box.style.transition = '';
    if (dy > DISMISS_DRAG_THRESHOLD) {
      hideModal();
    } else {
      box.style.transform = '';
    }
  };

  handle.addEventListener('touchstart', onStart, { passive: true });
  handle.addEventListener('touchmove', onMove, { passive: true });
  handle.addEventListener('touchend', onEnd);
  handle.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
}

/**
 * Wire one edge of the box (top/right/bottom/left) to manual resize —
 * desktop only, the handle elements are display:none in .is-sheet mode
 * (mobile keeps its own drag-to-dismiss handle instead). Resizing from
 * top/left moves that edge and adjusts the opposite dimension so the box
 * grows/shrinks from the edge being dragged, like a real window border.
 * Width becomes an explicit, fixed size once dragged (extra width is just
 * reading room, not visually wasteful). Height instead becomes a CAP
 * (userHeightCap) rather than a fixed size: the box still shrinks to fit
 * whatever content it currently has, so a height chosen for one long
 * Explain payload doesn't leave a large blank gap under a later, much
 * shorter translation — see userHeightCap's own comment for why. .modal's
 * max-height CSS and position()'s per-open viewport cap still apply on
 * top of userHeightCap either way, so a user-chosen size still can't push
 * the box off-screen; it just scrolls internally instead.
 * @param {HTMLElement} handleEl
 * @param {'top'|'right'|'bottom'|'left'} edge
 */
function wireResize(handleEl, edge) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startRect = null;

  const pointX = (e) => e.touches?.[0]?.clientX ?? e.clientX;
  const pointY = (e) => e.touches?.[0]?.clientY ?? e.clientY;

  const onStart = (e) => {
    dragging = true;
    startX = pointX(e);
    startY = pointY(e);
    startRect = box.getBoundingClientRect();
    box.style.transition = 'none';
    // Keep the grip line lit for the whole drag — :hover alone flickers off
    // the moment the pointer leaves the thin handle strip, even though the
    // resize itself keeps tracking fine (listeners are on window, not just
    // the handle).
    handleEl.classList.add('is-active');
    e.preventDefault?.();
  };

  const onMove = (e) => {
    if (!dragging) return;
    const dx = pointX(e) - startX;
    const dy = pointY(e) - startY;

    if (edge === 'right') {
      const width = Math.min(window.innerWidth - startRect.left - EDGE_MARGIN, Math.max(MIN_BOX_WIDTH, startRect.width + dx));
      box.style.width = `${width}px`;
    } else if (edge === 'left') {
      const maxWidth = startRect.right - EDGE_MARGIN;
      const width = Math.min(maxWidth, Math.max(MIN_BOX_WIDTH, startRect.width - dx));
      box.style.width = `${width}px`;
      box.style.left = `${startRect.right - width}px`;
    } else if (edge === 'bottom') {
      const height = Math.min(window.innerHeight - startRect.top - EDGE_MARGIN, Math.max(MIN_BOX_HEIGHT, startRect.height + dy));
      box.style.height = `${height}px`;
    } else if (edge === 'top') {
      const maxHeight = startRect.bottom - EDGE_MARGIN;
      const height = Math.min(maxHeight, Math.max(MIN_BOX_HEIGHT, startRect.height - dy));
      box.style.height = `${height}px`;
      box.style.top = `${startRect.bottom - height}px`;
    }
  };

  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    box.style.transition = '';
    handleEl.classList.remove('is-active');
    if (edge === 'top' || edge === 'bottom') {
      // The drag tracked box.style.height directly for real-time visual
      // feedback while dragging. Convert that into a CAP now, not a fixed
      // size: clearing the explicit height lets the box immediately shrink
      // back down if its current content doesn't need all that room, while
      // userHeightCap (applied via position()'s max-height) remembers how
      // tall the user is willing to let it get for a future longer payload.
      userHeightCap = Math.round(box.getBoundingClientRect().height);
      box.style.height = '';
      box.style.maxHeight = `${userHeightCap}px`;
    }
    resizeCb?.({ width: Math.round(box.getBoundingClientRect().width), height: userHeightCap ?? Math.round(box.getBoundingClientRect().height) });
  };

  handleEl.addEventListener('touchstart', onStart, { passive: false });
  handleEl.addEventListener('touchmove', onMove, { passive: true });
  handleEl.addEventListener('touchend', onEnd);
  handleEl.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
}

/**
 * Open the modal anchored to `rect`, showing `sourceText` and a loading state.
 * @param {string} sourceText
 * @param {DOMRect} rect selection bounding rect from the detector
 * @param {{closeLabel: string, loadingLabel: string, speakLabel?: string, onSpeakSource?: (text: string) => boolean, onStopSpeaking?: () => void}} labels
 *   onSpeakSource/onStopSpeaking are omitted entirely (not just falsy) when TTS isn't supported —
 *   same fail-closed convention as onUseOnDevice in showUpsell().
 */
export function showModal(sourceText, rect, { closeLabel, loadingLabel, speakLabel, onSpeakSource, onStopSpeaking }) {
  if (!rect) return;
  ensureBox();
  box.querySelector('.modal-close').setAttribute('aria-label', closeLabel);
  sourceTextEl.textContent = sourceText;
  if (onSpeakSource) {
    wireSpeakButton(sourceSpeakBtn, sourceText, speakLabel, onSpeakSource, onStopSpeaking);
  } else {
    sourceSpeakBtn.hidden = true;
  }
  targetTextEl.textContent = loadingLabel;
  targetEl.className = 'modal-row modal-target is-loading';
  targetSpeakBtn.hidden = true;
  explainBtn.hidden = true;
  resetExplainBody();
  upsellActions.hidden = true;
  position(rect);
}

/**
 * Render a successful translation result.
 * @param {string} translatedText
 * @param {{speakLabel?: string, onSpeakTarget?: (text: string) => boolean, onStopSpeaking?: () => void}} [opts]
 *   Same omit-when-unsupported convention as showModal's onSpeakSource.
 */
export function showResult(translatedText, { speakLabel, onSpeakTarget, onStopSpeaking } = {}) {
  if (!targetEl) return;
  targetTextEl.textContent = translatedText || '';
  targetEl.className = 'modal-row modal-target';
  if (onSpeakTarget && translatedText) {
    wireSpeakButton(targetSpeakBtn, translatedText, speakLabel, onSpeakTarget, onStopSpeaking);
  } else {
    targetSpeakBtn.hidden = true;
  }
  resetExplainBody();
  upsellActions.hidden = true;
}

/** Render a friendly error message in place of the result. */
export function showError(message) {
  if (!targetEl) return;
  targetTextEl.textContent = message;
  targetEl.className = 'modal-row modal-target is-error';
  targetSpeakBtn.hidden = true;
  resetExplainBody();
  upsellActions.hidden = true;
}

/**
 * Render the trial-quota-exhausted upsell in place of a plain error: a
 * headline message plus up to three actions. Callbacks (not chrome APIs)
 * are supplied by main.js so this module stays chrome-free (SPEC/CODING-
 * STANDARDS: content-script UI never touches chrome.* directly except
 * through main.js's message layer).
 * @param {string} message headline text (e.g. "today's free quota is used up")
 * @param {object} opts
 * @param {string} opts.settingsLabel
 * @param {string} opts.dismissLabel
 * @param {() => void} opts.onSettings
 * @param {() => void} opts.onDismiss
 * @param {string} [opts.onDeviceLabel] only needed when onUseOnDevice is provided
 * @param {() => void} [opts.onUseOnDevice] omit entirely to hide the on-device button
 */
export function showUpsell(message, { settingsLabel, dismissLabel, onSettings, onDismiss, onDeviceLabel, onUseOnDevice }) {
  if (!targetEl) return;
  targetTextEl.textContent = message;
  targetEl.className = 'modal-row modal-target is-error';
  targetSpeakBtn.hidden = true;
  explainBtn.hidden = true;
  resetExplainBody();

  upsellSettingsBtn.textContent = settingsLabel;
  upsellSettingsBtn.onclick = () => onSettings?.();

  upsellDismissBtn.textContent = dismissLabel;
  upsellDismissBtn.onclick = () => onDismiss?.();

  if (onUseOnDevice) {
    upsellOnDeviceBtn.textContent = onDeviceLabel;
    upsellOnDeviceBtn.hidden = false;
    upsellOnDeviceBtn.onclick = () => onUseOnDevice();
  } else {
    upsellOnDeviceBtn.hidden = true;
    upsellOnDeviceBtn.onclick = null;
  }

  upsellActions.hidden = false;
}

function resetExplainBody() {
  explainBody.hidden = true;
  explainBody.className = 'modal-explain-body';
  explainBody.innerHTML = '';
}

/**
 * Show the Explain button, enabled, after a successful translation on an
 * engine that supports it. main.js decides which of this or
 * showExplainDisabled() to call, based on GET_CAPABILITIES (T-026).
 * @param {string} label i18n "Explain" button text
 * @param {() => void} onClick
 */
export function showExplainButton(label, onClick) {
  if (!explainBtn) return;
  explainBtn.textContent = label;
  explainBtn.disabled = false;
  explainBtn.title = '';
  explainBtn.hidden = false;
  explainBtn.onclick = () => onClick();
}

/**
 * Show the Explain button in a disabled state with a hint (SPEC §4: "hide
 * or disable the Explain button with a hint to configure an LLM key" when
 * the active engine is on-device-only). Disabled rather than hidden so the
 * feature stays discoverable.
 * @param {string} label i18n "Explain" button text
 * @param {string} hint i18n tooltip explaining why it's disabled
 */
export function showExplainDisabled(label, hint) {
  if (!explainBtn) return;
  explainBtn.textContent = label;
  explainBtn.disabled = true;
  explainBtn.title = hint;
  explainBtn.hidden = false;
  explainBtn.onclick = null;
}

/** Loading state while the EXPLAIN request is in flight — disables the button so it can't double-fire. */
export function showExplainLoading(loadingLabel) {
  if (!explainBody) return;
  explainBtn.disabled = true;
  explainBody.className = 'modal-explain-body is-loading';
  explainBody.textContent = loadingLabel;
  explainBody.hidden = false;
}

/** Friendly error in place of the explain payload (e.g. explain_unsupported, network failure). */
export function showExplainError(message) {
  if (!explainBody) return;
  explainBtn.disabled = false;
  explainBody.className = 'modal-explain-body is-error';
  explainBody.textContent = message;
  explainBody.hidden = false;
}

/**
 * Render the SPEC §5 explain payload: headword + phonetic + POS/CEFR
 * badges, dual-language definitions, in-context meaning, graded examples,
 * and collapsible collocations/word-family/synonyms/antonyms/memory-tip.
 * Every dynamic value is escaped — this is the one place in this module
 * that uses innerHTML (see the file-header comment).
 * @param {string} headword the originally-selected phrase (already shown in sourceEl, repeated here as the Explain block's own heading)
 * @param {object} payload SPEC §5 shape from EXPLAIN — schemaVersion, phonetic, partOfSpeech, cefrLevel, definitionSrc, definitionTgt, context, examples[], collocations[], wordFamily[], synonyms[], antonyms[], memoryTip
 * @param {{collocationsLabel: string, wordFamilyLabel: string, synonymsLabel: string, antonymsLabel: string, memoryTipLabel: string, definitionLabel: string, examplesLabel: string, contextLabel: string}} sectionLabels i18n labels for each block (T-025 doesn't hardcode English)
 */
export function showExplainResult(headword, payload, sectionLabels) {
  if (!explainBody) return;
  explainBtn.disabled = false;

  const block = (body, opts = {}) =>
    body
      ? `<div class="explain-block${opts.collapsible ? ' is-collapsible' : ''}"${
          opts.collapsible ? ' data-collapsed="1"' : ''
        }>
           <div class="explain-label">${escapeHtml(opts.label || '')}${opts.collapsible ? ' <span class="explain-toggle">+</span>' : ''}</div>
           <div class="explain-body-text">${body}</div>
         </div>`
      : '';

  const head = `
    <div class="explain-head">
      <div>
        <span class="explain-headword">${escapeHtml(headword)}</span>
        ${payload.phonetic ? `<span class="explain-phonetic">${escapeHtml(payload.phonetic)}</span>` : ''}
      </div>
      <div>
        ${payload.partOfSpeech ? `<span class="badge">${escapeHtml(payload.partOfSpeech)}</span>` : ''}
        ${payload.cefrLevel && payload.cefrLevel !== 'unknown' ? `<span class="badge badge-cefr">${escapeHtml(payload.cefrLevel)}</span>` : ''}
      </div>
    </div>`;

  const definitions =
    payload.definitionSrc || payload.definitionTgt
      ? block(
          `${payload.definitionSrc ? `<div class="explain-def-src">${escapeHtml(payload.definitionSrc)}</div>` : ''}${
            payload.definitionTgt ? `<div class="explain-def-tgt">${escapeHtml(payload.definitionTgt)}</div>` : ''
          }`,
          { label: sectionLabels.definitionLabel },
        )
      : '';

  const context = payload.context ? block(escapeHtml(payload.context), { label: sectionLabels.contextLabel }) : '';

  const examples = payload.examples?.length
    ? block(
        payload.examples
          .map(
            (e) => `
          <div class="explain-example">
            ${e.level ? `<span class="badge badge-cefr badge-sm">${escapeHtml(e.level)}</span>` : ''}
            <div class="explain-example-src">${escapeHtml(e.src)}</div>
            <div class="explain-example-tgt">${escapeHtml(e.tgt)}</div>
          </div>`,
          )
          .join(''),
        { label: sectionLabels.examplesLabel },
      )
    : '';

  const collocations = payload.collocations?.length
    ? block(
        `<div class="explain-chips">${payload.collocations.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join('')}</div>`,
        { label: sectionLabels.collocationsLabel, collapsible: true },
      )
    : '';

  const wordFamily = payload.wordFamily?.length
    ? block(
        `<ul class="explain-list">${payload.wordFamily
          .map(
            (w) =>
              `<li><strong>${escapeHtml(w.word)}</strong>${w.pos ? ` <span class="muted">(${escapeHtml(w.pos)})</span>` : ''}${w.meaning ? ` — ${escapeHtml(w.meaning)}` : ''}</li>`,
          )
          .join('')}</ul>`,
        { label: sectionLabels.wordFamilyLabel, collapsible: true },
      )
    : '';

  const synonyms = payload.synonyms?.length
    ? block(
        `<ul class="explain-list">${payload.synonyms
          .map(
            (s) =>
              `<li><strong>${escapeHtml(s.word)}</strong>${s.note ? ` — <span class="muted">${escapeHtml(s.note)}</span>` : ''}</li>`,
          )
          .join('')}</ul>`,
        { label: sectionLabels.synonymsLabel, collapsible: true },
      )
    : '';

  const antonyms = payload.antonyms?.length
    ? block(
        `<div class="explain-chips">${payload.antonyms.map((a) => `<span class="chip">${escapeHtml(a)}</span>`).join('')}</div>`,
        { label: sectionLabels.antonymsLabel, collapsible: true },
      )
    : '';

  const memoryTip = payload.memoryTip
    ? block(escapeHtml(payload.memoryTip), { label: sectionLabels.memoryTipLabel, collapsible: true })
    : '';

  explainBody.className = 'modal-explain-body';
  explainBody.innerHTML = head + definitions + context + examples + collocations + wordFamily + synonyms + antonyms + memoryTip;
  explainBody.hidden = false;
  wireExplainCollapsibles();
}

/** Click-to-toggle for `.explain-block.is-collapsible` sections. */
function wireExplainCollapsibles() {
  explainBody.querySelectorAll('.explain-block.is-collapsible .explain-label').forEach((label) => {
    label.addEventListener('click', () => {
      const b = label.parentElement;
      const collapsed = b.dataset.collapsed === '1';
      b.dataset.collapsed = collapsed ? '0' : '1';
      const toggle = b.querySelector('.explain-toggle');
      if (toggle) toggle.textContent = collapsed ? '−' : '+';
    });
  });
}

export function hideModal() {
  if (box) box.classList.remove('visible');
  // Closing via Esc/outside-click/× doesn't go through main.js, so this
  // module has to remember how to stop speech itself rather than relying on
  // the caller to notice the modal closed.
  stopSpeakingCb?.();
}

export function isModalVisible() {
  return !!box && box.classList.contains('visible');
}
