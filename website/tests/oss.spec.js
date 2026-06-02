import { test, expect, setup, visible } from './helpers.js';

// ─── 13. OSS / Ollama filter correctness ────────────────────────────────────
//
// Bug: isOpenWeight() was missing several providers whose models are available
// on Ollama.  The fix: expand OPEN_PROVIDERS + add pattern-matching for
// nemotron / kimi / glm / minimax in the model-ID fallback.
//
// This test uses a small custom mock (4 models) to assert exact counts.

const OSS_MOCK_BD = {
  generated: new Date().toISOString(),
  dataset: 'lb',
  openRouterOnly: false,
  modelCount: 4,
  benchmarks: { lb_avg: { key:'lb_avg', label:'Avg', desc:'', unit:'%', higherIsBetter:true } },
  familyOrder: ['nvidia', 'moonshotai', 'thudm', 'openai'],
  models: [
    { id:'nvidia/nemotron-70b', slug:'nemotron-70b', name:'Nemotron 70B',            family:'nvidia',      brand:'NVIDIA',     type:'open',   released:'2025-04-14', vfl:0, openRouterId:null, sources:['livebench'], scores:{ lb_avg:84.0 } },
    { id:'moonshotai/kimi-k2',  slug:'kimi-k2',     name:'Kimi K2',                   family:'moonshotai',  brand:'Moonshot AI', type:'open',   released:'2025-07-01', vfl:0, openRouterId:null, sources:['livebench'], scores:{ lb_avg:88.0 } },
    { id:'thudm/glm-z1-32b',    slug:'glm-z1',      name:'GLM-Z1 32B',                family:'thudm',       brand:'THUDM',       type:'open',   released:'2025-02-01', vfl:0, openRouterId:null, sources:['livebench'], scores:{ lb_avg:78.0 } },
    { id:'openai/gpt-4o',       slug:'gpt-4o',      name:'GPT-4o',                    family:'openai',      brand:'OpenAI',      type:'closed',  released:'2024-05-13', vfl:0, openRouterId:null, sources:['livebench'], scores:{ lb_avg:88.7 } },
  ],
};

const OSS_MOCK_INF = {
  entries: {
    'nvidia/nemotron-70b': { openRouter: true,  ollamaCloud: false, ollamaLocal: true },
    'moonshotai/kimi-k2':  { openRouter: true,  ollamaCloud: true,  ollamaLocal: false },
    'thudm/glm-z1-32b':    { openRouter: false, ollamaCloud: false, ollamaLocal: true },
    'openai/gpt-4o':       { openRouter: true,  ollamaCloud: false, ollamaLocal: false },
  },
};

async function setupOss(page) {
  await page.addInitScript(() => window.history.replaceState(null, '', window.location.pathname));
  await page.route('**/benchmark_lb.json', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OSS_MOCK_BD) })
  );
  await page.route('**/inference.json', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OSS_MOCK_INF) })
  );
  await page.goto('/');
  await page.waitForSelector('.fam-name', { timeout: 10_000 });
}

test.describe('OSS / Ollama filter correctness', () => {
  test('dashboard loads with 4 models across 4 families', async ({ page }) => {
    await setupOss(page);
    expect(await page.locator('.fam-name').count()).toBe(4);
    expect(await visible(page)).toBe(4);
  });

  test('nvidia (OL+OR) classified as open — visible with Open filter', async ({ page }) => {
    await setupOss(page);
    await page.click('button:has-text("Closed Weights")');
    await page.waitForTimeout(150);
    expect(await visible(page)).toBe(3);  // nvidia, moonshotai, thudm — all open
  });

  test('openai (OR only) classified as closed — hidden with Open filter', async ({ page }) => {
    await setupOss(page);
    await page.click('button:has-text("Open Weights")');
    await page.waitForTimeout(150);
    expect(await visible(page)).toBe(1);  // only gpt-4o
  });

  test('moonshotai (OC+OR) visible when Ollama Cloud is checked', async ({ page }) => {
    await setupOss(page);
    // Uncheck OpenRouter and Ollama Local → only OC remains
    await page.locator('label').filter({ hasText: 'Available on OpenRouter' }).locator('input[type=checkbox]').uncheck();
    await page.locator('label').filter({ hasText: 'Available for Ollama Download' }).locator('input[type=checkbox]').uncheck();
    await page.waitForTimeout(150);
    // Models passing via OC: moonshotai/kimi-k2, also claude-sonnet-4... wait no, we have mock data
    // In OSS mock: moonshotai has OC, nvidia has OL only → excluded, thudm has OL only → excluded
    // openai has OR only → excluded. Only moonshotai passes
    expect(await visible(page)).toBe(1);
  });

  test('type buttons are visible', async ({ page }) => {
    await setupOss(page);
    await expect(page.locator('button:has-text("Open Weights")')).toBeVisible();
    await expect(page.locator('button:has-text("Closed Weights")')).toBeVisible();
  });
});