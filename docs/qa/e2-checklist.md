# T-012 — E2 exit-criteria manual QA checklist

Manual pass, not automatable via headless tooling: requires the unpacked
extension loaded in a real Chrome profile (native "Load unpacked" file
picker). See docs/DEVELOPMENT.md "Load the extension unpacked" for setup.

**Executed 2026-07-03** — real Chrome 150 (isolated profile), extension
loaded via "Load unpacked" pointed at `dist/`, driven end-to-end via the
Chrome DevTools Protocol (real selection events, real clicks, real network
calls to the trial gateway — no mocking). Target language set to zh-CN for
most sites so translated output is visibly distinct from source, proving a
real round trip rather than an echo. Full raw results/screenshots in this
session's scratchpad; summarized below.

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
| 1 | Wikipedia — en.wikipedia.org (long article) | ✅ | ✅ "Explanatory notes" → "说明性注释" | ✅ | ✅ (see cross-cutting) | Also used for cross-cutting + mobile + Explain runs. |
| 2 | News — bbc.com/news | ✅ | ✅ real headline → zh-CN | ✅ | ✅ | No console errors. |
| 3 | github.com/torvalds/linux (strict CSP) | ✅ | ✅ "Skip to content" → "跳至内容" | ✅ | ✅ | Content script runs fine under GitHub's CSP. |
| 4 | developer.mozilla.org (MDN article) | ✅ | ✅ "JavaScript Guide" → "JavaScript 指南" | ✅ | ✅ | |
| 5 | ~~x.com (requires login)~~ → substituted: old.reddit.com, then news.ycombinator.com | ✅ (HN) | ✅ (HN) | ✅ | ✅ | Reddit returned a bot-protection block page in this sandbox (network-level, not our extension — the extension still worked correctly *on* the block page). Substituted Hacker News as a public feed-style site; no credentials available for an authenticated X session. |
| 6 | ~~mail.google.com (requires login)~~ → substituted: stackoverflow.com | ✅ | ✅ "Skip to main content" → "跳转到主要内容" | ✅ | ✅ | One console error present but it's Stack Overflow's own Google Sign-In (FedCM) widget failing due to no Google session in this sandbox — unrelated to our extension. No Gmail credentials available. |
| 7 | react.dev/learn (React SPA) | ✅ | ✅ "Tutorial: Tic-Tac-Toe" → "教程：井字棋" | ✅ | ✅ | |
| 8 | gov.uk/browse/visas-immigration (strict-CSP gov site) | ✅ | ✅ "Cookies on GOV.UK" → "GOV.UK 上的 Cookies" | ✅ | ✅ | Second, independent strict-CSP data point beyond GitHub. |
| 9 | w3schools.com/html/html_iframe.asp (iframe-heavy) | ✅ | ✅ "INTRO TO PROGRAMMING" → "编程入门" | ✅ | ✅ | |
| 10 | ar.wikipedia.org (RTL page) | ✅ | ✅ real translation rendered | ✅ (host page RTL layout undisturbed) | ✅ | Finding (non-blocking): our own modal chrome always renders LTR even on an RTL host page — SPEC doesn't call for mirroring our UI, flagging as a future polish item, not a bug. |

## Cross-cutting checks (once, not per-site)

- [x] Selecting < 2 characters: icon does NOT appear. **Verified** — 1-char selection on Wikipedia, icon stayed hidden.
- [x] Collapsing a selection (click elsewhere): icon disappears, no stale icon. **Verified** — icon shown after a fresh 24-char selection, then hidden immediately after `removeAllRanges()` + `selectionchange`.
- [ ] Normal text copy (Ctrl/Cmd+C) after selecting still copies the right text. **Not directly exercised** (no real OS clipboard in this automated pass) — verified by code inspection instead: the icon's `mousedown` handler only calls `preventDefault`/`stopPropagation` on itself (trigger-icon.js), never on the page or `document`, so nothing in the pipeline can intercept a normal copy gesture made on page text.
- [x] Scrolling while the icon is visible: icon hides. **Verified** — icon visible pre-scroll, hidden immediately after a 300px `scrollBy` + scroll event.
- [x] Resize to < 640px width: modal switches to bottom-sheet mode; drag handle appears; dragging down > 80px dismisses it. **Verified** — real window resize to 390×844 (not just a media-query fake), `.modal.is-sheet` applied, handle visible, translation rendered ("Artificial intelligence" → "人工智能"), and a simulated 150px downward drag on the handle dismissed the modal (`visible` class removed). Screenshot confirms correct bottom-sheet visual (rounded top corners, anchored to viewport bottom).
- [x] Explain button appears after translation and works end-to-end. **Verified** — clicked Explain on a real translated phrase, got back a real LLM-graded bilingual payload (headword, POS badge, CEFR level A2, definition in both languages, in-context meaning, graded examples with their own CEFR badges) and it rendered correctly with all values HTML-escaped. Screenshot: `explain-result.png`.
- [ ] Trigger a real trial-quota-exhausted response. **Deliberately not forced**, per the existing 2026-07-03 owner decision on T-021 (same rationale carried forward) — never naturally occurred during this pass either, so the upsell UI remains verified only via T-022's original mocked-response testing, not a live quota exhaustion.
- [ ] Context menu ("Translate selection"). **Not exercised live** — a native OS right-click context menu can't be driven through the Chrome DevTools Protocol used for this pass. Verified by code inspection only (service-worker.js's `contextMenus.onClicked` → `chrome.tabs.sendMessage(MENU_TRANSLATE_SELECTION)` → main.js's listener re-enters the same `translateSelection()` path already proven live in every site test above). Recommend a 30-second manual click-through before store submission.

