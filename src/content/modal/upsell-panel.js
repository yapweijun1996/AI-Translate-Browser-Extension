// Trial-quota upsell buttons (T-022): shown instead of a plain error when
// the trial gateway's daily allowance runs out. Stateless — modal.js holds
// the returned elements bag and passes it back into renderUpsellButtons()
// each time, since (unlike explain-panel.js) nothing outside modal.js ever
// calls into this module directly, so there's no need for it to remember
// its own elements between calls.

/** Create the upsell action row once; modal.js appends `upsellActions` into the DOM tree. */
export function createUpsellElements() {
  const upsellActions = document.createElement('div');
  upsellActions.className = 'modal-upsell-actions';
  upsellActions.hidden = true;

  const upsellSettingsBtn = document.createElement('button');
  upsellSettingsBtn.type = 'button';
  upsellSettingsBtn.className = 'modal-upsell-btn modal-upsell-btn-primary';

  const upsellOnDeviceBtn = document.createElement('button');
  upsellOnDeviceBtn.type = 'button';
  upsellOnDeviceBtn.className = 'modal-upsell-btn';
  upsellOnDeviceBtn.hidden = true; // shown only when on-device is available

  const upsellDismissBtn = document.createElement('button');
  upsellDismissBtn.type = 'button';
  upsellDismissBtn.className = 'modal-upsell-btn';

  upsellActions.append(upsellSettingsBtn, upsellOnDeviceBtn, upsellDismissBtn);

  return { upsellActions, upsellSettingsBtn, upsellOnDeviceBtn, upsellDismissBtn };
}

export function hideUpsell(elements) {
  elements.upsellActions.hidden = true;
}

/**
 * Wire and show the upsell action buttons. Callbacks (not chrome APIs) are
 * supplied by main.js via modal.js so this module stays chrome-free (SPEC/
 * CODING-STANDARDS: content-script UI never touches chrome.* directly
 * except through main.js's message layer).
 * @param {ReturnType<typeof createUpsellElements>} elements
 * @param {object} opts
 * @param {string} opts.settingsLabel
 * @param {string} opts.dismissLabel
 * @param {() => void} opts.onSettings
 * @param {() => void} opts.onDismiss
 * @param {string} [opts.onDeviceLabel] only needed when onUseOnDevice is provided
 * @param {() => void} [opts.onUseOnDevice] omit entirely to hide the on-device button
 */
export function renderUpsellButtons(elements, { settingsLabel, dismissLabel, onSettings, onDismiss, onDeviceLabel, onUseOnDevice }) {
  const { upsellActions, upsellSettingsBtn, upsellOnDeviceBtn, upsellDismissBtn } = elements;

  upsellSettingsBtn.textContent = settingsLabel;
  upsellSettingsBtn.onclick = () => onSettings?.();

  upsellDismissBtn.textContent = dismissLabel;
  upsellDismissBtn.onclick = () => onDismiss?.();

  if (onUseOnDevice) {
    upsellOnDeviceBtn.textContent = onDeviceLabel;
    upsellOnDeviceBtn.hidden = false;
    upsellOnDeviceBtn.onclick = () => onUseOnDevice();
  } else {
    upsellOnDeviceBtn.hidden = true;
    upsellOnDeviceBtn.onclick = null;
  }

  upsellActions.hidden = false;
}
