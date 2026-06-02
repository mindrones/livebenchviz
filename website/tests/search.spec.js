import { test, expect, setup, visible, searchInput, searchFor, modelRowCount, sortAlphaBtn } from './helpers.js';

// ─── 12. Search ───────────────────────────────────────────────────────────
//
// Search matches model.name OR model.family (case-insensitive).
// Matching families auto-expand.
//
// Mock name inventory:
//   openai     → GPT-4o, o3                                       (2)
//   anthropic  → Claude 3.5 Sonnet, Claude Sonnet 4                  (2)
//   google     → Gemini 2.5 Pro, Gemma 3 27B, Gemma 2 27B          (3)
//   meta-llama → Llama 4 Scout, Llama 3.1 70B, Llama 3 8B          (3)
//   deepseek   → DeepSeek R1, DeepSeek Chat                         (2)
//   nvidia     → Nemotron 70B                                       (1)
//   zhipuai    → GLM-4                                              (1)

test.describe('search', () => {
  test('search input is visible on load', async ({ page }) => {
    await setup(page);
    await expect(searchInput(page)).toBeVisible();
  });

  test('search "gpt" → 1 family (openai), 1 model row (GPT-4o; o3 excluded)', async ({ page }) => {
    await setup(page);
    await searchFor(page, 'gpt');
    expect(await page.locator('.fam-name').count()).toBe(1);
    expect(await modelRowCount(page)).toBe(1);
  });

  test('search "openai" → 1 family, both models shown', async ({ page }) => {
    await setup(page);
    await searchFor(page, 'openai');
    expect(await page.locator('.fam-name').count()).toBe(1);
    expect(await modelRowCount(page)).toBe(2);
  });

  test('search "claude" → 1 family (anthropic), 2 model rows', async ({ page }) => {
    await setup(page);
    await searchFor(page, 'claude');
    expect(await page.locator('.fam-name').count()).toBe(1);
    expect(await modelRowCount(page)).toBe(2);
  });

  test('search "gemma" → 1 family (google), 2 model rows', async ({ page }) => {
    await setup(page);
    await searchFor(page, 'gemma');
    expect(await page.locator('.fam-name').count()).toBe(1);
    expect(await modelRowCount(page)).toBe(2);
  });

  test('search "llama" → 1 family (meta-llama), 3 model rows', async ({ page }) => {
    await setup(page);
    await searchFor(page, 'llama');
    expect(await page.locator('.fam-name').count()).toBe(1);
    expect(await modelRowCount(page)).toBe(3);
  });

  test('search "glm" → 1 family (zhipuai), 1 model row', async ({ page }) => {
    await setup(page);
    await searchFor(page, 'glm');
    expect(await page.locator('.fam-name').count()).toBe(1);
    expect(await modelRowCount(page)).toBe(1);
  });

  test('search with no match → 0 families visible', async ({ page }) => {
    await setup(page);
    await searchFor(page, 'xyzzy-nonexistent');
    expect(await page.locator('.fam-name').count()).toBe(0);
    expect(await modelRowCount(page)).toBe(0);
  });

  test('clearing search restores all families (collapsed)', async ({ page }) => {
    await setup(page);
    await searchFor(page, 'gpt');
    expect(await page.locator('.fam-name').count()).toBe(1);
    await searchFor(page, '');
    expect(await page.locator('.fam-name').count()).toBe(7);
    expect(await modelRowCount(page)).toBe(0);  // collapsed
  });

  test('✕ button clears search', async ({ page }) => {
    await setup(page);
    await searchFor(page, 'claude');
    expect(await page.locator('.fam-name').count()).toBe(1);
    await page.locator('.search-clr').click();
    await page.waitForTimeout(100);
    expect(await page.locator('.fam-name').count()).toBe(7);
  });

  test('search is case-insensitive', async ({ page }) => {
    await setup(page);
    await searchFor(page, 'GPT');
    const upper = await modelRowCount(page);
    await searchFor(page, 'gpt');
    const lower = await modelRowCount(page);
    expect(upper).toBe(lower);
  });

  test('search + type filter (closed only): "gemini" found, "gemma" not', async ({ page }) => {
    await setup(page);
    await page.click('button:has-text("Open Weights")');  // Closed only
    await searchFor(page, 'gemini');
    expect(await page.locator('.fam-name').count()).toBe(1);

    await searchFor(page, 'gemma');
    expect(await page.locator('.fam-name').count()).toBe(0);  // Gemma is open, hidden
  });

  test('search filters chart: reduces visible count', async ({ page }) => {
    await setup(page);
    const before = await visible(page);
    await searchFor(page, 'deepseek');
    const after = await visible(page);
    expect(after).toBeLessThan(before);
  });

  test('clearing search restores previous visible count', async ({ page }) => {
    await setup(page);
    const before = await visible(page);
    await searchFor(page, 'deepseek');
    await page.locator('.search-clr').click();
    await page.waitForTimeout(200);
    expect(await visible(page)).toBe(before);
  });
});