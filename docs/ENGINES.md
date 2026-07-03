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

Registry (`background/engines/registry.js`) resolves the active adapter from settings, with fallback order: user-selected → trial gateway → on-device.

## Engine 1 — Trial gateway (shipped default)

- Endpoint: `https://gpt.yapweijun1996.com/v1/responses` (OpenAI-compatible `/v1/responses`, SSE streaming).
- Model: `gpt-5.4-mini`. Always pass `reasoning: {effort: "low"}` explicitly — the gateway's own default is `xhigh`, which drains quota.
- Explain (T-024): `capabilities().explain` is `true` — the same `callGateway()` used for translate is reused with the Explain prompt (`maxOutputTokens: 1600`) and the shared parser (see "Prompts" below).
- Auth: `Bearer` key bundled as an **XOR cipher string** (seed `20260515`). Port `decryptKey()` + the SSE parse loop from [REFERENCE-SNIPPETS §3](REFERENCE-SNIPPETS.md) unchanged (the cipher string is there too). The plaintext key must never appear in the repo, logs, or error messages.
- Why bundling is OK here (and only here): the gateway is owner-controlled, enforces a **daily token limit server-side**, and the key can be rotated/revoked anytime. This is the try-before-BYOK funnel (SPEC §4).
- Streaming is required — it avoids Cloudflare's 100s edge timeout on long outputs.

### Quota error → upsell (the important part)

`background/error-mapper.js` (T-021) is the single place every engine's HTTP failures get classified: `mapHttpError({status, bodyMessage, providerName, isTrialGateway})` maps a `429` to `trial_quota_exhausted` when `isTrialGateway: true` (trial-gateway.js is the only adapter that passes it), or to plain `quota` otherwise. Every engine calls this instead of duplicating status-code judgment calls — see `trial-gateway.js`/`gemini.js`/`openai.js`/`deepseek.js` for the (now nearly identical) call sites.

**Deliberately not verified against a live 429 (owner decision, 2026-07-03):** the gateway's exact daily-limit response shape was NOT probed by deliberately exhausting real quota — the owner already has quota-handling logic server-side and forcing it from here isn't this project's job. The classification above assumes standard HTTP semantics (`429 Too Many Requests`), which is how virtually every rate-limited API signals this. If the live gateway ever turns out to use a different status or a distinguishable body shape for "daily limit" vs. some other `429` cause, `mapHttpError`'s `isTrialGateway` branch is the one place to refine.

Content script behavior on `trial_quota_exhausted` (SPEC §9, wired by T-022): show the upsell — "free quota used up today" + [Set up your own API key] (opens options) + [Try again tomorrow] + on-device fallback offer when available. A BYOK user's own provider quota error maps to `quota`, not `trial_quota_exhausted` — they must never see the upsell.

## Engine 2 — Chrome on-device Translator (free/private path)

- APIs: `Translator` + `LanguageDetector` (Chrome 138+ desktop).
- **Requires an offscreen document (discovered during T-015).** These APIs need a real Document to check Permissions-Policy status and are explicitly documented as unavailable in Web Workers — the service worker cannot call them directly. Architecture: `background/engines/on-device.js` (the adapter, runs in the worker) creates/reuses an offscreen document at `src/offscreen/offscreen.html` via `chrome.offscreen.createDocument()` (manifest permission: `"offscreen"`) and relays requests to it over `chrome.runtime` messaging using an internal protocol (`background/engines/on-device-protocol.js`, `OD_MSG.CHECK_SUPPORT` / `OD_MSG.TRANSLATE`) — content scripts never talk to the offscreen document directly, only through the worker, same as every other engine. `src/offscreen/offscreen.js` is the only file allowed to reference the `Translator`/`LanguageDetector` globals.
- **Gotcha this creates:** `chrome.runtime.sendMessage` broadcasts to every listener in the extension, including the sender's own — so the worker's own `onMessage` listener also sees the `OD_MSG.*` messages it just sent to the offscreen document. Its default case must explicitly ignore (`return false`, no `sendResponse`) any type in `OD_MSG`, or its synchronous "unhandled message type" response wins the race and the offscreen document's real answer never reaches the caller. See `service-worker.js`'s default case.
- No auto-detected source language in our `translate(text, targetLang)` adapter signature, so `offscreen.js` always runs `LanguageDetector` first, then `Translator` — two on-device model calls per translation, not one.
- `isAvailable()` is a coarse browser-capability check (`'Translator' in self`, `LanguageDetector.availability() !== 'unavailable'`) via the offscreen document — it can't check a specific language pair without knowing the source language first, so per-pair unavailability (`unsupported_language_pair`) surfaces as a `translate()`-time error instead.
- `capabilities()`: `{translate: true, explain: false, streaming: false}` → UI hides/disables Explain with an i18n hint.
- No key, no network, no quota. Offer it as fallback in the quota upsell.
- Model-download progress (`monitor` → `downloadprogress` events) is captured in the offscreen document but not yet relayed to the modal UI — logged only for now; add a progress affordance later if first-use download latency turns out to matter in practice.
- **Two things NOT verifiable outside a real loaded Chrome 138+ extension (owed as QA, can't be checked in this repo's tooling):**
  1. Whether `Translator.create()`'s transient-user-activation requirement is satisfied when the call chain is content-script click → worker → offscreen document (the offscreen document itself never receives a user gesture). If not, it throws `NotAllowedError`, which is caught and mapped to `code: 'unavailable'` — a clean non-crashing failure either way, but confirm it isn't ALWAYS unavailable in practice.
  2. Whether `reasons: ['WORKERS']` is accepted by `chrome.offscreen.createDocument()` for this use case — the documented `Reason` enum has no dedicated "on-device AI" value, so this is a best-effort pick; revisit if Chrome adds one.

