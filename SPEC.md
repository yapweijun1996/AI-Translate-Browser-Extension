# SPEC — AI Translate Browser Extension

Status: Draft v1 (2026-07-03). No code exists yet; this spec is the build target for the MVP.
Reference implementation studied: a proven PDF-Reader PWA with the same selection → tooltip → explain pipeline; its reusable code lives in [docs/REFERENCE-SNIPPETS.md](docs/REFERENCE-SNIPPETS.md).

---

## 1. Goal

A Manifest V3 browser extension (Chrome/Edge first) that lets a user select text on any webpage and get an AI translation plus an optional learner-oriented explanation, without leaving the page.

Primary user: a language learner reading foreign-language web content, who wants both a quick translation and (on demand) a deeper dictionary-style explanation.

## 2. Core UX flow (MVP)

Icon-first flow (user's chosen design — deliberately different from the reference project's instant-popup):

1. User selects/highlights text or a sentence on the page.
2. A small floating **trigger icon** appears near the end of the selection (debounced ~250ms; does NOT appear for selections < 2 chars or when selection is collapsed).
3. User clicks the icon → a **modal/tooltip box** opens anchored to the selection:
   - Shows original text + translation (translation starts loading on icon click, not on selection — no wasted API calls when the user is just copying text).
   - Contains an **"Explain" button**: on click, expands an in-box learner explanation (definition, part of speech, CEFR level, graded examples, collocations, synonyms, memory tip).
   - Desktop only: draggable from any of its 4 edges to resize (min 260×160px, can't be dragged past the viewport edge). The chosen size is remembered and reused for future translations on any site, until resized again.
   - A speaker button next to the source text and next to the translated text plays it aloud via the browser's built-in text-to-speech (free, no network call, no API key). The translated-text voice is whichever the user picked per target language in Settings, defaulting to the browser's own choice; the source-text voice always uses the browser default (no reliable source-language detection feeds into this). An optional Settings toggle speaks the translation automatically as soon as it arrives.
4. Clicking outside the box, pressing Esc, or clicking × closes it. New selection replaces the old icon.
5. Mobile / narrow viewport (< 640px): box renders as a bottom sheet with drag-to-dismiss instead of an anchored tooltip.

Why icon-first: selecting text is a common non-translate gesture (copy, drag). Instant popup fires on every selection and annoys users; the icon costs one extra click but is non-intrusive and saves API quota.

## 3. Architecture (Manifest V3)

```
manifest.json          MV3 (default_locale: "en")
_locales/              extension UI i18n — en, zh_CN, ms, ja, vi, ko (see §8)
background/            service worker
  └─ owns: all LLM/translation API calls, cache, context menu, settings access
content/               content script (injected per page)
  └─ owns: selection detection, trigger icon, modal box UI, DOM anchoring
popup/                 quick actions + settings shortcut
options/               engine choice, API key entry, target language, UI language, per-site rules
```

Message flow (one round trip per action):

```
content script ──(TRANSLATE {text, context, targetLang})──▶ service worker ──▶ engine API
content script ◀─(result | error {friendlyMessage})──────── service worker
```

Rules:
- Content script NEVER calls translation APIs directly and never sees API keys. All network + key access lives in the service worker.
- Content script UI must be resilient to hostile page CSS: render icon + box inside a Shadow DOM host element with reset styles.
- Selection detection: `mouseup` + `touchend`, debounced 250ms, with `selectionchange` clearing state when selection collapses ([REFERENCE-SNIPPETS §1](docs/REFERENCE-SNIPPETS.md)).

## 4. Translation engines

| Priority | Engine | Notes |
|---|---|---|
| Shipped default (trial) | Owner's GPT gateway (`https://gpt.yapweijun1996.com/v1/responses`) | Works out of the box, zero setup — this is the try-before-BYOK funnel. Owner-controlled, **daily token limit enforced server-side**, key revocable/rotatable at any time. Bundled key is XOR-obfuscated (seed `20260515`, scheme + cipher string in [REFERENCE-SNIPPETS §3](docs/REFERENCE-SNIPPETS.md); tool: [XOR-Cipher-Tool](https://github.com/yapweijun1996/XOR-Cipher-Tool)). Model: `gpt-5.4-mini`, `/v1/responses` streaming SSE, `reasoning.effort: "low"` for snappy translations. |
| Upgrade path (BYOK) | User-supplied key: OpenAI / DeepSeek / Gemini / Claude / DeepL | Configured in options page. Key stored in `chrome.storage.local`. Once set, replaces the trial gateway entirely. LLM engines also power "Explain". |
| Alternative (free/private) | Chrome built-in Translator API + Language Detector API | On-device, free, private, no key, no quota. Chrome desktop 138+. Feature-detect; offer as a no-cost option for plain translation (cannot power "Explain"). |

Trial → BYOK funnel (product decision, 2026-07-03):
- The extension ships with the owner's gateway key as the working default so end users can **try immediately with zero setup**. This is owner-authorized: the gateway enforces a daily token limit server-side, so key extraction/abuse is bounded and the key can be rotated or killed at any time.
- When the gateway returns its **daily-limit/quota error**, the extension must NOT show a dead-end error. It shows a friendly upsell alert: "今日免费额度已用完" → explain the free trial quota is exhausted for today, and offer two buttons: **"Set up your own API key"** (opens options page, BYOK) and **"Try again tomorrow"** (dismiss). If the on-device Chrome Translator API is available, also offer it as a free fallback for plain translation.
- Once the user configures BYOK, the trial gateway is no longer used for that user (their key, their quota, no shared limit).
- Reuse the reference gateway client (SSE streaming parse, `decryptKey()`) as-is — [REFERENCE-SNIPPETS §3](docs/REFERENCE-SNIPPETS.md).
- "Explain" requires an LLM engine; if the user's only working engine is on-device Translator, hide or disable the Explain button with a hint to configure an LLM key.

## 5. Explain feature

Port the reference explain design ([REFERENCE-SNIPPETS §5](docs/REFERENCE-SNIPPETS.md)):

- Strict-JSON prompt, schema-versioned payload (`schemaVersion`), loose-parse fallback (strip code fences, regex-extract `{...}`).
- Payload: phonetic (IPA), partOfSpeech, cefrLevel, definition in source language + target language, in-context meaning, 3 graded examples (increasing CEFR, vocabulary simpler than the target word), collocations, wordFamily, synonyms/antonyms, memoryTip.
- Context: send the surrounding paragraph (capture via selection's `commonAncestorContainer`, truncated to ~1200 chars) so the explanation is context-specific.
- Render: headword + badges (POS, CEFR), definition block, collapsible sections for collocations/word family/synonyms. Escape all dynamic HTML ([REFERENCE-SNIPPETS §8](docs/REFERENCE-SNIPPETS.md)).

## 6. Caching

- Storage: IndexedDB (`idb-keyval` or equivalent) accessed from the service worker.
- Translation cache key: `v{PROMPT_VERSION}::{targetLang}::{engine}::{sha256(text) short}`.
- Explain cache key: `explain::v{SCHEMA_VERSION}::{origin or pageURL}::{normalized phrase}::{targetLang}`.
- Bump `PROMPT_VERSION` / `SCHEMA_VERSION` whenever the prompt or payload schema changes — old cache entries auto-invalidate ([REFERENCE-SNIPPETS §6](docs/REFERENCE-SNIPPETS.md)).
- LRU cap (e.g. a few thousand entries) to bound storage.

## 7. Permissions (minimal)

```json
"permissions": ["storage", "contextMenus", "offscreen"],
"host_permissions": []
```

- The content script is declared with `"matches": ["<all_urls>"]` — required for the core UX (selection must be detectable on any page without the user clicking the toolbar icon first). This triggers the "read data on all websites" install warning; the privacy policy must explain it (M5, see docs/store/PRIVACY-POLICY.md).
- `host_permissions` stays empty — the content script match is sufficient; the service worker only calls translation APIs, which needs no host permission.
- `offscreen` (added T-015): the on-device Translator/LanguageDetector engine needs a real Document, which the service worker cannot provide — see docs/ARCHITECTURE.md and docs/ENGINES.md "Engine 2".
- `scripting` and `activeTab` were removed (T-031, 2026-07-03): neither was ever used — content scripts are injected purely declaratively via `content_scripts`, and the context menu's `chrome.tabs.sendMessage` (T-029) needs neither permission. Fewer permissions means a cleaner Web Store review and a simpler, honest privacy policy.
- No remotely hosted code, no `eval` (MV3 / Chrome Web Store hard requirement).

## 8. Extension UI i18n

The extension's own UI (popup, options page, modal box labels, context menu, error messages) must be localized via the standard `chrome.i18n` mechanism — this is separate from the translation feature itself.

Supported locales (MVP):

| Locale dir | Language |
|---|---|
| `en` | English (default locale / fallback) |
| `zh_CN` | Mandarin (Simplified Chinese) |
| `ms` | Malay |
| `ja` | Japanese |
| `vi` | Vietnamese |
| `ko` | Korean |

Rules:
- All user-visible strings live in `_locales/<locale>/messages.json` — **no hardcoded UI strings** in JS/HTML. Use `chrome.i18n.getMessage()` (and `__MSG_key__` in `manifest.json` for name/description).
- `default_locale: "en"` in manifest; Chrome falls back to English for unsupported browser locales.
- Content-script UI (icon tooltip, modal labels like "Explain", "Close", loading/error text) also pulls from `chrome.i18n` — content scripts can call `chrome.i18n.getMessage()` directly.
- UI language follows the browser's locale by default; a manual language override in the options page is a nice-to-have (requires a small self-managed message loader since `chrome.i18n` can't switch at runtime).
- Keep `messages.json` keys flat and prefixed by surface: `popup_*`, `options_*`, `modal_*`, `menu_*`, `error_*`.
- Every new string added in any milestone must land in all 6 locale files in the same commit (English text as placeholder is acceptable short-term for non-English files, but flag it).

## 9. Error handling

- Central error mapper in the service worker: network / auth (bad key) / quota / model errors → one friendly, actionable message string sent to the content script. Content script only renders, never interprets provider errors.
- **Quota error is a first-class product event, not just an error** (see §4 trial funnel): when the trial gateway returns its daily-limit error (HTTP 429 or the gateway's quota-exceeded response — confirm exact shape against the live gateway during M3), the service worker maps it to `code: 'trial_quota_exhausted'` and the content script renders the BYOK upsell (options-page button + "try again tomorrow" + on-device fallback if available) instead of a plain error string. A BYOK user's own provider quota error renders as a normal quota message pointing at their provider dashboard, NOT the upsell.
- All error/upsell strings go through `chrome.i18n` (`error_*` keys, all 6 locales — see §8).
- Timeouts: abort translation calls via `AbortSignal` (e.g. 30s); show retry affordance in the box.

## 10. Out of scope for MVP (explicit non-goals)

- Full-page bilingual translation (planned v2 — needs `MutationObserver` node tracking + batching; see [CLAUDE.md](CLAUDE.md) feature list)
- Video subtitle translation
- PDF/EPUB translation
- TTS (defer to v1.x)
- Firefox/Safari ports
- Per-site auto-translate rules

## 11. Milestones

1. **M1 — Skeleton**: manifest + build tooling (Vite + CRXJS or esbuild), empty service worker/content script/popup/options wired and loadable unpacked. `_locales/` scaffolded for all 6 locales from day one (`default_locale: "en"`).
2. **M2 — Selection → icon → box**: full content-script UX (Shadow DOM styling, Esc/outside-click dismiss, bottom sheet on mobile widths, context capture) wired to the real message protocol. The mock-translator step was dropped (2026-07-03) — M2's UI work exercises the real `TRANSLATE` message end-to-end and surfaces the honest "not implemented yet" error until M3's real engines land.
3. **M3 — Real engines**: trial gateway path (REFERENCE-SNIPPETS §3) + Chrome Translator API path + one BYO-key LLM path (Gemini or OpenAI), options page for key/target language, service-worker cache, quota→upsell flow.
4. **M4 — Explain**: LLM explain call + rendering, explain cache, engine-capability gating.
5. **M5 — Polish**: error messages, context menu ("Translate selection"), i18n completeness pass (all 6 locales translated, no English placeholders left — see §8), Web Store listing prep (privacy policy: what text is sent where; localized store listing for the 6 languages).

## 12. Open questions

- Which BYO-key engine to implement first in M3 for production (Gemini cheapest to test vs OpenAI most common vs DeepSeek cheapest overall)?
- Popup quick-translate box (type/paste text) in MVP or defer?
- Should the trigger icon be suppressible per-site (blocklist) from day one?
