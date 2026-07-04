// chrome.storage.local key names shared across contexts — single source of
// truth so the worker (reads) and the options page (writes) never drift.
// Per-engine keys (e.g. gemini.apiKey) live next to each engine adapter
// instead (docs/ENGINES.md) since only that adapter + the options page need
// them; this file is only for settings more than one unrelated file reads.

/** Which engine the user picked, or absent/removed for "Automatic" (registry.js FALLBACK_ORDER). */
export const ENGINE_ID_STORAGE_KEY = 'engineId';

/** Per-target-language chosen TTS voice: { [langCode]: {voiceURI, name, lang} }, written by
 * the options page's voice pickers, read by the content script when speaking a translation. */
export const TTS_VOICES_STORAGE_KEY = 'ttsVoices';

/** Whether to automatically speak the translation result as soon as it arrives. */
export const TTS_AUTOPLAY_STORAGE_KEY = 'ttsAutoPlay';

/** Global on/off switch (popup toggle) for the selection icon + context-menu
 * translate. Absent/undefined means enabled — this is a kill switch a user
 * flips occasionally, not a setup step, so it must default to on without
 * ever being explicitly written on install. */
export const EXTENSION_ENABLED_STORAGE_KEY = 'extensionEnabled';
