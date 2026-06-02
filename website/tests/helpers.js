/**
 * tests/helpers.js
 *
 * Shared mock data, setup functions, and locator helpers for dashboard tests.
 *
 * Mock dataset: 14 models across 7 families.
 *
 *   openai      (closed, openRouter only):       gpt-4o, o3                    ×2
 *   anthropic   (closed, ollamaCloud):            claude-3.5, claude-sonnet-4   ×2
 *   google      (mixed):                         gemini-2.5 (closed/oc), gemma-3 (open/ol), gemma-2 (open/ol) ×3
 *   meta-llama  (open, ollamaLocal+openRouter):   llama-4-s, llama-3.1-70b, llama-3-8b  ×3
 *   deepseek    (open, ollamaLocal+openRouter):   deepseek-r1, deepseek-chat    ×2
 *   nvidia      (open, ollamaLocal+openRouter):   nemotron-70b                  ×1
 *   zhipuai     (closed, other source only):      glm-4                         ×1
 *
 * Inference source matrix:
 *   gpt-4o          — openRouter only
 *   o3              — openRouter only
 *   claude-3.5      — ollamaCloud only
 *   claude-sonnet-4 — ollamaCloud + openRouter
 *   gemini-2.5      — ollamaCloud + openRouter
 *   gemma-3         — ollamaLocal + openRouter
 *   gemma-2         — ollamaLocal only
 *   llama-4-s       — ollamaLocal + openRouter
 *   llama-3.1-70b   — ollamaLocal + openRouter
 *   llama-3-8b      — ollamaLocal only
 *   deepseek-r1     — ollamaLocal + ollamaCloud + openRouter
 *   deepseek-chat   — ollamaLocal + openRouter
 *   nemotron-70b    — ollamaLocal + openRouter
 *   glm-4           — other source only (no OR, no OC, no OL)
 *
 * Release dates (for timeline):
 *   2023-06: gpt-4o          2024-03: claude-3.5     2024-06: gemma-2
 *   2024-07: llama-3.1-70b   2024-12: deepseek-chat  2025-01: o3, deepseek-r1, llama-3-8b
 *   2025-03: gemini-2.5       2025-04: llama-4-s     2025-05: gemma-3, claude-sonnet-4, nemotron-70b
 *   2025-07: glm-4
 *
 * Families by count:
 *   meta-llama (3), google (3), openai (2), anthropic (2), deepseek (2), nvidia (1), zhipuai (1)
 *
 * vfl (within type-group per family):
 *   openai:      o3=0, gpt-4o=1
 *   anthropic:   claude-sonnet-4=0, claude-3.5=1
 *   google-open: gemma-3=0, gemma-2=1
 *   google-closed: gemini-2.5=0
 *   meta-llama:  llama-4-s=0, llama-3.1-70b=1, llama-3-8b=2
 *   deepseek:    deepseek-r1=0, deepseek-chat=1
 *   nvidia:      nemotron-70b=0
 *   zhipuai:     glm-4=0
 */

import { test, expect } from '@playwright/test';

export { test, expect };

// ─── Mock data (matches live BenchmarkData + InferenceMap schemas) ──────────

