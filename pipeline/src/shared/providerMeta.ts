/**
 * shared/providerMeta.ts
 * Provider metadata shared between pipeline export scripts.
 *
 * Canonical home for:
 *   - BRAND_NAMES / getBrand()         — display names for provider families
 *   - OPEN_PROVIDERS / isOpenWeight()  — open-weight detection
 *   - FAMILY_PRIORITY                  — sidebar sort order
 *   - getProviderForLBId()             — maps LiveBench native IDs → {family, type}
 *   - LB_OLLAMA_MAP                    — LiveBench IDs → Ollama pull tags
 *   - parseOllamaCloudNames()          — parses ollama_cloud.json
 */

// ── Display names for provider families ───────────────────────────────────────
export const BRAND_NAMES: Record<string, string> = {
  // Core closed-weight providers
  openai:         'OpenAI',
  anthropic:      'Anthropic',
  'x-ai':         'xAI',
  perplexity:     'Perplexity',
  cohere:         'Cohere',
  amazon:         'Amazon',
  tencent:        'Tencent',
  stepfun:        'StepFun',
  // Core open-weight providers
  google:         'Google',
  'meta-llama':   'Meta',
  mistralai:      'Mistral AI',
  qwen:           'Qwen',
  deepseek:       'DeepSeek',
  microsoft:      'Microsoft',
  nvidia:         'NVIDIA',
  moonshotai:     'Moonshot AI',
  // Secondary open-weight providers
  '01-ai':        '01.AI',
  thudm:          'Zhipu AI',
  zhipuai:        'Zhipu AI',
  internlm:       'InternLM',
  tiiuae:         'TII UAE',
  bigcode:        'BigCode',
  allenai:        'AllenAI',
  liquid:         'Liquid AI',
  togethercomputer:'Together AI',
  nousresearch:   'Nous Research',
  abacusai:       'Abacus AI',
  databricks:     'Databricks',
  minimax:        'MiniMax',
  'sao10k':       'Sao10k',
  'eva-unit-01':  'EVA',
  'undi95':       'Undi95',
  'ai21':         'AI21 Labs',
  inflection:     'Inflection',
  snowflake:      'Snowflake',
  // LB-specific families (not on OpenRouter)
  lmsys:          'LMSYS',
  'berkeley-nest':'Berkeley',
  novasky:        'NovaSky',
  teknium:        'Teknium',
  mattshumer:     'Matt Shumer',
  huggingface:    'HuggingFace',
  xiaomi:         'Xiaomi',
  arcee:          'Arcee AI',
  openrouter:     'OpenRouter',
  other:          'Other',
};

export function getBrand(family: string): string {
  return BRAND_NAMES[family]
    ?? family.split(/[-_]/).map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
}

// ── Open-weight detection ──────────────────────────────────────────────────────
// Criterion: released as open-weight; can potentially run locally.
// Mirrors the OPEN_PROVIDERS set in data.ts — keep in sync.
export const OPEN_PROVIDERS = new Set([
  // Established open-weight providers
  'meta-llama', 'qwen', 'deepseek', 'microsoft', 'nousresearch',
  '01-ai', 'thudm', 'zhipuai', 'internlm', 'tiiuae', 'bigcode', 'allenai',
  'liquid', 'togethercomputer',
  // Additional providers with models confirmed on Ollama
  'nvidia',             // Nemotron (Apache 2.0)
  'moonshotai',         // Kimi K2 (open-weight)
  'minimax',            // MiniMax open-weight variants
  'cognitivecomputations',
  'bartowski',
  'mlx-community',
  'lmstudio-community',
  // LB-specific
  'abacusai', 'lmsys', 'berkeley-nest', 'novasky', 'teknium', 'mattshumer',
  'huggingface',        // Zephyr etc.
]);

// Closed Google models (Gemma is open; Gemini is closed)
const CLOSED_GOOGLE = new Set([
  'google/gemini-2.5-pro-preview',
  'google/gemini-2.0-flash-001',
  'google/gemini-2.0-flash-lite-001',
]);

/**
 * Determine if an OpenRouter-style id is open-weight.
 * Mirrors data.ts isOpenWeight() — keep in sync.
 */
export function isOpenWeight(id: string): boolean {
  const [provider = '', model = ''] = id.split('/');
  if (OPEN_PROVIDERS.has(provider)) return true;
  if (provider === 'google') {
    return model.startsWith('gemma') || model.startsWith('pali');
  }
  if (provider === 'mistralai' && /7b|8x|nemo|ministral/i.test(model)) return true;
  if (provider === 'openai' && /\boss\b/i.test(model)) return true;
  if (/\b(llama|gemma|qwen|deepseek|phi[-\s]?\d|mixtral|falcon|bloom|starcoder|olmo|tulu|nemotron|kimi|glm|minimax)/i.test(id)) return true;
  return false;
}

/** Mirrors the isOllama() check in mergeScores.ts for OR ids. */
export function isOllamaOrId(orId: string): boolean {
  if (CLOSED_GOOGLE.has(orId)) return false;
  return isOpenWeight(orId);
}

