# AI Translate Browser Extension

Select text on any webpage → a small icon appears → click it → get an instant AI translation, plus an optional learner-friendly "Explain" (definition, examples, synonyms, memory tip).

Chrome/Edge extension, Manifest V3. Ships with a free trial engine (zero setup) — users who want more bring their own API key (OpenAI / DeepSeek / Gemini).

> **Status: pre-code.** The documentation below is the build plan. No source code exists yet — start from the task list.

## For engineers — read in this order

| Doc | What it tells you |
|---|---|
| [SPEC.md](SPEC.md) | **The contract.** UX flow, architecture, engines, caching, i18n, error handling. If code contradicts SPEC.md, the code is wrong (or the spec needs a reviewed update). |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit: service worker vs content script, message protocol, data flow diagrams. |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Setup, build, load the extension unpacked, debug each context. |
| [docs/CODING-STANDARDS.md](docs/CODING-STANDARDS.md) | Conventions you must follow (naming, errors, i18n strings, commits). |
| [docs/I18N.md](docs/I18N.md) | How to add/modify UI strings — 6 locales, no hardcoded text. |
| [docs/ENGINES.md](docs/ENGINES.md) | Translation engine adapters: trial gateway, BYOK providers, on-device API. |
| [ROADMAP.md](ROADMAP.md) | Where this project is going (MVP → production → business). |
| [EPICS.md](EPICS.md) | Epic definitions — every task belongs to an epic. |
| [task.jsonl](task.jsonl) | **Your work queue.** One task per line. See format below. |

## Working the task list (`task.jsonl`)

One JSON object per line:

```json
{"id":"T-001","epic":"E1","milestone":"M1","title":"...","status":"todo","depends_on":[],"details":"..."}
```

- `status`: `todo` → `in_progress` → `review` → `done` (or `blocked` — say why in `details`)
- Rules:
  1. Pick the lowest-numbered `todo` task whose `depends_on` are all `done`.
  2. Set it `in_progress` (commit the task.jsonl change with your work).
  3. One task = one PR/commit series. Don't bundle tasks.
  4. When done, set `review`; the reviewer flips it to `done`.
  5. Never delete a task line — append corrections or mark `status:"dropped"` with a reason.

## Quick facts

- **UX:** icon-first (select → icon → click → modal). NOT auto-popup. See SPEC §2.
- **Security split:** content script never sees API keys and never calls providers; all network + keys live in the service worker. See SPEC §3.
- **Trial funnel:** shipped default = owner's rate-limited gateway; on daily-quota error show the BYOK upsell, never a dead-end error. See SPEC §4 + §9.
- **i18n:** en (default), zh_CN, ms, ja, vi, ko. All UI strings via `chrome.i18n`. See SPEC §8.
- **Reference code:** [sample/PDF-Reader](sample/PDF-Reader) — a working PWA with the same select→translate→explain pipeline. Port patterns from it (see SPEC for what to reuse vs what to change). It is reference only; do not import it as a dependency.

## License

MIT — see [LICENSE](LICENSE). Free for personal and commercial use.
