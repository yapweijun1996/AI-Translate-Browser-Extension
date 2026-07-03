// Single source of truth for message types crossing the content ↔ worker
// boundary. Never inline these strings — import from here.
// Protocol reference: docs/ARCHITECTURE.md "Message protocol".

export const MSG = {
  PING: 'PING',
  TRANSLATE: 'TRANSLATE',
  EXPLAIN: 'EXPLAIN',
  GET_CAPABILITIES: 'GET_CAPABILITIES',
  // Sent by the options page (T-019) to render the engine picker — the
  // registry (which engines exist, whether each is available right now) is
  // worker-only runtime state, so the options page can't read it directly
  // the way it reads plain settings from chrome.storage.local.
  LIST_ENGINES: 'LIST_ENGINES',
  // worker → content (T-029): the ONLY message type that flows this
  // direction — sent via chrome.tabs.sendMessage (not chrome.runtime.
  // sendMessage's extension-wide broadcast) when the user picks "Translate
  // selection" from the native context menu, so just that tab's content
  // script re-enters the same translateSelection() pipeline the trigger
  // icon uses.
  MENU_TRANSLATE_SELECTION: 'MENU_TRANSLATE_SELECTION',
};

/** Success envelope for message responses. */
export function ok(data) {
  return { ok: true, data };
}

/** Error envelope for message responses. `code` values: docs/ARCHITECTURE.md. */
export function err(code, message) {
  return { ok: false, error: { code, message } };
}