export const MOCK_BD = {
  generated: new Date().toISOString(),
  dataset: 'lb',
  openRouterOnly: false,
  modelCount: 14,
  benchmarks: {
    lb_avg:     { key: 'lb_avg',     label: 'LiveBench Avg',     desc: 'Overall',   unit: '%', higherIsBetter: true },
    lb_coding:  { key: 'lb_coding',  label: 'LiveBench Coding',  desc: 'Coding',    unit: '%', higherIsBetter: true },
    lb_math:    { key: 'lb_math',    label: 'LiveBench Math',    desc: 'Math',      unit: '%', higherIsBetter: true },
  },
  familyOrder: ['openai', 'anthropic', 'google', 'meta-llama', 'deepseek', 'nvidia', 'zhipuai'],
  models: [
    // openai – closed, openRouter only
    { id:'gpt-4o',  slug:'gpt-4o',  name:'GPT-4o',             family:'openai',    brand:'OpenAI',    type:'closed', released:'2023-06-13', vfl:1, openRouterId:null, sources:['livebench'], scores:{ lb_avg:88.7, lb_coding:82.0, lb_math:92.0 } },
    { id:'o3',      slug:'o3',      name:'o3',                 family:'openai',    brand:'OpenAI',    type:'closed', released:'2025-01-31', vfl:0, openRouterId:null, sources:['livebench'], scores:{ lb_avg:96.0, lb_coding:90.0, lb_math:97.0 } },
    // anthropic – closed, ollamaCloud (+ openRouter for sonnet-4)
    { id:'claude-3.5',      slug:'claude-35',      name:'Claude 3.5 Sonnet',  family:'anthropic',  brand:'Anthropic', type:'closed', released:'2024-03-04', vfl:1, openRouterId:null, sources:['livebench'], scores:{ lb_avg:90.0, lb_coding:84.0, lb_math:95.0 } },
    { id:'claude-sonnet-4', slug:'claude-sonnet-4', name:'Claude Sonnet 4',   family:'anthropic',  brand:'Anthropic', type:'closed', released:'2025-05-15', vfl:0, openRouterId:null, sources:['livebench'], scores:{ lb_avg:92.0, lb_coding:87.0, lb_math:96.0 } },
    // google – mixed: 1 closed (gemini), 2 open (gemma)
    { id:'gemini-2.5', slug:'gemini-25', name:'Gemini 2.5 Pro', family:'google', brand:'Google', type:'closed', released:'2025-03-25', vfl:0, openRouterId:null, sources:['livebench'], scores:{ lb_avg:89.0, lb_coding:85.0, lb_math:93.0 } },
    { id:'gemma-3',     slug:'gemma-3',    name:'Gemma 3 27B',   family:'google', brand:'Google', type:'open',   released:'2025-05-19', vfl:0, openRouterId:null, sources:['livebench'], scores:{ lb_avg:76.0, lb_coding:68.0, lb_math:74.0 } },
    { id:'gemma-2',     slug:'gemma-2',    name:'Gemma 2 27B',   family:'google', brand:'Google', type:'open',   released:'2024-06-27', vfl:1, openRouterId:null, sources:['livebench'], scores:{ lb_avg:75.2, lb_coding:66.0, lb_math:73.0 } },
    // meta-llama – open, ollamaLocal + openRouter
    { id:'llama-4-s',     slug:'llama-4s',    name:'Llama 4 Scout',   family:'meta-llama', brand:'Meta', type:'open', released:'2025-04-05', vfl:0, openRouterId:null, sources:['livebench'], scores:{ lb_avg:79.0, lb_coding:72.0, lb_math:78.0 } },
    { id:'llama-3.1-70b', slug:'llama-31-70b', name:'Llama 3.1 70B',  family:'meta-llama', brand:'Meta', type:'open', released:'2024-07-23', vfl:1, openRouterId:null, sources:['livebench'], scores:{ lb_avg:83.1, lb_coding:76.0, lb_math:81.0 } },
    { id:'llama-3-8b',    slug:'llama-3-8b',   name:'Llama 3 8B',     family:'meta-llama', brand:'Meta', type:'open', released:'2025-01-01', vfl:2, openRouterId:null, sources:['livebench'], scores:{ lb_avg:66.6, lb_coding:58.0, lb_math:64.0 } },
    // deepseek – open, various sources
    { id:'deepseek-r1',   slug:'deepseek-r1',  name:'DeepSeek R1',     family:'deepseek', brand:'DeepSeek', type:'open', released:'2025-01-20', vfl:0, openRouterId:null, sources:['livebench'], scores:{ lb_avg:90.0, lb_coding:83.0, lb_math:94.0 } },
    { id:'deepseek-chat',  slug:'deepseek-chat', name:'DeepSeek Chat',  family:'deepseek', brand:'DeepSeek', type:'open', released:'2024-12-06', vfl:1, openRouterId:null, sources:['livebench'], scores:{ lb_avg:77.0, lb_coding:69.0, lb_math:75.0 } },
    // nvidia – open, ollamaLocal + openRouter (regression test for open-weight provider)
    { id:'nemotron-70b',  slug:'nemotron-70b', name:'Nemotron 70B',     family:'nvidia',    brand:'NVIDIA',    type:'open', released:'2025-05-10', vfl:0, openRouterId:null, sources:['livebench'], scores:{ lb_avg:84.0, lb_coding:77.0, lb_math:82.0 } },
    // zhipuai – closed, other source only (no OR, OC, OL)
    { id:'glm-4',         slug:'glm-4',        name:'GLM-4',           family:'zhipuai',   brand:'ZhipuAI',   type:'closed', released:'2025-07-01', vfl:0, openRouterId:null, sources:['livebench'], scores:{ lb_avg:81.0, lb_coding:73.0, lb_math:79.0 } },
  ],
};

export const MOCK_INF = {
  entries: {
    'gpt-4o':          { openRouter: true,  ollamaCloud: false, ollamaLocal: false },
    'o3':              { openRouter: true,  ollamaCloud: false, ollamaLocal: false },
    'claude-3.5':      { openRouter: false, ollamaCloud: true,  ollamaLocal: false },
    'claude-sonnet-4': { openRouter: true,  ollamaCloud: true,  ollamaLocal: false },
    'gemini-2.5':      { openRouter: true,  ollamaCloud: true,  ollamaLocal: false },
    'gemma-3':         { openRouter: true,  ollamaCloud: false, ollamaLocal: true },
    'gemma-2':         { openRouter: false, ollamaCloud: false, ollamaLocal: true },
    'llama-4-s':       { openRouter: true,  ollamaCloud: false, ollamaLocal: true },
    'llama-3.1-70b':   { openRouter: true,  ollamaCloud: false, ollamaLocal: true },
    'llama-3-8b':      { openRouter: false, ollamaCloud: false, ollamaLocal: true },
    'deepseek-r1':     { openRouter: true,  ollamaCloud: true,  ollamaLocal: true },
    'deepseek-chat':   { openRouter: true,  ollamaCloud: false, ollamaLocal: true },
    'nemotron-70b':    { openRouter: true,  ollamaCloud: false, ollamaLocal: true },
    'glm-4':           { openRouter: false, ollamaCloud: false, ollamaLocal: false },
  },
};

