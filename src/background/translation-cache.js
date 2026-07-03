// IndexedDB translation cache (SPEC §6). Avoids redundant API calls (cost +
// latency) for text the user has already translated with the same target
// language and engine. Explain gets its own cache in T-026 — this file is
// translation-only, matching T-020's scope.

import { get, set, del } from 'idb-keyval';

// Bump whenever a translate prompt (trial-gateway.js / gemini.js / openai.js
// / deepseek.js buildTranslatePrompt) changes — old cache entries stop
// matching new keys and are naturally superseded, no explicit migration
// needed (REFERENCE-SNIPPETS §6).
const PROMPT_VERSION = 1;

// "A few thousand entries" per SPEC §6.
const CACHE_LIMIT = 3000;
const INDEX_KEY = 'trans::__index__';

async function hashText(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function buildCacheKey(text, targetLang, engineId) {
  const hash = await hashText(text);
  return `trans::v${PROMPT_VERSION}::${targetLang}::${engineId}::${hash}`;
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
 * @param {string} text
 * @param {string} targetLang
 * @param {string} engineId
 * @returns {Promise<string|undefined>} the cached translation, or undefined on a miss
 */
export async function getCachedTranslation(text, targetLang, engineId) {
  const key = await buildCacheKey(text, targetLang, engineId);
  const value = await get(key);
  if (value !== undefined) await touchIndex(key); // reads count toward LRU recency too
  return value;
}

/** Stores a translation result and evicts the least-recently-used entry if over CACHE_LIMIT. */
export async function setCachedTranslation(text, targetLang, engineId, translated) {
  const key = await buildCacheKey(text, targetLang, engineId);
  await set(key, translated);
  await touchIndex(key);
  await evictIfOverLimit();
}