// ── Priority order for the family sidebar ─────────────────────────────────────
export const FAMILY_PRIORITY: string[] = [
  // Closed-weight leaders first
  'openai', 'anthropic', 'google', 'x-ai', 'perplexity', 'cohere', 'amazon',
  'tencent', 'stepfun',
  // Open-weight leaders
  'meta-llama', 'mistralai', 'qwen', 'deepseek', 'microsoft', 'nvidia',
  'moonshotai', 'databricks',
  // Open-weight secondary
  '01-ai', 'nousresearch', 'allenai', 'tiiuae', 'thudm', 'zhipuai', 'internlm',
  'bigcode', 'liquid', 'togethercomputer', 'abacusai', 'minimax', 'xiaomi',
  // LB-specific
  'lmsys', 'berkeley-nest', 'novasky', 'teknium', 'mattshumer', 'huggingface',
  'arcee', 'openrouter',
  // HF-specific
  'ibm-granite', 'EleutherAI', 'deepseek-ai', 'CohereForAI', 'stabilityai',
  'HuggingFaceTB', 'HuggingFaceH4', 'TinyLlama', 'mlabonne', 'openchat',
  'bigscience', 'WizardLMTeam', 'lmsys', 'mistral-community',
  'other',
];

// ── LiveBench provider rules ───────────────────────────────────────────────────

export interface LBProviderMeta {
  family: string;
  type:   'open' | 'closed';
}

/**
 * Maps a LiveBench native model ID to its provider family and type.
 * Rules are checked in order; first match wins.
 * The ID is matched case-insensitively.
 */
