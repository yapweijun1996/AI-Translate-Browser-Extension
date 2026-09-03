import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT = 8133;
const CDP_PORT = 9889;
const QA_DIR = path.resolve('docs/qa');
fs.mkdirSync(QA_DIR, { recursive: true });

const enMessages = JSON.parse(fs.readFileSync('public/_locales/en/messages.json', 'utf8'));

function startServer() {
  const server = http.createServer((req, res) => {
    let filePath = path.join(process.cwd(), 'dist', req.url.split('?')[0]);
    if (filePath.endsWith(path.sep) || !path.extname(filePath)) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    if (ext === '.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      let html = fs.readFileSync(filePath, 'utf8');

      const mockScript = `
        <script>
          (function() {
            const messages = ${JSON.stringify(enMessages)};
            const mockStorage = {
              targetLang: 'en',
              engineId: 'trial-gateway',
              ttsAutoPlay: true,
              'deepseek.apiKey': 'sk-deepseek-test-key-9988776655'
            };

            window.chrome = {
              i18n: {
                getMessage: function(key) {
                  return messages[key] ? messages[key].message : key;
                }
              },
              storage: {
                local: {
                  get: async function(keys) {
                    if (typeof keys === 'string') return { [keys]: mockStorage[keys] };
                    if (Array.isArray(keys)) {
                      const res = {};
                      for (const k of keys) res[k] = mockStorage[k];
                      return res;
                    }
                    return { ...mockStorage };
                  },
                  set: async function(items) {
                    Object.assign(mockStorage, items);
                  },
                  remove: async function(key) {
                    delete mockStorage[key];
                  }
                }
              },
              runtime: {
                sendMessage: async function(msg) {
                  if (msg.type === 'LIST_ENGINES') {
                    return {
                      ok: true,
                      data: {
                        engines: [
                          { id: 'trial-gateway', available: true, capabilities: { translate: true, explain: true } },
                          { id: 'on-device', available: true, capabilities: { translate: true, explain: false } },
                          { id: 'gemini', available: Boolean(mockStorage['gemini.apiKey']), capabilities: { translate: true, explain: true } },
                          { id: 'openai', available: Boolean(mockStorage['openai.apiKey']), capabilities: { translate: true, explain: true } },
                          { id: 'deepseek', available: Boolean(mockStorage['deepseek.apiKey']), capabilities: { translate: true, explain: true } }
                        ]
                      }
                    };
                  }
                  if (msg.type === 'TRANSLATE') {
                    return { ok: true, data: { translated: 'Hola (Connection Verified)' } };
                  }
                  return { ok: false };
                }
              }
            };
          })();
        </script>
      `;
      html = html.replace('<head>', '<head>' + mockScript);
      res.end(html);
      return;
    }

    if (ext === '.js') res.setHeader('Content-Type', 'application/javascript');
    else if (ext === '.png') res.setHeader('Content-Type', 'image/png');
    else if (ext === '.svg') res.setHeader('Content-Type', 'image/svg+xml');

    res.end(fs.readFileSync(filePath));
  });

  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.msgId = 0;
    this.pending = new Map();

    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const res = JSON.parse(event.data);
      if (res.id && this.pending.has(res.id)) {
        const { resolve, reject } = this.pending.get(res.id);
        this.pending.delete(res.id);
        if (res.error) reject(new Error(JSON.stringify(res.error)));
        else resolve(res.result);
      }
    };
  }

  async call(method, params = {}) {
    await this.ready;
    const id = ++this.msgId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.call('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval failed: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  async captureScreenshot(filename, width, height, isMobile = false) {
    await this.call('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile,
    });
    await new Promise((r) => setTimeout(r, 400));
    const res = await this.call('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(QA_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`[QA Screenshot] Saved: ${filename} (${width}x${height})`);
  }

  close() {
    this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runVerification() {
  console.log('[QA] Booting static test server...');
  const server = await startServer();

  const tempProfile = path.join(QA_DIR, '.chrome-qa-profile-v2');
  fs.mkdirSync(tempProfile, { recursive: true });

  const chromeProc = spawn(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${tempProfile}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
    { stdio: 'ignore' },
  );

  await sleep(1200);

  let cdp;
  try {
    const targetUrl = `http://127.0.0.1:${PORT}/src/options/index.html`;
    const newTabRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${targetUrl}`, { method: 'PUT' });
    const tabInfo = await newTabRes.json();

    cdp = new CDP(tabInfo.webSocketDebuggerUrl);
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await sleep(800);

    // -----------------------------------------------------------------------
    // TEST SUITE 1: TRUE SINGLE-VIEW SPA ARCHITECTURE
    // -----------------------------------------------------------------------
    console.log('\n========================================');
    console.log('TEST SUITE 1: Single View & Page Ownership');
    console.log('========================================');

    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(300);

    // A. Check Default View is General
    const activeRouteInitial = await cdp.eval(`
      (() => {
        const views = Array.from(document.querySelectorAll('.settings-view'));
        const visible = views.filter(v => !v.hidden);
        return {
          totalViews: views.length,
          visibleCount: visible.length,
          visibleId: visible[0]?.id || null,
          ariaCurrent: document.querySelector('.nav-item[aria-current="page"]')?.dataset.route || null
        };
      })()
    `);
    console.log('[Check 1A] Default Route state:', activeRouteInitial);
    if (activeRouteInitial.visibleCount !== 1 || activeRouteInitial.visibleId !== 'view-general') {
      throw new Error(`Only General view should be visible by default! Got: ${JSON.stringify(activeRouteInitial)}`);
    }
    if (activeRouteInitial.ariaCurrent !== 'general') {
      throw new Error(`Sidebar nav item 'general' must have aria-current="page"!`);
    }
    await cdp.captureScreenshot('options-v2-view-general-1440x900.png', 1440, 900, false);

    // B. Page Ownership: General MUST NOT contain Engine Picker or Providers
    const generalLeakCheck = await cdp.eval(`
      (() => {
        const gView = document.getElementById('view-general');
        return {
          hasEnginePicker: Boolean(gView.querySelector('#enginePicker')),
          hasProviders: Boolean(gView.querySelector('#providersList')),
          hasAutoplay: Boolean(gView.querySelector('#ttsAutoplay'))
        };
      })()
    `);
    console.log('[Check 1B] General View isolation:', generalLeakCheck);
    if (generalLeakCheck.hasEnginePicker || generalLeakCheck.hasProviders || generalLeakCheck.hasAutoplay) {
      throw new Error('General view leaked controls from other sections!');
    }

    // C. Navigate to Translation View
    await cdp.eval(`window.location.hash = '#translation';`);
    await sleep(250);
    const translationState = await cdp.eval(`
      (() => {
        const visible = Array.from(document.querySelectorAll('.settings-view')).filter(v => !v.hidden);
        return {
          visibleCount: visible.length,
          visibleId: visible[0]?.id,
          ariaCurrent: document.querySelector('.nav-item[aria-current="page"]')?.dataset.route,
          hasEngineRows: Boolean(document.querySelector('#view-translation #enginePicker .engine-row-card')),
          hasKeyInputs: Boolean(document.querySelector('#view-translation input[type="password"]'))
        };
      })()
    `);
    console.log('[Check 1C] Translation View state:', translationState);
    if (translationState.visibleCount !== 1 || translationState.visibleId !== 'view-translation') {
      throw new Error('Translation view is not exclusively visible!');
    }
    if (translationState.hasKeyInputs) {
      throw new Error('Translation view must NOT contain API key input fields!');
    }
    await cdp.captureScreenshot('options-v2-view-translation-1440x900.png', 1440, 900, false);

    // D. Navigate to Providers View
    await cdp.eval(`window.location.hash = '#providers';`);
    await sleep(250);
    const providersState = await cdp.eval(`
      (() => {
        const visible = Array.from(document.querySelectorAll('.settings-view')).filter(v => !v.hidden);
        const cardCount = document.querySelectorAll('#view-providers .provider-card').length;
        return {
          visibleCount: visible.length,
          visibleId: visible[0]?.id,
          ariaCurrent: document.querySelector('.nav-item[aria-current="page"]')?.dataset.route,
          providerCards: cardCount
        };
      })()
    `);
    console.log('[Check 1D] Providers View state:', providersState);
    if (providersState.visibleCount !== 1 || providersState.visibleId !== 'view-providers') {
      throw new Error('Providers view is not exclusively visible!');
    }
    if (providersState.providerCards !== 3) {
      throw new Error(`Expected 3 BYOK provider cards, found: ${providersState.providerCards}`);
    }
    await cdp.captureScreenshot('options-v2-view-providers-1440x900.png', 1440, 900, false);

    // E. Navigate to Speech View
    await cdp.eval(`window.location.hash = '#speech';`);
    await sleep(250);
    const speechState = await cdp.eval(`
      (() => {
        const visible = Array.from(document.querySelectorAll('.settings-view')).filter(v => !v.hidden);
        return {
          visibleCount: visible.length,
          visibleId: visible[0]?.id,
          ariaCurrent: document.querySelector('.nav-item[aria-current="page"]')?.dataset.route,
          hasAutoplay: Boolean(document.querySelector('#view-speech #ttsAutoplay')),
          hasPrimaryVoice: Boolean(document.querySelector('#view-speech #primaryVoiceContainer')),
          hasAdvancedVoicesPanel: Boolean(document.querySelector('#view-speech .advanced-voices-details'))
        };
      })()
    `);
    console.log('[Check 1E] Speech View state:', speechState);
    if (speechState.visibleCount !== 1 || speechState.visibleId !== 'view-speech') {
      throw new Error('Speech view is not exclusively visible!');
    }
    if (!speechState.hasAdvancedVoicesPanel) {
      throw new Error('Speech view should tuck full voice matrix inside advanced panel!');
    }
    await cdp.captureScreenshot('options-v2-view-speech-1440x900.png', 1440, 900, false);

    // F. Navigate to Privacy View
    await cdp.eval(`window.location.hash = '#privacy';`);
    await sleep(250);
    const privacyState = await cdp.eval(`
      (() => {
        const visible = Array.from(document.querySelectorAll('.settings-view')).filter(v => !v.hidden);
        return {
          visibleCount: visible.length,
          visibleId: visible[0]?.id,
          ariaCurrent: document.querySelector('.nav-item[aria-current="page"]')?.dataset.route,
          pillarCount: document.querySelectorAll('#view-privacy .trust-pillar').length
        };
      })()
    `);
    console.log('[Check 1F] Privacy View state:', privacyState);
    if (privacyState.visibleCount !== 1 || privacyState.visibleId !== 'view-privacy') {
      throw new Error('Privacy view is not exclusively visible!');
    }
    await cdp.captureScreenshot('options-v2-view-privacy-1440x900.png', 1440, 900, false);

    // -----------------------------------------------------------------------
    // TEST SUITE 2: ROUTING, RELOAD, BACK/FORWARD & INVALID ROUTE
    // -----------------------------------------------------------------------
    console.log('\n========================================');
    console.log('TEST SUITE 2: Routing, History & Fallback');
    console.log('========================================');

    // A. Direct Route on Page Load
    const directUrl = `http://127.0.0.1:${PORT}/src/options/index.html#providers`;
    const tabDirectRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(directUrl)}`, { method: 'PUT' });
    const tabDirectInfo = await tabDirectRes.json();
    const cdpDirect = new CDP(tabDirectInfo.webSocketDebuggerUrl);
    await cdpDirect.call('Page.enable');
    await cdpDirect.call('Runtime.enable');
    await sleep(600);

    const directVisibleId = await cdpDirect.eval(`document.querySelector('.settings-view:not([hidden])')?.id`);
    console.log('[Check 2A] Direct Route #providers loaded view:', directVisibleId);
    if (directVisibleId !== 'view-providers') throw new Error('Direct route to #providers failed!');

    // B. Reload while on #providers preserves route
    await cdpDirect.call('Page.reload');
    await sleep(600);
    const reloadedVisibleId = await cdpDirect.eval(`document.querySelector('.settings-view:not([hidden])')?.id`);
    console.log('[Check 2B] Reload on #providers preserved view:', reloadedVisibleId);
    if (reloadedVisibleId !== 'view-providers') throw new Error('Reload did not preserve #providers route!');

    // C. Invalid Route Fallback to General
    await cdpDirect.eval(`window.location.hash = '#completely-bogus-route';`);
    await sleep(250);
    const fallbackVisibleId = await cdpDirect.eval(`document.querySelector('.settings-view:not([hidden])')?.id`);
    console.log('[Check 2C] Invalid route fallback view:', fallbackVisibleId);
    if (fallbackVisibleId !== 'view-general') throw new Error('Invalid route did not fallback to #general!');

    // D. Back / Forward History Navigation
    await cdpDirect.eval(`window.location.hash = '#translation';`);
    await sleep(200);
    await cdpDirect.eval(`window.location.hash = '#speech';`);
    await sleep(200);
    console.log('[Check 2D] Navigated to #speech. Triggering history.back()...');
    await cdpDirect.eval(`window.history.back();`);
    await sleep(250);
    const backVisibleId = await cdpDirect.eval(`document.querySelector('.settings-view:not([hidden])')?.id`);
    console.log('[Check 2D] View after history.back():', backVisibleId);
    if (backVisibleId !== 'view-translation') throw new Error('Browser Back button navigation failed!');

    await cdpDirect.eval(`window.history.forward();`);
    await sleep(250);
    const forwardVisibleId = await cdpDirect.eval(`document.querySelector('.settings-view:not([hidden])')?.id`);
    console.log('[Check 2D] View after history.forward():', forwardVisibleId);
    if (forwardVisibleId !== 'view-speech') throw new Error('Browser Forward button navigation failed!');

    cdpDirect.close();

    // -----------------------------------------------------------------------
    // TEST SUITE 3: TRANSLATION REFINEMENT & SETUP REQUIRED JUMP
    // -----------------------------------------------------------------------
    console.log('\n========================================');
    console.log('TEST SUITE 3: Translation Engine Refinement');
    console.log('========================================');

    await cdp.eval(`window.location.hash = '#translation';`);
    await sleep(200);

    // Check Automatic doesn't duplicate "Recommended"
    const autoTitle = await cdp.eval(`document.querySelector('#engine-radio-__auto__')?.closest('.engine-row-card')?.querySelector('.engine-title-text')?.textContent`);
    const autoBadge = await cdp.eval(`document.querySelector('#engine-radio-__auto__')?.closest('.engine-row-card')?.querySelector('.badge')?.textContent`);
    console.log('[Check 3A] Automatic Title:', `"${autoTitle}"`, 'Badge:', `"${autoBadge}"`);
    if (autoTitle.toLowerCase().includes('recommended')) {
      throw new Error('Duplicate "recommended" in title string!');
    }

    // Check Unconfigured Gemini has "Setup required →"
    const geminiAction = await cdp.eval(`
      (() => {
        const card = document.querySelector('#engine-radio-gemini')?.closest('.engine-row-card');
        return card ? card.querySelector('.action-chip-link')?.textContent : null;
      })()
    `);
    console.log('[Check 3B] Unconfigured Gemini action text:', `"${geminiAction}"`);
    if (!geminiAction || !geminiAction.includes('→')) {
      throw new Error('Unconfigured provider must show "Setup required →" action link!');
    }

    // Click "Setup required →" and verify jump to #providers
    await cdp.eval(`
      document.querySelector('#engine-radio-gemini')?.closest('.engine-row-card')?.querySelector('.action-chip-link')?.click();
    `);
    await sleep(250);
    const viewAfterSetupClick = await cdp.eval(`document.querySelector('.settings-view:not([hidden])')?.id`);
    console.log('[Check 3C] View after clicking "Setup required →":', viewAfterSetupClick);
    if (viewAfterSetupClick !== 'view-providers') {
      throw new Error('Setup required action did not navigate to #providers view!');
    }

    // -----------------------------------------------------------------------
    // TEST SUITE 4: RESPONSIVE BEHAVIOR & NO HORIZONTAL OVERFLOW
    // -----------------------------------------------------------------------
    console.log('\n========================================');
    console.log('TEST SUITE 4: Responsive Viewport QA');
    console.log('========================================');

    // Desktop 1440x900
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(300);
    const desktopOverflow = await cdp.eval('document.documentElement.scrollWidth > document.documentElement.clientWidth');
    const desktopSidebarWidth = await cdp.eval('document.querySelector(".app-sidebar").getBoundingClientRect().width');
    console.log(`[Check 4A] Desktop 1440x900 - Overflow: ${desktopOverflow}, Sidebar Width: ${desktopSidebarWidth}px`);
    if (desktopOverflow) throw new Error('Desktop has horizontal overflow!');

    // Tablet 834x1112 (Drawer functionality)
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 834, height: 1112, deviceScaleFactor: 1, mobile: false });
    await sleep(300);
    const tabletOverflow = await cdp.eval('document.documentElement.scrollWidth > document.documentElement.clientWidth');
    console.log(`[Check 4B] Tablet 834x1112 - Overflow: ${tabletOverflow}`);
    if (tabletOverflow) throw new Error('Tablet has horizontal overflow!');

    // Open mobile drawer
    await cdp.eval(`document.getElementById('menuToggleBtn').click();`);
    await sleep(300);
    const drawerOpenState = await cdp.eval(`document.getElementById('appSidebar').classList.contains('is-open')`);
    console.log('[Check 4C] Tablet Hamburger Drawer opened:', drawerOpenState);
    if (!drawerOpenState) throw new Error('Drawer did not open when hamburger button was clicked!');
    await cdp.captureScreenshot('options-v2-tablet-drawer-834.png', 834, 1112, false);

    // Close drawer via backdrop click
    await cdp.eval(`document.getElementById('drawerBackdrop').click();`);
    await sleep(300);
    const drawerClosedState = await cdp.eval(`!document.getElementById('appSidebar').classList.contains('is-open')`);
    console.log('[Check 4D] Drawer closed via backdrop:', drawerClosedState);
    if (!drawerClosedState) throw new Error('Drawer failed to close on backdrop click!');

    // Mobile 390x844
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(300);
    const mobileOverflow = await cdp.eval('document.documentElement.scrollWidth > document.documentElement.clientWidth');
    console.log(`[Check 4E] Mobile 390x844 - Overflow: ${mobileOverflow}`);
    if (mobileOverflow) throw new Error('Mobile 390x844 has horizontal overflow!');
    await cdp.captureScreenshot('options-v2-mobile-390.png', 390, 844, true);

    // -----------------------------------------------------------------------
    // TEST SUITE 5: API KEY TRUST & ZERO EXPOSURE
    // -----------------------------------------------------------------------
    console.log('\n========================================');
    console.log('TEST SUITE 5: Security & Key Protection');
    console.log('========================================');

    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.eval(`window.location.hash = '#providers';`);
    await sleep(250);

    const deepseekCardText = await cdp.eval(`document.getElementById('provider-card-deepseek').innerText`);
    const keyLeaked = deepseekCardText.includes('sk-deepseek-test-key-9988776655');
    const isMasked = deepseekCardText.includes('sk-••••••••••••6655');
    console.log(`[Check 5A] Raw Key Leaked in UI Text: ${keyLeaked} (Must be false)`);
    console.log(`[Check 5B] Masked Key Shown Properly: ${isMasked} (Must be true)`);

    if (keyLeaked) throw new Error('SECURITY BREACH: Raw API key is rendered in DOM text!');
    if (!isMasked) throw new Error('Masked credential pattern missing in UI!');

    // Test connection action
    console.log('[Check 5C] Testing Provider Connection...');
    await cdp.eval(`
      const testBtn = document.querySelector('#provider-card-deepseek .btn-secondary');
      if (testBtn) testBtn.click();
    `);
    await sleep(400);
    const testResultBadge = await cdp.eval(`
      document.querySelector('#provider-card-deepseek .inline-notice')?.innerText || ''
    `);
    console.log('[Check 5C] Test connection notice:', testResultBadge);
    if (!testResultBadge.includes('Connected successfully')) {
      throw new Error(`Test connection did not return success: ${testResultBadge}`);
    }

    console.log('\n=============================================================');
    console.log('ALL 5 ACCEPTANCE TEST SUITES PASSED WITH 100% SUCCESS!');
    console.log('=============================================================');

  } finally {
    cdp?.close();
    chromeProc.kill();
    server.close();
    await sleep(300);
    fs.rmSync(tempProfile, { recursive: true, force: true });
  }
}

runVerification().catch((e) => {
  console.error('\n[FATAL TEST FAILURE]', e);
  process.exit(1);
});
