// Demo gateway engine adapter — the zero-setup default (SPEC §4,
// ENGINES.md "Engine 1"). The gateway issues a short-lived, origin-bound
// demo token; no gateway/API key is bundled in the extension.

import { EngineError } from './errors.js';
import { mapHttpError, mapNetworkError, extractErrorMessage } from '../error-mapper.js';
import { buildExplainPrompt, parseExplainResponse } from '../explain-schema.js';
import { detectSourceLanguage } from '../lang-detect.js';

const GATEWAY_BASE = 'https://gpt.yapweijun1996.com';
const SESSION_URL = `${GATEWAY_BASE}/demo/session`;
const RESPONSES_URL = `${GATEWAY_BASE}/demo/v1/responses`;
// This project id must be registered for the extension's exact Origin at the gateway.
const DEMO_PROJECT_ID = 'ai-translate';
const DEMO_MODEL = 'demo-fast';
const REQUEST_TIMEOUT_MS = 30000;
const TOKEN_REFRESH_SKEW_MS = 5000;

let sessionToken = null;
let sessionExpiresAt = 0;
let sessionPromise = null;

/** Always applies a 30s ceiling, additionally aborting if the caller's own signal fires. */
function withTimeout(externalSignal) {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return externalSignal ? AbortSignal.any([externalSignal, timeoutSignal]) : timeoutSignal;
}

/**
 * Obtain one origin-bound demo token and share concurrent session requests.
 * The token is deliberately kept only in service-worker memory; MV3 worker
 * restarts simply obtain a fresh short-lived session.
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
async function getSessionToken(signal) {
  if (sessionToken && sessionExpiresAt - TOKEN_REFRESH_SKEW_MS > Date.now()) return sessionToken;
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    let res;
    try {
      // No Authorization header: the demo session endpoint validates the
      // browser's automatically supplied Origin (and optional Turnstile token).
      res = await fetch(SESSION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: DEMO_PROJECT_ID }),
        signal: withTimeout(signal),
      });
    } catch (cause) {
      throw mapNetworkError(cause, 'Demo gateway');
    }
    if (!res.ok) {
      const bodyMessage = await extractErrorMessage(res);
      throw mapHttpError({
        status: res.status,
        bodyMessage,
        providerName: 'Demo gateway',
        isTrialGateway: true,
      });
    }

    let data;
    try {
      data = await res.json();
    } catch {
      throw new EngineError('gateway_error', 'Demo gateway returned an invalid session response.');
    }
    if (typeof data?.token !== 'string' || !data.token.startsWith('dmo_')) {
      throw new EngineError('gateway_error', 'Demo gateway returned an invalid session token.');
    }

    sessionToken = data.token;
    const expiresIn = Number(data.expires_in);
    const expiresAt =
      typeof data.expires_at === 'string' ? Date.parse(data.expires_at) : Number(data.expires_at);
    sessionExpiresAt = Number.isFinite(expiresIn)
      ? Date.now() + Math.max(1, expiresIn) * 1000
      : Number.isFinite(expiresAt) && expiresAt > Date.now()
        ? expiresAt
        : Date.now() + 5 * 60 * 1000;
    return sessionToken;
  })().finally(() => {
    sessionPromise = null;
  });

  return sessionPromise;
}

function extractResponseText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  const outputText = Array.isArray(data?.output)
    ? data.output
        .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .join('')
    : '';
  if (outputText) return outputText;
  const chatText = data?.choices?.[0]?.message?.content;
  return typeof chatText === 'string' ? chatText : '';
}

/**
 * Call the non-streaming Demo Responses endpoint and return plain text.
 * The public demo API uses a short-lived dmo_ bearer token and the single
 * `demo-fast` model; unlike the old private gateway path, it does not require
 * the extension to carry an owner key or send SSE-specific request fields.
 * @param {string} prompt
 * @param {{signal?: AbortSignal, retried?: boolean}} [opts]
 * @returns {Promise<string>}
 */
async function callGateway(prompt, { signal, retried = false } = {}) {
  const token = await getSessionToken(signal);
  let res;
  try {
    res = await fetch(RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: DEMO_MODEL, input: prompt }),
      signal: withTimeout(signal),
    });
  } catch (cause) {
    throw mapNetworkError(cause, 'Demo gateway');
  }

  // A worker may retain a token until the server rejects it. Refresh once,
  // then surface the second failure instead of retrying indefinitely.
  if (res.status === 401 && !retried) {
    sessionToken = null;
    sessionExpiresAt = 0;
    return callGateway(prompt, { signal, retried: true });
  }
  if (!res.ok) {
    const bodyMessage = await extractErrorMessage(res);
    throw mapHttpError({
      status: res.status,
      bodyMessage,
      providerName: 'Demo gateway',
      isTrialGateway: true,
    });
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new EngineError('gateway_error', 'Demo gateway returned an invalid response.');
  }
  const text = extractResponseText(data);
  if (!text) throw new EngineError('gateway_error', 'Demo gateway returned an empty response.');
  return text.trim();
}

/** Translate prompt — generalized from REFERENCE-SNIPPETS §4 to web content. */
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
  // The demo session has no user setup, so availability is determined by the
  // request itself (including the gateway's registered-Origin check).
  async isAvailable() {
    return true;
  },
  capabilities() {
    return { translate: true, explain: true, streaming: false };
  },
  async translate(text, targetLang, { signal } = {}) {
    const prompt = buildTranslatePrompt({ text, targetLang });
    return callGateway(prompt, { signal });
  },
  async explain(phrase, targetLang, { context, signal } = {}) {
    const sourceLang = detectSourceLanguage(phrase);
    const prompt = buildExplainPrompt({
      phrase,
      contextParagraph: context,
      sourceLangName: sourceLang.name,
      targetLang,
    });
    const raw = await callGateway(prompt, { signal });
    return parseExplainResponse(raw, sourceLang);
  },
};