## Known constraints / non-goals for this pass

- Full-page bilingual translation is out of scope (SPEC §10) — this checklist only exercises selection→translate, not whole-page rendering.
- Firefox/mobile-browser testing is out of scope for MVP (Chrome/Edge only).

## Results log

(Fill in after each testing session — date, tester, summary, any bugs filed.)

- **2026-07-03**: Checklist scaffolded. Execution pending — needs a human-driven pass in a real Chrome profile.
- **2026-07-03 (same day)**: Executed. 10/10 sites pass (2 login-walled sites from the original template — x.com, Gmail — substituted with reachable public equivalents; no test credentials available for those). All cross-cutting checks pass except two that are structurally untestable via automation (clipboard, native context menu) and one deliberately not forced (trial-quota exhaustion, per standing owner decision). Mobile bottom-sheet + drag-to-dismiss verified with a real window resize, not a media-query simulation. Explain feature verified end-to-end with a real graded bilingual payload. Zero extension-caused console errors across all 10 sites. Initially reported "no blocking bugs found" here — **corrected below**, that was wrong.
- **2026-07-03 (bug found post-report)**: Owner spotted a real defect from a live screenshot that the JSON-only assertions in this pass missed: on **every successful translation**, two empty, unlabeled, unwired button bars (blank blue + blank gray) rendered below the Explain button. Root cause: `.modal-upsell-actions` in modal.js sets `display: flex` unconditionally; the JS sets `.hidden = true` on that container after every successful translation, but an author stylesheet's explicit `display` always wins over the browser's default `[hidden] { display: none }` rule at equal specificity, so the `hidden` attribute was silently ignored. The container's two buttons (Settings/Dismiss) were never given text or click handlers on the success path (only `showUpsell()` does that, which normal translation never calls) — hence blank bars, not just misplaced ones. `explainBtn`/`explainBody` don't have this problem because their CSS never sets an explicit `display`, so the UA default applies unopposed — this was luck, not a guaranteed pattern. **Fix**: added `.modal-upsell-actions[hidden] { display: none; }` in modal.js. **Verified**: rebuilt, reloaded the same live extension instance, re-ran the exact same site/selection from the owner's screenshot (Stack Overflow, "Skip to main content") — bars gone, modal renders cleanly (source → translation → Explain only). This was a real, systematic, every-single-translation-affecting UI bug that the JSON-assertion-based sweep above did not catch (it checked `hidden`/visibility booleans on the *wrong* elements, never rendered pixels). **Revised conclusion: 1 blocking bug found and fixed** during this QA pass, not zero. T-012's exit criteria are now met with this fix included; recommend closing T-012 and unblocking T-032, with the context-menu and clipboard checks still getting a quick manual confirmation before store submission since they couldn't be automated here.
- **2026-07-03 (2nd bug found post-report)**: Owner asked "what if the selection is near the bottom of the page?" from another live screenshot showing modal content cut off mid-sentence. Reproduced deterministically via CDP: 900×700 viewport, selection near the bottom of the visible page, then Explain clicked to grow the box — **modal overflowed the viewport bottom by 336px**, with the overflowing portion completely unreachable (not scrolled off, genuinely invisible — no scrollbar existed). Root cause: `position(rect)` in modal.js measures and places the box once, at `showModal()` time, while it's still small (just source text + a loading spinner). The translation result and, later, the Explain payload both arrive afterward and grow the box — nothing ever re-measures or re-clamps its position against the viewport as that happens, so growth silently pushes the box past the bottom edge. `.modal` also had no `max-height`/`overflow-y` of its own (only the inner `.modal-explain-body` did, which doesn't help once the *outer* box is already taller than the viewport). **Fix**: (1) added `max-height: calc(100vh - 24px); overflow-y: auto;` to the base `.modal` rule as a passive safety net; (2) `position()` now also sets an inline `max-height` capped to the room actually available below the box's chosen `top` (`window.innerHeight - top - EDGE_MARGIN`, no floor — a floor would silently reintroduce a smaller version of the same overflow). Any content beyond that now scrolls inside the box instead of running off-screen. **Verified**: rebuilt, reloaded live, re-ran the exact repro (900×700, same near-bottom selection, same Explain click) — `overflowsBottom: false`, `overflowPx: 0`, and confirmed via `scrollHeight` (444px) vs `clientHeight` (96px) that the box is genuinely scrollable and that scrolling it (`modal.scrollTop = 200`) actually surfaces the previously-unreachable Explain definition text. Regression-checked a normal (non-edge) selection afterward — still positions and translates correctly, zero console errors. **Revised conclusion: 2 blocking bugs found and fixed** during this QA pass in total.
