import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';

const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
const appVersion = rootPkg.version;

// Replaces __SW_VERSION__ in the built sw.js with the actual package.json version.
// sw.js is a static file so it bypasses Vite's transform pipeline — we patch it post-build.
function swVersionPlugin() {
  return {
    name: 'sw-version',
    closeBundle() {
      const swPath = resolve(__dirname, 'build/sw.js');
      try {
        const code = readFileSync(swPath, 'utf-8');
        writeFileSync(swPath, code.replace(/__SW_VERSION__/g, appVersion));
      } catch {
        // Not a production build (e.g. dev mode) — skip
      }
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    swVersionPlugin(),
  ]
});
