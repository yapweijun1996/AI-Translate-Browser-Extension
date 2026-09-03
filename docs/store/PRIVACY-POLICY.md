---
permalink: /privacy-policy/
---

# Privacy Policy — AI Translate

**Last updated: 2026-09-03**

This is the canonical (English) privacy policy for the AI Translate browser extension. Translated versions for reference are in this same folder (`privacy-policy-<locale>.md`); in case of any conflict, this English version governs.

> **Before publishing:** this file must be hosted at a public URL (e.g. GitHub Pages, or a page on your own site) — the Chrome Web Store requires a live Privacy Policy URL, not a repo link, in the Developer Dashboard's "Privacy practices" tab.

## What this extension does

AI Translate lets you select text on any webpage and get an AI-generated translation, plus an optional "Explain" panel (definition, examples, grammar notes) for the selected phrase. Both features are user-initiated: nothing is translated, explained, or sent anywhere until you select text and click the translate icon, the right-click "Translate selection" menu item, or the Explain button.

## What data is processed, and where it goes

The only data this extension ever processes is:

- **The text you select** on a page, plus a short surrounding excerpt (up to ~1,200 characters of the same paragraph) used to make the translation/explanation more accurate in context.
- **Your target language** and, for Explain, a lightweight local guess at the source language (a quick, on-device heuristic based on the script/characters used — this never leaves your browser).

This data is sent to exactly one destination: **whichever translation engine you are currently using**, and only at the moment you request a translation or explanation — never automatically, never in the background, and never for text you haven't selected.

## Chrome Web Store Limited Use compliance

AI Translate's use of data received from Chrome APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. The extension uses selected text only to provide the translation or explanation requested by the user.

### Engine 1 — Demo gateway (default, no setup)

- When you use the demo gateway, your selected text and context are sent over HTTPS to the developer's gateway (`gpt.yapweijun1996.com/demo`) and relayed to an upstream AI service to produce the translation or explanation.
- The OpenAI project currently used by this gateway has input and output sharing with OpenAI enabled. Therefore, content submitted through the demo gateway may be shared with OpenAI and may be used to improve or train OpenAI models. This differs from the default OpenAI API data policy, under which API data is not used for training unless the customer explicitly opts in. Do not submit confidential, personal, or sensitive information that you do not want processed by these services.
- The demo service may be subject to daily, rate, or operational limits, and its availability may change. If it is unavailable, the extension can offer your own API key, on-device translation when available, or a later retry.

### Engine 2 — On-device (private, no network)

- Uses Chrome's built-in on-device Translator and Language Detector APIs. Your text is processed entirely on your own device — **it is never sent over the network to anyone**, not even the developer.
- This is the only engine for which a "your data never leaves your device" claim applies.
- On-device translation cannot power the Explain feature (a technical limitation of Chrome's on-device API), so Explain is disabled when this is your only available engine.

### Engine 3 — Bring your own key (Gemini, OpenAI, or DeepSeek)

- If you add your own API key for Gemini, OpenAI, or DeepSeek in Settings, your selected text and context are sent **directly from your browser to that provider's own API** (`generativelanguage.googleapis.com`, `api.openai.com`, or `api.deepseek.com` respectively), using your own key.
- The developer of this extension never sees this traffic — it goes straight from your browser to the provider you chose. Your data is subject to that provider's own privacy policy and data-retention practices, not the developer's. Review the provider's policy directly if this matters to you.
- Once you've added a key for a provider, the free demo gateway is no longer used at all.

## What is stored, and where

| Data | Where | Sent anywhere? |
|---|---|---|
| Your API key(s), if you add any | `chrome.storage.local` (your browser only) | Only as an authentication header to that specific provider's API — never to the developer, never anywhere else |
| Your engine choice, target language | `chrome.storage.local` (your browser only) | No |
| A cache of recent translations/explanations (to avoid re-requesting the same text) | IndexedDB (your browser only) | No — this cache never leaves your device |

Nothing this extension stores locally is synced to a developer-run server. This does not override the remote-engine disclosures above: selected content sent to the demo gateway or a provider is processed under that engine's policies. The extension does not sell data or use it for advertising.

## What this extension does NOT do

- No analytics, telemetry, or usage tracking of any kind.
- No advertising, and no data is ever sold or shared with advertisers.
- No passive reading of page content — the content script only activates on a selection you make and a button you click.
- No account or sign-in required to use the free trial or on-device engines.

## Why this extension can read data on all websites

Chrome shows an install-time warning that this extension can "read and change all your data on all websites." This is because the extension needs to detect a text selection on **any** page you're reading, so the translate icon can appear no matter what site you're on — it cannot know in advance which sites you'll want to translate. In practice, the content script only reads the text you explicitly select; it does not scan, log, or transmit anything else on the page.

## Children's privacy

This extension is not directed at children under 13 and does not knowingly collect data from them (it doesn't collect personal data from anyone, regardless of age, beyond what's described above).

## Changes to this policy

If this policy changes in a way that affects what data is processed or where it goes, the "Last updated" date above will change and, for material changes, a note will be added to the extension's Chrome Web Store listing.

## Contact

Questions about this policy or how the extension handles data: yapweijun1996@gmail.com