// ─── Setup & helpers ──────────────────────────────────────────────────────────

/** 
 * Standard test setup: register API mocks, navigate, wait for load.
 * Clears any pre-existing URL params.
 */
export async function setup(page) {
  await page.addInitScript(() => {
    // Clear any persisted URL params from previous tests
    window.history.replaceState(null, '', window.location.pathname);
  });
  await page.route('**/benchmark_lb.json', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BD) })
  );
  await page.route('**/inference.json', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INF) })
  );
  await page.goto('/');
  await page.waitForSelector('.stat-value', { timeout: 15_000 });
}

/** 
 * Setup for persistence tests: register mocks WITHOUT clearing URL params.
 * After setting state, page.reload() will preserve the URL params.
 */
export async function setupPersist(page) {
  // Don't clear URL params — let the app read them on reload
  await page.route('**/benchmark_lb.json', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BD) })
  );
  await page.route('**/inference.json', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INF) })
  );
  await page.goto('/');
  await page.waitForSelector('.stat-value', { timeout: 15_000 });
}

/** Read the "Visible" stat (e.g. "14/14" → 14). */
export async function visible(page) {
  const txt = await page.locator('.stat').filter({ hasText: 'Visible' }).locator('.stat-value').textContent();
  return parseInt(txt.split('/')[0], 10);
}

/** Read the "Families" stat. */
export async function families(page) {
  const txt = await page.locator('.stat').filter({ hasText: 'Families' }).locator('.stat-value').textContent();
  return parseInt(txt, 10);
}

/** Locator for the "Available on Ollama Cloud" checkbox. */
export const ollamaCloudCb = p => p.locator('label').filter({ hasText: 'Available on Ollama Cloud' }).locator('input[type=checkbox]');

/** Locator for the "Available for Ollama Download" checkbox. */
export const ollamaLocalCb = p => p.locator('label').filter({ hasText: 'Available for Ollama Download' }).locator('input[type=checkbox]');

/** Locator for the "Available on OpenRouter" checkbox. */
export const openRouterCb = p => p.locator('label').filter({ hasText: 'Available on OpenRouter' }).locator('input[type=checkbox]');

/** Locator for the "Other source" checkbox. */
export const otherSourceCb = p => p.locator('label').filter({ hasText: 'Other source' }).locator('input[type=checkbox]');

/** Locator for the "Show latest 2 per series" checkbox. */
export const latest2Cb = p => p.locator('label').filter({ hasText: 'Latest 2' }).locator('input[type=checkbox]');

/** Select/deselect-all button. */
export const selAllBtn = p => p.locator('.ctrl-btn').first();

/** Timeline preset button. */
export const tlBtn = (p, label) => p.locator('button.tl-btn').filter({ hasText: label });

/** Sort buttons. */
export const sortCountBtn = p => p.locator('button.sort-btn', { hasText: '# ↓ Count' });
export const sortAlphaBtn = p => p.locator('button.sort-btn', { hasText: 'A–Z Name' });
export const sortCatBtn  = p => p.locator('button.sort-btn', { hasText: '◈ Category' });

/** Return sidebar family names in order. */
export async function familyNames(page) {
  return page.locator('.fam-name').allTextContents();
}

/** Search input. */
export const searchInput = p => p.locator('input[placeholder*="Search"]');

/** Fill search and wait for debounce. */
export async function searchFor(page, query) {
  await searchInput(page).fill(query);
  await page.waitForTimeout(150);
}

/** Count model rows (visible = expanded or in flat view). */
export async function modelRowCount(page) {
  return page.locator('.model-row').count();
}

// ── Convenient model counts for assertions ─────────────────────────────────
// 14 total: 6 closed + 8 open; 7 families
// By type:      open=8, closed=6
// By inference:
//   openRouter=true:  gpt-4o, o3, claude-sonnet-4, gemini-2.5, gemma-3, llama-4-s, llama-3.1-70b, deepseek-r1, deepseek-chat, nemotron-70b  = 10
//   ollamaCloud=true: claude-3.5, claude-sonnet-4, gemini-2.5, deepseek-r1 = 4
//   ollamaLocal=true:  gemma-3, gemma-2, llama-4-s, llama-3.1-70b, llama-3-8b, deepseek-r1, deepseek-chat, nemotron-70b = 8
//   other only:       glm-4 = 1