/**
 * compareModels.ts
 * Compares OpenRouter model availability with LiveBench benchmark scores.
 * Outputs out/coverage_matrix.html — a Plotly heatmap for visual inspection.
 *
 * The heatmap rows are models present in EITHER source.
 * Columns are LiveBench categories + an "on_openrouter" indicator column.
 * Cell value = score (0–100) for LB models, NaN for missing.
 *
 * Run:  pnpm run compare
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'out');
const LB_FILE   = path.join(OUT_DIR, 'livebench_scores.json');
const OR_FILE   = path.join(OUT_DIR, 'openrouter_models.json');
const OUT_HTML  = path.join(OUT_DIR, 'coverage_matrix.html');

// ── Types ──────────────────────────────────────────────────────────────────
interface LBModel  { id: string; scores: Record<string, number>; n_categories: number }
interface LBData   { categories: string[]; models: LBModel[]; n_models: number }
interface ORModel  { id: string; name: string }
interface ORData   { models: ORModel[]; n_models: number }

// ── Match heuristic: OpenRouter id → LB model id ──────────────────────────────────
// OpenRouter ids look like "anthropic/claude-3-5-sonnet-20241022"
// LB ids look like "claude-3-5-sonnet-20241022"
function findLBMatch(orId: string, lbIds: Set<string>): string | null {
  const slug = orId.split('/').pop()!.toLowerCase();
  if (lbIds.has(slug)) return slug;
  // Also try exact
  if (lbIds.has(orId)) return orId;
  // Partial: find LB id that contains slug or vice versa
  for (const lb of lbIds) {
    if (lb.includes(slug) || slug.includes(lb)) return lb;
  }
  return null;
}

function tok(s: string | null | undefined): number {
  return s ? parseFloat(s) * 1e6 : 0;
}

// ── HTML template ──────────────────────────────────────────────────────────
function buildHTML(
  categories:   string[],
  rows:         Array<{ label: string; orId: string | null; lbId: string | null; scores: (number | null)[]; onOR: boolean }>,
  stats:        Record<string, unknown>
): string {
  // Heatmap data: z[row][col] = score or null
  const labels     = rows.map(r => r.label);
  const zScores    = rows.map(r => r.scores.map(s => s ?? null));
  const zOR        = rows.map(r => r.onOR ? 1 : 0);

  // Custom hovertext
  const hovertext = rows.map((r, ri) =>
    categories.map((cat, ci) => {
      const s = r.scores[ci];
      const or = r.onOR ? '✅ on OpenRouter' : '❌ not on OpenRouter';
      return `<b>${r.label}</b><br>Category: ${cat}<br>Score: ${s != null ? s.toFixed(1) + '%' : '—'}<br>${or}`;
    })
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>LiveBench × OpenRouter Coverage Matrix</title>
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
<style>
  body { margin: 0; background: #0f1117; color: #e2e8f0; font-family: Inter, system-ui, sans-serif; }
  h1   { text-align: center; padding: 24px 0 4px; font-size: 20px; color: #818cf8; }
  .sub { text-align: center; color: #6b7280; font-size: 13px; margin-bottom: 16px; }
  .stats { display: flex; gap: 24px; justify-content: center; padding: 0 0 20px; flex-wrap: wrap; }
  .stat  { background: #1a1d27; border: 1px solid #2e3250; border-radius: 8px; padding: 10px 20px; text-align: center; }
  .stat-val  { font-size: 24px; font-weight: 700; color: #e2e8f0; }
  .stat-lbl  { font-size: 12px; color: #6b7280; margin-top: 2px; }
  #heatmap, #bar { width: 100%; }
</style>
</head>
<body>
<h1>LiveBench × OpenRouter — Coverage Matrix</h1>
<p class="sub">Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</p>

<div class="stats">
  <div class="stat"><div class="stat-val">${(stats.n_lb_models as number)}</div><div class="stat-lbl">LiveBench models</div></div>
  <div class="stat"><div class="stat-val">${(stats.n_or_models as number)}</div><div class="stat-lbl">OpenRouter models</div></div>
  <div class="stat"><div class="stat-val">${(stats.n_both as number)}</div><div class="stat-lbl">in both (matchable)</div></div>
  <div class="stat"><div class="stat-val">${(stats.n_full_coverage as number)}</div><div class="stat-lbl">full LB coverage</div></div>
  <div class="stat"><div class="stat-val">${(stats.n_categories as number)}</div><div class="stat-lbl">categories</div></div>
</div>

<div id="heatmap"></div>
<div id="bar"></div>

<script>
const labels     = ${JSON.stringify(labels)};
const categories = ${JSON.stringify(categories)};
const z          = ${JSON.stringify(zScores)};
const onOR       = ${JSON.stringify(zOR)};
const hovertext  = ${JSON.stringify(hovertext)};

// ── Heatmap ──────────────────────────────────────────────────────────────
Plotly.newPlot('heatmap', [{
  type: 'heatmap',
  x: categories,
  y: labels,
  z: z,
  text: hovertext,
  hoverinfo: 'text',
  colorscale: [
    [0,    '#1e293b'],
    [0.01, '#312e81'],
    [0.5,  '#6366f1'],
    [0.75, '#a5b4fc'],
    [1,    '#e0e7ff'],
  ],
  zmin: 0, zmax: 100,
  showscale: true,
  colorbar: { title: 'Score %', tickfont: { color: '#8892a4' }, titlefont: { color: '#8892a4' } },
  xgap: 1, ygap: 1,
}], {
  paper_bgcolor: '#0f1117',
  plot_bgcolor:  '#0f1117',
  font:  { color: '#e2e8f0', size: 11 },
  xaxis: { title: 'LiveBench Category', tickfont: { size: 12 }, side: 'top' },
  yaxis: { title: '', automargin: true, tickfont: { size: 10 }, autorange: 'reversed' },
  margin: { t: 60, r: 80, b: 20, l: 240 },
  height: Math.max(500, labels.length * 16 + 120),
  shapes: labels.map((_, i) => onOR[i] ? null : ({
    type: 'rect', xref: 'paper', yref: 'y',
    x0: 0, x1: 1, y0: i - 0.5, y1: i + 0.5,
    fillcolor: 'rgba(239,68,68,0.08)', line: { width: 0 },
  })).filter(Boolean),
}, { responsive: true });

// ── Bar: OpenRouter coverage per LB category ─────────────────────────────────────
const catCounts = categories.map((_, ci) =>
  z.filter((row, ri) => row[ci] != null && onOR[ri]).length
);
Plotly.newPlot('bar', [{
  type: 'bar',
  x: categories,
  y: catCounts,
  marker: { color: '#6366f1' },
  text: catCounts.map(n => String(n)),
  textposition: 'outside',
  hovertemplate: '%{x}<br>%{y} models in both LB + OpenRouter<extra></extra>',
}], {
  paper_bgcolor: '#0f1117',
  plot_bgcolor:  '#1a1d27',
  font:  { color: '#e2e8f0' },
  xaxis: { tickfont: { size: 12 } },
  yaxis: { title: 'Models with scores AND on OpenRouter', gridcolor: '#2e3250' },
  title: { text: 'Models available on both LiveBench and OpenRouter, per category', font: { color: '#818cf8' } },
  margin: { t: 60, r: 40, b: 60, l: 80 },
  height: 320,
}, { responsive: true });
</script>
</body>
</html>`;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const lb: LBData = JSON.parse(readFileSync(LB_FILE, 'utf8'));
  const or: ORData = JSON.parse(readFileSync(OR_FILE, 'utf8'));

  const lbIds  = new Set(lb.models.map(m => m.id));
  const lbMap  = new Map(lb.models.map(m => [m.id, m]));
  const orIds  = new Set(or.models.map(m => m.id));
  const orMap  = new Map(or.models.map(m => [m.id, m]));

  // ── Build union of models to show ───────────────────────────────────────
  // Only show LB models (those are the ones with scores — OpenRouter-only models
  // have no benchmark data to display). Sort by: on OR first, then coverage desc.
  const rows = lb.models.map(lbm => {
    const lbId = lbm.id;
    const orId = (() => {
          // Try to find an OpenRouter model whose slug matches this LB id
          for (const o of or.models) {
            const slug = o.id.split('/').pop()!.toLowerCase();
            if (slug === lbId || lbId.includes(slug) || slug.includes(lbId)) return o.id;
          }
          return null;
        })();

    const onOR   = orId !== null;
    const scores = lb.categories.map(cat => lbm.scores[cat] ?? null);

    // Friendly label: prefer "provider/name" form when on OpenRouter
    const label = orId
      ? orId.split('/').slice(0, 2).join('/').replace(/^[^/]+\//, '')  // just the model slug
      : lbId;

    return { label: lbId, orId, lbId, scores, onOR };
  });

  // Sort: on OpenRouter first, then by n_categories desc, then by mean score desc
  rows.sort((a, b) => {
    if (a.onOR !== b.onOR) return a.onOR ? -1 : 1;
    const lbA = lbMap.get(a.lbId)!;
    const lbB = lbMap.get(b.lbId)!;
    if (lbB.n_categories !== lbA.n_categories) return lbB.n_categories - lbA.n_categories;
    const meanA = Object.values(lbA.scores).reduce((x, y) => x + y, 0) / (lbA.n_categories || 1);
    const meanB = Object.values(lbB.scores).reduce((x, y) => x + y, 0) / (lbB.n_categories || 1);
    return meanB - meanA;
  });

  // ── Stats ─────────────────────────────────────────────────────────────
  const nBoth        = rows.filter(r => r.onOR).length;
  const nFullCov     = rows.filter(r => r.onOR && r.scores.every(s => s !== null)).length;

  const stats = {
    n_lb_models:    lb.n_models,
    n_or_models:    or.n_models,
    n_both:         nBoth,
    n_full_coverage: nFullCov,
    n_categories:   lb.categories.length,
  };

  console.log(`\n📊  Coverage summary`);
  console.log(`   LiveBench models   : ${lb.n_models}`);
  console.log(`   OpenRouter models  : ${or.n_models}`);
  console.log(`   Matchable (in both): ${nBoth}`);
  console.log(`   Full coverage + OpenRouter : ${nFullCov}`);
  console.log(`   Categories         : ${lb.categories.join(', ')}`);

  // Per-category: how many LB models are also on OpenRouter
  for (const cat of lb.categories) {
    const withScore = rows.filter(r => r.onOR && r.scores[lb.categories.indexOf(cat)] !== null);
    console.log(`   ${cat.padEnd(25)} ${withScore.length} models in both`);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const html = buildHTML(lb.categories, rows, stats);
  writeFileSync(OUT_HTML, html, 'utf8');
  console.log(`\n✅  ${OUT_HTML}`);
  console.log(`    Open in browser to explore the matrix.`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
