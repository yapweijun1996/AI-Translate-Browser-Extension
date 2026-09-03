import { applyI18n } from '../shared/i18n.js';
import { MSG } from '../shared/messages.js';
import { ENGINE_ID_STORAGE_KEY, TTS_VOICES_STORAGE_KEY, TTS_AUTOPLAY_STORAGE_KEY } from '../shared/settings-keys.js';
import { TARGET_LANGUAGES, DEFAULT_TARGET_LANGUAGE, TARGET_LANG_STORAGE_KEY } from '../shared/languages.js';
import { engineLabel } from '../shared/engine-labels.js';
import { GEMINI_API_KEY_KEY } from '../background/engines/gemini.js';
import { OPENAI_API_KEY_KEY } from '../background/engines/openai.js';
import { DEEPSEEK_API_KEY_KEY } from '../background/engines/deepseek.js';

console.log('[ai-translate:options] options app shell loaded');
applyI18n(document);

const VALID_ROUTES = ['general', 'translation', 'providers', 'speech', 'privacy'];
const DEFAULT_ROUTE = 'general';

const targetLangEl = document.getElementById('targetLang');
const enginePickerEl = document.getElementById('enginePicker');
const providersListEl = document.getElementById('providersList');
const ttsAutoplayEl = document.getElementById('ttsAutoplay');
const primaryVoiceContainerEl = document.getElementById('primaryVoiceContainer');
const ttsVoicesMatrixEl = document.getElementById('ttsVoicesMatrix');
const saveToastEl = document.getElementById('saveToast');
const saveToastTextEl = document.getElementById('saveToastText');
const contentViewportEl = document.getElementById('contentViewport');
const menuToggleBtn = document.getElementById('menuToggleBtn');
const appSidebarEl = document.getElementById('appSidebar');
const drawerBackdropEl = document.getElementById('drawerBackdrop');

const AUTO_VALUE = '__auto__';

let toastTimer = null;
export function showToast(message) {
  if (!saveToastEl) return;
  if (saveToastTextEl) saveToastTextEl.textContent = message;
  saveToastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    saveToastEl.classList.remove('is-visible');
  }, 2200);
}

// ---------------------------------------------------------------------------
// 1. Single View Routing & Navigation
// ---------------------------------------------------------------------------
function getRouteFromHash() {
  const hash = window.location.hash.replace(/^#/, '').trim().toLowerCase();
  return VALID_ROUTES.includes(hash) ? hash : DEFAULT_ROUTE;
}

export function showView(route, { focusProvider = null } = {}) {
  const activeRoute = VALID_ROUTES.includes(route) ? route : DEFAULT_ROUTE;

  // 1. Update Active View Panel
  VALID_ROUTES.forEach((r) => {
    const viewEl = document.getElementById(`view-${r}`);
    const navEl = document.getElementById(`nav-${r}`);
    const isActive = r === activeRoute;

    if (viewEl) {
      viewEl.hidden = !isActive;
      viewEl.classList.toggle('is-active', isActive);
    }

    if (navEl) {
      navEl.classList.toggle('is-active', isActive);
      if (isActive) {
        navEl.setAttribute('aria-current', 'page');
      } else {
        navEl.removeAttribute('aria-current');
      }
    }
  });

  // 2. Close mobile drawer if open
  closeMobileDrawer();

  // 3. Scroll content area back to top
  if (contentViewportEl) {
    contentViewportEl.scrollTop = 0;
  }

  // 4. If focusProvider requested, open its drawer and focus input
  if (focusProvider && activeRoute === 'providers') {
    setTimeout(() => {
      const drawer = document.getElementById(`edit-drawer-${focusProvider}`);
      if (drawer) {
        drawer.hidden = false;
        const input = drawer.querySelector('input');
        input?.focus();
      }
    }, 50);
  }
}

function openMobileDrawer() {
  if (!appSidebarEl || !drawerBackdropEl) return;
  appSidebarEl.classList.add('is-open');
  drawerBackdropEl.classList.add('is-open');
  menuToggleBtn?.setAttribute('aria-expanded', 'true');
}

function closeMobileDrawer() {
  if (!appSidebarEl || !drawerBackdropEl) return;
  appSidebarEl.classList.remove('is-open');
  drawerBackdropEl.classList.remove('is-open');
  menuToggleBtn?.setAttribute('aria-expanded', 'false');
}

function initShellNavigation() {
  // Hash change routing
  window.addEventListener('hashchange', () => {
    showView(getRouteFromHash());
  });

  // Direct sidebar clicks
  VALID_ROUTES.forEach((route) => {
    const navItem = document.getElementById(`nav-${route}`);
    navItem?.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.location.hash !== `#${route}`) {
        window.location.hash = `#${route}`;
      } else {
        showView(route);
      }
    });
  });

  // Mobile menu button
  menuToggleBtn?.addEventListener('click', () => {
    const isOpen = appSidebarEl?.classList.contains('is-open');
    if (isOpen) closeMobileDrawer();
    else openMobileDrawer();
  });

  drawerBackdropEl?.addEventListener('click', closeMobileDrawer);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && appSidebarEl?.classList.contains('is-open')) {
      closeMobileDrawer();
    }
  });

  // Initial Route setup
  const initial = getRouteFromHash();
  if (window.location.hash !== `#${initial}`) {
    window.location.replace(`#${initial}`);
  } else {
    showView(initial);
  }
}

