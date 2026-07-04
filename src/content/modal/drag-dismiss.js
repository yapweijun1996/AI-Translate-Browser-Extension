// Drag-to-dismiss on the mobile bottom-sheet handle (desktop simply never
// triggers these gestures in practice, but the listeners are harmless
// either way). Supports touch and mouse so it's testable on desktop too.
// Pure function factory — no module state, everything lives in the
// closures below, so this file has nothing to get out of sync with the
// rest of the modal.

/**
 * @param {HTMLElement} box
 * @param {HTMLElement} handle
 * @param {{dismissThreshold: number, onDismiss: () => void}} opts
 */
export function wireDragToDismiss(box, handle, { dismissThreshold, onDismiss }) {
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
    if (dy > dismissThreshold) {
      onDismiss();
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
