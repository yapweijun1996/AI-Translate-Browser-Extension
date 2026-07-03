# Reference snippets

Working code extracted from the (now removed) PDF-Reader reference project. These are the patterns the tasks in [task.jsonl](../task.jsonl) say to "port". Copy from here, adapt names/paths to our structure, and follow [CODING-STANDARDS.md](CODING-STANDARDS.md).

Provenance: `sample/PDF-Reader` (a working PWA with the same select→translate→explain pipeline), reviewed and verified 2026-07-03. The PWA called APIs directly from page JS — in this extension that logic moves to the service worker (see [ARCHITECTURE.md](ARCHITECTURE.md)); the DOM/UI parts move to the content script.

## §1 Selection detector (for T-006)

Debounced selection detection. Ignores collapsed/short selections; `selectionchange` resets state so re-selecting the same text fires again.

```js
export function onSelection(handler) {
  let timer = null;
  let lastText = '';

  const fire = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (!text || text === lastText) return;
    if (text.length < 2) return;
    let rect = null;
    try {
      rect = sel.getRangeAt(0).getBoundingClientRect();
    } catch {}
    lastText = text;
    handler(text, rect);
  };

  const debounced = () => {
    clearTimeout(timer);
    timer = setTimeout(fire, 250);
  };

  document.addEventListener('mouseup', debounced);
  document.addEventListener('touchend', debounced);
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) lastText = '';
  });
}
```

## §2 Context capture (for T-010)

Walk up from the selection to grab the surrounding paragraph (~1200 chars) for context-aware translate/explain.

```js
function captureContext(selectedText) {
  try {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return selectedText;
    let node = sel.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    // walk up until we have a block with enough text, but don't grab the whole page
    while (node && node.innerText && node.innerText.length < 200 && node.parentElement) {
      node = node.parentElement;
    }
    return (node?.innerText || selectedText).slice(0, 1200);
  } catch {
    return selectedText;
  }
}
```

## §3 Trial gateway client — XOR key + SSE streaming (for T-014)

OpenAI-compatible `/v1/responses` with streaming SSE. Streaming is required (avoids Cloudflare's 100s edge timeout). `temperature` must NOT be forwarded — gpt-5.x reasoning models reject it with a 400. Always pass explicit `reasoning.effort` (gateway default is `xhigh`, drains quota).

```js
const GATEWAY_URL = 'https://gpt.yapweijun1996.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.4-mini';
const XOR_SEED = '20260515';
// XOR-obfuscated gateway key (obfuscation only, NOT crypto — acceptable here
// because the gateway enforces a daily limit server-side and the key is revocable).
const ENCRYPTED_DEFAULT_KEY =
  '085071109003002001087084003002084015001086006001081000083087002004085002001086080087081002083012005081000001081002085087001082007087006087002006005000010';

let cachedKey = null;

function decryptKey(cipher, seed) {
  const bytes = [];
  for (let i = 0; i < cipher.length; i += 3) {
    const n = parseInt(cipher.slice(i, i + 3), 10);
    const kc = seed.charCodeAt((i / 3) % seed.length);
    bytes.push(n ^ kc);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function getDefaultKey() {
  if (!cachedKey) cachedKey = decryptKey(ENCRYPTED_DEFAULT_KEY, XOR_SEED);
  return cachedKey;
}

export async function callGateway({ prompt, model, apiKey, maxOutputTokens, reasoningEffort = 'low', signal }) {
  const key = apiKey || getDefaultKey();
  const body = {
    model: model || DEFAULT_MODEL,
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
    stream: true,
    reasoning: { effort: reasoningEffort }
  };
  if (typeof maxOutputTokens === 'number') body.max_output_tokens = maxOutputTokens;

  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify(body),
    signal
  });
  if (!res.ok) throw await mapHttpError(res);       // → central error mapper (T-021)
  if (!res.body) throw new Error('empty response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamed = '';
  let finalText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLines = frame.split('\n').filter(l => l.startsWith('data:'));
      if (!dataLines.length) continue;
      const payload = dataLines.map(l => l.slice(5).trimStart()).join('\n');
      if (payload === '[DONE]') continue;
      let evt;
      try { evt = JSON.parse(payload); } catch { continue; }
      const t = evt?.type || '';
      if (t === 'response.output_text.delta' && typeof evt.delta === 'string') {
        streamed += evt.delta;
      } else if (t === 'response.completed' && evt.response?.output) {
        for (const item of evt.response.output) {
          if (item.type === 'message') {
            for (const c of (item.content || [])) {
              if (typeof c.text === 'string') finalText += c.text;
            }
          }
        }
      } else if (t === 'error') {
        throw new Error(evt.error?.message || 'gateway stream error');
      }
    }
  }
  return (finalText || streamed).trim();
}
```

## §4 Translate prompt (for T-023)

Adapted from the PDF version — cleaning rules generalized to web content:

```
You are translating web page content to ${targetLang}.

Before translating, silently clean the input:
- Drop citation markers like [1], [12, 5] entirely (they're not content)
- Drop stray UI labels / footnote markers that appear mid-sentence
- Reconnect words split by hyphens at line breaks (e.g. "se- quence" → "sequence")
- Keep code, math symbols and variable names as-is — do not translate them
- Normalize whitespace; do NOT add Markdown unless the source is structured

Output: the cleaned, fluent ${targetLang} translation only.
No explanation, no quotes, no preamble.

INPUT:
${text}
```

## §5 Explain prompt + strict-JSON parsing (for T-024)

Schema-versioned payload; bump `SCHEMA_VERSION` when the shape changes (invalidates cache).

```js
const SCHEMA_VERSION = 2;

function buildExplainPrompt({ phrase, contextParagraph, sourceLangName, targetLang }) {
  return (
    `You are a language tutor. The user is a native ${targetLang} speaker reading a ${sourceLangName} text.\n` +
    `They highlighted: "${phrase}".\n` +
    (contextParagraph ? `Surrounding paragraph: """${contextParagraph}"""\n` : '') +
    `\nExplain "${phrase}" so the learner can understand AND use it.\n\n` +
    `CRITICAL rules for examples:\n` +
    `- Examples MUST use vocabulary SIMPLER than the target word/phrase, so the example teaches the word.\n` +
    `- Provide 3 examples in increasing difficulty (typically A2 → B1 → B2).\n` +
    `- Do NOT just paraphrase the surrounding paragraph — give fresh, natural examples.\n\n` +
    `Return STRICT JSON ONLY. No markdown fences, no preamble.\n` +
    `Schema:\n` +
    `{\n` +
    `  "phonetic": "/IPA/ or empty string",\n` +
    `  "partOfSpeech": "noun|verb|adjective|adverb|phrase|...",\n` +
    `  "cefrLevel": "A1|A2|B1|B2|C1|C2|unknown",\n` +
    `  "definitionSrc": "definition in ${sourceLangName} using simple vocabulary",\n` +
    `  "definitionTgt": "definition in ${targetLang}, 1-2 sentences",\n` +
    `  "context": "${targetLang}: what it means in the surrounding paragraph",\n` +
    `  "examples": [{"src": "...", "tgt": "...", "level": "A2"}, ...],\n` +
    `  "collocations": ["3-5 common phrases"],\n` +
    `  "wordFamily": [{"word": "...", "pos": "...", "meaning": "${targetLang}"}],\n` +
    `  "synonyms": [{"word": "...", "note": "${targetLang} nuance note"}],\n` +
    `  "antonyms": ["..."],\n` +
    `  "memoryTip": "${targetLang}: short mnemonic (one sentence)"\n` +
    `}\n` +
    `If a section doesn't apply, return an empty array or empty string for it.`
  );
}

