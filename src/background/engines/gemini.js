// Gemini BYOK engine adapter (ENGINES.md "Engines 3-5"). User supplies their
// own API key in the options page (T-019, not built yet — this adapter
// defines the storage schema T-019 must write to: GEMINI_API_KEY_KEY /
// GEMINI_MODEL_KEY). This is the pattern T-017 (OpenAI) and T-018 (DeepSeek)
// clone: each BYOK engine is a self-contained file with its own settings
// keys, request builder, and error mapping — same shape as trial-gateway.js,
// no shared abstraction, so each is easy to read end-to-end on its own.

import { EngineError } from './errors.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.0-flash';
const REQUEST_TIMEOUT_MS = 30000;

// Storage schema for this engine — T-019's options page reads/writes these.
export const GEMINI_API_KEY_KEY = 'gemini.apiKey';
export const GEMINI_MODEL_KEY = 'gemini.model';

async function getSettings() {
  const stored = await chrome.storage.local.get([GEMINI_API_KEY_KEY, GEMINI_MODEL_KEY]);
  return {
    apiKey: stored[GEMINI_API_KEY_KEY] || '',
    model: stored[GEMINI_MODEL_KEY] || DEFAULT_MODEL,
  };
}

function withTimeout(externalSignal) {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return externalSignal ? AbortSignal.any([externalSignal, timeoutSignal]) : timeoutSignal;
}

/**
 * Call Gemini's generateContent REST endpoint and return the assembled text.
 * @param {string} prompt
 * @param {{apiKey: string, model: string, signal?: AbortSignal}} opts
 * @returns {Promise<string>}
 */
async function callGemini(prompt, { apiKey, model, signal }) {
  const url = `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3 },
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: withTimeout(signal),
    });
  } catch (cause) {
    if (cause?.name === 'AbortError' || cause?.name === 'TimeoutError') {
      throw new EngineError('timeout', 'Gemini request timed out or was cancelled.');
    }
    throw new EngineError('network', cause?.message || 'Network error contacting Gemini.');
  }

  if (!res.ok) {
    // Interim mapping by HTTP status only (same honesty caveat as
    // trial-gateway.js) — classification never trusts response-body content,
    // only its own display text does. Refine once real error responses have
    // been observed against a live key.
    let apiMessage;
    try {
      apiMessage = (await res.json())?.error?.message;
    } catch {
      /* body wasn't JSON — fall back to the generic message below */
    }
    const code = res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'quota' : 'gateway_error';
    throw new EngineError(code, apiMessage || `Gemini error (HTTP ${res.status}).`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw new EngineError('unknown', 'Gemini returned an unexpected response shape.');
  }
  return text.trim();
}

/** Translate prompt — same shape as REFERENCE-SNIPPETS §4 / trial-gateway.js. */
function buildTranslatePrompt({ text, targetLang }) {
  return (
    `You are translating web page content to ${targetLang}.\n\n` +
    `Before translating, silently clean the input:\n` +
    `- Drop citation markers like [1], [12, 5] entirely (they're not content)\n` +
    `- Drop stray UI labels / footnote markers that appear mid-sentence\n` +
    `- Reconnect words split by hyphens at line breaks (e.g. "se- quence" → "sequence")\n` +
    `- Keep code, math symbols and variable names as-is — do not translate them\n` +
    `- Normalize whitespace; do NOT add Markdown unless the source is structured\n\n` +
    `Output: the cleaned, fluent ${targetLang} translation only.\n` +
    `No explanation, no quotes, no preamble.\n\n` +
    `INPUT:\n${text}`
  );
}

/** @type {import('./registry.js').EngineAdapter} */
export const geminiAdapter = {
  id: 'gemini',
  async isAvailable() {
    const { apiKey } = await getSettings();
    return apiKey.trim().length > 0;
  },
  capabilities() {
    // explain:false until T-024 adds the Explain prompt to this adapter.
    return { translate: true, explain: false, streaming: false };
  },
  async translate(text, targetLang, { signal } = {}) {
    const { apiKey, model } = await getSettings();
    if (!apiKey) {
      throw new EngineError('auth', 'No Gemini API key is configured.');
    }
    const prompt = buildTranslatePrompt({ text, targetLang });
    return callGemini(prompt, { apiKey, model, signal });
  },
};
