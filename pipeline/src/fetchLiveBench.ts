/**
 * fetchLiveBench.ts
 * Downloads the latest LiveBench leaderboard CSV from the livebench.github.io
 * public repository (the same source used by livebench.ai).
 *
 * The HuggingFace parquet (livebench/model_judgment) stopped receiving updates
 * after April 2025. The official source is now the GitHub Pages site repo at
 * https://github.com/LiveBench/livebench.github.io which contains per-release
 * CSV files at public/table_YYYY_MM_DD.csv.
 *
 * Output: out/livebench.csv              (cached — skipped if already present)
 *         out/livebench_categories.json  (category→tasks mapping, same release)
 *         out/livebench_release.txt      (the release date string, e.g. "2026_01_08")
 *
 * Run:  pnpm run fetch:livebench
 *       pnpm run fetch:livebench -- --force
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { mkdir }  from 'fs/promises';
import path       from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'out');
const OUT_FILE        = path.join(OUT_DIR, 'livebench.csv');
const CATEGORIES_FILE = path.join(OUT_DIR, 'livebench_categories.json');
const RELEASE_FILE    = path.join(OUT_DIR, 'livebench_release.txt');

// GitHub Pages source for LiveBench leaderboard data.
// The HF parquet (livebench/model_judgment) stopped updating after April 2025.
const SITE_REPO = 'https://raw.githubusercontent.com/LiveBench/livebench.github.io/main/public';
const TREE_API  = 'https://api.github.com/repos/LiveBench/livebench.github.io/git/trees/main?recursive=1';

const force = process.argv.includes('--force');

/** Fetch the directory listing and return the latest table_*.csv filename. */
async function getLatestRelease(): Promise<string> {
  const res = await fetch(TREE_API, {
    headers: { 'User-Agent': 'choosy-pipeline/1.0' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`GitHub tree API: HTTP ${res.status}`);
  const tree = await res.json() as { tree: Array<{ path: string }> };
  const tables = tree.tree
    .map(f => f.path)
    .filter(p => /^public\/table_\d{4}_\d{2}_\d{2}\.csv$/.test(p))
    .map(p => p.replace('public/table_', '').replace('.csv', ''))  // e.g. "2026_01_08"
    .sort();
  if (!tables.length) throw new Error('No table_*.csv files found in livebench.github.io');
  const latest = tables[tables.length - 1];
  console.log(`    Available releases: ${tables.join(', ')}`);
  return latest;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  if (existsSync(OUT_FILE) && existsSync(CATEGORIES_FILE) && !force) {
    const release = existsSync(RELEASE_FILE) ? readFileSync(RELEASE_FILE, 'utf8').trim() : '(unknown)';
    const { size } = (await import('fs')).statSync(OUT_FILE);
    console.log(`✅  Cached  →  ${OUT_FILE}  (${(size / 1024).toFixed(0)} KB, release ${release})`);
    console.log('    Use --force to re-download.');
    return;
  }

  console.log('📥  Finding latest LiveBench release via GitHub API …');
  const release = await getLatestRelease();
  const csvUrl  = `${SITE_REPO}/table_${release}.csv`;

  console.log(`📥  Downloading LiveBench ${release} …`);
  console.log(`    ${csvUrl}`);

  const res = await fetch(csvUrl, {
    headers: { 'User-Agent': 'choosy-pipeline/1.0' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const csv = await res.text();
  const rows = csv.trim().split('\n').length - 1;  // minus header

  writeFileSync(OUT_FILE, csv, 'utf8');
  writeFileSync(RELEASE_FILE, release, 'utf8');
  console.log(`✅  Saved  →  ${OUT_FILE}  (${rows} models, release ${release}, ${(csv.length / 1024).toFixed(0)} KB)`);
  console.log(`    Note: ${release.replace(/_/g, '-')} is the benchmark question set release date,`);
  console.log(`    not a model release date. LiveBench evaluates models against this question set.`);

  // Fetch the matching categories JSON (same release date as the CSV)
  const categoriesUrl = `${SITE_REPO}/categories_${release}.json`;
  console.log(`\n📥  Downloading LiveBench categories ${release} …`);
  console.log(`    ${categoriesUrl}`);
  const catRes = await fetch(categoriesUrl, {
    headers: { 'User-Agent': 'choosy-pipeline/1.0' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!catRes.ok) throw new Error(`Categories fetch: HTTP ${catRes.status} ${catRes.statusText}`);
  const categoriesJson = await catRes.text();
  writeFileSync(CATEGORIES_FILE, categoriesJson, 'utf8');
  const categoryCount = Object.keys(JSON.parse(categoriesJson)).length;
  console.log(`✅  Saved  →  ${CATEGORIES_FILE}  (${categoryCount} categories)`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
