/**
 * fetchLiveBenchModelConfig.ts
 *
 * Extracts the full model config from the livebench.ai JS bundle (id, url,
 * organization, displayName, release date) and resolves missing dates via:
 *
 *   1. URL regex  — many announcement URLs encode the date in the path
 *   2. HF API     — huggingface.co model pages → /api/models/{org}/{id}
 *   3. Meta tags  — fetch the announcement page (og:published_time etc.)
 *   4. ID regex   — fall back to extractDate() on the model ID itself
 *
 * Results are cached in out/livebench_model_config.json.  On subsequent runs
 * only NEW model IDs (absent from the cache) are scraped, so the lookup
 * is done once per model for the lifetime of the project.
 *
 * Output: out/livebench_model_config.json
 *
 * Run:  pnpm run fetch:lb-model-config
 *       pnpm run fetch:lb-model-config -- --force   # re-scrape unresolved
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { mkdir } from 'fs/promises';
import path      from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { extractDate } from './shared/dateUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'out');
const OUT_FILE  = path.join(OUT_DIR, 'livebench_model_config.json');

const FORCE = process.argv.includes('--force');

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ModelConfig {
  url:            string;
  organization:   string;
  displayName:    string;
  version:        string | null;  // YYYY-MM-DD, null if unknown
  version_source: 'bundle' | 'variant' | 'url_regex' | 'hf_api' | 'page_meta' | 'id_regex' | 'unknown';
}

export interface ModelConfigCache {
  fetched:    string;
  bundle_url: string;
  models:     Record<string, ModelConfig>;
}

// ── Domains where page-scraping is reliably productive ────────────────────────
// Every other domain is skipped (SPA / blocks bots / returns no meta dates).
const SCRAPABLE_DOMAINS = new Set([
  'blog.google',
  'developers.googleblog.com',
  'qwenlm.github.io',
  'together.ai',
  'www.together.ai',
  'mistral.ai',
  'www.mistral.ai',
  'www.anthropic.com',   // Claude announcement posts have og:published_time
  'x.ai',               // Grok announcement posts
  'qwen.ai',            // Qwen blog (?id= param posts)
  'z.ai',
  'www.z.ai',
  'cohere.com',
  'www.cohere.com',
  'build.nvidia.com',
  'www.kimi.com',
  'mimo.xiaomi.com',
]);

function isScrapable(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return SCRAPABLE_DOMAINS.has(hostname);
  } catch { return false; }
}

// ── URL-based date extraction (zero network cost) ─────────────────────────────
function dateFromUrl(url: string): string | null {
  if (!url) return null;

  // DeepSeek news260424 → 2026-04-24  (6 digits: YY MM DD)
  const news6 = url.match(/news(\d{2})(\d{2})(\d{2})(?:\D|$)/);
  if (news6) return `20${news6[1]}-${news6[2]}-${news6[3]}`;

  // DeepSeek news1226 → infer year from month (MM > current month → prev year)
  // news1226 = Dec 26, most likely 2024 (DeepSeek V3 launch)
  const news4 = url.match(/news(\d{2})(\d{2})(?:\D|$)/);
  if (news4) {
    const mm = parseInt(news4[1], 10);
    const dd = parseInt(news4[2], 10);
    const year = (mm >= 1 && mm <= 6) ? 2025 : 2024; // rough heuristic
    return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }

  // Explicit YYYY-MM-DD in URL path  (e.g. /blog/2025-06-02-title)
  const isoDate = url.match(/\/(20\d{2}-\d{2}-\d{2})[/?#]?/);
  if (isoDate) return isoDate[1];

  // /YYYY/MM/DD/
  const dmy = url.match(/\/(20\d{2})\/(\d{2})\/(\d{2})\//);
  if (dmy) return `${dmy[1]}-${dmy[2]}-${dmy[3]}`;

  // /YYYY/MM/
  const ym = url.match(/\/(20\d{2})\/(\d{2})\//);
  if (ym) return `${ym[1]}-${ym[2]}-01`;

  // ?id=YYYY-MM-DD
  const qDate = url.match(/[?&](?:id|date)=(20\d{2}-\d{2}-\d{2})/);
  if (qDate) return qDate[1];

  return null;
}

// ── HuggingFace API lookup ────────────────────────────────────────────────────
async function dateFromHF(url: string): Promise<string | null> {
  const hfMatch = url.match(/huggingface\.co\/([^/?#]+)\/([^/?#]+)/);
  if (!hfMatch) return null;
  const [, org, model] = hfMatch;
  try {
    const res = await fetch(`https://huggingface.co/api/models/${org}/${model}`, {
      headers: { 'User-Agent': 'choosy-pipeline/1.0' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, string>;
    const date = data['createdAt'] ?? data['lastModified'];
    return date ? date.slice(0, 10) : null;
  } catch { return null; }
}

// ── Page meta-tag scraping ────────────────────────────────────────────────────
async function dateFromPage(url: string): Promise<string | null> {
  if (!isScrapable(url)) return null;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; choosy-pipeline/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('text/html')) return null;
    const html = await res.text();

    for (const pattern of [
      /og:published_time[^>]*content="(20\d{2}-\d{2}-\d{2})/i,
      /article:published_time[^>]*content="(20\d{2}-\d{2}-\d{2})/i,
      /"datePublished"\s*:\s*"(20\d{2}-\d{2}-\d{2})/,
      /"dateCreated"\s*:\s*"(20\d{2}-\d{2}-\d{2})/,
      /name="date"[^>]*content="(20\d{2}-\d{2}-\d{2})/i,
      /<time[^>]+datetime="(20\d{2}-\d{2}-\d{2})/i,
      // Some blog pages have a visible date string near the top
      /"published(?:At|_at|Date)?"\s*:\s*"(20\d{2}-\d{2}-\d{2})/,
    ]) {
      const m = html.match(pattern);
      if (m) return m[1];
    }
    return null;
  } catch { return null; }
}

// ── Local Repo: parse model configs from src/Table/modelLinks.js ──────────────
async function fetchBundle(): Promise<{
  bundleUrl: string;
  configs: Record<string, Omit<ModelConfig, 'version_source'>>;
}> {
  const repoDir = path.join(__dirname, '..', 'livebench_repo');
  const linksPath = path.join(repoDir, 'src', 'Table', 'modelLinks.js');
  
  if (!existsSync(linksPath)) {
    throw new Error(`modelLinks.js not found at ${linksPath}. Did you run fetchLiveBench first?`);
  }
  
  console.log(`📂  Reading local model configs from ${linksPath} …`);
  const srcContent = readFileSync(linksPath, 'utf8');
  
  // Write content to a temp .mjs file so Node's dynamic import can execute it.
  const tempMjsPath = path.join(__dirname, 'temp_modelLinks.mjs');
  writeFileSync(tempMjsPath, srcContent, 'utf8');
  
  let modelLinks: any;
  try {
    const module = await import(pathToFileURL(tempMjsPath).toString());
    modelLinks = module.modelLinks;
  } finally {
    try {
      unlinkSync(tempMjsPath);
    } catch { /* ignore */ }
  }

  const configs: Record<string, Omit<ModelConfig, 'version_source'>> = {};

  for (const [id, info] of Object.entries(modelLinks)) {
    const modelInfo = info as any;
    configs[id] = {
      url: modelInfo.url,
      organization: modelInfo.organization,
      displayName: modelInfo.displayName,
      version: modelInfo.version ?? null,
    };

    // Expand variants → inherit base model's version, organization, and url
    if (modelInfo.variants && Array.isArray(modelInfo.variants)) {
      for (const variant of modelInfo.variants) {
        const varId = variant.rawName;
        if (!configs[varId]) {
          configs[varId] = {
            url: modelInfo.url,
            organization: modelInfo.organization,
            displayName: variant.displayName || `${modelInfo.displayName} (variant)`,
            version: modelInfo.version ?? null,
          };
        } else if (!configs[varId].version) {
          configs[varId].version = modelInfo.version ?? null;
        }
      }
    }
  }

  const withVer = Object.values(configs).filter(c => c.version).length;
  console.log(`    Parsed ${Object.keys(configs).length} model configs (${withVer} with version)`);
  return { bundleUrl: 'local:src/Table/modelLinks.js', configs };
}

