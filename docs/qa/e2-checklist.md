# T-012 — E2 exit-criteria manual QA checklist

Manual pass, not automatable: requires the unpacked extension loaded in a real
Chrome profile (native "Load unpacked" file picker) and, for a couple of
sites, a logged-in account. See docs/DEVELOPMENT.md "Load the extension
unpacked" for setup.

Exit criteria under test (EPICS.md E2 / SPEC §2 §3):

- Works on 10 diverse real sites with actual translation results (real
  engine, not a mock — E2's original mock-translator step was dropped;
  T-011 removed, so this depends on T-023's real engines).
- Icon never appears for selections < 2 chars or a collapsed selection.
- Page CSS never breaks our UI (Shadow DOM isolation holds).
- No interference with the page's normal copy/paste.
- Debounce (~250ms) feels right, not laggy or premature.
- Modal dismiss works: Esc, outside-click, ×.
- Mobile/narrow viewport (< 640px) renders the bottom-sheet variant with
  working drag-to-dismiss (SPEC §2 point 5).

## Per-site checklist template

For each site below, record: ✅/❌ per criterion, and any notes (screenshot
path optional). A criterion only needs manual narrative when it fails.

| # | Site | Selection→icon | Translate result | CSS isolation OK | Copy/paste unaffected | Notes |
|---|------|-----------------|-------------------|-------------------|------------------------|-------|
| 1 | News site (e.g. bbc.com/news or a local outlet) | | | | | |
| 2 | github.com (README/code page) | | | | | |
| 3 | developer.mozilla.org (MDN article) | | | | | |
| 4 | wikipedia.org (any long article) | | | | | |
| 5 | x.com / twitter.com (requires login) | | | | | |
| 6 | mail.google.com (Gmail, requires login) | | | | | |
| 7 | A React SPA (e.g. react.dev docs, or app.slack.com web) | | | | | |
| 8 | A strict-CSP site (e.g. github.com counts; also try a bank/gov site with strict CSP headers) | | | | | |
| 9 | An iframe-heavy site (e.g. a page embedding YouTube + ads, or codesandbox.io) | | | | | |
| 10 | An RTL page (e.g. arabic.cnn.com or wikipedia.org/wiki/... in Arabic/Hebrew) | | | | | |

## Cross-cutting checks (once, not per-site)

- [ ] Selecting < 2 characters: icon does NOT appear.
- [ ] Collapsing a selection (click elsewhere): icon disappears, no stale icon.
- [ ] Normal text copy (Ctrl/Cmd+C) after selecting still copies the right text — the icon/modal never intercepts the clipboard.
- [ ] Scrolling while the icon is visible: icon hides (per main.js's scroll listener) rather than floating in a stale position.
- [ ] Resize to < 640px width: modal switches to bottom-sheet mode; drag handle appears; dragging down > 80px dismisses it.
- [ ] Explain button appears after translation, and is enabled/disabled correctly depending on the active engine (T-026).
- [ ] Trigger a real trial-quota-exhausted response (only if/when it naturally occurs — do NOT deliberately force it, per the 2026-07-03 owner decision on T-021) and confirm the upsell renders correctly if seen.

## Known constraints / non-goals for this pass

- Full-page bilingual translation is out of scope (SPEC §10) — this checklist only exercises selection→translate, not whole-page rendering.
- Firefox/mobile-browser testing is out of scope for MVP (Chrome/Edge only).

## Results log

(Fill in after each testing session — date, tester, summary, any bugs filed.)

- **2026-07-03**: Checklist scaffolded. Execution pending — needs a human-driven pass in a real Chrome profile (see note below).
