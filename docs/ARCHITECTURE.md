# Architecture

Read [SPEC.md](../SPEC.md) first. This doc explains *how the pieces talk to each other* so you know where any new code belongs.

## The contexts

An MV3 extension runs code in several isolated places. They cannot call each other's functions — they communicate only by message passing and shared storage.

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
└──────▲───────────────────▲──────────────────────▲────────────┘
       │ runtime messages   │ chrome.storage        │ chrome.runtime
┌──────▼──────┐      ┌──────▼──────┐        ┌───────▼────────────┐
│ POPUP       │      │ OPTIONS     │        │ OFFSCREEN DOCUMENT │
│ quick UI    │      │ engine,keys,│        │ (offscreen/)       │
│             │      │ languages   │        │ hosts Translator/  │
│             │      │             │        │ LanguageDetector — │
│             │      │             │        │ these need a real  │
│             │      │             │        │ Document, worker   │
│             │      │             │        │ can't call them    │
└─────────────┘      └─────────────┘        └─────────────────────┘
```

The offscreen document is created on demand by `background/engines/on-device.js` (not declared in the manifest the way popup/options are — see docs/ENGINES.md "Engine 2" for why, the internal `OD_MSG` protocol it uses, and a gotcha this causes in the worker's own message listener). Content scripts never talk to it directly.

**Golden rule:** if code needs a key or the network → service worker. If code needs the page DOM → content script. Nothing else.

## Message protocol

All messages are `{type, payload}` objects over `chrome.runtime.sendMessage`. Responses are `{ok: true, data}` or `{ok: false, error: {code, message}}`.

| type | direction | payload | data |
|---|---|---|---|
| `TRANSLATE` | content → worker | `{text, context, targetLang}` | `{translated, engine, cached}` |
| `EXPLAIN` | content → worker | `{phrase, context, targetLang}` | explain payload (SPEC §5 schema) |
| `GET_CAPABILITIES` | content → worker | `{}` | `{canTranslate, canExplain, engine}` |
| `OPEN_OPTIONS` | content → worker | `{}` | — (worker calls `chrome.runtime.openOptionsPage()`) |
| `LIST_ENGINES` | options → worker | `{}` | `{engines: [{id, available, capabilities}]}` — options page's engine picker (T-019); availability is live runtime state the options page can't read itself |

Error codes (produced by `background/error-mapper.js`, T-021 — every engine adapter's HTTP failures funnel through it instead of each duplicating status-code logic): `trial_quota_exhausted` (trial gateway's own daily limit → render BYOK upsell, SPEC §9 — T-022 wires this), `quota` (a BYOK user's own provider quota/rate-limit → plain message, never the upsell — the `isTrialGateway` flag on `mapHttpError()` is what keeps these two apart), `auth` (bad/missing key → point at options), `network`, `timeout`, `gateway_error`/`unknown` (generic message + retry button). `no_engine_available` / `explain_unsupported` come from the registry itself, not a provider.

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

## Reference code

Reusable snippets from a proven reference project live in [REFERENCE-SNIPPETS.md](REFERENCE-SNIPPETS.md). Port table:

| Snippet | Port to | Change needed |
|---|---|---|
| §1 selection detector | content script | as-is |
| §2 context capture | content script | as-is |
| §3 gateway client (XOR + SSE) | worker engine adapter | plug errors into central mapper |
| §4 translate prompt | worker | as-is |
| §5 explain prompt + loose parse | worker | as-is |
| §6 cache versioning | worker IndexedDB | as-is |
| §7 modal positioning / bottom sheet | content script | render inside Shadow DOM |
| §8 escapeHtml | shared/ | as-is |

The reference project called APIs directly from page JS — that wiring is **not** ported; this extension uses the message protocol above instead.
