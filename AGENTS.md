# AGENTS.md

## Project

AI-Translate-Browser-Extension — an AI-powered browser extension for translating web pages, selected text, and video subtitles. Chrome/Edge (Manifest V3) first; Firefox WebExtensions as a stretch goal.

## Current state

Pre-code — full documentation suite exists, no source code yet. Build from the docs: README.md (entry + task workflow) → SPEC.md (the contract) → docs/ (ARCHITECTURE, DEVELOPMENT, CODING-STANDARDS, I18N, ENGINES) → task.jsonl (work queue T-001…T-032, one JSON per line, never delete lines). EPICS.md and ROADMAP.md define scope and direction. License: MIT.

## Planned architecture

- `manifest.json` — Manifest V3
- `background/` — service worker: owns translation API calls, context-menu registration, message routing from content scripts
- `content/` — content scripts: selection capture, DOM text-node replacement, subtitle overlay. Uses a `MutationObserver` for SPA/dynamic content so lazy-loaded text still gets translated
- `popup/` — quick translate UI
- `options/` — engine choice, API key entry, target language, per-site rules

## Translation engines

- Default: Chrome's built-in on-device **Translator API** + **Language Detector API** — free, private (text never leaves the device), no API key, Chrome desktop 138+ only.
- Optional, user-supplied API key: DeepL, Google Cloud Translate, OpenAI, Gemini, Claude — for higher quality, cross-browser support, or nuanced/LLM-style translation.
- Trial → BYOK funnel (owner-authorized): the extension ships with the owner's own daily-rate-limited GPT gateway key (`gpt.yapweijun1996.com`, XOR-obfuscated, seed `20260515`, same scheme as `sample/PDF-Reader/src/gateway.js`) as the zero-setup default. On daily-limit error, show a BYOK upsell prompting the user to configure their own OpenAI/DeepSeek/Gemini key. See SPEC.md §4 + §9.
- Never bundle any other provider's key. Store user-supplied keys in `chrome.storage.local`.

## Conventions

- Minimal permissions in `manifest.json` — request only what a feature actually needs; keep `permissions` (API access) and `host_permissions` (injection scope) as narrow as possible.
- No remotely hosted or `eval`'d code — forbidden by Manifest V3 and Chrome Web Store review.
- Cache translations by `(text, sourceLang, targetLang, engine)` to avoid redundant/duplicate API calls and control cost.

## Build / test

No build tooling exists yet. Once chosen, document install/build/test/lint commands here so agents don't have to guess.

## Persistent knowledge (KB-MCP)

This project uses an external KB-MCP knowledge base (`https://kb.yapweijun1996.com`) as a cross-session decision log and memory store, tagged `project: "AI-Translate-Browser-Extension"`. Agents with KB-MCP tool access should search it for prior decisions before large changes, and record new decisions or non-obvious lessons after — don't duplicate an existing entry, update it instead.
