import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import defaultAttributes from 'lucide/dist/esm/defaultAttributes.mjs';
import ActivityIcon from 'lucide/dist/esm/icons/activity.mjs';

const ICON_NAME = 'activity';
const OUTPUT_DIR = 'static';

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

async function generateFavicons() {
	try {
		// lucide ESM default exports are arrays: [[tag, {attrs}], ...]
		const iconNode = ActivityIcon.default ?? ActivityIcon;
		const svgString = buildSvg(defaultAttributes.default ?? defaultAttributes, iconNode);
		const svgBuffer = Buffer.from(svgString);

		console.log(`Generating favicons from lucide icon "${ICON_NAME}"...`);

		// 1. Generate PNGs
		await sharp(svgBuffer)
			.resize(32, 32)
			.png()
			.toFile(path.join(OUTPUT_DIR, 'favicon-32x32.png'));

		await sharp(svgBuffer)
			.resize(16, 16)
			.png()
			.toFile(path.join(OUTPUT_DIR, 'favicon-16x16.png'));

		await sharp(svgBuffer)
			.resize(180, 180)
			.png()
			.toFile(path.join(OUTPUT_DIR, 'apple-touch-icon.png'));

		// 2. Simple favicon.ico (32x32 PNG — widely supported)
		await sharp(svgBuffer)
			.resize(32, 32)
			.png()
			.toFile(path.join(OUTPUT_DIR, 'favicon.ico'));

		// 3. site.webmanifest
		const manifest = {
			name: 'LiveBench Viz',
			short_name: 'LiveBench',
			icons: [
				{ src: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
				{ src: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
				{ src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
			],
			theme_color: '#ffffff',
			background_color: '#ffffff',
			display: 'standalone'
		};
		fs.writeFileSync(path.join(OUTPUT_DIR, 'site.webmanifest'), JSON.stringify(manifest, null, 2));

		console.log('Favicons generated successfully in static/ directory.');
	} catch (error) {
		console.error('Error generating favicons:', error);
		process.exit(1);
	}
}

generateFavicons();