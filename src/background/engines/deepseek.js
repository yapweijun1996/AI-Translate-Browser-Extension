// DeepSeek BYOK engine adapter (ENGINES.md "Engines 3-5"). Clone of
// openai.js — DeepSeek's endpoint is OpenAI-compatible (identical
// messages/role/content request shape, identical choices[0].message.content
// response shape), so only the endpoint/model/error-text differ. Same
// self-contained-file pattern as gemini.js/openai.js: own settings keys,
// own request builder, own error mapping, own translate prompt copy.

import { EngineError } from './errors.js';

const API_URL = 'https://api.deepseek.com/chat/completions';
// DeepSeek's legacy 'deepseek-chat'/'deepseek-reasoner' model names are
// deprecated 2026-07-24 (confirmed against api-docs.deepseek.com 2026-07-03,
// i.e. ~3 weeks out from this commit) in favor of deepseek-v4-flash (fast/
// cheap, non-thinking) and deepseek-v4-pro (higher quality, thinking mode).
// Default to the current name so this doesn't need revisiting before it
// even ships.
const DEFAULT_MODEL = 'deepseek-v4-flash';
const REQUEST_TIMEOUT_MS = 30000;

// Storage schema for this engine — T-019's options page reads/writes these
// (same pattern as gemini.js / openai.js).
export const DEEPSEEK_API_KEY_KEY = 'deepseek.apiKey';
export const DEEPSEEK_MODEL_KEY = 'deepseek.model';

async function getSettings() {
  const stored = await chrome.storage.local.get([DEEPSEEK_API_KEY_KEY, DEEPSEEK_MODEL_KEY]);
  return {
    apiKey: stored[DEEPSEEK_API_KEY_KEY] || '',
    model: stored[DEEPSEEK_MODEL_KEY] || DEFAULT_MODEL,
  };
}

function withTimeout(externalSignal) {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return externalSignal ? AbortSignal.any([externalSignal, timeoutSignal]) : timeoutSignal;
}

/**
 * Call DeepSeek's (OpenAI-compatible) chat.completions endpoint and return
 * the assembled text.
 * @param {string} prompt
 * @param {{apiKey: string, model: string, signal?: AbortSignal}} opts
 * @returns {Promise<string>}
 */
async function callDeepSeek(prompt, { apiKey, model, signal }) {
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  };

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: withTimeout(signal),
    });
  } catch (cause) {
    if (cause?.name === 'AbortError' || cause?.name === 'TimeoutError') {
      throw new EngineError('timeout', 'DeepSeek request timed out or was cancelled.');
    }
    throw new EngineError('network', cause?.message || 'Network error contacting DeepSeek.');
  }

  if (!res.ok) {
    // Interim mapping by HTTP status only — same honesty caveat as
    // trial-gateway.js/gemini.js/openai.js. Never trusts response-body
    // content for classification, only uses it for display text.
    let apiMessage;
    try {
      apiMessage = (await res.json())?.error?.message;
    } catch {
      /* body wasn't JSON — fall back to the generic message below */
    }
    const code = res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'quota' : 'gateway_error';
    throw new EngineError(code, apiMessage || `DeepSeek error (HTTP ${res.status}).`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') {
    throw new EngineError('unknown', 'DeepSeek returned an unexpected response shape.');
  }
  return text.trim();
}

/** Translate prompt — same shape as REFERENCE-SNIPPETS §4 / trial-gateway.js / gemini.js / openai.js. */
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
export const deepseekAdapter = {
  id: 'deepseek',
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
      throw new EngineError('auth', 'No DeepSeek API key is configured.');
    }
    const prompt = buildTranslatePrompt({ text, targetLang });
    return callDeepSeek(prompt, { apiKey, model, signal });
  },
};
