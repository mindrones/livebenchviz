import { test, expect, setup, MOCK_BD, MOCK_INF } from './helpers.js';

// ─── Mobile sidebar scrolling tests ────────────────────────────────────────
//
// Tests for the improved mobile sidebar: full scrollability and
// collapsible settings section to maximize space for model list.

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 900 };

async function setupMobileFilter(page) {
	await page.setViewportSize(MOBILE_VIEWPORT);
	await page.route('**/benchmark_lb.json', r =>
		r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BD) })
	);
	await page.route('**/inference.json', r =>
		r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INF) })
	);
	await page.goto('/');
	await page.waitForSelector('.chart-section svg', { timeout: 15_000 });

	// Click Filter tab to show sidebar
	const filterBtn = page.locator('nav.mobile-nav button:has-text("Filter")');
	await filterBtn.click();
	await page.waitForSelector('button:has-text("Open Weights")', { timeout: 5_000 });
}

test.describe('mobile sidebar scrolling', () => {
	test.use({ viewport: MOBILE_VIEWPORT });

	test('sidebar shows collapse button on mobile', async ({ page }) => {
		await setupMobileFilter(page);
		const collapseBtn = page.locator('.collapse-btn');
		await expect(collapseBtn).toBeVisible();
	});

	test('collapse button toggles settings visibility', async ({ page }) => {
		await setupMobileFilter(page);

		const collapseBtn = page.locator('.collapse-btn');
		const settingsScroll = page.locator('.settings-scroll');

		// Settings should be visible initially
		await expect(settingsScroll).toBeVisible();

		// Click to collapse
		await collapseBtn.click();
		await page.waitForTimeout(300);

		// Settings should be hidden
		await expect(settingsScroll).not.toBeVisible();

		// Click to expand
		await collapseBtn.click();
		await page.waitForTimeout(300);

		// Settings should be visible again
		await expect(settingsScroll).toBeVisible();
	});

	test('settings section is NOT scrollable — fixed height, collapse to hide', async ({ page }) => {
		await setupMobileFilter(page);

		const settingsScroll = page.locator('.settings-scroll');
		await expect(settingsScroll).toBeVisible();

		// Attempt to scroll settings — it should stay at 0
		await settingsScroll.evaluate(el => { el.scrollTop += 100; });
		await page.waitForTimeout(200);

		const scroll = await settingsScroll.evaluate(el => el.scrollTop);
		expect(scroll).toBe(0);
	});

	test('tree (model list) is always scrollable', async ({ page }) => {
		await setupMobileFilter(page);

		const tree = page.locator('.tree');
		await expect(tree).toBeVisible();

		// Get initial scroll position
		const initialScroll = await tree.evaluate(el => el.scrollTop);

		// Scroll down in tree
		await tree.evaluate(el => { el.scrollTop += 200; });
		await page.waitForTimeout(200);

		const newScroll = await tree.evaluate(el => el.scrollTop);
		expect(newScroll).toBeGreaterThan(initialScroll);
	});

	test('collapsing settings expands the model list scrollable area', async ({ page }) => {
		await setupMobileFilter(page);

		const collapseBtn = page.locator('.collapse-btn');
		const tree = page.locator('.tree');

		// Get initial tree height
		const initialHeight = await tree.boundingBox().then(box => box?.height || 0);

		// Collapse settings
		await collapseBtn.click();
		await page.waitForTimeout(300);

		// Get new tree height (should be larger now)
		const newHeight = await tree.boundingBox().then(box => box?.height || 0);
		expect(newHeight).toBeGreaterThan(initialHeight);
	});

	test('can scroll models even with settings visible', async ({ page }) => {
		await setupMobileFilter(page);

		const tree = page.locator('.tree');

		// Expand first family to show models
		const firstFamily = page.locator('.fam-row').first();
		if (await firstFamily.isVisible()) {
			await firstFamily.click();
			await page.waitForTimeout(200);
		}

		// Get initial scroll position
		const initialScroll = await tree.evaluate(el => el.scrollTop);

		// Scroll down through models
		await tree.evaluate(el => { el.scrollTop += 300; });
		await page.waitForTimeout(200);

		const newScroll = await tree.evaluate(el => el.scrollTop);
		expect(newScroll).toBeGreaterThan(initialScroll);
	});

	test('no JS errors when toggling collapse and scrolling', async ({ page }) => {
		const errors = [];
		page.on('pageerror', e => errors.push(e.message));
		page.on('console', msg => {
			if (msg.type() === 'error') errors.push(msg.text());
		});

		await setupMobileFilter(page);

		const collapseBtn = page.locator('.collapse-btn');
		const tree = page.locator('.tree');

		// Toggle collapse several times
		for (let i = 0; i < 3; i++) {
			await collapseBtn.click();
			await page.waitForTimeout(200);
		}

		// Scroll in tree
		await tree.evaluate(el => { el.scrollTop += 200; });
		await page.waitForTimeout(100);

		expect(errors).toEqual([]);
	});
});

test.describe('desktop sidebar (no collapse button)', () => {
	test.use({ viewport: DESKTOP_VIEWPORT });

	test('collapse button is NOT visible on desktop', async ({ page }) => {
		await setup(page);
		const collapseBtn = page.locator('.collapse-btn');
		await expect(collapseBtn).not.toBeVisible();
	});
});
