# Architecture

Read [SPEC.md](../SPEC.md) first. This doc explains *how the pieces talk to each other* so you know where any new code belongs.

## The four contexts

An MV3 extension runs code in four isolated places. They cannot call each other's functions — they communicate only by message passing and shared storage.

```
┌─────────────────────────────────────────────────────────────┐
│ Web page (any site)                                          │
│  ┌────────────────────────────────────────────┐              │
│  │ CONTENT SCRIPT (content/)                  │              │
│  │ - selection detection                      │              │
│  │ - trigger icon + modal box (Shadow DOM)    │              │
│  │ - NO network calls, NO keys                │              │
│  └───────────────▲────────────────────────────┘              │
└──────────────────│───────────────────────────────────────────┘
        chrome.runtime.sendMessage / onMessage
┌──────────────────▼───────────────────────────────────────────┐
│ SERVICE WORKER (background/)                                  │
│ - engine adapters (trial gateway / on-device / BYOK)          │
│ - API keys (read from chrome.storage.local)                   │
│ - IndexedDB cache                                             │
│ - error mapper (provider error → friendly code)               │
│ - context menu registration                                   │
└──────▲──────────────────────────▲────────────────────────────┘
       │ runtime messages          │ chrome.storage (settings)
┌──────▼──────┐            ┌───────▼──────┐
│ POPUP       │            │ OPTIONS      │
│ quick UI    │            │ engine, keys,│
│             │            │ languages    │
└─────────────┘            └──────────────┘
```

**Golden rule:** if code needs a key or the network → service worker. If code needs the page DOM → content script. Nothing else.

## Message protocol

All messages are `{type, payload}` objects over `chrome.runtime.sendMessage`. Responses are `{ok: true, data}` or `{ok: false, error: {code, message}}`.

| type | direction | payload | data |
|---|---|---|---|
| `TRANSLATE` | content → worker | `{text, context, targetLang}` | `{translated, engine, cached}` |
| `EXPLAIN` | content → worker | `{phrase, context, targetLang}` | explain payload (SPEC §5 schema) |
| `GET_CAPABILITIES` | content → worker | `{}` | `{canTranslate, canExplain, engine}` |
| `OPEN_OPTIONS` | content → worker | `{}` | — (worker calls `chrome.runtime.openOptionsPage()`) |

Error codes the content script must handle: `trial_quota_exhausted` (render BYOK upsell — SPEC §9), `auth` (bad key → point at options), `network`, `timeout`, `unknown` (generic message + retry button).

Add new message types to this table in the same PR that introduces them.

## Data flow: a translate action

1. User selects text → content script (debounced) shows trigger icon.
2. User clicks icon → content script sends `TRANSLATE {text, context, targetLang}`. **The API call starts now, not at selection time.**
3. Worker: cache lookup → hit? return `{cached: true}` : call active engine adapter → store in cache → respond.
4. Content script renders result in the modal. On `trial_quota_exhausted`, renders the upsell instead.

## Where state lives

| State | Where | Why |
|---|---|---|
| User settings (engine, target lang) | `chrome.storage.local` | Read by worker + options + popup |
| API keys (BYOK) | `chrome.storage.local` | Worker-read only; options-page write only. Never send to content script. |
| Translation/explain cache | IndexedDB (worker) | Too big for chrome.storage; worker-only |
| UI state (icon position, open modal) | Content script memory | Per-page, ephemeral |

## Service worker lifetime gotcha

MV3 workers are killed after ~30s idle and restarted on demand. Consequences:

- No module-level mutable state that must survive (cache = IndexedDB, settings = chrome.storage).
- In-flight SSE streams die if the worker is killed mid-stream — keep translation calls short, and always handle a dropped connection as a `network` error with retry.
- Event listeners must be registered synchronously at the top level of the worker script.

## Reference implementation

[sample/PDF-Reader](../sample/PDF-Reader) is a working PWA (not an extension) with the same pipeline. Port table:

| Sample file | Port to | Change needed |
|---|---|---|
| `pdf-viewer.js onSelection()` | content script | as-is |
| `tooltip.js` (position, bottom sheet, renderExplain) | content script | render inside Shadow DOM |
| `gateway.js` | worker engine adapter | as-is (XOR + SSE) |
| `explain.js` | worker | as-is (prompt + loose parse) |
| `db.js` cache patterns | worker IndexedDB | new cache keys (no docHash — use origin/text hash) |
| `llm-error.js` idea | worker error mapper | add `trial_quota_exhausted` |
| `main.js` direct fetch-in-page wiring | **do NOT port** | replaced by message protocol |