// ── Concurrent resolver (max N parallel, polite per domain) ───────────────────
async function resolveDate(
  id: string,
  conf: Omit<ModelConfig, 'version_source'>,
): Promise<{ version: string | null; source: ModelConfig['version_source'] }> {
  // 1. URL regex
  const urlDate = dateFromUrl(conf.url);
  if (urlDate) return { version: urlDate, source: 'url_regex' };

  // 2. HF API (cheap, no HTML parse)
  if (conf.url.includes('huggingface.co/')) {
    const hfDate = await dateFromHF(conf.url);
    if (hfDate) return { version: hfDate, source: 'hf_api' };
  }

  // 3. ID regex
  const idDate = extractDate(id);
  if (idDate) return { version: idDate, source: 'id_regex' };

  // 4. Page meta-tag scrape (only scrapable domains)
  if (isScrapable(conf.url)) {
    const pageDate = await dateFromPage(conf.url);
    if (pageDate) return { version: pageDate, source: 'page_meta' };
  }

  return { version: null, source: 'unknown' };
}

async function resolveAll(
  toResolve: Array<[string, Omit<ModelConfig, 'version_source'>]>,
  CONCURRENCY = 6,
): Promise<Map<string, { version: string | null; source: ModelConfig['version_source'] }>> {
  const results = new Map<string, { version: string | null; source: ModelConfig['version_source'] }>();

  // Group by domain for polite rate-limiting
  const domainLastFetch = new Map<string, number>();
  const MIN_GAP_MS = 500;

  async function processOne(id: string, conf: Omit<ModelConfig, 'version_source'>) {
    // Rate-limit per domain
    let domain = 'unknown';
    try { domain = new URL(conf.url).hostname; } catch { /* ok */ }

    const last = domainLastFetch.get(domain) ?? 0;
    const gap  = Date.now() - last;
    if (gap < MIN_GAP_MS) await sleep(MIN_GAP_MS - gap);
    domainLastFetch.set(domain, Date.now());

    const result = await resolveDate(id, conf);
    results.set(id, result);

    const icon = result.version ? '✓' : '·';
    const label = result.version ? `${result.version} (${result.source})` : 'unknown';
    console.log(`    ${icon} ${id.padEnd(45)} ${label}`);
  }

  // Run with concurrency limit
  const queue = [...toResolve];
  const active: Promise<void>[] = [];

  while (queue.length > 0 || active.length > 0) {
    while (active.length < CONCURRENCY && queue.length > 0) {
      const [id, conf] = queue.shift()!;
      const p = processOne(id, conf).then(() => {
        active.splice(active.indexOf(p), 1);
      });
      active.push(p);
    }
    if (active.length > 0) await Promise.race(active);
  }

  return results;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // Load cache
  let cache: ModelConfigCache = { fetched: '', bundle_url: '', models: {} };
  if (!FORCE && existsSync(OUT_FILE)) {
    try {
      cache = JSON.parse(readFileSync(OUT_FILE, 'utf8')) as ModelConfigCache;
      console.log(`📂  Cache: ${Object.keys(cache.models).length} models (${cache.fetched?.slice(0,10) ?? '?'})`);
    } catch {
      console.warn('⚠️  Cache corrupt — starting fresh');
      cache = { fetched: '', bundle_url: '', models: {} };
    }
  }

  const { bundleUrl, configs: bundleConfigs } = await fetchBundle();

  // Merge new bundle data into cache
  for (const [id, c] of Object.entries(bundleConfigs)) {
    const existing = cache.models[id];
    if (existing) {
      existing.url          = c.url;
      existing.organization = c.organization;
      existing.displayName  = c.displayName;
      if (c.version && !existing.version) {
        existing.version        = c.version;
        existing.version_source = 'bundle';
      }
    } else {
      cache.models[id] = { ...c, version_source: c.version ? 'bundle' : 'unknown' };
    }
  }

  // Determine what to resolve: new unversioned models, or --force re-scrape of unknowns
  const toResolve = Object.entries(bundleConfigs).filter(([id, c]) => {
    if (c.version) return false;  // already has date in bundle
    const cached = cache.models[id];
    if (FORCE) return cached?.version_source === 'unknown';  // re-try previously failed
    return !cached?.version;  // only new unknowns
  }) as Array<[string, Omit<ModelConfig, 'version_source'>]>;

  if (toResolve.length === 0) {
    console.log('✅  All models resolved — nothing to do.');
  } else {
    console.log(`\n🔍  Resolving ${toResolve.length} models (url_regex → hf_api → id_regex → page_scrape) …`);
    const results = await resolveAll(toResolve);

    for (const [id, result] of results) {
      const entry = cache.models[id]!;
      entry.version        = result.version;
      entry.version_source = result.source;
    }
  }

  // Save
  cache.fetched    = new Date().toISOString();
  cache.bundle_url = bundleUrl;
  writeFileSync(OUT_FILE, JSON.stringify(cache, null, 2), 'utf8');

  const total    = Object.keys(cache.models).length;
  const withDate = Object.values(cache.models).filter(m => m.version).length;
  const unknown  = total - withDate;
  console.log(`\n✅  ${OUT_FILE}`);
  console.log(`    ${total} models | ${withDate} dated | ${unknown} unknown`);
  if (unknown > 0) {
    const unk = Object.entries(cache.models).filter(([, m]) => !m.version).map(([id]) => id);
    console.log(`    Unknown: ${unk.slice(0, 10).join(', ')}${unk.length > 10 ? ' …' : ''}`);
    console.log(`    Re-run with --force to retry unknown models.`);
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

main().catch(e => { console.error('❌', e.message); process.exit(1); });
