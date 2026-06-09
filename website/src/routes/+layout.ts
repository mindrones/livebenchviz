/**
 * +layout.ts — loads benchmark data and inference map before the page renders.
 *
 * benchmark_lb.json  — scores + metadata for all LB models
 *
 * The "OpenRouter only" toggle and Ollama checkboxes are applied reactively
 * in the page using data from the models.
 */
import type { LayoutLoad } from './$types';
import { browser }         from '$app/environment';
import { loadDataset }     from '$lib/data';

export const ssr       = false;
export const prerender = false;

export const load: LayoutLoad = async ({ fetch }) => {
  // During SSR (build) there's no localStorage — return empty and let the
  // client hydration trigger the real fetch.
  if (!browser) return { benchmarkData: null, error: null };
  return loadDataset(fetch);
};
