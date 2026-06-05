import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import defaultAttributes from 'lucide/dist/esm/defaultAttributes.mjs';
import ActivityIcon from 'lucide/dist/esm/icons/activity.mjs';

const ICON_NAME = 'activity';
const OUTPUT_DIR = 'static';
const BASE = '/livebenchviz';          // matches svelte.config.js paths.base

if (!fs.existsSync(OUTPUT_DIR)) {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Build a raw SVG string from a lucide icon data tuple and the default attributes.
 * @param {object} attrs - defaultAttributes from lucide
 * @param {Array<Array<string, object>>} iconNode - e.g. [["path", { d: "..." }]]
 * @returns {string} SVG markup
 */
function buildSvg(attrs, iconNode) {
	const attrStr = Object.entries(attrs)
		.map(([k, v]) => `${k}="${v}"`)
		.join(' ');

	const children = iconNode
		.map(([tag, props]) => {
			const propStr = Object.entries(props)
				.map(([k, v]) => `${k}="${v}"`)
				.join(' ');
			return `<${tag} ${propStr} />`;
		})
		.join('\n  ');

	return `<svg ${attrStr}>\n  ${children}\n</svg>`;
}

/**
 * Icon definitions: filename → size.
 * Naming convention:  icon-{W}x{H}.png
 *   - Browser / desktop:  icon-16x16, icon-32x32
 *   - Apple touch:         icon-180x180
 *   - Android / PWA:      icon-192x192, icon-512x512
 */
const ICON_SIZES = {
	'icon-16x16.png':    16,
	'icon-32x32.png':    32,
	'icon-180x180.png': 180,
	'icon-192x192.png': 192,
	'icon-512x512.png': 512,
};

async function generateFavicons() {
	try {
		const iconNode = ActivityIcon.default ?? ActivityIcon;
		const svgString = buildSvg(defaultAttributes.default ?? defaultAttributes, iconNode);
		const svgBuffer = Buffer.from(svgString);

		console.log(`Generating icons from lucide icon "${ICON_NAME}"...`);

		// 1. Generate PNGs
		for (const [filename, size] of Object.entries(ICON_SIZES)) {
			await sharp(svgBuffer)
				.resize(size, size)
				.flatten({ background: 'palegreen' })
				.png()
				.toFile(path.join(OUTPUT_DIR, filename));
			console.log(`  ✓ ${filename} (${size}×${size})`);
		}

		// 2. favicon.ico (32×32 PNG-in-ICO — widely supported)
		await sharp(svgBuffer)
			.resize(32, 32)
			.flatten({ background: 'palegreen' })
			.png()
			.toFile(path.join(OUTPUT_DIR, 'favicon.ico'));
		console.log('  ✓ favicon.ico (32×32)');

		// 3. site.webmanifest
		const manifest = {
			name: 'LiveBench Viz — LLM Benchmark Dashboard',
			short_name: 'LiveBench',
			description: 'Interactive dashboard for comparing LLM benchmark scores across models, families, and evaluation dates.',
			start_url: `${BASE}/`,
			scope: `${BASE}/`,
			display: 'standalone',
			orientation: 'any',
			theme_color: '#0f1117',
			background_color: '#0f1117',
			icons: [
				{ src: `${BASE}/icon-192x192.png`, sizes: '192x192', type: 'image/png' },
				{ src: `${BASE}/icon-512x512.png`, sizes: '512x512', type: 'image/png' },
				{ src: `${BASE}/icon-180x180.png`, sizes: '180x180', type: 'image/png' },
				{ src: `${BASE}/icon-32x32.png`,   sizes: '32x32',   type: 'image/png' },
				{ src: `${BASE}/icon-16x16.png`,   sizes: '16x16',   type: 'image/png' },
			],
		};
		fs.writeFileSync(path.join(OUTPUT_DIR, 'site.webmanifest'), JSON.stringify(manifest, null, 2));
		console.log('  ✓ site.webmanifest');

		console.log('\nAll icons generated successfully in static/ directory.');
	} catch (error) {
		console.error('Error generating icons:', error);
		process.exit(1);
	}
}

generateFavicons();
