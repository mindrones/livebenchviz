import { test, expect } from '@playwright/test';

// ─── 14. Classification & Latest-2 correctness (vfl per type-group) ──────
//
// Bug: vfl was computed across ALL models in a family. In a mixed family
// (e.g., google with both Gemini/closed and Gemma/open), newer closed models
// inflated the vfl of open models, making "Latest 2 + Open" show 0 for google.
// Fix: vfl is now computed within each type-group independently.
//
// This test uses a mixed-family mock to verify the fix.

const CLS_MOCK_BD = {
  generated: new Date().toISOString(),
  dataset: 'lb',
  openRouterOnly: false,
  modelCount: 13,
  benchmarks: { lb_avg: { key:'lb_avg', label:'Avg', desc:'', unit:'%', higherIsBetter:true } },
  familyOrder: ['google', 'deepseek', 'openai'],
  models: [
    // google closed (Gemini) — 4 models
    { id:'gemini-flash-2024',  slug:'gemini-flash-2024',  name:'Gemini Flash 2024', family:'google', brand:'Google', type:'closed', released:'2024-05-01', vfl:3, openRouterId:null, sources:['livebench'], scores:{ lb_avg:78.0 } },
    { id:'gemini-pro-2025',   slug:'gemini-pro-2025',    name:'Gemini Pro 2025',   family:'google', brand:'Google', type:'closed', released:'2025-01-01', vfl:2, openRouterId:null, sources:['livebench'], scores:{ lb_avg:89.0 } },
    { id:'gemini-flash-2025', slug:'gemini-flash-2025',  name:'Gemini Flash 2025', family:'google', brand:'Google', type:'closed', released:'2025-02-01', vfl:1, openRouterId:null, sources:['livebench'], scores:{ lb_avg:82.0 } },
    { id:'gemini-pro-2-2025', slug:'gemini-pro-2-2025', name:'Gemini Pro 2 2025',  family:'google', brand:'Google', type:'closed', released:'2025-03-01', vfl:0, openRouterId:null, sources:['livebench'], scores:{ lb_avg:90.0 } },
    // google open (Gemma) — 2 models
    { id:'gemma-2-27b',  slug:'gemma-2-27b',  name:'Gemma 2 27B',  family:'google', brand:'Google', type:'open', released:'2024-06-01', vfl:1, openRouterId:null, sources:['livebench'], scores:{ lb_avg:75.2 } },
    { id:'gemma-3-27b',  slug:'gemma-3-27b',  name:'Gemma 3 27B',  family:'google', brand:'Google', type:'open', released:'2025-01-15', vfl:0, openRouterId:null, sources:['livebench'], scores:{ lb_avg:76.0 } },
    // deepseek — all open, 3 models
    { id:'deepseek-chat',    slug:'deepseek-chat',   name:'DeepSeek Chat',  family:'deepseek', brand:'DeepSeek', type:'open', released:'2024-01-05', vfl:2, openRouterId:null, sources:['livebench'], scores:{ lb_avg:77.0 } },
    { id:'deepseek-r1',      slug:'deepseek-r1',     name:'DeepSeek R1',    family:'deepseek', brand:'DeepSeek', type:'open', released:'2025-01-20', vfl:0, openRouterId:null, sources:['livebench'], scores:{ lb_avg:90.0 } },
    { id:'deepseek-v3',      slug:'deepseek-v3',     name:'DeepSeek V3',    family:'deepseek', brand:'DeepSeek', type:'open', released:'2025-01-10', vfl:1, openRouterId:null, sources:['livebench'], scores:{ lb_avg:88.0 } },
    // openai — all closed, 4 models
    { id:'gpt-4',       slug:'gpt-4',       name:'GPT-4',         family:'openai', brand:'OpenAI', type:'closed', released:'2023-06-13', vfl:3, openRouterId:null, sources:['livebench'], scores:{ lb_avg:86.4 } },
    { id:'gpt-4o',      slug:'gpt-4o',      name:'GPT-4o',        family:'openai', brand:'OpenAI', type:'closed', released:'2024-05-13', vfl:2, openRouterId:null, sources:['livebench'], scores:{ lb_avg:88.7 } },
    { id:'gpt-4o-mini', slug:'gpt-4o-mini', name:'GPT-4o mini',   family:'openai', brand:'OpenAI', type:'closed', released:'2024-07-18', vfl:1, openRouterId:null, sources:['livebench'], scores:{ lb_avg:82.0 } },
    { id:'o3',          slug:'o3',          name:'o3',             family:'openai', brand:'OpenAI', type:'closed', released:'2025-01-31', vfl:0, openRouterId:null, sources:['livebench'], scores:{ lb_avg:96.0 } },
  ],
};

