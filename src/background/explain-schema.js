// Shared Explain prompt + response schema — REFERENCE-SNIPPETS §5, ported
// (near-)verbatim. Deliberately shared across all 4 LLM-capable engines
// (trial-gateway/gemini/openai/deepseek — on-device can't do Explain at
// all), unlike the translate() prompt which each engine file duplicates on
// purpose: here the prompt AND the parsing are 100% provider-agnostic, so
// each engine's explain() is just "build this prompt, call my own raw-text
// completion function, parse the result with this" — duplicating ~150
// lines of prompt+parsing four times would be a real maintenance cost with
// zero benefit, unlike translate()'s much smaller, genuinely-fine-to-clone
// prompt.
//
// Caching (SPEC §6 explain:: key) and UI rendering are NOT this file's job
// — those are T-026 and T-025.

// New cache/schema namespace for this project — no prior version to
// migrate from, unlike the REFERENCE-SNIPPETS source project which was
// already at v2 due to its own history.
export const SCHEMA_VERSION = 1;

/** REFERENCE-SNIPPETS §5, generalized from "PDF paragraph" to web content. */
export function buildExplainPrompt({ phrase, contextParagraph, sourceLangName, targetLang }) {
  const context = (contextParagraph || '').slice(0, 1200);
  return (
    `You are a language tutor. The user is a native ${targetLang} speaker reading a ${sourceLangName} text.\n` +
    `They highlighted: "${phrase}".\n` +
    (context ? `Surrounding paragraph: """${context}"""\n` : '') +
    `\n` +
    `Explain "${phrase}" so the learner can understand AND use it.\n` +
    `\n` +
    `CRITICAL rules for examples:\n` +
    `- Examples MUST use vocabulary SIMPLER than the target word/phrase, so the example teaches the word.\n` +
    `- Provide 3 examples in increasing difficulty (typically A2 → B1 → B2). Adjust if the phrase is itself elementary.\n` +
    `- Do NOT just paraphrase the surrounding paragraph — give fresh, natural examples.\n` +
    `\n` +
    `Return STRICT JSON ONLY. No markdown fences, no preamble, no commentary.\n` +
    `Schema:\n` +
    `{\n` +
    `  "phonetic": "/IPA/ or empty string if uncertain",\n` +
    `  "partOfSpeech": "noun|verb|adjective|adverb|phrase|...",\n` +
    `  "cefrLevel": "A1|A2|B1|B2|C1|C2|unknown",\n` +
    `  "definitionSrc": "definition in ${sourceLangName} using simple learner-friendly vocabulary",\n` +
    `  "definitionTgt": "definition in ${targetLang}, 1-2 sentences",\n` +
    `  "context": "${targetLang}: what it means specifically in the surrounding paragraph (or empty if no context)",\n` +
    `  "examples": [\n` +
    `    {"src": "easy ${sourceLangName} sentence using the word", "tgt": "${targetLang} translation", "level": "A2"},\n` +
    `    {"src": "medium sentence", "tgt": "${targetLang}", "level": "B1"},\n` +
    `    {"src": "harder sentence", "tgt": "${targetLang}", "level": "B2"}\n` +
    `  ],\n` +
    `  "collocations": ["3-5 common phrases that use this word naturally"],\n` +
    `  "wordFamily": [{"word": "...", "pos": "...", "meaning": "${targetLang}"}],\n` +
    `  "synonyms": [{"word": "...", "note": "${targetLang} note about nuance"}],\n` +
    `  "antonyms": ["..."],\n` +
    `  "memoryTip": "${targetLang}: short etymology or mnemonic (one sentence)"\n` +
    `}\n` +
    `If a section doesn't apply (e.g. no clear antonym), return an empty array or empty string for it.`
  );
}

// Models sometimes wrap JSON in fences or add preamble — recover instead of failing.
function parseJsonLoose(s) {
  if (!s) return null;
  const cleaned = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* fall through to brace-extraction below */
  }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {
      /* give up — caller gets an empty-ish payload, not a crash */
    }
  }
  return null;
}

function stringy(v) {
  return typeof v === 'string' ? v.trim() : v != null ? String(v).trim() : '';
}

function arrify(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Turn a model's raw text response into the normalized Explain payload
 * (SPEC §5). Defensive on every field — a sloppy or partially-malformed
 * model response can never throw here; worst case, fields come back empty
 * and `definitionTgt` falls back to the raw text so the user sees
 * something rather than nothing.
 * @param {string} raw model's raw text output
 * @param {{name: string, bcp47: string}} sourceLang from lang-detect.js
 * @returns {object} SPEC §5 explain payload
 */
export function parseExplainResponse(raw, sourceLang) {
  const parsed = parseJsonLoose(raw) || {};
  return {
    schemaVersion: SCHEMA_VERSION,
    sourceLang,
    phonetic: stringy(parsed.phonetic),
    partOfSpeech: stringy(parsed.partOfSpeech),
    cefrLevel: stringy(parsed.cefrLevel) || 'unknown',
    definitionSrc: stringy(parsed.definitionSrc),
    definitionTgt: stringy(parsed.definitionTgt) || stringy(raw),
    context: stringy(parsed.context),
    examples: arrify(parsed.examples)
      .map((e) => ({ src: stringy(e?.src), tgt: stringy(e?.tgt), level: stringy(e?.level) }))
      .filter((e) => e.src && e.tgt),
    collocations: arrify(parsed.collocations).map(stringy).filter(Boolean),
    wordFamily: arrify(parsed.wordFamily)
      .map((w) => ({ word: stringy(w?.word), pos: stringy(w?.pos), meaning: stringy(w?.meaning) }))
      .filter((w) => w.word),
    synonyms: arrify(parsed.synonyms)
      .map((s) => ({ word: stringy(s?.word), note: stringy(s?.note) }))
      .filter((s) => s.word),
    antonyms: arrify(parsed.antonyms).map(stringy).filter(Boolean),
    memoryTip: stringy(parsed.memoryTip),
  };
}