// Models sometimes wrap JSON in fences or add preamble — recover instead of failing.
function parseJsonLoose(s) {
  if (!s) return null;
  const cleaned = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}
```

Then normalize every field defensively (`stringy()` / `arrify()` — coerce to trimmed strings / arrays, filter incomplete entries) so a sloppy model response can never crash the renderer; worst case, fall back to showing the raw text.

## §6 Cache versioning pattern (for T-020, T-026)

```js
// Bump when the translation prompt changes — invalidates older cached entries.
const PROMPT_VERSION = 1;
const transKey = (targetLang, engine, textHash) =>
  `trans::v${PROMPT_VERSION}::${targetLang}::${engine}::${textHash}`;

const explainKey = (origin, phrase, targetLang) =>
  `explain::v${SCHEMA_VERSION}::${origin}::${phrase.trim().toLowerCase().slice(0, 200)}::${targetLang}`;

// LRU: keep an index of {key, ts}; on insert over cap, delete oldest.
```

## §7 Modal positioning + mobile bottom sheet (for T-008, T-009)

Desktop: anchor below the selection rect, clamp to viewport; width ~380px, margin 12px, offset 8px below the rect. Mobile (`window.innerWidth < 640`): render as a bottom sheet (left/right/bottom = 0), with a drag handle — track `touchstart/touchmove/touchend` deltaY, dismiss when dragged down > 80px, else snap back.

```js
function position(box, rect) {
  if (window.innerWidth < 640) {
    Object.assign(box.style, { left: '0', right: '0', top: 'auto', bottom: '0', maxWidth: 'none' });
    return;
  }
  if (!rect) return;
  const margin = 12, boxWidth = 380;
  let left = rect.left + window.scrollX;
  const top = rect.bottom + window.scrollY + 8;
  if (left + boxWidth + margin > window.innerWidth) left = window.innerWidth - boxWidth - margin;
  if (left < margin) left = margin;
  Object.assign(box.style, { left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto', maxWidth: `${boxWidth}px` });
}
```

## §8 escapeHtml helper (hard rule #3 in CODING-STANDARDS)

```js
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
```