const CLS_MOCK_INF = {
  entries: Object.fromEntries(
    CLS_MOCK_BD.models.map(m => [m.id, { openRouter: true, ollamaCloud: false, ollamaLocal: m.type === 'open' }])
  ),
};

async function setupCls(page) {
  await page.addInitScript(() => window.history.replaceState(null, '', window.location.pathname));
  await page.route('**/benchmark_lb.json', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CLS_MOCK_BD) })
  );
  await page.route('**/inference.json', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CLS_MOCK_INF) })
  );
  await page.goto('/');
  await page.waitForSelector('.fam-name', { timeout: 10_000 });
}

async function clsVisible(page) {
  const txt = await page.locator('.stat').filter({ hasText: 'Visible' }).locator('.stat-value').textContent();
  return parseInt(txt.split('/')[0], 10);
}

test.describe('classification & Latest-2 correctness', () => {
  test('all 13 models visible by default', async ({ page }) => {
    await setupCls(page);
    expect(await clsVisible(page)).toBe(13);
  });

  test('Open filter: 5 open models (2 Gemma + 3 DeepSeek)', async ({ page }) => {
    await setupCls(page);
    await page.click('button:has-text("Closed Weights")');
    await page.waitForTimeout(150);
    expect(await clsVisible(page)).toBe(5);
  });

  test('Closed filter: 8 closed models (4 Gemini + 4 OpenAI)', async ({ page }) => {
    await setupCls(page);
    await page.click('button:has-text("Open Weights")');
    await page.waitForTimeout(150);
    expect(await clsVisible(page)).toBe(8);
  });

  test('google/gemma-* are open; google/gemini-* are closed', async ({ page }) => {
    await setupCls(page);
    await page.click('button:has-text("Expand all")');
    await page.waitForTimeout(100);

    // Open only
    await page.click('button:has-text("Closed Weights")');
    await page.waitForTimeout(150);
    const ossNames = await page.locator('.model-name').allTextContents();
    expect(ossNames.some(n => /gemma/i.test(n))).toBe(true);
    expect(ossNames.some(n => /gemini/i.test(n))).toBe(false);

    // Closed only: re-enable closed, then disable open
    await page.click('button:has-text("Closed Weights")');
    await page.click('button:has-text("Open Weights")');
    await page.waitForTimeout(150);
    const apiNames = await page.locator('.model-name').allTextContents();
    expect(apiNames.some(n => /gemini/i.test(n))).toBe(true);
    expect(apiNames.some(n => /gemma/i.test(n))).toBe(false);
  });

  // ── Core regression: vfl computed per type-group ─────────────────────────
  test('[regression] Latest 2 + Open: google Gemma models still appear', async ({ page }) => {
    await setupCls(page);
    await page.locator('label').filter({ hasText: 'Latest 2' }).locator('input').check();
    await page.click('button:has-text("Closed Weights")');
    await page.waitForTimeout(200);

    // google family must still be visible
    const famNames = await page.locator('.fam-name').allTextContents();
    expect(famNames.some(f => f.includes('google'))).toBe(true);

    // Expanding reveals both Gemma models (vfl 0 and 1 within open group)
    await page.click('button:has-text("Expand all")');
    await page.waitForTimeout(100);
    const rows = await page.locator('.model-name').allTextContents();
    expect(rows.filter(n => /gemma/i.test(n)).length).toBe(2);
    expect(rows.some(n => /gemini/i.test(n))).toBe(false);
  });

  test('total with Latest 2 (no type filter): 8 visible models', async ({ page }) => {
    await setupCls(page);
    await page.locator('label').filter({ hasText: 'Latest 2' }).locator('input').check();
    await page.waitForTimeout(200);
    // google: 2 Gemma(vfl≤1) + 2 Gemini(vfl≤1) = 4
    // deepseek: V3(vfl=1) + R1(vfl=0) = 2
    // openai: o3(vfl=0) + gpt-4o-mini(vfl=1) = 2
    // Total = 8
    expect(await clsVisible(page)).toBe(8);
  });
});