## Engines 3–5 — BYOK: Gemini (T-016), OpenAI (T-017), DeepSeek (T-018)

- Key from `chrome.storage.local` (options page writes it, worker reads it, masked in UI, never sent to content script). Each engine file owns and exports its own storage-key constants (e.g. `gemini.js` exports `GEMINI_API_KEY_KEY`, `GEMINI_MODEL_KEY`) — options.js (T-019) imports them directly rather than the storage schema being centralized, so each BYOK engine stays a self-contained, cloneable file (see the "clone pattern" note at the top of this section).
- Gemini: `generateContent` REST (confirmed against ai.google.dev 2026-07-03 — key as a query param, not a header; response text at `candidates[0].content.parts[0].text`). OpenAI: `/v1/chat/completions` (confirmed 2026-07-03 — `Authorization: Bearer`, `{model, messages:[{role,content}]}` body, response text at `choices[0].message.content`; default model `gpt-5.4-mini`, matching the trial gateway's already-validated model choice). DeepSeek: `https://api.deepseek.com/chat/completions`, identical OpenAI-compatible request/response shape (confirmed against api-docs.deepseek.com 2026-07-03) — default model `deepseek-v4-flash`; the legacy names `deepseek-chat`/`deepseek-reasoner` are deprecated 2026-07-24, so don't default to those even though they're what most existing sample code still shows.
- All three power translate + explain (T-024). Auth failure maps to `code: 'auth'` → UI points at options page.
- Once a BYOK engine is selected, the trial gateway is not called at all for that user.
- The options page's engine picker asks the worker for the live list via `LIST_ENGINES` (docs/ARCHITECTURE.md) rather than hardcoding engine ids — a BYOK engine only becomes selectable once its key makes `isAvailable()` true. Engine selection itself is `chrome.storage.local` key `engineId` (`shared/settings-keys.js`, `ENGINE_ID_STORAGE_KEY`) — absent/removed means "Automatic" (registry.js `FALLBACK_ORDER`); BYOK engines are deliberately never in that fallback order, since they must only run when the user explicitly picks them.

## Prompts

- Translate prompt: [REFERENCE-SNIPPETS §4](REFERENCE-SNIPPETS.md) (cleaning rules: drop citation markers, fix hyphen-split words, keep code/math tokens, output translation only). Each engine keeps its own copy (deliberate — see the "clone pattern" note above); bumping it means bumping `translation-cache.js`'s `PROMPT_VERSION` (SPEC §6).
- Explain prompt (T-024): unlike translate, this one IS shared — `background/explain-schema.js` (`buildExplainPrompt`, `parseExplainResponse`) is imported by all 4 LLM-capable engines, since the prompt and response parsing are 100% provider-agnostic (only which raw-completion function gets called differs). Strict JSON, CEFR-graded examples, simpler-vocabulary rule, loose-parse fallback — [REFERENCE-SNIPPETS §5](REFERENCE-SNIPPETS.md), near-verbatim. Source-language framing text comes from `background/lang-detect.js`'s `detectSourceLanguage()` — a local Unicode-block heuristic (no network/on-device-API call), low-stakes since the model reads the real phrase regardless of this label. Own cache/schema versioning: `explain-schema.js`'s `SCHEMA_VERSION` (starts at 1 — no prior version to migrate from in this project, unlike REFERENCE-SNIPPETS' source project which was already at v2).
- Explain cache + capability gating (T-026): `background/explain-cache.js` mirrors `translation-cache.js`'s IndexedDB/LRU pattern but keys on page origin instead of engine id (`explain::v{SCHEMA_VERSION}::{origin}::{normalized phrase}::{targetLang}`, SPEC §6) — an explanation shouldn't change just because the active engine changed, so it isn't part of the cache key the way it is for translate(). `registry.js`'s `explain()` checks this cache before calling the engine and stores after. The content script sends `location.origin` in the `EXPLAIN` message payload since the service worker has no page context of its own. Separately, before offering the Explain button at all, `main.js` calls `GET_CAPABILITIES` and shows a disabled button with an i18n hint (SPEC §4) rather than an enabled one when the active engine can't explain (e.g. on-device-only) — fails closed (disabled) if the capability check itself errors.
- on-device (Engine 2) has no `explain()` — the Translator API can't do this; `capabilities().explain` stays `false`.

## Adding a new engine later

1. New module in `background/engines/`, export the adapter shape.
2. Register in the registry + options page picker (+ i18n keys for its name/settings).
3. Map its error responses in the central error mapper.
4. Document it in this file (endpoint, auth, quirks).
5. No content-script changes should ever be needed — if they are, the abstraction broke; stop and discuss.
