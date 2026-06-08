/**
 * normalizeModelIds.ts
 * Maps LiveBench model IDs to canonical OpenRouter IDs.
 * Deduplicates multiple runs of the same model (keeps best-scoring).
 * Output: out/livebench_normalized.json
 *
 * Run:  pnpm run normalize
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LB_FILE  = path.join(__dirname, '..', 'out', 'livebench_scores.json');
const OR_FILE  = path.join(__dirname, '..', 'out', 'openrouter_models.json');
const OUT_FILE = path.join(__dirname, '..', 'out', 'livebench_normalized.json');

interface LBModel { id: string; scores: Record<string, number>; n_categories: number; n_rows: number }
interface LBData  { categories: string[]; tasks: string[]; n_models: number; models: LBModel[] }
interface ORModel { id: string; name: string }
interface ORData  { models: ORModel[] }

// ── Explicit overrides: LB id → OpenRouter id ──────────────────────────────────────
// Only maps to OpenRouter ids that actually exist in the current OpenRouter catalogue.
const EXPLICIT_MAP: Record<string, string | null> = {
  // OpenAI — dated snapshots
  'chatgpt-4o-latest-2025-01-29':        'openai/gpt-4o-2024-11-20',
  'chatgpt-4o-latest-2025-01-30':        'openai/gpt-4o-2024-11-20',
  'chatgpt-4o-latest-2025-03-27':        'openai/gpt-4o-2024-11-20',
  'o1-2024-12-17-high':                  'openai/o1',
  'o1-2024-12-17-medium':                'openai/o1',
  'o1-2024-12-17-low':                   'openai/o1',
  'o1-mini-2024-09-12':                  null,   // o1-mini no longer on OpenRouter
  'o1-preview-2024-09-12':               null,   // o1-preview no longer on OpenRouter
  'o3-mini-2025-01-31-high':             'openai/o3-mini',
  'o3-mini-2025-01-31-medium':           'openai/o3-mini',
  'o3-mini-2025-01-31-low':              'openai/o3-mini',
  'gpt-4.5-preview-2025-02-27':          null,   // not on OpenRouter
  'gpt-4-0125-preview':                  'openai/gpt-4-turbo',
  'gpt-4-1106-preview':                  'openai/gpt-4-1106-preview',
  'gpt-4-0613':                          'openai/gpt-4',
  'gpt-4-turbo-2024-04-09':              'openai/gpt-4-turbo',
  'gpt-4o-2024-05-13':                   'openai/gpt-4o-2024-05-13',
  'gpt-4o-2024-08-06':                   'openai/gpt-4o-2024-08-06',
  'gpt-4o-2024-11-20':                   'openai/gpt-4o-2024-11-20',
  'gpt-4o-mini-2024-07-18':              'openai/gpt-4o-mini',
  'gpt-3.5-turbo-0125':                  'openai/gpt-3.5-turbo',
  'gpt-3.5-turbo-1106':                  'openai/gpt-3.5-turbo',

  // Anthropic — OpenRouter now carries only Claude 4.x + 3.5-haiku + 3-haiku
  // Claude 3 / 3.5 / 3.7 are no longer available on OpenRouter
  'claude-3-7-sonnet-20250219-thinking-64k': null,
  'claude-3-7-sonnet-20250219-thinking-25k': null,
  'claude-3-7-sonnet-20250219-base':         null,
  'claude-3-5-sonnet-20240620':              null,
  'claude-3-5-sonnet-20241022':              null,
  'claude-3-5-haiku-20241022':               'anthropic/claude-3.5-haiku',
  'claude-3-5-opus-20240229':               null,
  'claude-3-opus-20240229':                  null,
  'claude-3-haiku-20240307':                 'anthropic/claude-3-haiku',
  'claude-3-sonnet-20240229':                null,

  // Google Gemini — OpenRouter uses short slugs
  'gemini-2.5-pro-exp-03-25':            'google/gemini-2.5-pro-preview',
  'gemini-2.0-pro-exp-02-05':            'google/gemini-2.5-pro-preview',
  'gemini-2.0-flash-thinking-exp-01-21': 'google/gemini-2.0-flash-001',
  'gemini-2.0-flash-thinking-exp-1219':  'google/gemini-2.0-flash-001',
  'gemini-2.0-flash-lite-preview-02-05': 'google/gemini-2.0-flash-lite-001',
  'gemini-2.0-flash-exp':                'google/gemini-2.0-flash-001',
  'gemini-2.0-flash':                    'google/gemini-2.0-flash-001',
  'gemini-1.5-pro-001':                  null,   // removed from OpenRouter
  'gemini-1.5-pro-002':                  null,
  'gemini-1.5-pro-exp-0801':             null,
  'gemini-1.5-pro-exp-0827':             null,
  'gemini-1.5-flash-001':                null,
  'gemini-1.5-flash-002':                null,
  'gemini-exp-1114':                     null,
  'gemini-exp-1121':                     null,
  'gemini-exp-1206':                     null,

  // Google Gemma
  'gemma-2-27b-it':                      'google/gemma-2-27b-it',
  'gemma-2-9b-it':                       null,   // not on current OpenRouter
  'gemma-3-27b-it':                      'google/gemma-3-27b-it',
  'gemma-3-12b-it':                      'google/gemma-3-12b-it',
  'gemma-3-4b-it':                       'google/gemma-3-4b-it',

  // Meta Llama — OpenRouter uses lowercase with dashes
  'Meta-Llama-3.1-405B-Instruct-Turbo':  null,   // 405B not on current OpenRouter
  'Meta-Llama-3.1-70B-Instruct-Turbo':   'meta-llama/llama-3.1-70b-instruct',
  'Meta-Llama-3.1-8B-Instruct-Turbo':    'meta-llama/llama-3.1-8b-instruct',
  'Meta-Llama-3-70B-Instruct':           'meta-llama/llama-3-70b-instruct',
  'Meta-Llama-3-8B-Instruct':            'meta-llama/llama-3-8b-instruct',
  'llama-4-maverick-17b-128e-instruct':  'meta-llama/llama-4-maverick',
  'llama-3.3-70b-instruct-turbo':        'meta-llama/llama-3.3-70b-instruct',
  'llama-3.1-nemotron-70b-instruct':     null,   // not on current OpenRouter
  'meta-llama-3-70b-instruct':           'meta-llama/llama-3-70b-instruct',
  'meta-llama-3-8b-instruct':            'meta-llama/llama-3-8b-instruct',
  'meta-llama-3.1-405b-instruct-turbo':  null,
  'meta-llama-3.1-70b-instruct-turbo':   'meta-llama/llama-3.1-70b-instruct',
  'meta-llama-3.1-8b-instruct-turbo':    'meta-llama/llama-3.1-8b-instruct',

  // Mistral
  'mistral-large':                        'mistralai/mistral-large',
  'mistral-large-2402':                   'mistralai/mistral-large',
  'mistral-large-2407':                   'mistralai/mistral-large-2407',
  'mistral-large-2411':                   'mistralai/mistral-large-2411',
  'mistral-small-2402':                   'mistralai/mistral-small-3.1-24b-instruct',
  'mistral-small-2409':                   'mistralai/mistral-small-3.1-24b-instruct',
  'mistral-small-2501':                   'mistralai/mistral-small-24b-instruct-2501',
  'mistral-small-2503':                   'mistralai/mistral-small-3.1-24b-instruct',
  'mistral-7b-instruct-v0.2':             'mistralai/mistral-7b-instruct-v0.1',
  'Mistral-7B-Instruct-v0.2':             'mistralai/mistral-7b-instruct-v0.1',
  'Mistral-7B-Instruct-v0.3':             'mistralai/mistral-7b-instruct-v0.1',
  'mixtral-8x22b-instruct-v0.1':          'mistralai/mixtral-8x22b-instruct',
  'mixtral-8x7b-instruct-v0.1':           null,   // not on current OpenRouter
  'Mixtral-8x22B-Instruct-v0.1':          'mistralai/mixtral-8x22b-instruct',
  'Mixtral-8x7B-Instruct-v0.1':           null,
  'open-mistral-nemo':                    'mistralai/mistral-nemo',
  'open-mixtral-8x22b':                   'mistralai/mixtral-8x22b-instruct',
  'open-mixtral-8x7b':                    null,

  // Qwen — OpenRouter moved to qwen3 series; only qwen-2.5-72b remains from 2.5
  'Qwen2.5-72B-Instruct-Turbo':          'qwen/qwen-2.5-72b-instruct',
  'Qwen2.5-7B-Instruct-Turbo':           'qwen/qwen-2.5-7b-instruct',
  'qwen2.5-72b-instruct-turbo':          'qwen/qwen-2.5-72b-instruct',
  'qwen2.5-7b-instruct-turbo':           'qwen/qwen-2.5-7b-instruct',
  'qwen2.5-max':                         'qwen/qwen3-235b-a22b',
  'qwq-32b':                             null,   // not on current OpenRouter
  'QwQ-32B-Preview':                     null,
  'qwq-32b-preview':                     null,
  'Qwen2-72B-Instruct':                  null,   // qwen2 not on current OpenRouter
  'qwen2-72b-instruct':                  null,
  'qwen2-math-72b-instruct':             null,

  // DeepSeek
  'deepseek-r1':                          'deepseek/deepseek-r1',
  'deepseek-r1-local':                    'deepseek/deepseek-r1',
  'deepseek-r1-local-2':                  'deepseek/deepseek-r1',
  'deepseek-v3':                          'deepseek/deepseek-chat',
  'deepseek-v3-0324':                     'deepseek/deepseek-chat-v3-0324',
  'deepseek-r1-distill-llama-70b':        'deepseek/deepseek-r1-distill-llama-70b',
  'DeepSeek-R1-Distill-Qwen-32B':         'deepseek/deepseek-r1-distill-qwen-32b',
  'deepseek-r1-distill-qwen-32b':         'deepseek/deepseek-r1-distill-qwen-32b',

  // Amazon Nova
  'amazon.nova-pro-v1:0':                 'amazon/nova-pro-v1',
  'amazon.nova-lite-v1:0':                'amazon/nova-lite-v1',
  'amazon.nova-micro-v1:0':               'amazon/nova-micro-v1',

  // Cohere
  'command-r-03-2024':                    'cohere/command-r-plus-08-2024', // closest still-active
  'command-r-08-2024':                    'cohere/command-r-08-2024',
  'command-r-plus-04-2024':               'cohere/command-r-plus-08-2024',
  'command-r-plus-08-2024':               'cohere/command-r-plus-08-2024',
  'command-a-03-2025':                    'cohere/command-a',

  // Perplexity
  'sonar-pro':                            'perplexity/sonar-pro',
  'sonar':                                'perplexity/sonar',
  'perplexity-sonar-reasoning':           'perplexity/sonar-pro',

  // Microsoft Phi
  'phi-4':                                'microsoft/phi-4',
  'Phi-3-medium-128k-instruct':           null,
  'Phi-3-medium-4k-instruct':             null,
  'Phi-3-mini-128k-instruct':             null,
  'Phi-3-mini-4k-instruct':               null,
  'Phi-3.5-mini-instruct':                null,
  'phi-3-mini-4k-instruct':               null,
  'phi-3-mini-128k-instruct':             null,

  // New mappings for LiveBench 2026 models
  'gpt-5.5-xhigh':                       'openai/gpt-5.5',
  'gpt-5.5-high':                        'openai/gpt-5.5',
  'gpt-5.4-xhigh':                       'openai/gpt-5.4',
  'gpt-5.4-high':                        'openai/gpt-5.4',
  'gpt-5.2-2025-12-11-high':             'openai/gpt-5.2',
  'claude-opus-4-8-xhigh-effort':        'anthropic/claude-opus-4.8',
  'claude-opus-4-8-high-effort':         'anthropic/claude-opus-4.8',
  'claude-opus-4-7-xhigh-effort':        'anthropic/claude-opus-4.7',
  'claude-opus-4-7-high-effort':         'anthropic/claude-opus-4.7',
  'claude-opus-4-6-thinking-auto-high-effort': 'anthropic/claude-opus-4.6',
  'claude-opus-4-5-20251101-thinking-64k-high-effort': 'anthropic/claude-opus-4.5',
  'claude-sonnet-4-6-thinking-auto-high-effort': 'anthropic/claude-sonnet-4.6',
  'claude-sonnet-4-6-thinking-auto-medium-effort': 'anthropic/claude-sonnet-4.6',
  'gemini-3.1-pro-preview-high':         'google/gemini-3.1-pro-preview',
  'gemini-3.5-flash-high':               'google/gemini-3.5-flash',
};

// ── No match — known to be absent from OpenRouter ─────────────────────────
const NOT_ON_OPENROUTER = new Set([
  'grok-2','grok-2-1212','grok-2-mini','grok-3','grok-3-beta','grok-beta',
  'grok-3-mini-reasoning-beta',
  'learnlm-1.5-pro-experimental',
  'step-2-16k-202411', 'hunyuan-turbos-20250313',
  'azerogpt','wbot-4:347b_no_s',
  // Fine-tune / research checkpoints
  'codegen3_5k-qwen2.5-72b-instruct-2-chk-50',
  'coding-meta-llama-3.1-70b-instruct-chk-50',
  'coding2-amcfull-apifull-mmlu12k-meta-llama-3.1-70b-instruct-chk-150',
  'lcb-math-qwen2-72b-instructv3-merged-50',
  'acm_rewrite_qwen2-72B-Chat',
  'Dracarys2-72B-Instruct','dracarys2-72b-instruct','dracarys2-llama-3.1-70b-instruct',
  'Reflection-Llama-3.1-70B','reflection-llama-3.1-70b',
  'Smaug-Qwen2-72B-Instruct',
  'sky-t1-32b-preview',
  'olmo-2-1124-13b-instruct',
  'mathstral-7B-v0.1',
  'deepseek-coder','deepseek-chat',
  'DeepSeek-Coder-V2-Lite-Instruct','DeepSeek-V2-Lite-Chat',
  'Llama-2-7b-chat-hf','llama-2-7b-chat-hf','llama-3.1-nemotron-70b-instruct',
  'Llama-3.1-Nemotron-70B-Instruct-HF',
  'OpenHermes-2.5-Mistral-7B','Starling-LM-7B-beta','starling-lm-7b-beta',
  'Phi-3-small-128k-instruct','Phi-3-small-8k-instruct','phi-3-small-8k-instruct',
  'Phi-3.5-MoE-instruct',
  'mistral-small-2402','mistral-small-2409',
  'Yi-6B-Chat','yi-6b-chat',
  'vicuna-7b-v1.5','vicuna-7b-v1.5-16k',
  'zephyr-7b-alpha','zephyr-7b-beta',
  'Qwen1.5-0.5B-Chat','Qwen1.5-1.8B-Chat','Qwen1.5-4B-Chat','Qwen1.5-7B-Chat',
  'qwen1.5-0.5b-chat','qwen1.5-1.8b-chat','qwen1.5-4b-chat','qwen1.5-7b-chat',
  'Qwen2-0.5B-Instruct','Qwen2-1.5B-Instruct','Qwen2-7B-Instruct','qwen2.5-coder-32b-instruct',
  'Qwen2.5-Coder-32B-Instruct','Qwen2.5-7B-Instruct-Turbo','qwen2.5-7b-instruct-turbo',
  'gemini-1.5-flash-8b-001','gemini-1.5-flash-8b-exp-0827','gemini-1.5-flash-8b-exp-0924',
  'gemini-1.5-flash-exp-0827',
  'hermes-3-llama-3.1-70b',
]);

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const lb: LBData  = JSON.parse(readFileSync(LB_FILE, 'utf8'));
  const or: ORData  = JSON.parse(readFileSync(OR_FILE, 'utf8'));
  const orIds = new Set(or.models.map(m => m.id));
  const orSlugs = new Map(or.models.map(m => [m.id.split('/').pop()!.toLowerCase(), m.id]));

  let matched = 0, unmatched = 0, skipped = 0;
  const orUsed = new Map<string, LBModel>();   // openRouterId → best LB model so far

  type Resolved = LBModel & { openRouterId: string | null; match_type: string };
  const resolved: Resolved[] = [];

  for (const lbm of lb.models) {
    if (NOT_ON_OPENROUTER.has(lbm.id)) { skipped++; continue; }

    // 1. Explicit map (null means "known absent from OpenRouter", treat as skipped)
    const explicitValue = lbm.id in EXPLICIT_MAP ? EXPLICIT_MAP[lbm.id] : undefined;
    const knownAbsent = explicitValue === null;
    if (knownAbsent) { skipped++; continue; }
    let orId: string | null = explicitValue !== undefined ? explicitValue : null;

    // 2. Direct OpenRouter slug match (case-insensitive) — only if not already resolved
    if (!orId && !knownAbsent) {
      const slug = lbm.id.toLowerCase();
      for (const [, oid] of orSlugs) {
        if (oid.split('/').pop()!.toLowerCase() === slug) { orId = oid; break; }
      }
    }

    // 3. Try adding provider prefixes (only if not known-absent)
    if (!orId && !knownAbsent) {
      const lower = lbm.id.toLowerCase();
      const prefixCandidates: [string, string][] = [
        ['openai/',        lower],
        ['anthropic/',     lower],
        ['google/',        lower],
        ['meta-llama/',    lower],
        ['mistralai/',     lower],
        ['deepseek/',      lower],
        ['qwen/',          lower],
        ['microsoft/',     lower],
        ['amazon/',        lower],
        ['cohere/',        lower],
        ['perplexity/',    lower],
        ['nvidia/',        lower],
      ];
      for (const [prefix, slug] of prefixCandidates) {
        if (orIds.has(prefix + slug)) { orId = prefix + slug; break; }
      }
    }

    if (orId && !orIds.has(orId)) orId = null;  // validate it actually exists

    // Dedup: if this OpenRouter id already has a model, keep whichever has more categories or higher mean
    if (orId && orUsed.has(orId)) {
      const existing = orUsed.get(orId)!;
      const meanNew = Object.values(lbm.scores).reduce((a,b)=>a+b,0) / (lbm.n_categories||1);
      const meanOld = Object.values(existing.scores).reduce((a,b)=>a+b,0) / (existing.n_categories||1);
      if (lbm.n_categories > existing.n_categories || (lbm.n_categories === existing.n_categories && meanNew > meanOld)) {
        orUsed.set(orId, lbm);
        const idx = resolved.findIndex(r => r.openRouterId === orId);
        if (idx >= 0) resolved[idx] = { ...lbm, openRouterId: orId, match_type: 'dedup-replaced' };
      }
      // either way, don't push a duplicate
      continue;
    }

    if (orId) {
      orUsed.set(orId, lbm);
      matched++;
    } else {
      unmatched++;
    }

    resolved.push({ ...lbm, openRouterId: orId, match_type: orId ? 'matched' : 'no_match' });
  }

  // Sort: matched first, then by n_categories desc, then mean desc
  resolved.sort((a, b) => {
    if (!!a.openRouterId !== !!b.openRouterId) return a.openRouterId ? -1 : 1;
    if (b.n_categories !== a.n_categories) return b.n_categories - a.n_categories;
    const mA = Object.values(a.scores).reduce((x,y)=>x+y,0) / (a.n_categories||1);
    const mB = Object.values(b.scores).reduce((x,y)=>x+y,0) / (b.n_categories||1);
    return mB - mA;
  });

  const fullMatched = resolved.filter(r => r.openRouterId && r.n_categories === lb.categories.length);

  const out = {
    generated:  new Date().toISOString(),
    categories: lb.categories,
    summary: {
      total_lb_models: lb.n_models,
      skipped_not_on_openrouter: skipped,
      matched_to_openrouter: matched,
      unmatched: unmatched,
      full_coverage_and_matched: fullMatched.length,
    },
    models: resolved,
  };

  writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8');

  console.log(`\n✅  Normalization complete  →  ${OUT_FILE}`);
  console.log(`   Total LB models       : ${lb.n_models}`);
  console.log(`   Skipped (not on OpenRouter) : ${skipped}`);
  console.log(`   Matched to OpenRouter       : ${matched}`);
  console.log(`   Unmatched             : ${unmatched}`);
  console.log(`   Full coverage+matched : ${fullMatched.length}`);
  console.log(`\n   Matched models (${fullMatched.length} with full ${lb.categories.length}-cat coverage):`);
  for (const m of fullMatched) {
    const cats = lb.categories.map(c => `${c.slice(0,4)}:${m.scores[c]?.toFixed(0)??'—'}`).join('  ');
    const mean = (Object.values(m.scores).reduce((a,b)=>a+b,0) / m.n_categories).toFixed(1);
    console.log(`   ${m.openRouterId!.padEnd(50)} avg:${mean}  [${cats}]`);
  }

  // Report unmatched non-obvious models (not in NOT_ON_OPENROUTER)
  const unmatchedModels = resolved.filter(r => !r.openRouterId);
  if (unmatchedModels.length) {
    console.log(`\n   Still unmatched (${unmatchedModels.length}):`);
    unmatchedModels.slice(0, 15).forEach(m => console.log(`     ${m.id}`));
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
