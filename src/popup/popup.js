import { applyI18n } from '../shared/i18n.js';
import { MSG } from '../shared/messages.js';
import { engineLabel } from '../shared/engine-labels.js';

console.log('[ai-translate:popup] popup opened');
applyI18n(document);

const engineStatusRow = document.getElementById('engineStatusRow');
const engineStatusValue = document.getElementById('engineStatusValue');
const noEngineNote = document.getElementById('noEngineNote');
const openSettingsBtn = document.getElementById('openSettingsBtn');

async function renderEngineStatus() {
  const res = await chrome.runtime.sendMessage({ type: MSG.GET_CAPABILITIES, payload: {} });
  const engine = res?.ok ? res.data.engine : null;
  if (engine) {
    engineStatusValue.textContent = engineLabel(engine);
    engineStatusRow.hidden = false;
    noEngineNote.hidden = true;
  } else {
    engineStatusRow.hidden = true;
    noEngineNote.hidden = false;
  }
}

openSettingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  // The options page opens in its own tab (manifest options_ui.open_in_tab)
  // and takes focus, which normally auto-dismisses the popup anyway — this
  // just makes that immediate instead of relying on the focus-loss timing.
  window.close();
});

renderEngineStatus();
