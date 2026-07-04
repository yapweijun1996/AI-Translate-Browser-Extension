# AI-Translate-Browser-Extension

## Status

MVP feature-complete through M5 polish (2026-07-04, T-001…T-038): selection→icon→translate→Explain pipeline, all 4 BYOK engines + on-device + trial-gateway, options page, context menu, manual modal resize, browser-native TTS (speak buttons + voice picker + auto-play), a popup on/off kill switch, and a redesigned SVG-sourced logo are all shipped and live-verified. T-032 (Chrome Web Store submission) remains **blocked** — needs the owner's own Developer Dashboard account and a published (hosted, public-URL) privacy policy; everything QA-able short of actual submission is done. Junior engineers build from the docs + task list.

## Documentation map (keep in sync)

- [README.md](README.md) — entry point + task.jsonl workflow rules
- [SPEC.md](SPEC.md) — the contract (UX, architecture, engines, i18n, errors)
- [ROADMAP.md](ROADMAP.md) — v0.x MVP → v1.0 production → v2.0 business
- [EPICS.md](EPICS.md) — E1–E8 with exit criteria
- [task.jsonl](task.jsonl) — T-001…T-038 work queue (one JSON per line; never delete lines)
- docs/ — [ARCHITECTURE](docs/ARCHITECTURE.md), [DEVELOPMENT](docs/DEVELOPMENT.md), [CODING-STANDARDS](docs/CODING-STANDARDS.md), [I18N](docs/I18N.md), [ENGINES](docs/ENGINES.md), [REFERENCE-SNIPPETS](docs/REFERENCE-SNIPPETS.md), [store/](docs/store/) (privacy policy + Web Store listing, 6 locales), [qa/](docs/qa/) (manual QA checklists)
- [LICENSE](LICENSE) — MIT

When a decision changes: update SPEC.md first, then the affected docs/ file, then task.jsonl, in the same change.

## What this is

A browser extension that translates web content using AI — bilingual page translation, selection translate, and video subtitle translation, in the spirit of tools like Immersive Translate.

## Key architecture decisions (research done 2026-07-03)

- **Manifest V3 only.** Service worker (background), content scripts (DOM access), popup UI, options page. No remotely hosted or `eval`'d code — disallowed by MV3 and Chrome Web Store policy.
- **Permissions kept minimal.** `permissions`: `storage`, `contextMenus`, `offscreen` (the last one exists solely because the on-device Translator API needs a real Document — the service worker can't host it, see docs/ENGINES.md "Engine 2"). `host_permissions` scoped to what's actually needed, not `<all_urls>` unless a feature requires it. (`scripting`/`activeTab` were requested through T-030 but never actually used — removed in T-031.)
- **Translation engine — dual path:**
  - Default: Chrome's built-in on-device **Translator API** + **Language Detector API** (free, private, no network call, no API key). Chrome desktop 138+ only.
  - Optional "bring your own API key": DeepL, Google Cloud Translate, OpenAI, Gemini, Claude — for higher quality, cross-browser support, or nuanced/LLM-style translation.
  - **Trial → BYOK funnel (owner-authorized, 2026-07-03):** the extension SHIPS with the owner's own GPT gateway key (`gpt.yapweijun1996.com`, XOR-obfuscated with seed `20260515`, scheme + cipher in `docs/REFERENCE-SNIPPETS.md` §3) as the zero-setup default, so users can try before configuring a key. This is safe because the gateway enforces a daily token limit server-side and the key is revocable. When the daily limit is hit, show a BYOK upsell (not a dead-end error) prompting the user to add their own OpenAI/DeepSeek/Gemini key. See SPEC.md §4 + §9.
  - Never bundle any OTHER provider's key. User-supplied keys live in `chrome.storage.local`.

## Planned MVP feature set

1. Select-text → translate popup near the selection
2. Full-page bilingual translation, with a `MutationObserver` to catch dynamically injected/SPA content (don't re-translate already-replaced nodes)
3. Right-click context menu: "Translate selection" / "Translate page"
4. Options page: engine choice, API key entry, target language, per-site auto-translate rules
5. Cache translations by `(text, sourceLang, targetLang, engine)` to avoid redundant/duplicate API calls

## KB-MCP (persistent cross-session memory)

This project's decisions and facts are tracked in KB-MCP under `project: "AI-Translate-Browser-Extension"`.

- Before starting non-trivial work in this repo: `kb_search` / `kb_recall` for this project to load prior decisions — don't re-derive things already decided.
- After any architecture decision, landed feature, or non-obvious lesson: `kb_remember` (or `kb_add_item`), tagged with this project name.
- Search before writing — don't create duplicate memories for the same fact; update instead.

## Commands

- `npm run dev` — Vite watch build (then load `dist/` unpacked in Chrome; see docs/DEVELOPMENT.md)
- `npm run build` — production build to `dist/`
- `npm run lint` — ESLint (flat config)
- `npm run lint:i18n` — CI i18n check (T-028): missing/unknown message keys, hardcoded UI-string heuristic
- `npm run format` — Prettier write
