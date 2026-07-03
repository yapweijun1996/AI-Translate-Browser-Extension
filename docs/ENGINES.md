# Translation engines

All engines live in the **service worker** behind one adapter interface. The content script never knows which engine ran — it just gets a result or an error code.

## Adapter interface (T-013)

```js
/** Every engine module exports this shape. */
export const adapter = {
  id: 'trial-gateway',                    // stable id stored in settings
  async isAvailable() {},                 // feature-detect / key present?
  capabilities() {                        // what the UI may offer
    return { translate: true, explain: true, streaming: true };
  },
  async translate(text, targetLang, { context, signal }) {},  // → string
  async explain(phrase, targetLang, { context, signal }) {},  // → SPEC §5 payload (LLM engines only)
};
```

Registry (`background/engines/index.js`) resolves the active adapter from settings, with fallback order: user-selected → trial gateway → on-device.

## Engine 1 — Trial gateway (shipped default)

- Endpoint: `https://gpt.yapweijun1996.com/v1/responses` (OpenAI-compatible `/v1/responses`, SSE streaming).
- Model: `gpt-5.4-mini`. Always pass `reasoning: {effort: "low"}` explicitly — the gateway's own default is `xhigh`, which drains quota.
- Auth: `Bearer` key bundled as an **XOR cipher string** (seed `20260515`). Port `decryptKey()` + the SSE parse loop from [REFERENCE-SNIPPETS §3](REFERENCE-SNIPPETS.md) unchanged (the cipher string is there too). The plaintext key must never appear in the repo, logs, or error messages.
- Why bundling is OK here (and only here): the gateway is owner-controlled, enforces a **daily token limit server-side**, and the key can be rotated/revoked anytime. This is the try-before-BYOK funnel (SPEC §4).
- Streaming is required — it avoids Cloudflare's 100s edge timeout on long outputs.

### Quota error → upsell (the important part)

When the daily limit is hit the gateway returns an error (**exact status/body: probe the live gateway in T-021 and document it here**). The error mapper must translate it to:

```js
{ code: 'trial_quota_exhausted', message: <i18n key ref> }
```

Content script behavior on this code (SPEC §9): show the upsell — "free quota used up today" + [Set up your own API key] (opens options) + [Try again tomorrow] + on-device fallback offer when available. **A BYOK user's own provider quota error maps to `quota`, not `trial_quota_exhausted`** — they must never see the upsell.

## Engine 2 — Chrome on-device Translator (free/private path)

- APIs: `Translator` + `LanguageDetector` (Chrome 138+ desktop).
- `isAvailable()`: feature-detect + `availability()` check; handle `downloadable` state (model downloads on first use — surface progress, don't hang silently).
- `capabilities()`: `{translate: true, explain: false, streaming: false}` → UI hides/disables Explain with an i18n hint.
- No key, no network, no quota. Offer it as fallback in the quota upsell.

## Engines 3–5 — BYOK: Gemini (T-016), OpenAI (T-017), DeepSeek (T-018)

- Key from `chrome.storage.local` (options page writes it, worker reads it, masked in UI, never sent to content script).
- Gemini: `generateContent` REST. OpenAI: `/v1/chat/completions` (or `/v1/responses`). DeepSeek: OpenAI-compatible endpoint.
- All three power translate + explain. Auth failure maps to `code: 'auth'` → UI points at options page.
- Once a BYOK engine is selected, the trial gateway is not called at all for that user.

## Prompts

- Translate prompt: [REFERENCE-SNIPPETS §4](REFERENCE-SNIPPETS.md) (cleaning rules: drop citation markers, fix hyphen-split words, keep code/math tokens, output translation only).
- Explain prompt: [REFERENCE-SNIPPETS §5](REFERENCE-SNIPPETS.md) verbatim (strict JSON, CEFR-graded examples, simpler-vocabulary rule, loose-parse fallback).
- Prompts are versioned: bumping a prompt bumps `PROMPT_VERSION`, which invalidates the cache (SPEC §6).

## Adding a new engine later

1. New module in `background/engines/`, export the adapter shape.
2. Register in the registry + options page picker (+ i18n keys for its name/settings).
3. Map its error responses in the central error mapper.
4. Document it in this file (endpoint, auth, quirks).
5. No content-script changes should ever be needed — if they are, the abstraction broke; stop and discuss.
