/**
 * exportInference.ts
 * Builds inference.json — a map from LiveBench model IDs to their
 * inference availability across three platforms:
 *
 *   ollamaCloud  — available on Ollama Cloud (no local GPU needed)
 *   ollamaLocal  — can be pulled with `ollama pull` and run locally
 *   openRouter   — available on OpenRouter
 *
 * Sources:
 *   out/ollama.json       — scraped Ollama catalogue (from fetchOllama.ts)
 *   out/benchmark_lb.json — LB export (openRouterId field)
 *   LB_OLLAMA_MAP         — hand-curated LB-ID → Ollama slug:tag mapping
 *
 * Output: out/inference.json
 *
 * Run:  pnpm run export:inference
 */

import { readFileSync, writeFileSync } from 'fs';
import path              from 'path';
import { fileURLToPath } from 'url';
import { LB_OLLAMA_MAP } from './shared/providerMeta.js';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR    = path.join(__dirname, '..', 'out');
const OUT_FILE   = path.join(OUT_DIR, 'inference.json');

// ─── types ────────────────────────────────────────────────────────────────────

export interface InferenceEntry {
  ollamaCloud: boolean;
  ollamaLocal: boolean;
  openRouter:  boolean;
}

export type InferenceMap = Record<string, InferenceEntry>;

interface OllamaTag {
  name:          string;
  slug:          string;
  tag:           string;
  isOllamaLocal: boolean;
  isOllamaCloud: boolean;
}
interface OllamaIndex { tags: OllamaTag[] }
interface LBModel     { id: string; openRouterId: string | null }
interface LBExport    { models: LBModel[] }

// ─── main ─────────────────────────────────────────────────────────────────────

function main() {
  // ── load ollama.json ───────────────────────────────────────────────────────
  const ollamaPath = path.join(OUT_DIR, 'ollama.json');
  const ollamaData = JSON.parse(readFileSync(ollamaPath, 'utf8')) as OllamaIndex;

  // Index by slug → aggregate flags
  const slugLocal = new Set<string>();
  const slugCloud = new Set<string>();
  for (const t of ollamaData.tags) {
    if (t.isOllamaLocal) slugLocal.add(t.slug);
    if (t.isOllamaCloud) slugCloud.add(t.slug);
  }

  // ── load benchmark_lb.json ─────────────────────────────────────────────────
  const lbPath  = path.join(OUT_DIR, 'benchmark_lb.json');
  const lbData  = JSON.parse(readFileSync(lbPath, 'utf8')) as LBExport;

  // ── build inference map ────────────────────────────────────────────────────
  const entries: InferenceMap = {};
  let matched = 0;

  for (const model of lbData.models) {
    const ollamaTag = LB_OLLAMA_MAP[model.id];
    let ollamaLocal = false;
    let ollamaCloud = false;

    if (ollamaTag) {
      // Extract slug (part before ':')
      const slug = ollamaTag.includes(':') ? ollamaTag.split(':')[0] : ollamaTag;
      ollamaLocal = slugLocal.has(slug);
      ollamaCloud = slugCloud.has(slug);
      if (ollamaLocal || ollamaCloud) matched++;
    }

    entries[model.id] = {
      ollamaCloud,
      ollamaLocal,
      openRouter: model.openRouterId !== null,
    };
  }

  const output = {
    generated:  new Date().toISOString(),
    modelCount: lbData.models.length,
    entries,
  };

  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');

  const cloudCount = Object.values(entries).filter(e => e.ollamaCloud).length;
  const localCount = Object.values(entries).filter(e => e.ollamaLocal).length;
  const orCount    = Object.values(entries).filter(e => e.openRouter).length;

  console.log(`\n✅  Inference map  →  ${OUT_FILE}`);
  console.log(`   Models:       ${lbData.models.length}`);
  console.log(`   ollamaCloud:  ${cloudCount}`);
  console.log(`   ollamaLocal:  ${localCount}`);
  console.log(`   openRouter:   ${orCount}`);
  console.log(`   LB_OLLAMA_MAP matched: ${matched} / ${Object.keys(LB_OLLAMA_MAP).length} entries`);
}

main();
