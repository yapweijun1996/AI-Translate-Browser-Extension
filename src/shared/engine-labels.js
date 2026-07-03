// Friendly display name per known engine id — shared by the popup (status
// line) and the options page (engine picker) so the two surfaces never
// drift out of sync. Unrecognized ids (a future engine neither surface has
// been updated for yet) fall back to the raw id rather than a blank label.

const ENGINE_LABEL_KEYS = {
  'trial-gateway': 'engine_label_trial_gateway',
  'on-device': 'engine_label_on_device',
  gemini: 'engine_label_gemini',
  openai: 'engine_label_openai',
};

export function engineLabel(id) {
  const key = ENGINE_LABEL_KEYS[id];
  return key ? chrome.i18n.getMessage(key) : id;
}
