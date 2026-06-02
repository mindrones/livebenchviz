import { test, expect, setup, familyNames, latest2Cb, sortCountBtn, sortAlphaBtn, MOCK_BD, MOCK_INF } from './helpers.js';

// ─── 11. Sidebar sort ─────────────────────────────────────────────────────
//
// Mock counts per family (all 14 models, no filters):
//   meta-llama: 3  (llama-4-s, llama-3.1-70b, llama-3-8b)
//   google:     3  (gemini-2.5, gemma-3, gemma-2)
//   openai:     2  (gpt-4o, o3)
//   anthropic:   2  (claude-3.5, claude-sonnet-4)
//   deepseek:   2  (deepseek-r1, deepseek-chat)
//   nvidia:     1  (nemotron-70b)
//   zhipuai:    1  (glm-4)
//
// familyOrder from mock data:
//   openai, anthropic, google, meta-llama, deepseek, nvidia, zhipuai
//
// Default sort (category): familyOrder order
// Alpha sort: anthropic, deepseek, google, meta-llama, nvidia, openai, zhipuai
// Count sort: google(3)=meta-llama(3) > openai(2)=anthropic(2)=deepseek(2) > nvidia(1)=zhipuai(1)

test.describe('sidebar sort', () => {
  test('default sort (category) shows all 7 families', async ({ page }) => {
    await setup(page);
    const names = await familyNames(page);
    expect(names.length).toBe(7);
  });

  test('alpha sort orders families A–Z', async ({ page }) => {
    await setup(page);
    await sortAlphaBtn(page).click();
    const names = await familyNames(page);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
    expect(names[0]).toBe('anthropic');
    expect(names[names.length - 1]).toBe('zhipuai');
  });

  test('count sort: meta-llama and google tie for first', async ({ page }) => {
    await setup(page);
    await sortCountBtn(page).click();
    const names = await familyNames(page);
    // meta-llama and google both have 3 models — tiebreak alphabetically
    const firstTwo = [names[0], names[1]].sort();
    expect(firstTwo).toEqual(['google', 'meta-llama']);
  });

  test('count sort updates dynamically with Latest 2', async ({ page }) => {
    await setup(page);
    await latest2Cb(page).check();
    await sortCountBtn(page).click();
    const names = await familyNames(page);
    // With Latest 2, google has 3 models (gemini-2.5 + 2 gemma), meta-llama has 2 (vfl=2 excluded)
    // google(3) should be first
    expect(names[0]).toBe('google');
  });

  test('toggling between sort modes changes order', async ({ page }) => {
    await setup(page);
    const defaultOrder = await familyNames(page);
    await sortAlphaBtn(page).click();
    const alphaOrder = await familyNames(page);
    // Alpha and default (category/familyOrder) order differ
    expect(defaultOrder).not.toEqual(alphaOrder);
  });

  test('sort setting persists across page reload via URL', async ({ page }) => {
    // Setup without clearing URL params
    await page.route('**/benchmark_lb.json', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BD) })
    );
    await page.route('**/inference.json', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INF) })
    );
    await page.goto('/');
    await page.waitForSelector('.stat-value', { timeout: 15_000 });
    await sortAlphaBtn(page).click();
    const alphaOrder = await familyNames(page);

    await page.reload();
    await page.waitForSelector('.stat-value', { timeout: 15_000 });
    const afterReload = await familyNames(page);
    expect(afterReload).toEqual(alphaOrder);
  });
});