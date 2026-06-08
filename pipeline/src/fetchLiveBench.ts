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

import { writeFileSync, existsSync, readFileSync, copyFileSync, readdirSync } from 'fs';
import { mkdir }  from 'fs/promises';
import path       from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'out');
const OUT_FILE        = path.join(OUT_DIR, 'livebench.csv');
const CATEGORIES_FILE = path.join(OUT_DIR, 'livebench_categories.json');
const RELEASE_FILE    = path.join(OUT_DIR, 'livebench_release.txt');

const REPO_DIR = path.join(__dirname, '..', 'livebench_repo');
const SITE_REPO_URL = 'https://github.com/LiveBench/livebench.github.io.git';

function getLatestReleaseFromRepo(repoDir: string): string {
  const publicDir = path.join(repoDir, 'public');
  const files = readdirSync(publicDir);
  const tables = files
    .filter(f => /^table_\d{4}_\d{2}_\d{2}\.csv$/.test(f))
    .map(f => f.replace('table_', '').replace('.csv', ''))
    .sort();
  if (!tables.length) throw new Error('No table_*.csv files found in livebench_repo/public');
  return tables[tables.length - 1];
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let gitFailed = false;
  if (!existsSync(REPO_DIR)) {
    console.log(`📥  Cloning LiveBench repository to ${REPO_DIR} …`);
    try {
      execSync(`git clone ${SITE_REPO_URL} "${REPO_DIR}"`, { stdio: 'inherit' });
      console.log('✅  Repository cloned successfully.');
    } catch (e: any) {
      console.error(`⚠️  Failed to clone repository: ${e.message}`);
      gitFailed = true;
    }
  } else {
    console.log(`📥  Updating LiveBench repository in ${REPO_DIR} …`);
    try {
      execSync(`git -C "${REPO_DIR}" pull`, { stdio: 'inherit' });
      console.log('✅  Repository updated successfully.');
    } catch (e: any) {
      console.error(`⚠️  Failed to pull repository updates: ${e.message}`);
      gitFailed = true;
    }
  }

  // If Git failed and we don't have the cached files/repo, we cannot proceed.
  if (gitFailed && !existsSync(REPO_DIR) && (!existsSync(OUT_FILE) || !existsSync(CATEGORIES_FILE))) {
    throw new Error('Git repository clone/pull failed, and no cached LiveBench files exist.');
  }

  let release: string;
  if (gitFailed) {
    if (existsSync(REPO_DIR)) {
      release = getLatestReleaseFromRepo(REPO_DIR);
    } else if (existsSync(RELEASE_FILE)) {
      release = readFileSync(RELEASE_FILE, 'utf8').trim();
    } else {
      throw new Error('Unable to determine release date.');
    }
    console.log(`⚠️  Using local/cached files (release ${release}) due to git error.`);
  } else {
    release = getLatestReleaseFromRepo(REPO_DIR);
  }

  const repoCsvPath = path.join(REPO_DIR, 'public', `table_${release}.csv`);
  const repoCategoriesPath = path.join(REPO_DIR, 'public', `categories_${release}.json`);

  // Copy local CSV to out/
  if (existsSync(repoCsvPath)) {
    copyFileSync(repoCsvPath, OUT_FILE);
    const csvContent = readFileSync(OUT_FILE, 'utf8');
    const rows = csvContent.trim().split('\n').length - 1;
    writeFileSync(RELEASE_FILE, release, 'utf8');
    console.log(`✅  Saved  →  ${OUT_FILE}  (${rows} models, release ${release}, ${(csvContent.length / 1024).toFixed(0)} KB)`);
  } else {
    if (!existsSync(OUT_FILE)) {
      throw new Error(`CSV file not found at ${repoCsvPath}`);
    }
    console.log(`✅  Using existing  →  ${OUT_FILE}`);
  }

  // Copy local categories JSON to out/
  if (existsSync(repoCategoriesPath)) {
    copyFileSync(repoCategoriesPath, CATEGORIES_FILE);
    const categoriesJson = readFileSync(CATEGORIES_FILE, 'utf8');
    const categoryCount = Object.keys(JSON.parse(categoriesJson)).length;
    console.log(`✅  Saved  →  ${CATEGORIES_FILE}  (${categoryCount} categories)`);
  } else {
    if (!existsSync(CATEGORIES_FILE)) {
      throw new Error(`Categories file not found at ${repoCategoriesPath}`);
    }
    console.log(`✅  Using existing  →  ${CATEGORIES_FILE}`);
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
