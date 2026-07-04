#!/usr/bin/env node
// CI i18n check (T-028, docs/I18N.md "Rules"): fails the build if
//   (1) a key referenced anywhere in code/manifest/HTML isn't defined in
//       _locales/en/messages.json (the source of truth), or
//   (2) an en-defined key is missing from any of the other 5 locales, or
//   (3) a string literal in content/popup/options JS looks like hardcoded
//       user-visible text instead of a chrome.i18n key, or
//   (4) an HTML tag in popup/options renders literal text instead of using
//       the data-i18n walker (shared/i18n.js).
//
// This is a heuristic, not a full parser — grep-based, per the task's own
// framing ("grep heuristic for hardcoded UI literals"). False positives are
// expected occasionally; suppress a specific line with a trailing
// `// i18n-ok: <reason>` comment.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LOCALES = ['en', 'zh_CN', 'ja', 'ko', 'ms', 'vi'];
// Keep in sync with docs/I18N.md's "Key naming" table.
const KEY_PREFIX_RE = /^(ext|popup|options|modal|menu|error|engine_label|explain_section|explain_expand|explain_collapse)_[A-Za-z0-9_]+$/;
const SUPPRESS_RE = /\/\/\s*i18n-ok\b/;

let errors = [];
let warnings = [];

function walk(dir, exts) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(full, exts));
    else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(full);
  }
  return out;
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// --- 1. Load locale message files ---

const localeMessages = {};
for (const locale of LOCALES) {
  const file = path.join(ROOT, 'public', '_locales', locale, 'messages.json');
  if (!fs.existsSync(file)) {
    errors.push(`Missing locale file: public/_locales/${locale}/messages.json`);
    continue;
  }
  localeMessages[locale] = JSON.parse(fs.readFileSync(file, 'utf8'));
}

const enKeys = new Set(Object.keys(localeMessages.en || {}));

// --- 2. Every en key must exist in every other locale ---

for (const locale of LOCALES) {
  if (locale === 'en' || !localeMessages[locale]) continue;
  const keys = new Set(Object.keys(localeMessages[locale]));
  for (const key of enKeys) {
    if (!keys.has(key)) errors.push(`_locales/${locale}/messages.json is missing key "${key}" (present in en)`);
  }
  for (const key of keys) {
    if (!enKeys.has(key)) errors.push(`_locales/${locale}/messages.json has extra key "${key}" (not in en)`);
  }
}

// --- 3. Collect every key referenced in code/manifest/HTML ---

const usedKeys = new Set();
const stringLitRe = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;

for (const file of walk(path.join(ROOT, 'src'), ['.js'])) {
  const src = stripComments(fs.readFileSync(file, 'utf8'));
  let m;
  while ((m = stringLitRe.exec(src))) {
    const val = m[1] !== undefined ? m[1] : m[2];
    if (KEY_PREFIX_RE.test(val)) usedKeys.add(val);
  }
}

const dataI18nRe = /data-i18n(?:-placeholder)?="([^"]+)"/g;
for (const file of walk(path.join(ROOT, 'src'), ['.html'])) {
  const src = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = dataI18nRe.exec(src))) usedKeys.add(m[1]);
}

const manifestFile = path.join(ROOT, 'manifest.json');
if (fs.existsSync(manifestFile)) {
  const src = fs.readFileSync(manifestFile, 'utf8');
  let m;
  const msgRe = /__MSG_(\w+)__/g;
  while ((m = msgRe.exec(src))) usedKeys.add(m[1]);
}

for (const key of usedKeys) {
  if (!enKeys.has(key)) errors.push(`Key "${key}" is referenced in code but not defined in _locales/en/messages.json`);
}
for (const key of enKeys) {
  if (!usedKeys.has(key)) warnings.push(`Key "${key}" is defined in en/messages.json but not referenced anywhere found`);
}

// --- 4. Hardcoded-string heuristic: content/popup/options JS ---

const wordRe = /^[A-Za-z]{2,}$/;
function looksLikeSentence(s) {
  const words = s.trim().split(/\s+/);
  if (words.length < 2) return false;
  return words.filter((w) => wordRe.test(w)).length >= 2;
}

const uiDirs = ['content', 'popup', 'options'].map((d) => path.join(ROOT, 'src', d));
for (const dir of uiDirs) {
  for (const file of walk(dir, ['.js'])) {
    const rawSrc = fs.readFileSync(file, 'utf8');
    const src = stripComments(rawSrc);
    const lines = src.split('\n');
    let m;
    stringLitRe.lastIndex = 0;
    while ((m = stringLitRe.exec(src))) {
      const val = m[1] !== undefined ? m[1] : m[2];
      if (!looksLikeSentence(val)) continue;
      const lineNo = src.slice(0, m.index).split('\n').length;
      const lineText = lines[lineNo - 1] || '';
      if (/console\.(log|warn|error|debug|info)\s*\(/.test(lineText)) continue;
      if (SUPPRESS_RE.test(lineText)) continue;
      errors.push(`${path.relative(ROOT, file)}:${lineNo} looks like a hardcoded UI string: ${JSON.stringify(val)}`);
    }
  }
}

// --- 5. Hardcoded-string heuristic: popup/options HTML text nodes ---

for (const dir of [path.join(ROOT, 'src', 'popup'), path.join(ROOT, 'src', 'options')]) {
  for (const file of walk(dir, ['.html'])) {
    let src = fs.readFileSync(file, 'utf8');
    src = src.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
    const tagTextRe = /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>([^<]*)<\/\1>/g;
    let m;
    while ((m = tagTextRe.exec(src))) {
      const [, , attrs, text] = m;
      if (/data-i18n/.test(attrs)) continue;
      if (looksLikeSentence(text.replace(/\s+/g, ' '))) {
        const lineNo = src.slice(0, m.index).split('\n').length;
        errors.push(`${path.relative(ROOT, file)}:${lineNo} has hardcoded text instead of data-i18n: ${JSON.stringify(text.trim())}`);
      }
    }
  }
}

// --- Report ---

if (warnings.length) {
  console.warn(`\ni18n check: ${warnings.length} warning(s):`);
  for (const w of warnings) console.warn('  - ' + w);
}

if (errors.length) {
  console.error(`\ni18n check FAILED: ${errors.length} error(s):`);
  for (const e of errors) console.error('  - ' + e);
  console.error('\nSee docs/I18N.md. Suppress a specific false positive with a trailing `// i18n-ok: <reason>` comment.');
  process.exit(1);
} else {
  console.log(`i18n check passed: ${enKeys.size} keys, ${LOCALES.length} locales, ${usedKeys.size} keys referenced in code.`);
}
