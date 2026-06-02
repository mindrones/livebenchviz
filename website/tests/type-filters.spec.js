import { test, expect, setup, visible, families } from './helpers.js';

// ─── 2. Type filters (Open Weights / Closed Weights toggle buttons) ───────

test.describe('type filters', () => {
  test('Open only: 8 models from 4 families', async ({ page }) => {
    await setup(page);
    await page.click('button:has-text("Closed Weights")');
    expect(await visible(page)).toBe(8);
    // open families: google(2 gemma), meta-llama(3), deepseek(2), nvidia(1)
    expect(await families(page)).toBe(4);
  });

  test('Closed only: 6 models from 4 families', async ({ page }) => {
    await setup(page);
    await page.click('button:has-text("Open Weights")');
    expect(await visible(page)).toBe(6);
    // closed families: openai(2), anthropic(2), google(gemini×1), zhipuai(1)
    expect(await families(page)).toBe(4);
  });

  test('Both off: 0 models', async ({ page }) => {
    await setup(page);
    await page.click('button:has-text("Open Weights")');
    await page.click('button:has-text("Closed Weights")');
    expect(await visible(page)).toBe(0);
  });

  test('Re-enable both: restores all 14 models', async ({ page }) => {
    await setup(page);
    await page.click('button:has-text("Open Weights")');
    await page.click('button:has-text("Closed Weights")');
    await page.click('button:has-text("Open Weights")');
    await page.click('button:has-text("Closed Weights")');
    expect(await visible(page)).toBe(14);
  });

  test('Open only: sidebar shows only OW tags when expanded', async ({ page }) => {
    await setup(page);
    await page.click('button:has-text("Closed Weights")');
    await page.click('button:has-text("⊞")');
    await page.waitForTimeout(200);
    const apiTags = await page.locator('.tag.api').count();
    expect(apiTags).toBe(0);
    const ossTags = await page.locator('.tag.oss').count();
    expect(ossTags).toBeGreaterThan(0);
  });

  test('Closed only: sidebar shows only CW tags when expanded', async ({ page }) => {
    await setup(page);
    await page.click('button:has-text("Open Weights")');
    await page.click('button:has-text("⊞")');
    await page.waitForTimeout(200);
    const ossTags = await page.locator('.tag.oss').count();
    expect(ossTags).toBe(0);
    const apiTags = await page.locator('.tag.api').count();
    expect(apiTags).toBeGreaterThan(0);
  });
});