/**
 * fetchOllama.ts
 * Scrapes ollama.com to build a comprehensive model catalogue with two flags
 * per tag:
 *   isOllamaLocal  — can be pulled with `ollama pull` (runs locally)
 *   isOllamaCloud  — hosted on Ollama Cloud (no local GPU needed)
 *
 * Methodology
 *   1. Paginate /search?c=cloud  → collect cloud-capable slugs
 *   2. Paginate /search          → collect all slugs
 *   3. For each unique slug fetch /library/<slug>/tags, extract tags:
 *        tag contains "cloud" → isOllamaCloud: true
 *        tag does NOT contain "cloud" → isOllamaLocal: true
 *   4. Additionally mark all non-cloud tags of a cloud-capable slug as
 *      isOllamaCloud: true (those slugs run in the cloud without a suffix)
 *
 * Output: out/ollama.json
 *
 * Run:  pnpm run fetch:ollama
 */

import { writeFileSync } from 'fs';
import { parse }         from 'node-html-parser';
import path              from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE  = path.join(__dirname, '..', 'out', 'ollama.json');

const UA      = 'Mozilla/5.0 (compatible; livebenchviz-pipeline/1.0)';
const DELAY   = 1000; // ms between requests

export interface OllamaTag {
  name:          string;   // e.g. "gemma4:31b"
  slug:          string;   // e.g. "gemma4"
  tag:           string;   // e.g. "31b"
  isOllamaLocal: boolean;
  isOllamaCloud: boolean;
}

export interface OllamaIndex {
  fetched:    string;
  source:     string;
  tagCount:   number;
  slugCount:  number;
  tags:       OllamaTag[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal:  AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

/** Paginate a /search URL (with or without ?c=cloud) and return all slugs found. */
async function scrapeSearchSlugs(filter?: 'cloud'): Promise<Set<string>> {
  const slugs = new Set<string>();
  const base  = filter ? `https://ollama.com/search?c=${filter}` : 'https://ollama.com/search';

  for (let page = 1; ; page++) {
    if (page > 1) await sleep(DELAY);
    const url  = `${base}${filter ? '&' : '?'}page=${page}`;
    const html = await fetchPage(url);

    if (html.includes('No models found')) break;

    const root  = parse(html);
    const links = root.querySelectorAll('a[href^="/library/"]');
    if (links.length === 0) break;

    let added = 0;
    for (const a of links) {
      const slug = a.getAttribute('href')?.replace('/library/', '').split('?')[0];
      if (slug && !slugs.has(slug)) { slugs.add(slug); added++; }
    }
    if (added === 0) break;
    if (added === 0) break;   // no new slugs on this page → done

    process.stdout.write(`  page ${page}: +${added} slugs (${slugs.size} total)\n`);
  }

  return slugs;
}

/** Fetch /library/<slug>/tags and extract all tag names. */
async function scrapeTagsForSlug(slug: string): Promise<string[]> {
  const html = await fetchPage(`https://ollama.com/library/${slug}/tags`);
  const pattern = new RegExp(`${slug}:([\\w.\\-]+)`, 'g');
  const tags = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) tags.add(m[1]);
  return [...tags];
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n📡  Scraping Ollama cloud slugs …');
  const cloudSlugs = await scrapeSearchSlugs('cloud');
  console.log(`   → ${cloudSlugs.size} cloud-capable slugs\n`);

  console.log('📡  Scraping all Ollama slugs …');
  const allSlugs = await scrapeSearchSlugs();
  // cloud slugs may include models not on the main search page yet — merge both
  for (const s of cloudSlugs) allSlugs.add(s);
  console.log(`   → ${allSlugs.size} total slugs\n`);

  const allTags: OllamaTag[] = [];

  let i = 0;
  for (const slug of allSlugs) {
    i++;
    await sleep(DELAY);
    process.stdout.write(`  [${i}/${allSlugs.size}] ${slug} … `);

    let rawTags: string[];
    try {
      rawTags = await scrapeTagsForSlug(slug);
    } catch (e) {
      process.stdout.write(`⚠ skip (${(e as Error).message})\n`);
      continue;
    }

    const isCloudSlug = cloudSlugs.has(slug);

    for (const tag of rawTags) {
      const hasCloudWord = tag.toLowerCase().includes('cloud');
      allTags.push({
        name:          `${slug}:${tag}`,
        slug,
        tag,
        isOllamaLocal: !hasCloudWord,
        // cloud if the tag itself contains "cloud", or if the slug is cloud-capable
        // (meaning the same model runs serverlessly under a :cloud suffix)
        isOllamaCloud: hasCloudWord || isCloudSlug,
      });
    }

    process.stdout.write(`${rawTags.length} tags\n`);
  }

  const out: OllamaIndex = {
    fetched:   new Date().toISOString(),
    source:    'https://ollama.com',
    tagCount:  allTags.length,
    slugCount: allSlugs.size,
    tags:      allTags.sort((a, b) => a.name.localeCompare(b.name)),
  };

  writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8');

  const localCount = allTags.filter(t => t.isOllamaLocal).length;
  const cloudCount = allTags.filter(t => t.isOllamaCloud).length;

  console.log(`\n✅  Ollama catalogue  →  ${OUT_FILE}`);
  console.log(`   Slugs: ${allSlugs.size}   Tags: ${allTags.length}`);
  console.log(`   isOllamaLocal: ${localCount}   isOllamaCloud: ${cloudCount}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