// ---------------------------------------------------------------------------
// 2. View 1: General Preferences (Target Language)
// ---------------------------------------------------------------------------
function populateTargetLanguages() {
  if (!targetLangEl) return;
  targetLangEl.innerHTML = '';
  for (const { code, label } of TARGET_LANGUAGES) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = label;
    targetLangEl.appendChild(opt);
  }
}

async function loadTargetLanguage() {
  if (!targetLangEl) return;
  const stored = await chrome.storage.local.get(TARGET_LANG_STORAGE_KEY);
  targetLangEl.value = stored[TARGET_LANG_STORAGE_KEY] || DEFAULT_TARGET_LANGUAGE;
}

if (targetLangEl) {
  targetLangEl.addEventListener('change', async () => {
    await chrome.storage.local.set({ [TARGET_LANG_STORAGE_KEY]: targetLangEl.value });
    showToast(chrome.i18n.getMessage('options_saved_confirmation'));
    await renderTtsVoicePickers();
  });
}

// ---------------------------------------------------------------------------
// 3. View 2: Translation Engine Selection (Pure Selection Only)
// ---------------------------------------------------------------------------
let enginePickerRenderSeq = 0;

function getEngineDescription(id) {
  switch (id) {
    case AUTO_VALUE:
      return chrome.i18n.getMessage('options_engine_auto_hint');
    case 'trial-gateway':
      return chrome.i18n.getMessage('options_engine_trial_hint');
    case 'on-device':
      return chrome.i18n.getMessage('options_engine_on_device_hint');
    case 'gemini':
      return chrome.i18n.getMessage('options_engine_gemini_hint');
    case 'openai':
      return chrome.i18n.getMessage('options_engine_openai_hint');
    case 'deepseek':
      return chrome.i18n.getMessage('options_engine_deepseek_hint');
    default:
      return '';
  }
}

