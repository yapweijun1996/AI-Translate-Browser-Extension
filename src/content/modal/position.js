// Anchors the box to the selection rect on desktop (flipping above/below to
// stay on-screen), or switches to the mobile bottom-sheet layout below
// MOBILE_BREAKPOINT. The one thing this needs from resize.js is
// getEffectiveHeightCap() — the user's manually-dragged height cap, if any,
// combined with the viewport-derived one computed here.

import { EDGE_MARGIN, GAP, MOBILE_BREAKPOINT } from './constants.js';
import { getEffectiveHeightCap } from './resize.js';

function isMobileViewport() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/**
 * @param {HTMLElement} box
 * @param {HTMLElement} contentEl the element that actually scrolls (see styles.js)
 * @param {DOMRect} rect selection bounding rect from the detector
 */
export function positionModal(box, contentEl, rect) {
  // Any leftover drag transform from a previous open must not carry over.
  box.style.transform = '';
  // Reset before measuring — a stale cap from a previous open would
  // otherwise clip the natural-size measurement below. The cap lives on
  // contentEl (the element that actually scrolls), not box — see
  // styles.js's .modal-content comment for why box's max-height alone
  // can't reliably contain it.
  contentEl.style.maxHeight = '';

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
  // scrolls inside contentEl (via its own overflow-y) instead of running
  // off-screen, even in the worst case of a selection right at the edge.
  // getEffectiveHeightCap folds in the user's manually-dragged cap (if any)
  // too — the box never grows past the viewport even if that cap would
  // technically allow more.
  const viewportCap = window.innerHeight - top - EDGE_MARGIN;
  contentEl.style.maxHeight = `${getEffectiveHeightCap(viewportCap)}px`;

  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
}
