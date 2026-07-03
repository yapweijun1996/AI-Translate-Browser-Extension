// Single source of truth for message types crossing the content ↔ worker
// boundary. Never inline these strings — import from here.
// Protocol reference: docs/ARCHITECTURE.md "Message protocol".

export const MSG = {
  PING: 'PING',
  TRANSLATE: 'TRANSLATE',
  EXPLAIN: 'EXPLAIN',
  GET_CAPABILITIES: 'GET_CAPABILITIES',
  OPEN_OPTIONS: 'OPEN_OPTIONS',
};

/** Success envelope for message responses. */
export function ok(data) {
  return { ok: true, data };
}

/** Error envelope for message responses. `code` values: docs/ARCHITECTURE.md. */
export function err(code, message) {
  return { ok: false, error: { code, message } };
}
