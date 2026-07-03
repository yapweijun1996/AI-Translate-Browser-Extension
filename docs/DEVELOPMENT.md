# Development guide

## Prerequisites

- Node.js 20+
- Chrome 138+ (needed for the on-device Translator API path; older Chrome fine for everything else)
- Git

## Setup

```bash
npm install
npm run dev      # Vite dev build with watch (CRXJS gives HMR for extension contexts)
npm run build    # production build → dist/
```

(Scripts exist after T-001 lands; until then this doc is the target.)

## Load the extension unpacked

1. Build (`npm run dev` or `npm run build`).
2. Chrome → `chrome://extensions` → enable **Developer mode** (top right).
3. **Load unpacked** → select the `dist/` folder.
4. After code changes: dev mode usually hot-reloads; if behavior looks stale, click the ↻ reload icon on the extension card. Content scripts require reloading the *web page* too.

## Debugging each context

| Context | How to open its DevTools |
|---|---|
| Service worker | `chrome://extensions` → extension card → "service worker" link |
| Content script | Normal page DevTools (F12) → its logs appear in the page console; source under Sources → Content scripts |
| Popup | Right-click the popup → Inspect |
| Options | Open options page → F12 |

Tips:
- Worker logs disappear when the worker idles out (~30s). Keep its DevTools window open to keep it alive while debugging.
- To watch messages: log in both sender and receiver; message payloads must be JSON-serializable (no DOM nodes, no functions).
- IndexedDB inspection: worker DevTools → Application → IndexedDB.
- Test the trial-quota path without burning real quota: temporarily make the error mapper treat a fake header/flag as `trial_quota_exhausted` (never commit that hack).

## Testing the on-device Translator API

- Chrome 138+ desktop. First use may download a language model (see `chrome://on-device-internals`).
- Feature-detect exactly as in the adapter; never assume presence.

## Project conventions quicklinks

- Coding rules: [CODING-STANDARDS.md](CODING-STANDARDS.md)
- Adding UI strings: [I18N.md](I18N.md)
- Adding an engine: [ENGINES.md](ENGINES.md)
- Task workflow: [../README.md](../README.md) → "Working the task list"

## Definition of Done (every task)

1. Code follows CODING-STANDARDS.md; no hardcoded UI strings.
2. `npm run build` clean; `npm run lint` and `npm run lint:i18n` pass; CI green.
3. Manually verified in a loaded unpacked build (say what you tested in the PR description).
4. task.jsonl status updated in the same PR.
5. If you changed a message type, engine behavior, or cache key: update the matching doc (ARCHITECTURE/ENGINES) in the same PR.