function buildCompactEngineRow({ id, displayName, hint, available, isSelected }) {
  const row = document.createElement('div');
  row.className = `engine-row-card${isSelected ? ' is-selected' : ''}${!available && id !== AUTO_VALUE ? ' is-disabled' : ''}`;

  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'activeEngine';
  radio.id = `engine-radio-${id}`;
  radio.value = id;
  radio.checked = isSelected;
  radio.disabled = id !== AUTO_VALUE && !available;
  radio.className = 'engine-radio-input';

  const info = document.createElement('div');
  info.className = 'engine-row-info';

  const titleBar = document.createElement('div');
  titleBar.className = 'engine-title-bar';

  const title = document.createElement('label');
  title.htmlFor = radio.id;
  title.className = 'engine-title-text';
  title.textContent = displayName;

  titleBar.appendChild(title);

  // Status Badge / Action Link
  if (id === AUTO_VALUE) {
    const badge = document.createElement('span');
    badge.className = 'badge badge-recommended';
    badge.textContent = chrome.i18n.getMessage('options_status_recommended');
    titleBar.appendChild(badge);
  } else if (id === 'on-device') {
    const badge = document.createElement('span');
    badge.className = `badge ${available ? 'badge-ready' : 'badge-neutral'}`;
    badge.textContent = chrome.i18n.getMessage(
      available ? 'options_status_private_ready' : 'options_status_unsupported',
    );
    titleBar.appendChild(badge);
  } else if (available) {
    const badge = document.createElement('span');
    badge.className = 'badge badge-ready';
    badge.textContent = chrome.i18n.getMessage('options_status_ready');
    titleBar.appendChild(badge);
  } else {
    // Unconfigured BYOK cloud provider: show "Setup required →" link to #providers
    const link = document.createElement('a');
    link.href = '#providers';
    link.className = 'action-chip-link';
    link.textContent = chrome.i18n.getMessage('options_engine_setup_required');
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.hash = '#providers';
      showView('providers', { focusProvider: id });
    });
    titleBar.appendChild(link);
  }

  const desc = document.createElement('p');
  desc.className = 'engine-hint-text';
  desc.textContent = hint;

  info.append(titleBar, desc);
  row.append(radio, info);

  // Select card on click
  row.addEventListener('click', (e) => {
    if (!available && id !== AUTO_VALUE) {
      if (id === 'gemini' || id === 'openai' || id === 'deepseek') {
        window.location.hash = '#providers';
        showView('providers', { focusProvider: id });
      }
      return;
    }
    if (e.target !== radio) {
      radio.checked = true;
    }
    onEngineSelected(id);
  });

  return row;
}