export function getProviderForLBId(id: string): LBProviderMeta {
  const lo = id.toLowerCase();

  // ── Exact matches ──────────────────────────────────────────────────────────
  const EXACT: Record<string, LBProviderMeta> = {
    'o1':            { family: 'openai',     type: 'closed' },
    'azerogpt':      { family: 'other',      type: 'closed' },
    'elephant-alpha':{ family: 'openrouter', type: 'closed' },
  };
  if (EXACT[lo] || EXACT[id]) return EXACT[lo] ?? EXACT[id];

  // ── Specific patterns (must precede their parent families) ─────────────────

  // NVIDIA Nemotron — standalone nemotron-* slugs and llama-3-nemotron variants
  if (/^nemotron/i.test(id))
    return { family: 'nvidia', type: 'open' };
  if (/^(llama-3[\d.]*-nemotron|llama-3-nemotron)/i.test(id))
    return { family: 'nvidia', type: 'open' };

  // Reflection (before generic llama-)
  if (/^(reflection-llama|reflection-)/i.test(id))
    return { family: 'mattshumer', type: 'open' };

  // NousResearch Hermes (before generic llama-)
  if (/^hermes-\d+/i.test(id))
    return { family: 'nousresearch', type: 'open' };

  // OpenHermes / Hermes fine-tunes
  if (/^openhermes/i.test(id))
    return { family: 'teknium', type: 'open' };

  // Abacus AI — Dracarys + Smaug
  if (/^(dracarys2?|smaug)/i.test(id))
    return { family: 'abacusai', type: 'open' };

  // Starling (before generic llama-)
  if (/^starling-lm/i.test(id))
    return { family: 'berkeley-nest', type: 'open' };

  // NovaSky Sky-T1
  if (/^sky-t1/i.test(id))
    return { family: 'novasky', type: 'open' };

  // Mathstral (before generic mistral-)
  if (/^mathstral/i.test(id))
    return { family: 'mistralai', type: 'open' };

  // AllenAI OLMo
  if (/^olmo/i.test(id))
    return { family: 'allenai', type: 'open' };

  // LMSYS Vicuna
  if (/^vicuna/i.test(id))
    return { family: 'lmsys', type: 'open' };

  // HuggingFace Zephyr
  if (/^zephyr/i.test(id))
    return { family: 'huggingface', type: 'open' };

  // Research fine-tunes (Qwen-based)
  if (/^(acm_rewrite|codegen\d|lcb-math)/i.test(id))
    return { family: 'qwen', type: 'open' };

  // Research fine-tunes (Llama-based)
  if (/^coding.*(?:meta.?llama|llama)/i.test(id))
    return { family: 'meta-llama', type: 'open' };

  // Moonshot AI Kimi
  if (/^kimi/i.test(id))
    return { family: 'moonshotai', type: 'open' };

  // ZhipuAI GLM
  if (/^glm/i.test(id))
    return { family: 'zhipuai', type: 'open' };

  // MiniMax
  if (/^minimax/i.test(id))
    return { family: 'minimax', type: 'open' };

  // Mistral Devstral (before generic mistral- check)
  if (/^devstral/i.test(id))
    return { family: 'mistralai', type: 'open' };

  // Xiaomi MiMo
  if (/^mimo/i.test(id))
    return { family: 'xiaomi', type: 'open' };

  // Arcee AI
  if (/^arcee/i.test(id))
    return { family: 'arcee', type: 'open' };

  // Wbot (unknown/other)
  if (/^wbot/i.test(id))
    return { family: 'other', type: 'closed' };

  // ── Main families ──────────────────────────────────────────────────────────

  // Google — Gemma first (open), then Gemini (closed)
  if (/^gemma/i.test(id))     return { family: 'google', type: 'open'   };
  if (/^(gemini|learnlm)/i.test(id)) return { family: 'google', type: 'closed' };

  if (/^claude/i.test(id))    return { family: 'anthropic',  type: 'closed' };

  // OpenAI — o1 is covered by exact match above; o1- / o3- / o4- here
  if (/^(gpt|chatgpt|o[134]-)/i.test(id))
    return { family: 'openai', type: 'closed' };

  // DeepSeek (also catches DeepSeek-R1-Distill-*)
  if (/^deepseek/i.test(id))  return { family: 'deepseek',   type: 'open'   };

  // Qwen / QwQ
  if (/^(qwen|qwq)/i.test(id))return { family: 'qwen',       type: 'open'   };

  // Meta Llama (generic — must come AFTER Nemotron / Reflection / Hermes)
  if (/^(llama|meta-?llama)/i.test(id))
    return { family: 'meta-llama', type: 'open' };

  // Mistral / Mixtral
  if (/^(mistral|mixtral|open-?mistral|open-?mixtral)/i.test(id))
    return { family: 'mistralai', type: 'open' };

  // Microsoft Phi
  if (/^phi/i.test(id))        return { family: 'microsoft',  type: 'open'   };

  // xAI Grok
  if (/^grok/i.test(id))       return { family: 'x-ai',       type: 'closed' };

  // Perplexity Sonar
  if (/^(sonar|perplexity)/i.test(id))
    return { family: 'perplexity', type: 'closed' };

  // Cohere Command
  if (/^command/i.test(id))   return { family: 'cohere',      type: 'closed' };

  // Amazon Nova
  if (/^amazon\.nova/i.test(id)) return { family: 'amazon',   type: 'closed' };

  // 01.AI Yi
  if (/^yi[-_]/i.test(id))    return { family: '01-ai',        type: 'open'   };

  // Tencent Hunyuan
  if (/^hunyuan/i.test(id))   return { family: 'tencent',     type: 'closed' };

  // StepFun
  if (/^step-/i.test(id))     return { family: 'stepfun',     type: 'closed' };

  // ── Fallback ───────────────────────────────────────────────────────────────
  return { family: 'other', type: 'open' };
}
export const LB_OLLAMA_MAP: Record<string, string> = {
  // Google Gemma
  'gemma-4-31b-it':   'gemma4:31b',

  // Qwen3
  'qwen3-32b-thinking':             'qwen3:32b',
  'qwen3-30b-a3b-thinking':         'qwen3:30b-a3b',
  'qwen3-235b-a22b-instruct-2507':  'qwen3:235b-a22b',
  'qwen3-235b-a22b-thinking-2507':  'qwen3:235b-a22b',
  'qwen3-next-80b-a3b-instruct':    'qwen3-next:80b',
  'qwen3-next-80b-a3b-thinking':    'qwen3-next:80b',

  // DeepSeek
  'deepseek-v3.2':               'deepseek-v3.2',
  'deepseek-v3.2-exp':           'deepseek-v3.2',
  'deepseek-v3.2-exp-thinking':  'deepseek-v3.2',
  'deepseek-v3.2-thinking':      'deepseek-v3.2',
  'deepseek-v4-flash':           'deepseek-v4-flash',
  'deepseek-v4-pro':             'deepseek-v4-pro',

  // Mistral / Devstral
  'devstral-2512':   'devstral-2:123b',

  // Moonshot Kimi
  'kimi-k2-instruct':   'kimi-k2:1t',
  'kimi-k2-thinking':   'kimi-k2-thinking',
  'kimi-k2.5-thinking': 'kimi-k2.5',
  'kimi-k2.6-thinking': 'kimi-k2.6',

  // MiniMax
  'minimax-m2.5':   'minimax-m2.5',
  'minimax-m2.7':   'minimax-m2.7',

  // NVIDIA Nemotron
  'nemotron-3-super-120b-a12b':   'nemotron-3-super',

  // ZhipuAI GLM
  'glm-4.6':   'glm-4.6',
  'glm-4.7':   'glm-4.7',
  'glm-5':     'glm-5',
  'glm-5.1':   'glm-5.1',

  // OpenAI OSS (open-weight)
  'gpt-oss-120b':   'gpt-oss:120b',
};
/**
 * Load the set of Ollama cloud model names from a pre-fetched
 * out/ollama_cloud.json file.  Returns an empty Set if the file
 * is missing (fetchOllama.ts hasn't been run yet) so callers can
 * degrade gracefully to ollama_cloud: false.
 *
 * NOTE: this function receives the raw file content (already read by the
 * caller) rather than reading it internally, to work correctly in both
 * CommonJS and ESM contexts.
 */
export function parseOllamaCloudNames(_raw: string): Set<string> {
  // Retained for backwards compatibility — superseded by ollama.json + inference.json.
  // Returns an empty set so callers degrade gracefully.
  return new Set();
}
