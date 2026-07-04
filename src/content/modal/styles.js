// The modal's CSS, injected once into the shadow root by modal.js's
// ensureBox(). Split out purely so the ~350-line style block doesn't sit in
// the middle of the behavior code — no logic lives here.

import { BOX_WIDTH, EDGE_MARGIN, RESIZE_HANDLE_THICKNESS } from './constants.js';

export const MODAL_CSS = `
  .modal {
    position: fixed;
    display: none;
    width: ${BOX_WIDTH}px;
    max-width: calc(100vw - ${EDGE_MARGIN * 2}px);
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
    /* No height here — a percentage height wouldn't reliably resolve
       against .modal anyway, since .modal is only ever given a max-height,
       never an explicit height, and a max-height-clamped 'auto' height
       doesn't count as "definite" for a child's height:100% to resolve
       against per the CSS spec. This module used to rely on that
       percentage and it silently stopped containing overflow once
       .modal-content was split out for the resize handles. It owns its
       max-height directly instead now (position.js/resize.js set it via
       inline style; this is just the passive pre-JS default), so there's
       no indirection left to get wrong. */
    max-height: calc(100vh - ${EDGE_MARGIN * 2}px);
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
  /* No max-height/overflow of its own (dropped when .modal-content became
     the single scroll container) — an inner 320px cap here would make the
     manual resize feature useless for exactly the content it exists for:
     dragging the box taller wouldn't reveal any more of the Explain payload,
     just add a second, nested scrollbar. */
  .modal-explain-body {
    margin-top: 10px;
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
