import { applyI18n } from '../shared/i18n.js';
import { MSG } from '../shared/messages.js';
import { ENGINE_ID_STORAGE_KEY } from '../shared/settings-keys.js';
import { TARGET_LANGUAGES, DEFAULT_TARGET_LANGUAGE, TARGET_LANG_STORAGE_KEY } from '../shared/languages.js';
import { engineLabel } from '../shared/engine-labels.js';
import { GEMINI_API_KEY_KEY } from '../background/engines/gemini.js';
import { OPENAI_API_KEY_KEY } from '../background/engines/openai.js';
import { DEEPSEEK_API_KEY_KEY } from '../background/engines/deepseek.js';

console.log('[ai-translate:options] options page opened');
applyI18n(document);

const enginePickerEl = document.getElementById('enginePicker');
const keyFieldsEl = document.getElementById('keyFields');
const targetLangEl = document.getElementById('targetLang');

// Sentinel for the "Automatic" radio's value — never written to storage;
// selecting it instead REMOVES the stored preference (registry.js then uses
// its FALLBACK_ORDER).
const AUTO_VALUE = '__auto__';

// Data-driven BYOK key fields — adding a new BYOK engine means adding one
// entry here, not another near-duplicate HTML/JS block (proven by T-018:
// DeepSeek only needed this one line + the import above).
const BYOK_KEY_FIELDS = [
  { storageKey: GEMINI_API_KEY_KEY, labelKey: 'options_gemini_key_label' },
  { storageKey: OPENAI_API_KEY_KEY, labelKey: 'options_openai_key_label' },
  { storageKey: DEEPSEEK_API_KEY_KEY, labelKey: 'options_deepseek_key_label' },
];

function populateTargetLanguages() {
  for (const { code, label } of TARGET_LANGUAGES) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = label;
    targetLangEl.appendChild(opt);
  }
}

function buildKeyField({ storageKey, labelKey }) {
  const wrap = document.createElement('div');
  wrap.className = 'key-field';

  const inputId = `key-${storageKey}`;
  const label = document.createElement('label');
  label.htmlFor = inputId;
  label.textContent = chrome.i18n.getMessage(labelKey);

  const row = document.createElement('div');
  row.className = 'key-row';

  const input = document.createElement('input');
  input.type = 'password';
  input.id = inputId;
  input.autocomplete = 'off';
  input.placeholder = chrome.i18n.getMessage('options_key_input_placeholder');

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = chrome.i18n.getMessage('options_save_button');

  const savedNote = document.createElement('span');
  savedNote.className = 'save-note';
  savedNote.hidden = true;
  savedNote.textContent = chrome.i18n.getMessage('options_saved_confirmation');

  saveBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ [storageKey]: input.value.trim() });
    savedNote.hidden = false;
    setTimeout(() => {
      savedNote.hidden = true;
    }, 2000);
    // Adding/clearing a key changes that engine's availability — re-render
    // so the picker's status badge and enabled/disabled state stay accurate.
    await renderEnginePicker();
  });

  row.append(input, saveBtn, savedNote);
  wrap.append(label, row);
  return { wrap, input };
}

const keyInputsByStorageKey = new Map();

function renderKeyFields() {
  keyFieldsEl.innerHTML = '';
  keyInputsByStorageKey.clear();
  for (const field of BYOK_KEY_FIELDS) {
    const { wrap, input } = buildKeyField(field);
    keyFieldsEl.appendChild(wrap);
    keyInputsByStorageKey.set(field.storageKey, input);
  }
}

async function loadSettingsIntoForm() {
  const keys = [TARGET_LANG_STORAGE_KEY, ...BYOK_KEY_FIELDS.map((f) => f.storageKey)];
  const stored = await chrome.storage.local.get(keys);
  targetLangEl.value = stored[TARGET_LANG_STORAGE_KEY] || DEFAULT_TARGET_LANGUAGE;
  for (const [storageKey, input] of keyInputsByStorageKey) {
    input.value = stored[storageKey] || '';
  }
}

function buildEngineRow({ value, label, hint, available, checked }) {
  const wrap = document.createElement('div');

  const row = document.createElement('div');
  row.className = 'engine-row';

  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'engine';
  input.id = `engine-${value}`;
  input.value = value;
  input.checked = checked;
  // "Automatic" is always selectable; a concrete engine only if it's usable
  // right now (e.g. a BYOK key is configured, or on-device is supported).
  input.disabled = value !== AUTO_VALUE && !available;
  input.addEventListener('change', () => onEngineSelected(value));

  const labelEl = document.createElement('label');
  labelEl.htmlFor = input.id;
  labelEl.textContent = label;

  const status = document.createElement('span');
  status.className = `engine-status ${available ? 'is-available' : 'is-unavailable'}`;
  status.textContent = chrome.i18n.getMessage(available ? 'options_status_available' : 'options_status_unavailable');

  row.append(input, labelEl, status);
  wrap.appendChild(row);

  if (hint) {
    const hintEl = document.createElement('p');
    hintEl.className = 'engine-hint';
    hintEl.textContent = hint;
    wrap.appendChild(hintEl);
  }
  return wrap;
}

async function renderEnginePicker() {
  const res = await chrome.runtime.sendMessage({ type: MSG.LIST_ENGINES, payload: {} });
  const engines = res?.ok ? res.data.engines : [];
  const currentPreference = (await chrome.storage.local.get(ENGINE_ID_STORAGE_KEY))[ENGINE_ID_STORAGE_KEY];

  enginePickerEl.innerHTML = '';
  enginePickerEl.appendChild(
    buildEngineRow({
      value: AUTO_VALUE,
      label: chrome.i18n.getMessage('options_engine_auto_label'),
      hint: chrome.i18n.getMessage('options_engine_auto_hint'),
      available: true,
      checked: !currentPreference,
    }),
  );
  for (const engine of engines) {
    enginePickerEl.appendChild(
      buildEngineRow({
        value: engine.id,
        label: engineLabel(engine.id),
        hint: '',
        available: engine.available,
        checked: currentPreference === engine.id,
      }),
    );
  }
}

async function onEngineSelected(value) {
  if (value === AUTO_VALUE) {
    await chrome.storage.local.remove(ENGINE_ID_STORAGE_KEY);
  } else {
    await chrome.storage.local.set({ [ENGINE_ID_STORAGE_KEY]: value });
  }
}

targetLangEl.addEventListener('change', async () => {
  await chrome.storage.local.set({ [TARGET_LANG_STORAGE_KEY]: targetLangEl.value });
});

async function init() {
  populateTargetLanguages();
  renderKeyFields();
  await loadSettingsIntoForm();
  await renderEnginePicker();
}

init();
