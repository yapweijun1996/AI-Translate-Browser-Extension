// Manual resize (desktop only — the mobile is-sheet variant keeps its own
// drag-to-dismiss handle instead, see drag-dismiss.js). Owns the resize
// state (userHeightCap, the saved-size persistence hooks) so position.js
// and modal.js never need their own copy of it — see getEffectiveHeightCap
// for the one thing position.js actually needs from here.

import { EDGE_MARGIN, MIN_BOX_WIDTH, MIN_BOX_HEIGHT } from './constants.js';

// Size is restored once per page load via setSavedSize() (called by
// main.js after reading chrome.storage.local — this module stays
// chrome-API-free, same rule as everywhere else in the modal) and reported
// back via onModalResize()'s callback so main.js can persist whatever the
// user last dragged it to.
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

/** Apply the restored width + set the initial height cap — called once when the box is first created. */
export function applyPendingSavedSize(box) {
  if (pendingSavedSize?.width) {
    box.style.width = `${pendingSavedSize.width}px`;
  }
  if (pendingSavedSize?.height) {
    userHeightCap = pendingSavedSize.height;
  }
}

/**
 * Combine position.js's viewport-derived cap with the user's manually-
 * dragged cap, if any — whichever is smaller wins, so the box never grows
 * past the viewport even if the user's chosen cap would technically allow
 * more.
 * @param {number} viewportCap
 * @returns {number}
 */
export function getEffectiveHeightCap(viewportCap) {
  return userHeightCap != null ? Math.min(viewportCap, userHeightCap) : viewportCap;
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
 * max-height CSS and position.js's per-open viewport cap still apply on
 * top of userHeightCap either way, so a user-chosen size still can't push
 * the box off-screen; it just scrolls internally instead.
 * @param {HTMLElement} box
 * @param {HTMLElement} contentEl the element that actually scrolls (see styles.js)
 * @param {HTMLElement} handleEl
 * @param {'top'|'right'|'bottom'|'left'} edge
 */
export function wireResize(box, contentEl, handleEl, edge) {
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
      // .modal is deliberately overflow:visible (so the handles stay
      // hit-testable) — .modal-content is the only element that actually
      // clips content, via its own max-height. Without updating it here too,
      // it stays at the PRE-drag cap for the whole drag, so tall content
      // visibly spills past the box's real-time (shrinking) outline until
      // release, instead of scrolling inside it like it does once dragging
      // stops.
      contentEl.style.maxHeight = `${height}px`;
    } else if (edge === 'top') {
      const maxHeight = startRect.bottom - EDGE_MARGIN;
      const height = Math.min(maxHeight, Math.max(MIN_BOX_HEIGHT, startRect.height - dy));
      box.style.height = `${height}px`;
      box.style.top = `${startRect.bottom - height}px`;
      contentEl.style.maxHeight = `${height}px`;
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
      // userHeightCap (applied via position.js's max-height) remembers how
      // tall the user is willing to let it get for a future longer payload.
      const rectAtRelease = box.getBoundingClientRect();
      userHeightCap = Math.round(rectAtRelease.height);
      box.style.height = '';
      contentEl.style.maxHeight = `${userHeightCap}px`;
      if (edge === 'top') {
        // A top-edge drag anchors the BOTTOM edge — if the cap conversion
        // just shrank the box (content smaller than the dragged height),
        // re-derive top so the bottom stays where the user left it, instead
        // of leaving top pinned and letting the bottom float up away from
        // the selection the box was anchored to.
        const newHeight = box.getBoundingClientRect().height;
        box.style.top = `${Math.max(EDGE_MARGIN, rectAtRelease.bottom - newHeight)}px`;
      }
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
