// Pure HTML-string builder for the SPEC §5 Explain payload — no DOM state,
// no side effects, just payload in, HTML string out. Split out from
// explain-panel.js (which owns the actual explainBody element and wiring)
// so this ~100-line template-building block can be read/tested/changed on
// its own.

import { escapeHtml } from '../../shared/dom.js';

/**
 * Render the SPEC §5 explain payload: headword + phonetic + POS/CEFR
 * badges, dual-language definitions, in-context meaning, graded examples,
 * and collapsible collocations/word-family/synonyms/antonyms/memory-tip.
 * Every dynamic value is escaped — this is the one place in the modal that
 * builds HTML instead of using .textContent (SPEC §5's payload has real
 * structure — badges, examples, collapsible sections — that would be
 * painful to build as ~50 createElement calls).
 * @param {string} headword the originally-selected phrase (already shown in the source row; repeated here as the Explain block's own heading)
 * @param {object} payload SPEC §5 shape from EXPLAIN — schemaVersion, phonetic, partOfSpeech, cefrLevel, definitionSrc, definitionTgt, context, examples[], collocations[], wordFamily[], synonyms[], antonyms[], memoryTip
 * @param {{collocationsLabel: string, wordFamilyLabel: string, synonymsLabel: string, antonymsLabel: string, memoryTipLabel: string, definitionLabel: string, examplesLabel: string, contextLabel: string}} sectionLabels i18n labels for each block (T-025 doesn't hardcode English)
 * @returns {string} the full innerHTML for .modal-explain-body
 */
export function renderExplainHtml(headword, payload, sectionLabels) {
  const block = (body, opts = {}) =>
    body
      ? `<div class="explain-block${opts.collapsible ? ' is-collapsible' : ''}"${
          opts.collapsible ? ' data-collapsed="1"' : ''
        }>
           <div class="explain-label">${escapeHtml(opts.label || '')}${opts.collapsible ? ' <span class="explain-toggle">+</span>' : ''}</div>
           <div class="explain-body-text">${body}</div>
         </div>`
      : '';

  const head = `
    <div class="explain-head">
      <div>
        <span class="explain-headword">${escapeHtml(headword)}</span>
        ${payload.phonetic ? `<span class="explain-phonetic">${escapeHtml(payload.phonetic)}</span>` : ''}
      </div>
      <div>
        ${payload.partOfSpeech ? `<span class="badge">${escapeHtml(payload.partOfSpeech)}</span>` : ''}
        ${payload.cefrLevel && payload.cefrLevel !== 'unknown' ? `<span class="badge badge-cefr">${escapeHtml(payload.cefrLevel)}</span>` : ''}
      </div>
    </div>`;

  const definitions =
    payload.definitionSrc || payload.definitionTgt
      ? block(
          `${payload.definitionSrc ? `<div class="explain-def-src">${escapeHtml(payload.definitionSrc)}</div>` : ''}${
            payload.definitionTgt ? `<div class="explain-def-tgt">${escapeHtml(payload.definitionTgt)}</div>` : ''
          }`,
          { label: sectionLabels.definitionLabel },
        )
      : '';

  const context = payload.context ? block(escapeHtml(payload.context), { label: sectionLabels.contextLabel }) : '';

  const examples = payload.examples?.length
    ? block(
        payload.examples
          .map(
            (e) => `
          <div class="explain-example">
            ${e.level ? `<span class="badge badge-cefr badge-sm">${escapeHtml(e.level)}</span>` : ''}
            <div class="explain-example-src">${escapeHtml(e.src)}</div>
            <div class="explain-example-tgt">${escapeHtml(e.tgt)}</div>
          </div>`,
          )
          .join(''),
        { label: sectionLabels.examplesLabel },
      )
    : '';

  const collocations = payload.collocations?.length
    ? block(
        `<div class="explain-chips">${payload.collocations.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join('')}</div>`,
        { label: sectionLabels.collocationsLabel, collapsible: true },
      )
    : '';

  const wordFamily = payload.wordFamily?.length
    ? block(
        `<ul class="explain-list">${payload.wordFamily
          .map(
            (w) =>
              `<li><strong>${escapeHtml(w.word)}</strong>${w.pos ? ` <span class="muted">(${escapeHtml(w.pos)})</span>` : ''}${w.meaning ? ` — ${escapeHtml(w.meaning)}` : ''}</li>`,
          )
          .join('')}</ul>`,
        { label: sectionLabels.wordFamilyLabel, collapsible: true },
      )
    : '';

  const synonyms = payload.synonyms?.length
    ? block(
        `<ul class="explain-list">${payload.synonyms
          .map(
            (s) =>
              `<li><strong>${escapeHtml(s.word)}</strong>${s.note ? ` — <span class="muted">${escapeHtml(s.note)}</span>` : ''}</li>`,
          )
          .join('')}</ul>`,
        { label: sectionLabels.synonymsLabel, collapsible: true },
      )
    : '';

  const antonyms = payload.antonyms?.length
    ? block(
        `<div class="explain-chips">${payload.antonyms.map((a) => `<span class="chip">${escapeHtml(a)}</span>`).join('')}</div>`,
        { label: sectionLabels.antonymsLabel, collapsible: true },
      )
    : '';

  const memoryTip = payload.memoryTip
    ? block(escapeHtml(payload.memoryTip), { label: sectionLabels.memoryTipLabel, collapsible: true })
    : '';

  return head + definitions + context + examples + collocations + wordFamily + synonyms + antonyms + memoryTip;
}
