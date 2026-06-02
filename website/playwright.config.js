// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	testMatch: '**/*.spec.js',
	timeout: 20_000,
	retries: 0,

	use: {
		baseURL: 'http://localhost:5174',
		headless: true,
		actionTimeout: 8_000,
		navigationTimeout: 15_000,
	},

	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

	// Use existing dev server; start it automatically if not running.
	webServer: {
		command: 'npm run dev -- --port 5174',
		port: 5174,
		reuseExistingServer: true,
		timeout: 30_000,
	},

	reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
});
