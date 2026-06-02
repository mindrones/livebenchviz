import { test, expect, setup, visible, families, ollamaCloudCb, ollamaLocalCb, openRouterCb, otherSourceCb } from './helpers.js';

// ─── 3. Inference filters (4 checkboxes: OR, OC, OL, Other) ──────────────
//
// All 4 default to checked → all 14 models pass.
// Unchecking a source EXCLUDES models from that source.
// Logic is OR: a model passes if ANY checked source matches.
//
// Mock inference source counts:
//   openRouter=true:  10  (gpt-4o, o3, claude-sonnet-4, gemini-2.5, gemma-3,
//                           llama-4-s, llama-3.1-70b, deepseek-r1, deepseek-chat, nemotron-70b)
//   ollamaCloud=true:  4  (claude-3.5, claude-sonnet-4, gemini-2.5, deepseek-r1)
//   ollamaLocal=true:  8  (gemma-3, gemma-2, llama-4-s, llama-3.1-70b, llama-3-8b,
//                           deepseek-r1, deepseek-chat, nemotron-70b)
//   other only:        1  (glm-4)

test.describe('inference filters', () => {
  test('unchecking OpenRouter removes models that are OR-only (gpt-4o, o3 = 2) → 12 remain', async ({ page }) => {
    await setup(page);
    await openRouterCb(page).uncheck();
    // OR logic: model passes if ANY checked source matches.
    // gpt-4o and o3 only have OR → excluded. All others have OC/OL/other → pass.
    expect(await visible(page)).toBe(12);
  });

  test('unchecking Ollama Cloud removes OC-only models (claude-3.5) → 13 remain', async ({ page }) => {
    await setup(page);
    await ollamaCloudCb(page).uncheck();
    // claude-3.5 only has OC → excluded. Others with OC also have OR/OL → pass.
    expect(await visible(page)).toBe(13);
  });

  test('unchecking Ollama Download removes models that are OL-only → 10 remain', async ({ page }) => {
    await setup(page);
    await ollamaLocalCb(page).uncheck();
    // gemma-2 and llama-3-8b are OL-only (not OR, not OC, not other) → excluded
    // Others with OL are also OR → they pass
    // Excluded: gemma-2, llama-3-8b = 2 → 12 remain
    // But also: deepseek-r1 has OC, deepseek-chat has OR, etc.
    // Let's count: excluded models that have ONLY ollamaLocal = gemma-2, llama-3-8b
    expect(await visible(page)).toBe(12);
  });

  test('unchecking Other source removes glm-4 (other-only) → 13 remain', async ({ page }) => {
    await setup(page);
    await otherSourceCb(page).uncheck();
    // glm-4 is other-only → excluded
    expect(await visible(page)).toBe(13);
  });

  test('closed + uncheck all inference = 0 (no closed model passes without any source)', async ({ page }) => {
    await setup(page);
    // Show closed only
    await page.click('button:has-text("Open Weights")');
    // Now uncheck all inference sources
    await openRouterCb(page).uncheck();
    await ollamaCloudCb(page).uncheck();
    await ollamaLocalCb(page).uncheck();
    await otherSourceCb(page).uncheck();
    expect(await visible(page)).toBe(0);
  });

  test('open + uncheck all inference = 0', async ({ page }) => {
    await setup(page);
    await page.click('button:has-text("Closed Weights")');
    await openRouterCb(page).uncheck();
    await ollamaCloudCb(page).uncheck();
    await ollamaLocalCb(page).uncheck();
    await otherSourceCb(page).uncheck();
    expect(await visible(page)).toBe(0);
  });
});