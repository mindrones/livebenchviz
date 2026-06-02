import { test, expect, setup, visible, families, ollamaCloudCb, openRouterCb, otherSourceCb, latest2Cb, tlBtn } from './helpers.js';

// ─── 8. Cross-case combinations ────────────────────────────────────────────

test.describe('cross-case combinations', () => {
  test('Closed + no OpenRouter: only OC/OL/other closed models pass', async ({ page }) => {
    await setup(page);
    await page.click('button:has-text("Open Weights")');  // hide open
    await openRouterCb(page).uncheck();
    // Closed models without OR: claude-3.5(OC), gemini-2.5(OC+OR → OR off, but OC still on → passes)
    // claude-sonnet-4(OC), glm-4(other)
    // gpt-4o and o3 only have OR → excluded
    // Result: claude-3.5, claude-sonnet-4, gemini-2.5, glm-4 = 4
    expect(await visible(page)).toBe(4);
  });

  test('Open + no OpenRouter + no OllamaCloud: only OL and other-source open models', async ({ page }) => {
    await setup(page);
    await page.click('button:has-text("Closed Weights")');  // hide closed
    await openRouterCb(page).uncheck();
    await ollamaCloudCb(page).uncheck();
    // Open models with OL or other: gemma-3(OL), gemma-2(OL), llama-4-s(OL),
    // llama-3.1-70b(OL), llama-3-8b(OL), deepseek-r1(OL), deepseek-chat(OL), nemotron-70b(OL)
    // All open models have OL → 8 pass
    expect(await visible(page)).toBe(8);
  });

  test('Latest 2 + 1Y: fewer models than either alone', async ({ page }) => {
    await setup(page);
    await latest2Cb(page).check();
    await tlBtn(page, '1 Y').click();
    await page.waitForTimeout(200);
    // Both filters narrow; result should be less than 14
    expect(await visible(page)).toBeLessThan(14);
  });

  test('Deselect All + type filter: hidden set respects scope', async ({ page }) => {
    await setup(page);
    await page.locator('.ctrl-btn').first().click();  // deselect all
    expect(await visible(page)).toBe(0);
    // Switching type filter does not un-hide
    await page.click('button:has-text("Closed Weights")');
    expect(await visible(page)).toBe(0);
  });
});