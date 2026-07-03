import { applyI18n } from '../shared/i18n.js';
import { MSG } from '../shared/messages.js';
import { ENGINE_ID_STORAGE_KEY } from '../shared/settings-keys.js';
import { TARGET_LANGUAGES, DEFAULT_TARGET_LANGUAGE, TARGET_LANG_STORAGE_KEY } from '../shared/languages.js';
import { GEMINI_API_KEY_KEY } from '../background/engines/gemini.js';

console.log('[ai-translate:options] options page opened');
applyI18n(document);

const enginePickerEl = document.getElementById('enginePicker');
const targetLangEl = document.getElementById('targetLang');
const geminiKeyInput = document.getElementById('geminiApiKey');
const saveGeminiKeyBtn = document.getElementById('saveGeminiKey');
const geminiSavedNote = document.getElementById('geminiKeySavedNote');

// Sentinel for the "Automatic" radio's value — never written to storage;
// selecting it instead REMOVES the stored preference (registry.js then uses
// its FALLBACK_ORDER).
const AUTO_VALUE = '__auto__';

// i18n label per known engine id; unrecognized ids (a future engine this
// page hasn't been updated for) fall back to the raw id rather than
// crashing or showing a blank label.
const ENGINE_LABEL_KEYS = {
  'trial-gateway': 'options_engine_label_trial_gateway',
  'on-device': 'options_engine_label_on_device',
  gemini: 'options_engine_label_gemini',
};

function engineLabel(id) {
  const key = ENGINE_LABEL_KEYS[id];
  return key ? chrome.i18n.getMessage(key) : id;
}

function populateTargetLanguages() {
  for (const { code, label } of TARGET_LANGUAGES) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = label;
    targetLangEl.appendChild(opt);
  }
}

async function loadSettingsIntoForm() {
  const stored = await chrome.storage.local.get([TARGET_LANG_STORAGE_KEY, GEMINI_API_KEY_KEY]);
  targetLangEl.value = stored[TARGET_LANG_STORAGE_KEY] || DEFAULT_TARGET_LANGUAGE;
  geminiKeyInput.value = stored[GEMINI_API_KEY_KEY] || '';
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

saveGeminiKeyBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({ [GEMINI_API_KEY_KEY]: geminiKeyInput.value.trim() });
  geminiSavedNote.hidden = false;
  setTimeout(() => {
    geminiSavedNote.hidden = true;
  }, 2000);
  // Adding/clearing a key changes that engine's availability — re-render so
  // the picker's status badge and enabled/disabled state stay accurate.
  await renderEnginePicker();
});

async function init() {
  populateTargetLanguages();
  await loadSettingsIntoForm();
  await renderEnginePicker();
}

init();
