# Coding standards

Short version: plain modern JavaScript (ES modules), small files, no clever tricks. When in doubt, copy the style of the code in [REFERENCE-SNIPPETS.md](REFERENCE-SNIPPETS.md) — it's the reference for tone and structure.

## Language & modules

- Vanilla JS (ES2022+), ES modules. No TypeScript for MVP (keep the toolchain simple for juniors); use JSDoc `@param`/`@returns` on exported functions instead.
- No frameworks in content script / popup / options for MVP — plain DOM. (Re-evaluate at E7.)
- One module = one responsibility. If a file passes ~300 lines, consider splitting.

## Naming & structure

- Files: `kebab-case.js`. Functions/vars: `camelCase`. Constants: `UPPER_SNAKE`.
- Folders by context: `background/`, `content/`, `popup/`, `options/`, `shared/` (pure helpers usable in any context — must not touch DOM or chrome.* APIs).
- Message types: `UPPER_SNAKE` strings, defined once in `shared/messages.js`, imported everywhere. Never inline a message-type string literal.

## Hard rules (PR fails review if violated)

1. **No network calls or API keys in the content script.** All provider traffic goes through the service worker (SPEC §3).
2. **No hardcoded user-visible strings.** Every UI string is a `chrome.i18n` key present in all 6 locales ([I18N.md](I18N.md)).
3. **No `innerHTML` with unescaped dynamic content.** Use the `escapeHtml` helper ([REFERENCE-SNIPPETS §8](REFERENCE-SNIPPETS.md)) or `textContent`.
4. **No new permissions** in manifest.json without a spec change + owner approval.
5. **Never commit a plaintext API key.** The trial key exists in the repo ONLY as its XOR cipher string.
6. **No `eval`, no remote code, no CDN scripts.** MV3/store hard requirement.
7. Errors crossing the worker→content boundary are always `{code, message}` from the central mapper — content script never parses provider error bodies.

## Error handling style

- Async functions: let errors throw; catch at the boundary (message handler in worker, UI event handler in content script).
- Never swallow: `catch {}` is only acceptable for best-effort cache writes, and needs a comment saying why.
- User-facing failure always renders something actionable (retry / open options / fallback) — never a frozen spinner.

## Comments

- Comment *why*, not *what*. Good: the reference gateway client's note on why `temperature` isn't forwarded to gpt-5.x. Bad: `// call the API`.
- Every exported function: one-line JSDoc minimum.

## Git & PRs

- Branch per task: `t013-engine-registry`.
- Conventional-ish commits: `feat(content): trigger icon`, `fix(worker): abort timeout`, `docs: ...`, `i18n: ...`.
- One task per PR. PR description: what, how tested (which sites/contexts), task ID.
- Update `task.jsonl` status in the same PR as the code.
- CI must be green before review.

## Dependencies

- Default answer to "can I add an npm package?" is no. Allowed without discussion: `idb-keyval` (or `idb`). Anything else: ask first, justify in the PR.
- Zero runtime dependencies in the content script if possible (bundle size + review-surface).
