// chrome.storage.local key names shared across contexts — single source of
// truth so the worker (reads) and the options page (writes) never drift.
// Per-engine keys (e.g. gemini.apiKey) live next to each engine adapter
// instead (docs/ENGINES.md) since only that adapter + the options page need
// them; this file is only for settings more than one unrelated file reads.

/** Which engine the user picked, or absent/removed for "Automatic" (registry.js FALLBACK_ORDER). */
export const ENGINE_ID_STORAGE_KEY = 'engineId';
