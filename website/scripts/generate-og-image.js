#!/usr/bin/env node

/**
 * generate-og-image.js
 *
 * Takes a screenshot of a running LiveBench Viz instance and processes it
 * into an og-image.png (1200×630, PNG) for social media previews.
 *
 * This script does NOT start or stop any server — orchestration is in npm scripts
 * using start-server-and-test:
 *
 *   npm run build:og              # build, then screenshot from the preview server
 *   npm run og:dev                 # start dev server, screenshot, shut down
 *   npm run generate-og-image      # screenshot whatever is at the default URL
 *
 * Flags:
 *   --url <url>       custom URL to screenshot
 *   --copy-to-build   copy the result into build/ (used by build:og)
 *   --keep-full       also save the raw full-resolution screenshot
 */

import sharp from 'sharp';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync, copyFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STATIC = path.join(ROOT, 'static', 'og-image.png');
const BUILD_DIR = path.join(ROOT, 'build');

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argUrl = args.find((a, i) => a === '--url' && args[i + 1]) ? args[args.indexOf('--url') + 1] : null;
const keepFull = args.includes('--keep-full');
const copyToBuild = args.includes('--copy-to-build');

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const VIEWPORT_WIDTH = 1440;
const VIEWPORT_HEIGHT = Math.round(VIEWPORT_WIDTH / (OG_WIDTH / OG_HEIGHT)); // 754
const DEFAULT_URL = 'http://localhost:5174/livebenchviz/';
const SCREENSHOT_URL = argUrl || DEFAULT_URL;

// ── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
	console.log('📸  OG Image Generator\n');
	console.log(`   Viewport: ${VIEWPORT_WIDTH}×${VIEWPORT_HEIGHT} (ratio ${(VIEWPORT_WIDTH / VIEWPORT_HEIGHT).toFixed(4)}, target ${(OG_WIDTH / OG_HEIGHT).toFixed(4)})`);
	console.log(`   URL:      ${SCREENSHOT_URL}\n`);

	// ── 1. Screenshot ──────────────────────────────────────────────────────────
	console.log('   Taking screenshot…');
	let screenshotBuffer;
	try {
		const browser = await chromium.launch({ headless: true });
		const page = await browser.newPage({
			viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
			deviceScaleFactor: 2,
		});

		await page.goto(SCREENSHOT_URL, { waitUntil: 'networkidle' });

		await page.waitForSelector('.loading', { state: 'hidden', timeout: 15_000 }).catch(() => {
			return page.waitForSelector('main', { timeout: 10_000 });
		});

		// Extra settle time for D3 render + transitions
		await sleep(2000);

		screenshotBuffer = await page.screenshot({ type: 'png' });

		if (keepFull) {
			const fullOut = path.join(ROOT, 'static', 'og-image-full.png');
			await sharp(screenshotBuffer).toFile(fullOut);
			console.log(`   Full screenshot saved: ${path.relative(ROOT, fullOut)}`);
		}

		console.log('   Screenshot captured.\n');
		await browser.close();
	} catch (err) {
		console.error('❌  Screenshot failed:', err.message);
		process.exit(1);
	}

	// ── 2. Process into OG image ───────────────────────────────────────────────
	console.log(`   Processing → ${OG_WIDTH}×${OG_HEIGHT} PNG`);

	try {
		await sharp(screenshotBuffer)
			.resize(OG_WIDTH, OG_HEIGHT, { fit: 'inside', withoutEnlargement: false })
			.png({ compressionLevel: 6, effort: 7 })
			.toFile(STATIC);

		const metadata = await sharp(STATIC).metadata();
		const sizeKB = (await import('fs')).statSync(STATIC).size / 1024;

		console.log(`   Dimensions: ${metadata.width}×${metadata.height}`);
		console.log(`   File size:  ${sizeKB.toFixed(1)} KB\n`);
	} catch (err) {
		console.error('❌  Image processing failed:', err.message);
		process.exit(1);
	}

	// ── 3. Copy to build/ if requested ────────────────────────────────────────
	if (copyToBuild) {
		if (!existsSync(BUILD_DIR)) {
			console.error(`❌  build/ directory not found — run "npm run build" first.`);
			process.exit(1);
		}
		const buildDest = path.join(BUILD_DIR, 'og-image.png');
		copyFileSync(STATIC, buildDest);
		console.log(`   Copied → ${path.relative(ROOT, buildDest)}\n`);
	}

	console.log(`✅  Saved → ${path.relative(ROOT, STATIC)}`);
	console.log(`    Use this as your social media preview image.\n`);
}

main();