import { test, expect, setup, visible, families, latest2Cb } from './helpers.js';

// ─── 4. Latest 2 per series ───────────────────────────────────────────────
//
// vfl ≤ 1 means at most 2 models per type-group per family.
//
// Latest-2 models (vfl 0 or 1):
//   openai:      o3(0), gpt-4o(1) = 2
//   anthropic:   claude-sonnet-4(0), claude-3.5(1) = 2
//   google-open: gemma-3(0), gemma-2(1) = 2
//   google-closed: gemini-2.5(0) = 1
//   meta-llama:  llama-4-s(0), llama-3.1-70b(1) = 2  (llama-3-8b vfl=2 excluded)
//   deepseek:    deepseek-r1(0), deepseek-chat(1) = 2
//   nvidia:      nemotron-70b(0) = 1
//   zhipuai:     glm-4(0) = 1
//   Total: 2+2+2+1+2+2+1+1 = 13

test.describe('latest 2 per series', () => {
  test('Latest 2: shows 13 models', async ({ page }) => {
    await setup(page);
    await latest2Cb(page).check();
    // llama-3-8b (vfl=2) is excluded; all others have vfl ≤ 1
    expect(await visible(page)).toBe(13);
    expect(await families(page)).toBe(7);
  });

  test('Latest 2 + Open only: 8 models', async ({ page }) => {
    await setup(page);
    await latest2Cb(page).check();
    await page.click('button:has-text("Closed Weights")');
    // Open + vfl≤1: gemma-3, gemma-2, llama-4-s, llama-3.1-70b, deepseek-r1, deepseek-chat, nemotron-70b = 7
    expect(await visible(page)).toBe(7);
  });

  test('Latest 2 + Closed only: 6 models', async ({ page }) => {
    await setup(page);
    await latest2Cb(page).check();
    await page.click('button:has-text("Open Weights")');
    // Closed + vfl≤1: o3, gpt-4o, claude-sonnet-4, claude-3.5, gemini-2.5, glm-4 = 6
    expect(await visible(page)).toBe(6);
  });

  test('Disabling Latest 2 restores the pre-filter count', async ({ page }) => {
    await setup(page);
    const before = await visible(page);
    await latest2Cb(page).check();
    expect(await visible(page)).toBeLessThan(before);
    await latest2Cb(page).uncheck();
    expect(await visible(page)).toBe(before);
  });
});