import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { execSync } from 'child_process';

function getGitHash() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {
    return Date.now().toString();
  }
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: 'index.html' }),
    paths: {
      base: '/livebenchviz'
    },
    version: {
      name: getGitHash()
    }
  }
};

export default config;
