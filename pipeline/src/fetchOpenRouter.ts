/**
 * fetchOpenRouter.ts
 * Fetches the full model list from the OpenRouter public API.
 * Output: out/openrouter_models.json
 *
 * Run:  pnpm run fetch:openrouter
 */

import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'out');
const OUT_FILE  = path.join(OUT_DIR, 'openrouter_models.json');

const OR_API = 'https://openrouter.ai/api/v1/models';

interface ORModel {
  id:             string;
  name:           string;
  created:        number;
  context_length: number;
  description:    string;
  pricing?: {
    prompt?:            string;
    completion?:        string;
    input_cache_read?:  string;
    input_cache_write?: string;
  };
  architecture?: {
    modality?:       string;
    tokenizer?:      string;
    instruct_type?:  string;
  };
}

interface Output {
  generated: string;
  n_models:  number;
  models:    ORModel[];
}

async function main() {
  console.log(`📡  Fetching OpenRouter model list …`);
  console.log(`    ${OR_API}`);

  const res = await fetch(OR_API, {
    headers: { 'User-Agent': 'benchmarks-pipeline/1.0' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const json = await res.json() as { data: ORModel[] };
  const models = json.data ?? [];

  // Extract just the fields we care about — keep it lean
  const slim = models.map(m => ({
    id:             m.id,
    name:           m.name,
    created:        m.created,
    context_length: m.context_length,
    pricing: {
      prompt:           m.pricing?.prompt           ?? null,
      completion:       m.pricing?.completion       ?? null,
      input_cache_read: m.pricing?.input_cache_read ?? null,
    },
    architecture_modality: m.architecture?.modality ?? null,
  }));

  const out: Output = {
    generated: new Date().toISOString(),
    n_models:  slim.length,
    models:    slim as any,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8');

  // Stats
  const providers = new Set(slim.map(m => m.id.split('/')[0]));
  console.log(`\n✅  ${slim.length} models from ${providers.size} providers  →  ${OUT_FILE}`);
  const byCost = slim.filter(m => parseFloat(m.pricing?.prompt ?? '0') > 0);
  const free   = slim.length - byCost.length;
  console.log(`   Paid: ${byCost.length}   Free/open: ${free}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
