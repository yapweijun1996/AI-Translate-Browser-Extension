// Lightweight source-language guess via Unicode block heuristics — no
// network call, no on-device API dependency. Used only to fill in the
// {sourceLangName} framing text in the Explain prompt (explain-schema.js);
// the LLM reads the actual phrase and knows its real language regardless,
// so a rough guess here is low-stakes, not load-bearing for correctness.
// (Same approach the REFERENCE-SNIPPETS PDF-reader project used: detect
// locally instead of asking the user, since asking would break the
// select-and-click flow.)

const RANGES = [
  { test: /[぀-ゟ゠-ヿ]/, name: 'Japanese', bcp47: 'ja' }, // hiragana/katakana
  { test: /[가-힣]/, name: 'Korean', bcp47: 'ko' }, // hangul syllables
  { test: /[一-鿿]/, name: 'Chinese', bcp47: 'zh' }, // CJK ideographs, no kana -> not Japanese
  { test: /[؀-ۿ]/, name: 'Arabic', bcp47: 'ar' },
  { test: /[฀-๿]/, name: 'Thai', bcp47: 'th' },
  { test: /[Ѐ-ӿ]/, name: 'Russian', bcp47: 'ru' },
  { test: /[ऀ-ॿ]/, name: 'Hindi', bcp47: 'hi' },
];

/**
 * @param {string} text
 * @returns {{name: string, bcp47: string}} best-effort guess; Latin-script
 *   text (the large majority of cases this heuristic can't subdivide
 *   further — French vs English vs Vietnamese all look similar by block)
 *   defaults to English.
 */
export function detectSourceLanguage(text) {
  for (const { test, name, bcp47 } of RANGES) {
    if (test.test(text)) return { name, bcp47 };
  }
  return { name: 'English', bcp47: 'en' };
}
