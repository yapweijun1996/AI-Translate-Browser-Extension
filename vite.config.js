import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    rollupOptions: {
      // The offscreen document (src/background/engines/on-device.js) is
      // created dynamically at runtime via chrome.offscreen.createDocument()
      // — there's no manifest.json key that references it (unlike
      // popup/options), so CRXJS won't discover it on its own. It must be
      // added as an explicit build input to be bundled into dist/.
      input: {
        offscreen: 'src/offscreen/offscreen.html',
      },
    },
  },
});
