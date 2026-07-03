// IndexedDB explain cache (SPEC §6, T-026). Separate from translation-cache.js
// (T-020) because the key shape and versioning axis differ: explain is keyed
// by page origin instead of engine id (an explanation shouldn't change just
// because the active engine changed, unlike a translation's wording), and
// invalidates on SCHEMA_VERSION (explain-schema.js) rather than PROMPT_VERSION.

import { get, set, del } from 'idb-keyval';
import { SCHEMA_VERSION } from './explain-schema.js';

// Explain payloads are much heavier objects (definitions, graded examples,
// word lists) than a single translated string, so this cache uses a smaller
// cap than translation-cache.js's 3000 — still "a few thousand" per SPEC §6,
// just sized for the bigger per-entry footprint.
const CACHE_LIMIT = 1500;
const INDEX_KEY = 'explain::__index__';

function normalizePhrase(phrase) {
  return (phrase || '').trim().toLowerCase().slice(0, 200);
}

function buildCacheKey(origin, phrase, targetLang) {
  return `explain::v${SCHEMA_VERSION}::${origin}::${normalizePhrase(phrase)}::${targetLang}`;
}

async function touchIndex(key) {
  const idx = (await get(INDEX_KEY)) || [];
  const existing = idx.findIndex((e) => e.key === key);
  if (existing >= 0) idx.splice(existing, 1);
  idx.push({ key, ts: Date.now() });
  await set(INDEX_KEY, idx);
}

async function evictIfOverLimit() {
  const idx = (await get(INDEX_KEY)) || [];
  if (idx.length <= CACHE_LIMIT) return;
  const toEvict = idx.slice(0, idx.length - CACHE_LIMIT);
  for (const entry of toEvict) {
    await del(entry.key);
  }
  await set(INDEX_KEY, idx.slice(idx.length - CACHE_LIMIT));
}

/**
 * @param {string} origin page origin the phrase was selected on (coarse
 *   per-site scoping, per SPEC §6 — not the full page URL or paragraph hash)
 * @param {string} phrase
 * @param {string} targetLang
 * @returns {Promise<object|undefined>} the cached SPEC §5 explain payload, or undefined on a miss
 */
export async function getCachedExplain(origin, phrase, targetLang) {
  const key = buildCacheKey(origin, phrase, targetLang);
  const value = await get(key);
  if (value !== undefined) await touchIndex(key); // reads count toward LRU recency too
  return value;
}

/** Stores an explain payload and evicts the least-recently-used entry if over CACHE_LIMIT. */
export async function setCachedExplain(origin, phrase, targetLang, payload) {
  const key = buildCacheKey(origin, phrase, targetLang);
  await set(key, payload);
  await touchIndex(key);
  await evictIfOverLimit();
}
