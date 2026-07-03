// OpenAI BYOK engine adapter (ENGINES.md "Engines 3-5"). Clone of gemini.js's
// pattern: self-contained file, own settings keys, own request builder, own
// error mapping, own translate prompt copy — no shared abstraction, so this
// file (like gemini.js) is readable end-to-end on its own. T-018 (DeepSeek)
// clones this same shape again, swapping only the endpoint/model/auth.

import { EngineError } from './errors.js';
import { mapHttpError, mapNetworkError, extractErrorMessage } from '../error-mapper.js';
import { buildExplainPrompt, parseExplainResponse } from '../explain-schema.js';
import { detectSourceLanguage } from '../lang-detect.js';

const API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-5.4-mini';
const REQUEST_TIMEOUT_MS = 30000;

// Storage schema for this engine — T-019's options page reads/writes these
// (same pattern as gemini.js's GEMINI_API_KEY_KEY / GEMINI_MODEL_KEY).
export const OPENAI_API_KEY_KEY = 'openai.apiKey';
export const OPENAI_MODEL_KEY = 'openai.model';

async function getSettings() {
  const stored = await chrome.storage.local.get([OPENAI_API_KEY_KEY, OPENAI_MODEL_KEY]);
  return {
    apiKey: stored[OPENAI_API_KEY_KEY] || '',
    model: stored[OPENAI_MODEL_KEY] || DEFAULT_MODEL,
  };
}

function withTimeout(externalSignal) {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return externalSignal ? AbortSignal.any([externalSignal, timeoutSignal]) : timeoutSignal;
}

/**
 * Call OpenAI's chat.completions endpoint and return the assembled text.
 * No output-token cap is set here (unlike gemini.js's confirmed
 * generationConfig.maxOutputTokens) — OpenAI's own field name for this has
 * shifted across model generations (max_tokens vs max_completion_tokens)
 * and wasn't verified live for this task (platform.openai.com blocked the
 * WebFetch check during T-017); guessing wrong risks a 400 the same way
 * forwarding `temperature` to gpt-5.x reasoning models does (trial-gateway.js).
 * The model's own default ceiling is generous enough for Explain's ~1500
 * token JSON response in practice.
 * @param {string} prompt
 * @param {{apiKey: string, model: string, signal?: AbortSignal}} opts
 * @returns {Promise<string>}
 */
async function callOpenAI(prompt, { apiKey, model, signal }) {
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
    throw mapNetworkError(cause, 'OpenAI');
  }

  if (!res.ok) {
    const bodyMessage = await extractErrorMessage(res);
    // isTrialGateway defaults to false — a BYOK user's own quota/rate-limit
    // maps to plain 'quota' (shown as a normal message), never the trial
    // upsell (SPEC §9).
    throw mapHttpError({ status: res.status, bodyMessage, providerName: 'OpenAI' });
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') {
    throw new EngineError('unknown', 'OpenAI returned an unexpected response shape.');
  }
  return text.trim();
}

/** Translate prompt — same shape as REFERENCE-SNIPPETS §4 / trial-gateway.js / gemini.js. */
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
export const openaiAdapter = {
  id: 'openai',
  async isAvailable() {
    const { apiKey } = await getSettings();
    return apiKey.trim().length > 0;
  },
  capabilities() {
    return { translate: true, explain: true, streaming: false };
  },
  async translate(text, targetLang, { signal } = {}) {
    const { apiKey, model } = await getSettings();
    if (!apiKey) {
      throw new EngineError('auth', 'No OpenAI API key is configured.');
    }
    const prompt = buildTranslatePrompt({ text, targetLang });
    return callOpenAI(prompt, { apiKey, model, signal });
  },
  async explain(phrase, targetLang, { context, signal } = {}) {
    const { apiKey, model } = await getSettings();
    if (!apiKey) {
      throw new EngineError('auth', 'No OpenAI API key is configured.');
    }
    const sourceLang = detectSourceLanguage(phrase);
    const prompt = buildExplainPrompt({
      phrase,
      contextParagraph: context,
      sourceLangName: sourceLang.name,
      targetLang,
    });
    const raw = await callOpenAI(prompt, { apiKey, model, signal });
    return parseExplainResponse(raw, sourceLang);
  },
};
