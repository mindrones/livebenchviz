import { test, expect, setup, visible } from './helpers.js';

// ─── 5. Sidebar expand/collapse ────────────────────────────────────────────

test.describe('sidebar expand/collapse', () => {
  test('families start collapsed (no .children visible)', async ({ page }) => {
    await setup(page);
    const children = await page.locator('.children').count();
    expect(children).toBe(0);
  });

  test('Expand All: all 7 families show children', async ({ page }) => {
    await setup(page);
    await page.click('button:has-text("⊞")');
    await page.waitForTimeout(200);
    const children = await page.locator('.children').count();
    expect(children).toBe(7);
  });

  test('Collapse All after expanding: no children visible', async ({ page }) => {
    await setup(page);
    await page.click('button:has-text("⊞")');
    await page.waitForTimeout(200);
    await page.click('button:has-text("⊟")');
    await page.waitForTimeout(200);
    const children = await page.locator('.children').count();
    expect(children).toBe(0);
  });

  test('Clicking a family row toggles its children', async ({ page }) => {
    await setup(page);
    const firstFamRow = page.locator('.fam-row').first();
    await firstFamRow.click();
    await page.waitForTimeout(150);
    expect(await page.locator('.children').count()).toBe(1);
    await firstFamRow.click();
    await page.waitForTimeout(150);
    expect(await page.locator('.children').count()).toBe(0);
  });

  test('Expand All with Open-only filter: only 5 families expanded', async ({ page }) => {
    await setup(page);
    await page.click('button:has-text("Closed Weights")');
    await page.click('button:has-text("⊞")');
    await page.waitForTimeout(200);
    const children = await page.locator('.children').count();
    expect(children).toBe(4);  // google, meta-llama, deepseek, nvidia (open families)
  });
});

// ─── 6. Sidebar select/deselect ────────────────────────────────────────────

test.describe('sidebar select/deselect', () => {
  test('Deselect All hides all models (visible = 0)', async ({ page }) => {
    await setup(page);
    await expect(page.locator('.ctrl-btn').first()).toContainText('☑');
    await page.locator('.ctrl-btn').first().click();
    expect(await visible(page)).toBe(0);
  });

  test('Select All after deselect restores all 14 models', async ({ page }) => {
    await setup(page);
    await page.locator('.ctrl-btn').first().click();  // deselect
    expect(await visible(page)).toBe(0);
    await page.locator('.ctrl-btn').first().click();  // select all
    expect(await visible(page)).toBe(14);
  });

  test('Deselecting one model reduces visible by 1', async ({ page }) => {
    await setup(page);
    await page.locator('.fam-row').first().click();
    await page.waitForTimeout(150);
    const firstModelCb = page.locator('.model-row input[type=checkbox]').first();
    await firstModelCb.uncheck();
    expect(await visible(page)).toBe(13);
  });
});