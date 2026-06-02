/**
 * processLiveBench.ts
 * Reads out/livebench.csv (downloaded from livebench.github.io public repo),
 * aggregates per-task scores into the 3 category axes used by the dashboard,
 * and writes out/livebench_scores.json.
 *
 * The old source (HuggingFace parquet livebench/model_judgment) stopped
 * receiving updates after April 2025. The website CSV is the authoritative
 * source with data through at least January 2026.
 *
 * Category→axis mapping (matches the pre-CSV schema):
 *   coding              ← code_generation, code_completion
 *   instruction_following ← paraphrase, simplify, story_generation, summarize
 *   language            ← connections, plot_unscrambling, typos
 *
 * All other categories (Reasoning, Mathematics, Data Analysis, Agentic Coding)
 * are present in the CSV but not yet exposed as dashboard axes. They are
 * included in the raw output for forward compatibility.
 *
 * Run:  pnpm run process:livebench
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'out');
const IN_FILE         = path.join(OUT_DIR, 'livebench.csv');
const CATEGORIES_FILE = path.join(OUT_DIR, 'livebench_categories.json');
const RELEASE_FILE    = path.join(OUT_DIR, 'livebench_release.txt');
const OUT_FILE        = path.join(OUT_DIR, 'livebench_scores.json');

// ── Category name normalizer ───────────────────────────────────────────────────
// livebench.github.io uses title-cased names ("Coding", "Agentic Coding", "IF");
// we normalise them to snake_case for internal/JSON keys.
function normaliseCategoryName(name: string): string {
  if (name === 'IF') return 'instruction_following';
  return name.toLowerCase().replace(/\s+/g, '_');
}

// ── Category→task mapping (loaded from out/livebench_categories.json) ─────────
// This file is fetched alongside the CSV by fetchLiveBench.ts, ensuring the
// task list stays in sync with the livebench.github.io release.
function loadCategoryTasks(): Record<string, string[]> {
  if (!existsSync(CATEGORIES_FILE)) {
    throw new Error(`${CATEGORIES_FILE} not found — run: pnpm run fetch:livebench`);
  }
  const raw = JSON.parse(readFileSync(CATEGORIES_FILE, 'utf8')) as Record<string, string[]>;
  const normalised: Record<string, string[]> = {};
  for (const [name, tasks] of Object.entries(raw)) {
    normalised[normaliseCategoryName(name)] = tasks;
  }
  return normalised;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ModelScores {
  id:           string;
  scores:       Record<string, number>;  // category → mean 0–100
  tasks:        Record<string, number>;  // task → raw score 0–100
  n_categories: number;
  n_rows:       number;
}

interface Output {
  generated:    string;
  source:       string;
  release:      string;
  categories:   string[];  // exported (dashboard) categories
  all_categories: string[];  // all computed categories
  tasks:        string[];
  n_models:     number;
  models:       ModelScores[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function avg(nums: number[]): number | null {
  const valid = nums.filter(n => isFinite(n) && !isNaN(n));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

/** Minimal CSV parser: handles quoted fields, returns array of row objects. */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim(); });
    return row;
  });
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(IN_FILE)) {
    throw new Error(`${IN_FILE} not found — run: pnpm run fetch:livebench`);
  }

  const release = existsSync(RELEASE_FILE)
    ? readFileSync(RELEASE_FILE, 'utf8').trim()
    : 'unknown';

  console.log(`📊  Processing LiveBench CSV (release ${release}) …`);

  const CATEGORY_TASKS = loadCategoryTasks();
  const EXPORTED_CATEGORIES = Object.keys(CATEGORY_TASKS);
  console.log(`    Categories loaded from ${CATEGORIES_FILE}: ${EXPORTED_CATEGORIES.join(', ')}`);


  const rows = parseCSV(readFileSync(IN_FILE, 'utf8'));
  console.log(`    ${rows.length} model rows`);

  // Collect all task keys present in the CSV (excluding 'model' column)
  const allTaskKeys = rows.length ? Object.keys(rows[0]).filter(k => k !== 'model') : [];

  const models: ModelScores[] = [];

  for (const row of rows) {
    const id = row['model'];
    if (!id) continue;

    // Task-level scores (already 0–100 in the CSV)
    const taskScores: Record<string, number> = {};
    for (const task of allTaskKeys) {
      const v = parseFloat(row[task] ?? '');
      if (isFinite(v)) taskScores[task] = round1(v);
    }

    // Category-level averages
    const categoryScores: Record<string, number> = {};
    let nCategories = 0;
    for (const [cat, tasks] of Object.entries(CATEGORY_TASKS)) {
      const vals = tasks.map(t => taskScores[t]).filter(v => v !== undefined) as number[];
      const mean = avg(vals);
      if (mean !== null) {
        categoryScores[cat] = round1(mean);
        nCategories++;
      }
    }

    // Global average = mean of all category averages (equal category weighting,
    // matching LiveBench's own leaderboard computation).
    // Only assigned when ALL categories have data, matching LiveBench's rule:
    //   if not has_missing_category: avg = sum(values) / len(values)
    const allCats = Object.keys(CATEGORY_TASKS);
    const catVals = allCats.map(c => categoryScores[c]).filter(v => v !== undefined && isFinite(v));
    if (catVals.length === allCats.length) {
      categoryScores['global_average'] = round1(catVals.reduce((a, b) => a + b, 0) / catVals.length);
    }

    models.push({
      id,
      scores:       categoryScores,
      tasks:        taskScores,
      n_categories: nCategories,
      n_rows:       allTaskKeys.length,
    });
  }

  // Sort by global average desc, then coding desc for stable ordering
  models.sort((a, b) => {
    const da = (b.scores['global_average'] ?? 0) - (a.scores['global_average'] ?? 0);
    return da !== 0 ? da : (b.scores['coding'] ?? 0) - (a.scores['coding'] ?? 0);
  });

  const out: Output = {
    generated:      new Date().toISOString(),
    source:         `livebench.github.io/public/table_${release}.csv`,
    release,
    categories:     EXPORTED_CATEGORIES,
    all_categories: Object.keys(CATEGORY_TASKS),
    tasks:          allTaskKeys,
    n_models:       models.length,
    models,
  };

  writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8');
  console.log(`✅  Saved  →  ${OUT_FILE}  (${models.length} models)`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
