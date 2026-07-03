// Engine adapter registry — the seam between the worker's message handlers
// and the concrete translation engines (trial gateway T-014, on-device
// T-015, BYOK Gemini/OpenAI/DeepSeek T-016..T-018 — all five now registered
// in service-worker.js). See docs/ENGINES.md for the adapter shape and
// per-engine notes.

import { EngineError } from './errors.js';
import { ENGINE_ID_STORAGE_KEY } from '../../shared/settings-keys.js';
import { getCachedTranslation, setCachedTranslation } from '../translation-cache.js';
import { getCachedExplain, setCachedExplain } from '../explain-cache.js';

/**
 * @typedef {object} EngineAdapter
 * @property {string} id stable id stored in settings, e.g. 'trial-gateway'
 * @property {() => Promise<boolean>} isAvailable feature-detect / key present?
 * @property {() => {translate: boolean, explain: boolean, streaming: boolean}} capabilities
 * @property {(text: string, targetLang: string, opts: {context?: string, signal?: AbortSignal}) => Promise<string>} translate
 * @property {(phrase: string, targetLang: string, opts: {context?: string, signal?: AbortSignal}) => Promise<object>} [explain]
 *   Only required when capabilities().explain is true.
 */

const SETTINGS_KEY = ENGINE_ID_STORAGE_KEY;
// Order to try when the user hasn't picked an engine, or their pick isn't
// available right now (SPEC §4: on-device is the free/private fallback).
const FALLBACK_ORDER = ['trial-gateway', 'on-device'];

/** @type {Map<string, EngineAdapter>} */
const engines = new Map();

/** Register an engine adapter. Later calls with the same id replace the earlier one. */
export function registerEngine(adapter) {
  engines.set(adapter.id, adapter);
}

/** @returns {EngineAdapter[]} every registered adapter, for the options page engine picker (T-019). */
export function listEngines() {
  return [...engines.values()];
}

/** Remove all registered engines. Test-only — production code never needs this. */
export function _resetEngines() {
  engines.clear();
}

async function getPreferredEngineId() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return stored?.[SETTINGS_KEY];
}

/**
 * Resolve which engine should handle the next request: the user's saved
 * preference if it's registered and available, else the first available
 * engine in FALLBACK_ORDER.
 * @returns {Promise<EngineAdapter|null>} null when nothing is available.
 */
export async function getActiveEngine() {
  const preferred = await getPreferredEngineId();
  const order = preferred ? [preferred, ...FALLBACK_ORDER] : FALLBACK_ORDER;
  const tried = new Set();
  for (const id of order) {
    if (tried.has(id)) continue; // preferred id may already be in FALLBACK_ORDER
    tried.add(id);
    const adapter = engines.get(id);
    if (adapter && (await adapter.isAvailable())) return adapter;
  }
  return null;
}

/** Resolves a SPECIFIC engine id regardless of settings, for the one-shot
 * "use on-device instead" retry in the trial-quota upsell (T-022) — never
 * changes the user's persistent preference. Returns null if unregistered
 * or not currently available (same availability gate as normal resolution). */
async function resolveOverrideEngine(id) {
  const adapter = engines.get(id);
  if (adapter && (await adapter.isAvailable())) return adapter;
  return null;
}

/**
 * @param {string} text @param {string} targetLang
 * @param {{context?: string, signal?: AbortSignal, engineOverride?: string}} [opts]
 *   `engineOverride`: bypass the normal preference/fallback resolution and
 *   use this specific engine id for just this call (T-022's on-device retry).
 * @returns {Promise<{translated: string, engine: string, cached: boolean}>}
 *   Shape matches the TRANSLATE response documented in docs/ARCHITECTURE.md.
 */
export async function translate(text, targetLang, opts = {}) {
  const engine = opts.engineOverride ? await resolveOverrideEngine(opts.engineOverride) : await getActiveEngine();
  if (!engine) {
    throw new EngineError('no_engine_available', 'No translation engine is configured or available.');
  }

  const cached = await getCachedTranslation(text, targetLang, engine.id);
  if (cached !== undefined) {
    return { translated: cached, engine: engine.id, cached: true };
  }

  const translated = await engine.translate(text, targetLang, opts);
  await setCachedTranslation(text, targetLang, engine.id, translated);
  return { translated, engine: engine.id, cached: false };
}

/**
 * @param {string} phrase @param {string} targetLang
 * @param {{context?: string, signal?: AbortSignal, origin?: string}} [opts]
 *   `origin` (the page's location.origin, supplied by main.js) scopes the
 *   cache per SPEC §6 — explain results aren't hashed by engine like
 *   translate()'s cache, since the explanation shouldn't change just
 *   because the active engine changed.
 * @returns {Promise<object>} SPEC §5 explain payload (cached or freshly computed)
 */
export async function explain(phrase, targetLang, opts = {}) {
  const engine = await getActiveEngine();
  if (!engine) {
    throw new EngineError('no_engine_available', 'No translation engine is configured or available.');
  }
  if (!engine.capabilities().explain) {
    throw new EngineError('explain_unsupported', 'The active translation engine does not support Explain.');
  }

  const origin = opts.origin || 'unknown-origin';
  const cached = await getCachedExplain(origin, phrase, targetLang);
  if (cached !== undefined) return cached;

  const payload = await engine.explain(phrase, targetLang, opts);
  await setCachedExplain(origin, phrase, targetLang, payload);
  return payload;
}
