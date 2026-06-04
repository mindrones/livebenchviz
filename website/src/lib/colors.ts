/**
 * colors.ts — family colour map keyed by OpenRouter provider prefix.
 *
 * For providers not in the map, `familyColor()` generates a deterministic
 * HSL colour from a hash of the provider name so every provider gets a
 * unique, stable colour without manual configuration.
 */

export const FAMILY_COLORS: Record<string, string> = {
  // ── Major closed-API providers ──────────────────────────────────────────
  openai:       '#10b981',  // emerald
  anthropic:    '#f97316',  // orange
  google:       '#3b82f6',  // blue
  cohere:       '#8b5cf6',  // violet
  'x-ai':       '#6366f1',  // indigo  (Grok)
  nvidia:       '#22d3ee',  // sky
  amazon:       '#f59e0b',  // amber
  perplexity:   '#22c55e',  // green
  databricks:   '#ef4444',  // red
  inflection:   '#fb923c',  // orange-400
  ai21:         '#7c3aed',  // violet-700
  snowflake:    '#0ea5e9',  // sky-400

  // ── Open-weight providers ────────────────────────────────────────────────
  'meta-llama': '#ec4899',  // pink
  mistralai:    '#a78bfa',  // purple
  qwen:         '#fbbf24',  // yellow
  deepseek:     '#06b6d4',  // cyan
  microsoft:    '#84cc16',  // lime    (Phi)
  moonshotai:   '#f43f5e',  // rose    (Kimi)
  thudm:        '#14b8a6',  // teal    (GLM / Zhipu)
  zhipuai:      '#14b8a6',
  minimax:      '#fb7185',  // rose-400 (MiniMax)
  xiaomi:       '#f97316',  // orange  (Xiaomi)
  arcee:        '#a3e635',  // lime-400 (Arcee AI)
  openrouter:   '#818cf8',  // indigo-400 (OpenRouter)
  nousresearch: '#d946ef',  // fuchsia
  '01-ai':      '#0284c7',  // blue-600
  internlm:     '#16a34a',  // green-600
  tiiuae:       '#b45309',  // amber-700 (Falcon)
  bigcode:      '#4f46e5',  // indigo-600
  allenai:      '#0891b2',  // cyan-600
  liquid:       '#7c3aed',  // violet-700
};

/**
 * Return the display colour for a model family / provider.
 * Unknown providers get a deterministic colour from a name hash.
 */
export function familyColor(family: string): string {
  if (FAMILY_COLORS[family]) return FAMILY_COLORS[family];
  // Deterministic HSL from djb2-style hash
  let h = 5381;
  for (let i = 0; i < family.length; i++) h = ((h << 5) + h) ^ family.charCodeAt(i);
  const hue = ((h >>> 0) % 360);
  return `hsl(${hue}, 65%, 58%)`;
}

// Short one-liner shown under each benchmark axis acronym
export const AXIS_CATEGORIES: Record<string, string> = {
  // Performance axes (label above)
  mmlu:      'Knowledge',
  gsm8k:     'Grade math',
  math:      'Hard math',
  gpqa:      'Science PhD',
  swebench:  'Engineering',
  bbh:       'Reasoning',
  hellaswag: 'Language',
  // Cost axes (label below, lower = better)
  price_in:  'Cost ↓ better',
  price_out: 'Cost ↓ better',
  price_cr:  'Cost ↓ better',
  price_cw:  'Cost ↓ better',
};

// Abbreviations shown at the top of each LiveBench axis
export const AXIS_ABBREV: Record<string, string> = {
  lb_avg:    'Avg',
  lb_coding: 'C',
  lb_agentic:'AC',
  lb_math:   'M',
  lb_reasoning: 'R',
  lb_data:   'DA',
  lb_lang:   'L',
  lb_instruct: 'I',
};

// Full names for the category legend
export const AXIS_CATEGORY_NAMES: Record<string, string> = {
  lb_avg:    'LiveBench Average',
  lb_coding: 'Coding',
  lb_agentic:'Agentic Coding',
  lb_math:   'Mathematics',
  lb_reasoning: 'Reasoning',
  lb_data:   'Data Analysis',
  lb_lang:   'Language',
  lb_instruct: 'Instruction',
};
