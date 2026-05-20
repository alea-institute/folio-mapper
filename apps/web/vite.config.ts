import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Source of truth for the runtime app version is apps/desktop/package.json
// (per project MEMORY.md "Version bumps"). Read at build time and bake in via
// `define: __APP_VERSION__` so the demo-mode banner can compare the payload's
// pipeline_version against the running app's version.
const desktopPkgUrl = new URL('../desktop/package.json', import.meta.url);
const appVersion = JSON.parse(
  readFileSync(fileURLToPath(desktopPkgUrl), 'utf8'),
).version;

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    port: 58173,
    proxy: {
      '/api': {
        target: 'http://localhost:58000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['@folio-mapper/core', '@folio-mapper/ui'],
  },
});
