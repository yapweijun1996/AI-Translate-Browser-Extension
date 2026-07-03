# Chrome Web Store Developer Dashboard — submission notes

Reference text for the fields in the Dashboard that aren't part of the localized listing copy (those live in `listing-<locale>.md`). Fill these once, in English — the Dashboard doesn't localize them.

## Single purpose description

> This extension lets users select text on any webpage and receive an AI-generated translation, with an optional detailed explanation (definition, examples, grammar notes) for language learners.

## Permission justifications

| Permission | Justification |
|---|---|
| `storage` | Stores the user's settings (chosen engine, target language, optional BYOK API keys) and a local cache of recent translations, entirely in `chrome.storage.local` / IndexedDB on the user's own device. |
| `contextMenus` | Adds a "Translate selection" item to the right-click menu (T-029) as an alternative to the in-page trigger icon, for users who prefer the native context menu. |
| `offscreen` | Chrome's on-device Translator and Language Detector APIs require a real Document context, which a Manifest V3 service worker cannot provide. The extension creates a hidden offscreen document solely to host these on-device model calls (docs/ENGINES.md "Engine 2") — it is not used for anything else. |
| Host permission via `content_scripts` `matches: ["<all_urls>"]` | The extension must detect a text selection on whatever page the user is currently reading, so the translate icon can appear regardless of which site they're on. There is no way to know in advance which sites a user will want to translate on. The content script only reads text the user explicitly selects — see the Privacy Policy for exactly what is (and isn't) read or transmitted. |

Note: `scripting` and `activeTab` were requested in earlier manifest drafts but removed (2026-07-03, T-031) once confirmed unused — the extension only injects its content script declaratively via `content_scripts`, and `chrome.tabs.sendMessage` (used by the context menu handler) doesn't require either permission.

## Data usage disclosure (the checklist Chrome asks you to complete)

Based on what the extension actually does (see `PRIVACY-POLICY.md` for the full breakdown):

- **Personally identifiable information**: Not collected.
- **Health information**: Not collected.
- **Financial and payment information**: Not collected.
- **Authentication information**: Not collected by the extension — if the user adds their own third-party API key (Gemini/OpenAI/DeepSeek), it is stored only in their own browser (`chrome.storage.local`) and sent only to that provider as an auth header. The extension developer never receives it.
- **Personal communications**: Not collected.
- **Location**: Not collected.
- **Web history**: Not collected in the sense of browsing history tracking. The selected text (plus a short surrounding excerpt) is transmitted only when the user explicitly requests a translation/explanation, to whichever engine they're using — this is user content, not passive history collection, and nothing is logged by the extension itself.
- **User activity**: Not collected (no analytics/telemetry).
- **Website content**: The text a user selects (plus nearby context) is read and, on explicit user action, sent to the active translation engine. Declare this honestly in the "Website content" checkbox with a note that it's user-initiated, per-selection only.

Certify: "I do not sell or transfer user data to third parties outside of the approved use cases" — true, since BYOK traffic goes directly from the user's browser to the provider they configured, not through the developer.

## Privacy Policy URL

Must point to a **hosted, public URL** — not this repo file directly. Publish `PRIVACY-POLICY.md`'s content (e.g. via GitHub Pages, or a page on the developer's own site) before submitting, then paste that URL into the Dashboard's "Privacy practices" tab.

## Store icon / screenshots

- Icon: `public/icons/icon-128.png` (T-030) satisfies the 128×128 store icon requirement.
- Screenshots (1280×800 or 640×400, at least one required): not yet captured — needs a real loaded-extension screenshot pass, same manual-browser constraint as T-012. Take these once T-012's manual QA pass happens (or as part of T-032).
