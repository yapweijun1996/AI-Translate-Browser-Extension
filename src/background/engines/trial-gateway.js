// Trial gateway engine adapter — the zero-setup default (SPEC §4, ENGINES.md
// "Engine 1"). Owner-controlled OpenAI-compatible gateway with a daily
// server-side quota; the bundled key is XOR-obfuscated (not real crypto —
// acceptable because the gateway enforces the limit and the key is
// revocable), ported from REFERENCE-SNIPPETS §3.
//
// capabilities().explain is false until T-024 adds the Explain prompt/schema
// to this adapter — translate() alone is what T-014 delivers.

import { EngineError } from './errors.js';
import { mapHttpError, mapNetworkError, extractErrorMessage } from '../error-mapper.js';
import { buildExplainPrompt, parseExplainResponse } from '../explain-schema.js';
import { detectSourceLanguage } from '../lang-detect.js';

const GATEWAY_URL = 'https://gpt.yapweijun1996.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.4-mini';
const REQUEST_TIMEOUT_MS = 30000;
const XOR_SEED = '20260515';
// XOR-obfuscated gateway key — obfuscation only, NOT crypto, acceptable here
// only because the gateway enforces a daily limit server-side and the key
// is revocable (docs/ENGINES.md). The plaintext key must never appear in
// this repo, logs, or error messages.
const ENCRYPTED_DEFAULT_KEY =
  '085071109003002001087084003002084015001086006001081000083087002004085002001086080087081002083012005081000001081002085087001082007087006087002006005000010';

let cachedKey = null;

function decryptKey(cipher, seed) {
  const bytes = [];
  for (let i = 0; i < cipher.length; i += 3) {
    const n = parseInt(cipher.slice(i, i + 3), 10);
    const kc = seed.charCodeAt((i / 3) % seed.length);
    bytes.push(n ^ kc);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function getDefaultKey() {
  if (!cachedKey) cachedKey = decryptKey(ENCRYPTED_DEFAULT_KEY, XOR_SEED);
  return cachedKey;
}

/** Always applies a 30s ceiling, additionally aborting if the caller's own signal fires. */
function withTimeout(externalSignal) {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return externalSignal ? AbortSignal.any([externalSignal, timeoutSignal]) : timeoutSignal;
}

/**
 * Call the gateway's /v1/responses endpoint with streaming SSE and return
 * the assembled plain-text output. Streaming is required — it avoids
 * Cloudflare's 100s edge timeout on longer outputs. `temperature` is
 * intentionally never forwarded — gpt-5.x reasoning models reject it with a
 * 400 — and `reasoning.effort` is always explicit (the gateway's own default
 * is 'xhigh', which drains quota).
 * @param {string} prompt
 * @param {{reasoningEffort?: string, maxOutputTokens?: number, signal?: AbortSignal}} [opts]
 * @returns {Promise<string>}
 */
async function callGateway(prompt, { reasoningEffort = 'low', maxOutputTokens, signal } = {}) {
  const body = {
    model: DEFAULT_MODEL,
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
    stream: true,
    reasoning: { effort: reasoningEffort },
  };
  if (typeof maxOutputTokens === 'number') body.max_output_tokens = maxOutputTokens;

  let res;
  try {
    res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getDefaultKey()}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: withTimeout(signal),
    });
  } catch (cause) {
    throw mapNetworkError(cause, 'Trial gateway');
  }

  if (!res.ok) {
    const bodyMessage = await extractErrorMessage(res);
    // isTrialGateway:true — a 429 here means the free daily allowance ran
    // out, which must trigger the BYOK upsell (SPEC §4/§9), unlike a BYOK
    // engine's own quota (see gemini.js/openai.js/deepseek.js, which don't
    // pass this flag).
    throw mapHttpError({ status: res.status, bodyMessage, providerName: 'Trial gateway', isTrialGateway: true });
  }
  if (!res.body) {
    throw new EngineError('network', 'Trial gateway returned an empty response body.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamed = '';
  let finalText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLines = frame.split('\n').filter((l) => l.startsWith('data:'));
      if (!dataLines.length) continue;
      const payload = dataLines.map((l) => l.slice(5).trimStart()).join('\n');
      if (payload === '[DONE]') continue;
      let evt;
      try {
        evt = JSON.parse(payload);
      } catch {
        continue;
      }
      const t = evt?.type || '';
      if (t === 'response.output_text.delta' && typeof evt.delta === 'string') {
        streamed += evt.delta;
      } else if (t === 'response.completed' && evt.response?.output) {
        for (const item of evt.response.output) {
          if (item.type === 'message') {
            for (const c of item.content || []) {
              if (typeof c.text === 'string') finalText += c.text;
            }
          }
        }
      } else if (t === 'error') {
        throw new EngineError('gateway_error', evt.error?.message || 'Trial gateway stream error.');
      }
    }
  }
  return (finalText || streamed).trim();
}

/** Translate prompt — REFERENCE-SNIPPETS §4, generalized to web content. */
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
export const trialGatewayAdapter = {
  id: 'trial-gateway',
  // Always available — the bundled key needs no user setup. A future kill
  // switch (e.g. a remote disable flag) could make this conditional, but
  // that's not needed for the MVP.
  async isAvailable() {
    return true;
  },
  capabilities() {
    return { translate: true, explain: true, streaming: true };
  },
  async translate(text, targetLang, { signal } = {}) {
    const prompt = buildTranslatePrompt({ text, targetLang });
    return callGateway(prompt, { reasoningEffort: 'low', signal });
  },
  async explain(phrase, targetLang, { context, signal } = {}) {
    const sourceLang = detectSourceLanguage(phrase);
    const prompt = buildExplainPrompt({
      phrase,
      contextParagraph: context,
      sourceLangName: sourceLang.name,
      targetLang,
    });
    const raw = await callGateway(prompt, { reasoningEffort: 'low', maxOutputTokens: 1600, signal });
    return parseExplainResponse(raw, sourceLang);
  },
};
