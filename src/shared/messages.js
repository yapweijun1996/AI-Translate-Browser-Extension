// Single source of truth for message types crossing the content ↔ worker
// boundary. Never inline these strings — import from here.
// Protocol reference: docs/ARCHITECTURE.md "Message protocol".

export const MSG = {
  PING: 'PING',
  TRANSLATE: 'TRANSLATE',
  EXPLAIN: 'EXPLAIN',
  GET_CAPABILITIES: 'GET_CAPABILITIES',
  OPEN_OPTIONS: 'OPEN_OPTIONS',
  // Sent by the options page (T-019) to render the engine picker — the
  // registry (which engines exist, whether each is available right now) is
  // worker-only runtime state, so the options page can't read it directly
  // the way it reads plain settings from chrome.storage.local.
  LIST_ENGINES: 'LIST_ENGINES',
};

/** Success envelope for message responses. */
export function ok(data) {
  return { ok: true, data };
}

/** Error envelope for message responses. `code` values: docs/ARCHITECTURE.md. */
export function err(code, message) {
  return { ok: false, error: { code, message } };
}
