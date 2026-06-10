import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import crypto from 'crypto';

function getDataHash() {
  try {
    const data1 = readFileSync(resolve(__dirname, 'static/benchmark_lb.json'));
    const hash = crypto.createHash('md5');
    hash.update(data1);
    return hash.digest('hex').slice(0, 8);
  } catch (e) {
    return 'initial';
  }
}

// Write the data version file dynamically
const dataHash = getDataHash();
try {
  writeFileSync(
    resolve(__dirname, 'src/lib/data-version.js'),
    `export const DATA_VERSION = '${dataHash}';\n`
  );
} catch (e) {
  console.error('Failed to write data-version.js:', e);
}

export default defineConfig({
  server: {
    port: 5200,
    strictPort: true
  },
  plugins: [
    tailwindcss(),
    sveltekit(),
  ]
});