async function renderEnginePicker() {
  if (!enginePickerEl) return;
  const renderId = ++enginePickerRenderSeq;

  const res = await chrome.runtime.sendMessage({ type: MSG.LIST_ENGINES, payload: {} });
  const engines = res?.ok ? res.data.engines : [];
  const currentPreference = (await chrome.storage.local.get(ENGINE_ID_STORAGE_KEY))[ENGINE_ID_STORAGE_KEY];

  if (renderId !== enginePickerRenderSeq) return;

  enginePickerEl.innerHTML = '';

  // 1. Automatic Option (clean title + Recommended badge)
  enginePickerEl.appendChild(
    buildCompactEngineRow({
      id: AUTO_VALUE,
      displayName: chrome.i18n.getMessage('options_engine_auto_name'),
      hint: getEngineDescription(AUTO_VALUE),
      available: true,
      isSelected: !currentPreference,
    }),
  );

  // 2. Concrete Engines
  for (const eng of engines) {
    enginePickerEl.appendChild(
      buildCompactEngineRow({
        id: eng.id,
        displayName: engineLabel(eng.id),
        hint: getEngineDescription(eng.id),
        available: eng.available,
        isSelected: currentPreference === eng.id,
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
  showToast(chrome.i18n.getMessage('options_saved_confirmation'));
  await renderEnginePicker();
}

// ---------------------------------------------------------------------------
// 4. View 3: Providers (BYOK Credentials & Actions)
// ---------------------------------------------------------------------------
const BYOK_PROVIDERS = [
  {
    id: 'gemini',
    name: 'Google Gemini', // i18n-ok: brand name
    storageKey: GEMINI_API_KEY_KEY,
    labelKey: 'options_gemini_key_label',
    defaultModel: 'gemini-2.0-flash',
    avatarChar: 'G',
    avatarClass: 'gemini',
    portalUrl: 'https://aistudio.google.com/app/apikey',
    portalName: 'Google AI Studio', // i18n-ok: brand name
  },
  {
    id: 'openai',
    name: 'OpenAI',
    storageKey: OPENAI_API_KEY_KEY,
    labelKey: 'options_openai_key_label',
    defaultModel: 'gpt-5.4-mini',
    avatarChar: 'O',
    avatarClass: 'openai',
    portalUrl: 'https://platform.openai.com/api-keys',
    portalName: 'OpenAI Platform', // i18n-ok: brand name
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    storageKey: DEEPSEEK_API_KEY_KEY,
    labelKey: 'options_deepseek_key_label',
    defaultModel: 'deepseek-v4-flash',
    avatarChar: 'D',
    avatarClass: 'deepseek',
    portalUrl: 'https://platform.deepseek.com/api_keys',
    portalName: 'DeepSeek Platform', // i18n-ok: brand name
  },
];

function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••••••';
  const prefix = trimmed.slice(0, 3);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••••••••${suffix}`;
}

async function renderProviders() {
  if (!providersListEl) return;
  const storageKeys = BYOK_PROVIDERS.map((p) => p.storageKey);
  const stored = await chrome.storage.local.get(storageKeys);

  providersListEl.innerHTML = '';

  for (const provider of BYOK_PROVIDERS) {
    const rawKey = stored[provider.storageKey] || '';
    const hasKey = rawKey.trim().length > 0;

    const card = document.createElement('div');
    card.className = 'provider-card';
    card.id = `provider-card-${provider.id}`;

    // Header
    const topRow = document.createElement('div');
    topRow.className = 'provider-header-row';

    const identity = document.createElement('div');
    identity.className = 'provider-identity-group';

    const avatar = document.createElement('div');
    avatar.className = `provider-badge-avatar ${provider.avatarClass}`;
    avatar.textContent = provider.avatarChar;

    const nameStack = document.createElement('div');
    nameStack.className = 'provider-label-stack';

    const nameEl = document.createElement('span');
    nameEl.className = 'provider-title-name';
    nameEl.textContent = provider.name;

    const modelEl = document.createElement('span');
    modelEl.className = 'provider-model-spec';
    modelEl.textContent = provider.defaultModel;

    nameStack.append(nameEl, modelEl);
    identity.append(avatar, nameStack);

    // One authoritative status badge
    const statusBadge = document.createElement('span');
    statusBadge.className = `badge ${hasKey ? 'badge-ready' : 'badge-neutral'}`;
    statusBadge.textContent = chrome.i18n.getMessage(
      hasKey ? 'options_provider_status_configured' : 'options_provider_status_not_configured',
    );

    topRow.append(identity, statusBadge);

    // Key Summary Row
    const summaryBar = document.createElement('div');
    summaryBar.className = 'provider-summary-bar';

    const maskedView = document.createElement('div');
    maskedView.className = `masked-credential ${hasKey ? '' : 'is-empty'}`;
    maskedView.textContent = hasKey ? maskApiKey(rawKey) : chrome.i18n.getMessage('options_provider_masked_empty');

    const actionsGroup = document.createElement('div');
    actionsGroup.className = 'provider-action-group';

    // Test Connection Button
    if (hasKey) {
      const testBtn = document.createElement('button');
      testBtn.type = 'button';
      testBtn.className = 'btn btn-secondary btn-sm';
      testBtn.textContent = chrome.i18n.getMessage('options_provider_test_btn');
      testBtn.addEventListener('click', () => runTestConnection(provider, testBtn, summaryBar));
      actionsGroup.appendChild(testBtn);
    }

    // Configure / Replace Button
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = `btn ${hasKey ? 'btn-secondary' : 'btn-primary'} btn-sm`;
    editBtn.textContent = chrome.i18n.getMessage(hasKey ? 'options_provider_edit_btn' : 'options_engine_configure_action');
    actionsGroup.appendChild(editBtn);

    // Remove Button
    if (hasKey) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn btn-danger btn-sm';
      removeBtn.textContent = chrome.i18n.getMessage('options_provider_remove_btn');
      removeBtn.addEventListener('click', async () => {
        await chrome.storage.local.remove(provider.storageKey);

        const currentActive = (await chrome.storage.local.get(ENGINE_ID_STORAGE_KEY))[ENGINE_ID_STORAGE_KEY];
        if (currentActive === provider.id) {
          await chrome.storage.local.remove(ENGINE_ID_STORAGE_KEY);
        }

        showToast(chrome.i18n.getMessage('options_provider_key_removed'));
        await renderProviders();
        await renderEnginePicker();
      });
      actionsGroup.appendChild(removeBtn);
    }

    summaryBar.append(maskedView, actionsGroup);

    // Edit Drawer
    const editDrawer = document.createElement('div');
    editDrawer.className = 'provider-edit-drawer';
    editDrawer.id = `edit-drawer-${provider.id}`;
    editDrawer.hidden = true;

    const inputGroup = document.createElement('div');
    inputGroup.className = 'edit-input-group';

    const input = document.createElement('input');
    input.type = 'password';
    input.className = 'form-control';
    input.autocomplete = 'off';
    input.placeholder = chrome.i18n.getMessage('options_key_input_placeholder');
    input.value = rawKey;

    const toggleVisBtn = document.createElement('button');
    toggleVisBtn.type = 'button';
    toggleVisBtn.className = 'toggle-visibility-btn';
    toggleVisBtn.textContent = chrome.i18n.getMessage('options_provider_show_key');
    toggleVisBtn.addEventListener('click', () => {
      const isPwd = input.type === 'password';
      input.type = isPwd ? 'text' : 'password';
      toggleVisBtn.textContent = chrome.i18n.getMessage(isPwd ? 'options_provider_hide_key' : 'options_provider_show_key');
    });

    inputGroup.append(input, toggleVisBtn);

    const actionsRow = document.createElement('div');
    actionsRow.className = 'edit-actions-row';

    const portalLink = document.createElement('a');
    portalLink.className = 'portal-out-link';
    portalLink.href = provider.portalUrl;
    portalLink.target = '_blank';
    portalLink.rel = 'noopener noreferrer'; // i18n-ok: HTML rel attribute
    portalLink.textContent = provider.portalName;

    const buttonsWrap = document.createElement('div');
    buttonsWrap.className = 'edit-buttons-wrap';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary btn-sm';
    cancelBtn.textContent = chrome.i18n.getMessage('options_provider_cancel_btn');
    cancelBtn.addEventListener('click', () => {
      editDrawer.hidden = true;
      input.value = rawKey;
      input.type = 'password';
      toggleVisBtn.textContent = chrome.i18n.getMessage('options_provider_show_key');
    });

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary btn-sm';
    saveBtn.textContent = chrome.i18n.getMessage('options_provider_save_btn');
    saveBtn.addEventListener('click', async () => {
      const trimmed = input.value.trim();
      await chrome.storage.local.set({ [provider.storageKey]: trimmed });
      showToast(chrome.i18n.getMessage('options_provider_key_saved'));
      await renderProviders();
      await renderEnginePicker();
    });

    buttonsWrap.append(cancelBtn, saveBtn);
    actionsRow.append(portalLink, buttonsWrap);
    editDrawer.append(inputGroup, actionsRow);

    editBtn.addEventListener('click', () => {
      editDrawer.hidden = !editDrawer.hidden;
      if (!editDrawer.hidden) {
        input.focus();
      }
    });

    card.append(topRow, summaryBar, editDrawer);
    providersListEl.appendChild(card);
  }
}

async function runTestConnection(provider, testBtn, summaryBar) {
  const origText = testBtn.textContent;
  testBtn.disabled = true;
  testBtn.textContent = chrome.i18n.getMessage('options_provider_testing');

  summaryBar.querySelectorAll('.inline-notice').forEach((n) => n.remove());

  const notice = document.createElement('span');
  notice.className = 'inline-notice';

  try {
    const res = await chrome.runtime.sendMessage({
      type: MSG.TRANSLATE,
      payload: { text: 'Hello', targetLang: 'es', engineOverride: provider.id },
    });

    if (res?.ok) {
      notice.classList.add('is-success');
      notice.textContent = `✓ ${chrome.i18n.getMessage('options_provider_test_success')}`;
    } else {
      notice.classList.add('is-error');
      notice.textContent = `✕ ${res?.error?.message || chrome.i18n.getMessage('options_provider_test_failed')}`;
    }
  } catch (err) {
    notice.classList.add('is-error');
    notice.textContent = `✕ ${err?.message || chrome.i18n.getMessage('options_provider_test_failed')}`;
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = origText;
    summaryBar.appendChild(notice);
    setTimeout(() => notice.remove(), 4500);
  }
}

// ---------------------------------------------------------------------------
// 5. View 4: Speech (Autoplay + Target Voice + Collapsible Voice Matrix)
// ---------------------------------------------------------------------------
function getVoicesAsync() {
  if (!('speechSynthesis' in window)) return Promise.resolve([]);
  const existing = speechSynthesis.getVoices();
  if (existing.length) return Promise.resolve(existing);
  return new Promise((resolve) => {
    let done = false;
    const finish = (voices) => {
      if (done) return;
      done = true;
      resolve(voices);
    };
    speechSynthesis.onvoiceschanged = () => finish(speechSynthesis.getVoices());
    setTimeout(() => finish(speechSynthesis.getVoices()), 1000);
  });
}

function speakSample(voice, lang) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const sample = chrome.i18n.getMessage('options_tts_test_sample');
  const utterance = new SpeechSynthesisUtterance(sample);
  if (voice) utterance.voice = voice;
  if (lang) utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

function createVoicePickerRow(langCode, langLabel, voices, storedVoiceURI, onChange) {
  const row = document.createElement('div');
  row.className = 'voice-row-picker';

  const select = document.createElement('select');
  select.className = 'form-control';
  select.id = `tts-select-${langCode}`;
  select.setAttribute('aria-label', `${langLabel} voice`); // i18n-ok: aria label

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = chrome.i18n.getMessage('options_tts_voice_default');
  select.appendChild(defaultOpt);

  for (const v of voices) {
    const opt = document.createElement('option');
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} (${v.lang})`;
    select.appendChild(opt);
  }

  select.value = storedVoiceURI && voices.some((v) => v.voiceURI === storedVoiceURI) ? storedVoiceURI : '';

  select.addEventListener('change', () => {
    const chosen = voices.find((v) => v.voiceURI === select.value) || null;
    onChange(chosen);
  });

  const listenBtn = document.createElement('button');
  listenBtn.type = 'button';
  listenBtn.className = 'btn btn-secondary btn-sm';
  listenBtn.textContent = chrome.i18n.getMessage('options_tts_test_voice_btn');
  listenBtn.title = chrome.i18n.getMessage('options_tts_test_voice_btn');
  listenBtn.addEventListener('click', () => {
    const chosen = voices.find((v) => v.voiceURI === select.value);
    speakSample(chosen, langCode);
  });

  row.append(select, listenBtn);
  return row;
}

async function renderTtsVoicePickers() {
  if (!primaryVoiceContainerEl && !ttsVoicesMatrixEl) return;

  if (!('speechSynthesis' in window)) {
    const note = document.createElement('p');
    note.className = 'card-desc';
    note.textContent = chrome.i18n.getMessage('options_tts_unsupported');
    if (primaryVoiceContainerEl) primaryVoiceContainerEl.replaceChildren(note);
    return;
  }

  const voices = await getVoicesAsync();
  const storedTargetLang = (await chrome.storage.local.get(TARGET_LANG_STORAGE_KEY))[TARGET_LANG_STORAGE_KEY] || DEFAULT_TARGET_LANGUAGE;
  const storedVoices = (await chrome.storage.local.get(TTS_VOICES_STORAGE_KEY))[TTS_VOICES_STORAGE_KEY] || {};

  // 1. Primary Voice Picker (Target Language)
  if (primaryVoiceContainerEl) {
    primaryVoiceContainerEl.innerHTML = '';

    const targetLangObj = TARGET_LANGUAGES.find((l) => l.code === storedTargetLang) || {
      code: storedTargetLang,
      label: storedTargetLang,
    };
    const prefix = targetLangObj.code.split('-')[0].toLowerCase();
    const targetMatches = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));

    const header = document.createElement('div');
    header.className = 'form-label';
    header.textContent = `${targetLangObj.label} (${targetLangObj.code})`;

    if (targetMatches.length) {
      const picker = createVoicePickerRow(
        targetLangObj.code,
        targetLangObj.label,
        targetMatches,
        storedVoices[targetLangObj.code]?.voiceURI,
        async (chosen) => {
          const latest = (await chrome.storage.local.get(TTS_VOICES_STORAGE_KEY))[TTS_VOICES_STORAGE_KEY] || {};
          const next = { ...latest };
          if (!chosen) {
            delete next[targetLangObj.code];
          } else {
            next[targetLangObj.code] = { voiceURI: chosen.voiceURI, name: chosen.name, lang: chosen.lang };
          }
          await chrome.storage.local.set({ [TTS_VOICES_STORAGE_KEY]: next });
          showToast(chrome.i18n.getMessage('options_saved_confirmation'));
        },
      );
      primaryVoiceContainerEl.append(header, picker);
    } else {
      const emptyNote = document.createElement('p');
      emptyNote.className = 'form-helper';
      emptyNote.textContent = chrome.i18n.getMessage('options_tts_no_voices');
      primaryVoiceContainerEl.append(header, emptyNote);
    }
  }

  // 2. Full Voice Matrix (inside collapsible <details>)
  if (ttsVoicesMatrixEl) {
    ttsVoicesMatrixEl.innerHTML = '';

    for (const { code, label } of TARGET_LANGUAGES) {
      const prefix = code.split('-')[0].toLowerCase();
      const matches = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
      if (!matches.length) continue;

      const item = document.createElement('div');
      item.className = 'matrix-voice-item';

      const langLabel = document.createElement('div');
      langLabel.className = 'matrix-lang-label';
      langLabel.textContent = label;

      const controlWrap = document.createElement('div');
      controlWrap.className = 'matrix-voice-control';

      const picker = createVoicePickerRow(
        code,
        label,
        matches,
        storedVoices[code]?.voiceURI,
        async (chosen) => {
          const latest = (await chrome.storage.local.get(TTS_VOICES_STORAGE_KEY))[TTS_VOICES_STORAGE_KEY] || {};
          const next = { ...latest };
          if (!chosen) {
            delete next[code];
          } else {
            next[code] = { voiceURI: chosen.voiceURI, name: chosen.name, lang: chosen.lang };
          }
          await chrome.storage.local.set({ [TTS_VOICES_STORAGE_KEY]: next });
          showToast(chrome.i18n.getMessage('options_saved_confirmation'));
        },
      );

      controlWrap.appendChild(picker);
      item.append(langLabel, controlWrap);
      ttsVoicesMatrixEl.appendChild(item);
    }

    if (!ttsVoicesMatrixEl.children.length) {
      const matrixEmptyNote = document.createElement('p');
      matrixEmptyNote.className = 'form-helper';
      matrixEmptyNote.textContent = chrome.i18n.getMessage('options_tts_no_voices');
      ttsVoicesMatrixEl.appendChild(matrixEmptyNote);
    }
  }
}

async function loadTtsSettings() {
  if (ttsAutoplayEl) {
    const stored = await chrome.storage.local.get(TTS_AUTOPLAY_STORAGE_KEY);
    ttsAutoplayEl.checked = !!stored[TTS_AUTOPLAY_STORAGE_KEY];

    ttsAutoplayEl.addEventListener('change', async () => {
      await chrome.storage.local.set({ [TTS_AUTOPLAY_STORAGE_KEY]: ttsAutoplayEl.checked });
      showToast(chrome.i18n.getMessage('options_saved_confirmation'));
    });
  }
}

// ---------------------------------------------------------------------------
// 6. Init
// ---------------------------------------------------------------------------
async function init() {
  initShellNavigation();
  populateTargetLanguages();
  await loadTargetLanguage();
  await loadTtsSettings();
  await renderProviders();
  await renderEnginePicker();
  await renderTtsVoicePickers();
}

init();
