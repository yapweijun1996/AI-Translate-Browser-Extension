# ROADMAP

Direction: hobby MVP → polished store release → production-grade tool usable in business settings. MIT-licensed throughout.

## v0.x — MVP (current target)

Goal: the core loop works end-to-end and is demoable.

- Milestones M1–M5 as defined in [SPEC.md §11](SPEC.md) / [EPICS.md](EPICS.md) E1–E6
- Select → icon → translate modal → Explain
- Trial gateway (zero setup) + BYOK (OpenAI/DeepSeek/Gemini) + on-device Chrome Translator
- 6-locale UI i18n
- Chrome Web Store listing (unlisted or public beta)

Exit criteria: a stranger can install it, translate on 10 random sites without breakage, hit the trial quota, and successfully switch to their own key.

## v1.0 — Production quality

Goal: trustworthy for daily use; store-public.

- **Reliability:** graceful behavior on hostile pages (iframes, strict-CSP sites, heavy SPAs); automated test suite (unit + Playwright extension tests); error telemetry that respects privacy (opt-in only)
- **Performance:** selection→icon latency < 50ms; modal open→first translated token < 1.5s on trial gateway; cache hit rate measured
- **Security review:** permissions audit, key handling audit, dependency audit (`npm audit` clean), Web Store policy compliance re-check
- **UX polish:** keyboard shortcuts, dark mode, per-site disable (blocklist), popup quick-translate box
- **Docs:** user-facing help page + privacy policy in all 6 locales

## v1.x — Power features

Priority order (re-evaluate after v1.0 feedback):

1. **Full-page bilingual translation** — MutationObserver node tracking, batching, skip-already-translated (the flagship Immersive-Translate-style feature; biggest engineering lift)
2. Per-site auto-translate rules
3. Glossary / terminology overrides (user dictionary)
4. TTS (browser speechSynthesis + optional Gemini TTS)
5. Translation history + export
6. Firefox port (MV3 WebExtensions delta)

## v2.0 — Business use

Goal: viable in a company setting.

- **Team/BYO-endpoint support:** point the extension at a company-managed LLM gateway (like the trial gateway but customer-owned) so employees don't handle individual keys
- **Policy controls:** admin-managed settings (allowed engines, blocked sites, data-handling rules) via managed storage (`chrome.storage.managed` / enterprise policy)
- **Privacy posture:** documented data flow, zero-retention statement per engine, optional fully-on-device mode
- **Compliance:** privacy policy review, no PII in logs, configurable telemetry-off default
- Video subtitle translation & PDF translation — evaluate demand before committing (see SPEC §10 non-goals)

## Non-goals (all versions, unless revisited deliberately)

- Building/hosting our own translation models
- Selling API access — the trial gateway is a funnel, not a product
- Collecting or monetizing user content
