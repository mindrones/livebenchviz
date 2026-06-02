/**
 * copyToWebsite.ts
 * Copies pipeline output JSONs → ../website/static/
 *
 * Files copied:
 *   benchmark_lb.json  → benchmark_lb.json  (all LB models; openRouterId set where matched)
 *
 * Run:  pnpm run copy:website
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR    = path.join(__dirname, '..', 'out');
const DEST_DIR   = path.join(__dirname, '..', '..', 'website', 'static');

interface CopySpec {
  src:      string;
  dest:     string;
  required: boolean;
}

const FILES: CopySpec[] = [
  { src: 'benchmark_lb.json', dest: 'benchmark_lb.json', required: true  },
  { src: 'inference.json',    dest: 'inference.json',    required: false },
];

async function main() {
  if (!existsSync(DEST_DIR)) {
    mkdirSync(DEST_DIR, { recursive: true });
    console.log(`📁  Created ${DEST_DIR}`);
  }

  let copied = 0, skipped = 0;

  for (const spec of FILES) {
    const srcPath  = path.join(OUT_DIR, spec.src);
    const destPath = path.join(DEST_DIR, spec.dest);

    if (!existsSync(srcPath)) {
      if (spec.required) {
        console.error(`❌  Required source not found: ${srcPath}`);
        console.error('    Run: pnpm run merge  first');
        process.exit(1);
      } else {
        console.log(`⚠️   Skipping ${spec.src} (not yet generated)`);
        skipped++;
        continue;
      }
    }

    const data = readFileSync(srcPath, 'utf8');
    const json = JSON.parse(data) as {
      modelCount?: number;
      generated?:  string;
      dataset?:    string;
      openRouterOnly?: boolean;
    };

    writeFileSync(destPath, data, 'utf8');

    const label = json.dataset
      ? `dataset:${json.dataset} openRouterOnly:${json.openRouterOnly}`
      : 'legacy';

    console.log(`✅  ${spec.src.padEnd(32)} → ${spec.dest.padEnd(32)} [${label}  models:${json.modelCount ?? '?'}]`);
    copied++;
  }

  console.log(`\n   Copied: ${copied}  Skipped: ${skipped}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
