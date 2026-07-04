# EPICS

Every task in [task.jsonl](task.jsonl) belongs to one epic. Epics map to SPEC.md sections and ROADMAP.md versions. An epic is *done* when its exit criteria pass, not when its tasks are merely merged.

## E1 — Project skeleton & tooling (MVP M1)

Scaffold a loadable MV3 extension with build tooling and all 6 locale dirs.

- Scope: `manifest.json`, Vite+CRXJS (or esbuild) build, empty-but-wired service worker / content script / popup / options, `_locales/*`, lint+format config, CI (typecheck+lint+build on PR)
- Exit criteria: `npm run build` produces a dist/ that loads unpacked in Chrome with zero console errors; all four contexts log a heartbeat; locale files load (`chrome.i18n.getMessage('ext_name')` works).
- SPEC: §3, §7, §8

## E2 — Selection UX (MVP M2)

The icon-first select→icon→modal experience.

- Scope: debounced selection detection, floating trigger icon (Shadow DOM), modal box anchored to selection, Esc/outside-click/× dismissal, mobile bottom-sheet variant, context capture (surrounding paragraph)
- The mock-translator step was DROPPED (2026-07-03, user decision) — the modal sends the real `TRANSLATE` message and correctly surfaces an "unimplemented" error until E3's real engines land. See task.jsonl T-011 (dropped) / T-013 (now depends on T-003, not T-011).
- Exit criteria (T-012): works on 10 diverse real sites (news, docs, GitHub, SPA apps) with actual translation results; icon never appears for <2-char or collapsed selections; page CSS never breaks our UI; no interference with normal copy/paste. Because there's no mock, T-012 now depends on T-023 (real engines wired in) — E2's UI work is done at T-010, but its exit-criteria QA pass happens after E3 lands.
- SPEC: §2, §3

## E3 — Engines & settings (MVP M3)

Real translation through five engine paths + the options page.

- Scope: engine adapter interface; trial gateway adapter (XOR key + SSE streaming, REFERENCE-SNIPPETS §3); Chrome on-device Translator+Language Detector adapter (feature-detected, offscreen-document architecture); three BYOK adapters (Gemini, OpenAI, DeepSeek); options page (engine, key entry, target language, UI language); IndexedDB cache with version-stamped keys; central error mapper; trial-quota error → BYOK upsell flow
- Exit criteria: translation works through all five paths (verified with mocked HTTP — no live-gateway quota probing, an explicit owner decision on T-021); BYOK keys survive restart, independently per provider; `trial_quota_exhausted` shows the upsell while a BYOK engine's own quota shows a plain message; cache hit returns without calling the engine (verified via call-counting, not manual devtools inspection).
- SPEC: §4, §6, §9

## E4 — Explain (MVP M4)

The learner-oriented deep explanation.

- Scope: explain prompt + strict-JSON schema (REFERENCE-SNIPPETS §5), loose-parse fallback, render (headword/POS/CEFR badges, definitions, graded examples, collapsible sections), explain cache, engine gating (LLM-only)
- Exit criteria: explain works via trial gateway and BYOK; malformed model output degrades gracefully (shows raw text, never crashes); cached explain renders offline.
- SPEC: §5

## E5 — i18n completeness (cross-cutting, MVP M1→M5)

Extension UI in en, zh_CN, ms, ja, vi, ko.

- Scope: `_locales` message files, key conventions (`popup_*`, `options_*`, `modal_*`, `menu_*`, `error_*`), translation pass for all six, i18n lint check (no hardcoded strings; keys present in all locales)
- Exit criteria: switching browser locale switches the whole UI; a CI check fails when a key is missing from any locale.
- SPEC: §8

## E6 — Polish & release (MVP M5)

Ship it.

- Scope: friendly error mapping (port `llm-error.js` idea), context menu items, icons/branding, Web Store listing (6 locales), privacy policy, README user section
- Exit criteria: passes Chrome Web Store review; ROADMAP v0.x exit criteria pass end-to-end.
- SPEC: §9, §10

## E7 — Production hardening (ROADMAP v1.0)

Not yet task-broken-down. Reliability (tests, hostile pages), performance budgets, security audit, UX polish (shortcuts, dark mode, per-site disable — a global on/off toggle shipped ahead of schedule instead, T-037; per-*site* blocklist still open). Break into tasks when E1–E6 are done.

## E8 — Full-page bilingual translation (ROADMAP v1.x)

Not yet task-broken-down. The flagship v1.x feature — MutationObserver, node batching, dynamic-content tracking. Requires its own mini-spec before tasks are written.
