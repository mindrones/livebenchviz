/**
 * exportLBFull.ts
 * Exports all LiveBench models as a single self-contained BenchmarkData JSON.
 *
 * Every model carries `openRouterId: string | null`.  The website uses this field
 * reactively — no second network request is needed for the "OpenRouter only" toggle.
 *
 * Input:  out/livebench_scores.json       (all LB models, native LB ids)
 *         out/livebench_normalized.json   (models with openRouterId — for linkage)
 *         out/openrouter_models.json      (for release-date fallback on matched models)
 * Output: out/benchmark_lb.json
 *
 * Run:  pnpm run export:lb
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import slugify from 'slugify';
import crypto from 'crypto';

import { getProviderForLBId, getBrand, FAMILY_PRIORITY, LB_OLLAMA_MAP } from './shared/providerMeta.js';
import { extractDate, unixToDate }                       from './shared/dateUtils.js';
import { computeVfl }                                    from './shared/vflUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'out');

// ── Benchmark definitions (LB axes only — no pricing, no HF axes) ─────────────
const BENCHMARKS = {
  // Global average first — shown as the primary axis in the parallel chart
  lb_avg:          { key:'lb_avg',          label:'Average',         desc:'LiveBench global average — equal-weighted mean of all 7 category scores (0\u2013100).',           unit:'%', higherIsBetter:true },
  // Individual category axes
  lb_coding:       { key:'lb_coding',       label:'Coding',          desc:'LiveBench coding — LCB code generation + completion (0\u2013100).',                             unit:'%', higherIsBetter:true },
  lb_agentic:      { key:'lb_agentic',      label:'Agentic Coding',  desc:'LiveBench agentic coding — JavaScript, TypeScript, Python real-world tasks (0\u2013100).',    unit:'%', higherIsBetter:true },
  lb_math:         { key:'lb_math',         label:'Mathematics',     desc:'LiveBench mathematics — AMPS, integrals, AMC/AIME competition problems (0\u2013100).',         unit:'%', higherIsBetter:true },
  lb_reasoning:    { key:'lb_reasoning',    label:'Reasoning',       desc:'LiveBench reasoning — theory of mind, zebra puzzles, spatial, logic navigation (0\u2013100).', unit:'%', higherIsBetter:true },
  lb_data:         { key:'lb_data',         label:'Data Analysis',   desc:'LiveBench data analysis — table joins, reformatting, consecutive events (0\u2013100).',       unit:'%', higherIsBetter:true },
  lb_lang:         { key:'lb_lang',         label:'Language',        desc:'LiveBench language — Connections, plot unscrambling, typos (0\u2013100).',                      unit:'%', higherIsBetter:true },
  lb_instruct:     { key:'lb_instruct',     label:'Instruction',     desc:'LiveBench instruction-following — paraphrase, simplify, story, summarise (0\u2013100).',       unit:'%', higherIsBetter:true },
  // ── Sub-benchmarks ──
  // Reasoning
  theory_of_mind:         { key:'theory_of_mind',         label:'Theory of Mind',         desc:'Reasoning: Theory of Mind',         unit:'%', higherIsBetter:true, parentKey:'lb_reasoning', abbrev:'TM' },
  zebra_puzzle:           { key:'zebra_puzzle',           label:'Zebra Puzzle',           desc:'Reasoning: Zebra Puzzle',           unit:'%', higherIsBetter:true, parentKey:'lb_reasoning', abbrev:'ZP' },
  spatial:                { key:'spatial',                label:'Spatial',                desc:'Reasoning: Spatial',                unit:'%', higherIsBetter:true, parentKey:'lb_reasoning', abbrev:'Sp' },
  logic_with_navigation:  { key:'logic_with_navigation',  label:'Logic with Navigation',  desc:'Reasoning: Logic with Navigation',  unit:'%', higherIsBetter:true, parentKey:'lb_reasoning', abbrev:'LN' },
  // Coding
  code_generation:        { key:'code_generation',        label:'Code Generation',        desc:'Coding: Code Generation',           unit:'%', higherIsBetter:true, parentKey:'lb_coding', abbrev:'G' },
  code_completion:        { key:'code_completion',        label:'Code Completion',        desc:'Coding: Code Completion',           unit:'%', higherIsBetter:true, parentKey:'lb_coding', abbrev:'C' },
  // Agentic Coding
  javascript:             { key:'javascript',             label:'JavaScript',             desc:'Agentic Coding: JavaScript',        unit:'%', higherIsBetter:true, parentKey:'lb_agentic', abbrev:'JS' },
  typescript:             { key:'typescript',             label:'TypeScript',             desc:'Agentic Coding: TypeScript',        unit:'%', higherIsBetter:true, parentKey:'lb_agentic', abbrev:'TS' },
  python:                 { key:'python',                 label:'Python',                 desc:'Agentic Coding: Python',            unit:'%', higherIsBetter:true, parentKey:'lb_agentic', abbrev:'Py' },
  // Mathematics
  AMPS_Hard:              { key:'AMPS_Hard',              label:'AMPS Hard',              desc:'Mathematics: AMPS Hard',            unit:'%', higherIsBetter:true, parentKey:'lb_math', abbrev:'AH' },
  integrals_with_game:    { key:'integrals_with_game',    label:'Integrals with Game',    desc:'Mathematics: Integrals with Game',  unit:'%', higherIsBetter:true, parentKey:'lb_math', abbrev:'IG' },
  math_comp:              { key:'math_comp',              label:'Math Comp',              desc:'Mathematics: Math Comp',            unit:'%', higherIsBetter:true, parentKey:'lb_math', abbrev:'MC' },
  olympiad:               { key:'olympiad',               label:'Olympiad',               desc:'Mathematics: Olympiad',             unit:'%', higherIsBetter:true, parentKey:'lb_math', abbrev:'Ol' },
  // Data Analysis
  consecutive_events:     { key:'consecutive_events',     label:'Consecutive Events',     desc:'Data Analysis: Consecutive Events', unit:'%', higherIsBetter:true, parentKey:'lb_data', abbrev:'CE' },
  tablejoin:              { key:'tablejoin',              label:'Tablejoin',              desc:'Data Analysis: Tablejoin',          unit:'%', higherIsBetter:true, parentKey:'lb_data', abbrev:'TJ' },
  tablereformat:          { key:'tablereformat',          label:'Tablereformat',          desc:'Data Analysis: Tablereformat',      unit:'%', higherIsBetter:true, parentKey:'lb_data', abbrev:'TR' },
  // Language
  connections:            { key:'connections',            label:'Connections',            desc:'Language: Connections',             unit:'%', higherIsBetter:true, parentKey:'lb_lang', abbrev:'Cn' },
  plot_unscrambling:      { key:'plot_unscrambling',      label:'Plot Unscrambling',      desc:'Language: Plot Unscrambling',       unit:'%', higherIsBetter:true, parentKey:'lb_lang', abbrev:'PU' },
  typos:                  { key:'typos',                  label:'Typos',                  desc:'Language: Typos',                   unit:'%', higherIsBetter:true, parentKey:'lb_lang', abbrev:'Ty' },
  // Instruction
  paraphrase:             { key:'paraphrase',             label:'Paraphrase',             desc:'Instruction: Paraphrase',           unit:'%', higherIsBetter:true, parentKey:'lb_instruct', abbrev:'P' },
  simplify:               { key:'simplify',               label:'Simplify',               desc:'Instruction: Simplify',             unit:'%', higherIsBetter:true, parentKey:'lb_instruct', abbrev:'Si' },
  story_generation:       { key:'story_generation',       label:'Story Generation',       desc:'Instruction: Story Generation',     unit:'%', higherIsBetter:true, parentKey:'lb_instruct', abbrev:'SG' },
  summarize:              { key:'summarize',              label:'Summarize',              desc:'Instruction: Summarize',            unit:'%', higherIsBetter:true, parentKey:'lb_instruct', abbrev:'Su' },
};

// ── Display name overrides for LB model IDs ────────────────────────────────────
// Provides clean human-readable names for models whose IDs are ugly or ambiguous.
const LB_DISPLAY_NAMES: Record<string, string> = {
  // OpenAI
  'o1':                                         'o1',
  'o1-2024-12-17-high':                         'o1 (high)',
  'o1-2024-12-17-medium':                       'o1 (medium)',
  'o1-2024-12-17-low':                          'o1 (low)',
  'o1-mini-2024-09-12':                         'o1-mini',
  'o1-preview-2024-09-12':                      'o1 Preview',
  'o3-mini-2025-01-31-high':                    'o3-mini (high)',
  'o3-mini-2025-01-31-medium':                  'o3-mini (medium)',
  'o3-mini-2025-01-31-low':                     'o3-mini (low)',
  'gpt-4o-2024-05-13':                          'GPT-4o (May 24)',
  'gpt-4o-2024-08-06':                          'GPT-4o (Aug 24)',
  'gpt-4o-2024-11-20':                          'GPT-4o (Nov 24)',
  'gpt-4o-mini-2024-07-18':                     'GPT-4o Mini',
  'gpt-4.5-preview-2025-02-27':                 'GPT-4.5 Preview',
  'gpt-4-turbo-2024-04-09':                     'GPT-4 Turbo',
  'gpt-4-0125-preview':                         'GPT-4 Turbo Preview',
  'gpt-4-1106-preview':                         'GPT-4 Turbo (Nov)',
  'gpt-4-0613':                                 'GPT-4',
  'gpt-3.5-turbo-0125':                         'GPT-3.5 Turbo',
  'gpt-3.5-turbo-1106':                         'GPT-3.5 Turbo (Nov)',
  'chatgpt-4o-latest-2025-01-29':               'ChatGPT-4o (Jan 29)',
  'chatgpt-4o-latest-2025-01-30':               'ChatGPT-4o (Jan 30)',
  'chatgpt-4o-latest-2025-03-27':               'ChatGPT-4o (Mar 27)',
  // Anthropic
  'claude-3-7-sonnet-20250219-base':            'Claude 3.7 Sonnet',
  'claude-3-7-sonnet-20250219-thinking-25k':    'Claude 3.7 Sonnet (thinking 25k)',
  'claude-3-7-sonnet-20250219-thinking-64k':    'Claude 3.7 Sonnet (thinking 64k)',
  'claude-3-5-sonnet-20241022':                 'Claude 3.5 Sonnet v2',
  'claude-3-5-sonnet-20240620':                 'Claude 3.5 Sonnet v1',
  'claude-3-5-haiku-20241022':                  'Claude 3.5 Haiku',
  'claude-3-5-opus-20240229':                   'Claude 3.5 Opus',
  'claude-3-opus-20240229':                     'Claude 3 Opus',
  'claude-3-sonnet-20240229':                   'Claude 3 Sonnet',
  'claude-3-haiku-20240307':                    'Claude 3 Haiku',
  // Google Gemini (closed)
  'gemini-2.5-pro-exp-03-25':                   'Gemini 2.5 Pro (exp)',
  'gemini-2.0-pro-exp-02-05':                   'Gemini 2.0 Pro (exp)',
  'gemini-2.0-flash-001':                       'Gemini 2.0 Flash',
  'gemini-2.0-flash':                           'Gemini 2.0 Flash',
  'gemini-2.0-flash-exp':                       'Gemini 2.0 Flash (exp)',
  'gemini-2.0-flash-lite-001':                  'Gemini 2.0 Flash Lite',
  'gemini-2.0-flash-lite-preview-02-05':        'Gemini 2.0 Flash Lite Preview',
  'gemini-2.0-flash-thinking-exp-01-21':        'Gemini 2.0 Flash Thinking (Jan)',
  'gemini-2.0-flash-thinking-exp-1219':         'Gemini 2.0 Flash Thinking (Dec)',
  'gemini-1.5-pro-001':                         'Gemini 1.5 Pro v1',
  'gemini-1.5-pro-002':                         'Gemini 1.5 Pro v2',
  'gemini-1.5-pro-exp-0801':                    'Gemini 1.5 Pro (exp Aug 1)',
  'gemini-1.5-pro-exp-0827':                    'Gemini 1.5 Pro (exp Aug 27)',
  'gemini-1.5-flash-001':                       'Gemini 1.5 Flash v1',
  'gemini-1.5-flash-002':                       'Gemini 1.5 Flash v2',
  'gemini-1.5-flash-exp-0827':                  'Gemini 1.5 Flash (exp)',
  'gemini-1.5-flash-8b-001':                    'Gemini 1.5 Flash 8B',
  'gemini-1.5-flash-8b-exp-0827':               'Gemini 1.5 Flash 8B (exp Aug)',
  'gemini-1.5-flash-8b-exp-0924':               'Gemini 1.5 Flash 8B (exp Sep)',
  'gemini-exp-1114':                            'Gemini Exp (Nov 14)',
  'gemini-exp-1121':                            'Gemini Exp (Nov 21)',
  'gemini-exp-1206':                            'Gemini Exp (Dec 6)',
  'learnlm-1.5-pro-experimental':              'LearnLM 1.5 Pro',
  // Google Gemma (open)
  'gemma-3-27b-it':  'Gemma 3 27B', 'gemma-3-12b-it':  'Gemma 3 12B',
  'gemma-3-4b-it':   'Gemma 3 4B',  'gemma-2-27b-it':  'Gemma 2 27B',
  'gemma-2-9b-it':   'Gemma 2 9B',  'gemma-1.1-7b-it': 'Gemma 1.1 7B',
  // DeepSeek
  'deepseek-v3':                    'DeepSeek V3',
  'deepseek-v3-0324':               'DeepSeek V3 (Mar 24)',
  'deepseek-chat':                  'DeepSeek V2 Chat',
  'deepseek-coder':                 'DeepSeek Coder',
  'deepseek-r1':                    'DeepSeek R1',
  'deepseek-r1-local':              'DeepSeek R1 (local)',
  'deepseek-r1-local-2':            'DeepSeek R1 (local v2)',
  'deepseek-r1-distill-llama-70b':  'DeepSeek R1 Distill Llama 70B',
  'deepseek-r1-distill-qwen-32b':   'DeepSeek R1 Distill Qwen 32B',
  'DeepSeek-R1-Distill-Qwen-32B':   'DeepSeek R1 Distill Qwen 32B',
  'DeepSeek-Coder-V2-Lite-Instruct':'DeepSeek Coder V2 Lite',
  'DeepSeek-V2-Lite-Chat':          'DeepSeek V2 Lite Chat',
  // Qwen
  'qwq-32b':                        'QwQ 32B',
  'qwq-32b-preview':                'QwQ 32B Preview',
  'QwQ-32B-Preview':                'QwQ 32B Preview',
  'qwen2.5-max':                    'Qwen2.5 Max',
  'Qwen2.5-72B-Instruct-Turbo':     'Qwen2.5 72B Instruct',
  'Qwen2.5-7B-Instruct-Turbo':      'Qwen2.5 7B Instruct',
  'Qwen2.5-Coder-32B-Instruct':     'Qwen2.5 Coder 32B',
  'qwen2.5-coder-32b-instruct':     'Qwen2.5 Coder 32B',
  'qwen2.5-72b-instruct-turbo':     'Qwen2.5 72B Instruct',
  'qwen2.5-7b-instruct-turbo':      'Qwen2.5 7B Instruct',
  'Qwen2-72B-Instruct':             'Qwen2 72B Instruct',
  'qwen2-72b-instruct':             'Qwen2 72B Instruct',
  'Qwen2-7B-Instruct':              'Qwen2 7B Instruct',
  'qwen2-math-72b-instruct':        'Qwen2 Math 72B',
  'Qwen2-0.5B-Instruct':            'Qwen2 0.5B',
  'Qwen2-1.5B-Instruct':            'Qwen2 1.5B',
  'Qwen1.5-110B-Chat': 'Qwen1.5 110B', 'Qwen1.5-72B-Chat': 'Qwen1.5 72B',
  'Qwen1.5-7B-Chat':   'Qwen1.5 7B',   'Qwen1.5-4B-Chat':  'Qwen1.5 4B',
  'Qwen1.5-1.8B-Chat': 'Qwen1.5 1.8B', 'Qwen1.5-0.5B-Chat':'Qwen1.5 0.5B',
  'qwen1.5-110b-chat': 'Qwen1.5 110B', 'qwen1.5-72b-chat':  'Qwen1.5 72B',
  'qwen1.5-7b-chat':   'Qwen1.5 7B',   'qwen1.5-4b-chat':   'Qwen1.5 4B',
  'qwen1.5-1.8b-chat': 'Qwen1.5 1.8B', 'qwen1.5-0.5b-chat': 'Qwen1.5 0.5B',
  // Meta
  'Meta-Llama-3-70B-Instruct':                       'Llama 3 70B',
  'Meta-Llama-3-8B-Instruct':                        'Llama 3 8B',
  'meta-llama-3-70b-instruct':                       'Llama 3 70B',
  'meta-llama-3-8b-instruct':                        'Llama 3 8B',
  'Meta-Llama-3.1-405B-Instruct-Turbo':              'Llama 3.1 405B',
  'meta-llama-3.1-405b-instruct-turbo':              'Llama 3.1 405B',
  'Meta-Llama-3.1-70B-Instruct-Turbo':               'Llama 3.1 70B',
  'meta-llama-3.1-70b-instruct-turbo':               'Llama 3.1 70B',
  'Meta-Llama-3.1-8B-Instruct-Turbo':                'Llama 3.1 8B',
  'meta-llama-3.1-8b-instruct-turbo':                'Llama 3.1 8B',
  'llama-3.3-70b-instruct-turbo':                    'Llama 3.3 70B',
  'llama-4-maverick-17b-128e-instruct':              'Llama 4 Maverick',
  'Llama-2-7b-chat-hf':                              'Llama 2 7B',
  'llama-2-7b-chat-hf':                              'Llama 2 7B',
  // NVIDIA
  'llama-3.1-nemotron-70b-instruct':                 'Nemotron 70B',
  'Llama-3.1-Nemotron-70B-Instruct-HF':              'Nemotron 70B',
  // Mistral
  'Mistral-7B-Instruct-v0.2':     'Mistral 7B v0.2',
  'mistral-7b-instruct-v0.2':     'Mistral 7B v0.2',
  'Mistral-7B-Instruct-v0.3':     'Mistral 7B v0.3',
  'Mixtral-8x7B-Instruct-v0.1':   'Mixtral 8x7B',
  'mixtral-8x7b-instruct-v0.1':   'Mixtral 8x7B',
  'open-mixtral-8x7b':            'Mixtral 8x7B',
  'Mixtral-8x22B-Instruct-v0.1':  'Mixtral 8x22B',
  'mixtral-8x22b-instruct-v0.1':  'Mixtral 8x22B',
  'open-mixtral-8x22b':           'Mixtral 8x22B',
  'mistral-large-2402':           'Mistral Large (Feb 24)',
  'mistral-large-2407':           'Mistral Large (Jul 24)',
  'mistral-large-2411':           'Mistral Large (Nov 24)',
  'mistral-large':                'Mistral Large',
  'mistral-small-2402':           'Mistral Small (Feb 24)',
  'mistral-small-2409':           'Mistral Small (Sep 24)',
  'mistral-small-2501':           'Mistral Small (Jan 25)',
  'mistral-small-2503':           'Mistral Small (Mar 25)',
  'open-mistral-nemo':            'Mistral Nemo',
  'mathstral-7B-v0.1':            'Mathstral 7B',
  // Microsoft
  'phi-4':                      'Phi-4',
  'Phi-3.5-mini-instruct':      'Phi-3.5 Mini',
  'Phi-3.5-MoE-instruct':       'Phi-3.5 MoE',
  'Phi-3-medium-128k-instruct': 'Phi-3 Medium 128k',
  'Phi-3-medium-4k-instruct':   'Phi-3 Medium 4k',
  'phi-3-medium-4k-instruct':   'Phi-3 Medium 4k',
  'Phi-3-mini-128k-instruct':   'Phi-3 Mini 128k',
  'Phi-3-mini-4k-instruct':     'Phi-3 Mini 4k',
  'phi-3-mini-128k-instruct':   'Phi-3 Mini 128k',
  'phi-3-mini-4k-instruct':     'Phi-3 Mini 4k',
  'Phi-3-small-128k-instruct':  'Phi-3 Small 128k',
  'Phi-3-small-8k-instruct':    'Phi-3 Small 8k',
  'phi-3-small-8k-instruct':    'Phi-3 Small 8k',
  // xAI
  'grok-3-beta':                'Grok 3 Beta',
  'grok-3':                     'Grok 3',
  'grok-3-mini-reasoning-beta': 'Grok 3 Mini Reasoning',
  'grok-2-1212':                'Grok 2 (Dec 12)',
  'grok-2':                     'Grok 2',
  'grok-2-mini':                'Grok 2 Mini',
  'grok-beta':                  'Grok Beta',
  // Perplexity
  'sonar':                      'Sonar',
  'sonar-pro':                  'Sonar Pro',
  'perplexity-sonar-reasoning': 'Sonar Reasoning',
  // Cohere
  'command-r-plus-04-2024':     'Command R+ (Apr 24)',
  'command-r-plus-08-2024':     'Command R+ (Aug 24)',
  'command-r-03-2024':          'Command R (Mar 24)',
  'command-r-08-2024':          'Command R (Aug 24)',
  'command-a-03-2025':          'Command A',
  // Amazon
  'amazon.nova-pro-v1:0':       'Nova Pro',
  'amazon.nova-lite-v1:0':      'Nova Lite',
  'amazon.nova-micro-v1:0':     'Nova Micro',
  // 01.AI
  'Yi-6B-Chat': 'Yi 6B', 'yi-6b-chat': 'Yi 6B',
  // Tencent
  'hunyuan-turbos-20250313':    'Hunyuan Turbo S',
  // StepFun
  'step-2-16k-202411':          'Step 2 16k',
  // AllenAI
  'olmo-2-1124-13b-instruct':   'OLMo 2 13B',
  // NovaSky
  'sky-t1-32b-preview':         'Sky-T1 32B',
  // NousResearch
  'hermes-3-llama-3.1-70b':     'Hermes 3 Llama 3.1 70B',
  // Abacus AI
  'Dracarys2-72B-Instruct':     'Dracarys2 72B',
  'dracarys2-72b-instruct':     'Dracarys2 72B',
  'dracarys2-llama-3.1-70b-instruct': 'Dracarys2 Llama 3.1 70B',
  'Smaug-Qwen2-72B-Instruct':   'Smaug Qwen2 72B',
  // Berkeley
  'Starling-LM-7B-beta':        'Starling LM 7B',
  'starling-lm-7b-beta':        'Starling LM 7B',
  // Teknium
  'OpenHermes-2.5-Mistral-7B':  'OpenHermes 2.5 7B',
  // Matt Shumer
  'Reflection-Llama-3.1-70B':   'Reflection Llama 3.1 70B',
  'reflection-llama-3.1-70b':   'Reflection Llama 3.1 70B',
  // LMSYS
  'vicuna-7b-v1.5':             'Vicuna 7B v1.5',
  'vicuna-7b-v1.5-16k':         'Vicuna 7B v1.5 (16k)',
  // HuggingFace (Zephyr)
  'zephyr-7b-alpha':            'Zephyr 7B Alpha',
  'zephyr-7b-beta':             'Zephyr 7B Beta',
  // Research fine-tunes
  'acm_rewrite_qwen2-72B-Chat': 'ACM Rewrite Qwen2 72B',
  'codegen3_5k-qwen2.5-72b-instruct-2-chk-50':              'CodeGen3 Qwen2.5 72B',
  'coding-meta-llama-3.1-70b-instruct-chk-50':               'Coding Llama 3.1 70B (v1)',
  'coding2-amcfull-apifull-mmlu12k-meta-llama-3.1-70b-instruct-chk-150': 'Coding Llama 3.1 70B (v2)',
  'lcb-math-qwen2-72b-instructv3-merged-50':                 'LCB-Math Qwen2 72B',
  // Unknown
  'azerogpt':        'AzeroGPT',
  'wbot-4:347b_no_s':'Wbot 4 347B',
};

/**
 * Known release dates for LB model IDs that don't embed a date in their slug.
 * Also acts as an override for models whose embedded date is incorrect.
 */
// ── Release-date lookup: loaded from livebench_model_config.json at runtime ──
// The cache is populated by:  pnpm run fetch:lb-model-config
// It contains dates from the livebench.ai bundle + page-scraping for models
// that don't have a version field in the bundle.
//
// This static table is the fallback of LAST RESORT for models that:
//   (a) don't appear in the bundle at all, OR
//   (b) have a docs/SPA URL that can't be scraped automatically.
// It is intentionally small — the cache handles everything else.
const LB_RELEASE_DATES_FALLBACK: Record<string, string> = {
  // Old research/obscure models not in the bundle
  'azerogpt':                                                     '2024-01-01',
  'wbot-4:347b_no_s':                                             '2024-01-01',
  'coding2-amcfull-apifull-mmlu12k-meta-llama-3.1-70b-instruct-chk-150': '2024-08-01',
  'lcb-math-qwen2-72b-instructv3-merged-50':                      '2024-09-01',
  // Models whose URLs are SPA/docs pages that can't yield a date automatically
  'glm-4.6':                             '2025-09-01',
  'glm-4.7':                             '2025-10-01',
  'glm-5':                               '2025-12-01',
  'glm-5.1':                             '2026-01-01',
  'glm-5v-turbo':                        '2026-01-01',
  'qwen3-next-80b-a3b-instruct':         '2025-09-06',
  'qwen3-next-80b-a3b-thinking':         '2025-09-06',
  'kimi-k2.5-thinking':                  '2025-09-01',
  'kimi-k2.6-thinking':                  '2026-01-15',
  'grok-4.3':                            '2026-03-09',
  'gemini-3.1-pro-preview-high':         '2025-11-01',
  'gemini-3.1-flash-lite-preview-high':  '2025-11-01',
  'qwen3.6-27b':                         '2026-04-02',
  'qwen3.6-flash':                       '2026-04-02',
  'qwen3.7-max':                         '2026-03-11',
  'elephant-alpha':                      '2026-03-01',
  'arcee-trinity-large-preview':         '2025-12-01',
  'claude-opus-4-8-high-effort':         '2026-04-16',
  'claude-opus-4-8-medium-effort':       '2026-04-16',
  'claude-opus-4-8-low-effort':          '2026-04-16',
  // Minimax overrides (prevent dynamic scraping dates)
  'minimax-m2.5':                        '2026-02-12',
  'minimax-m2.7':                        '2026-03-18',
  'minimax-m3':                          '2026-06-01',
};

// ── Types ──────────────────────────────────────────────────────────────────────
interface LBModel {
  id:           string;
  scores:       Record<string, number>;
  tasks:        Record<string, number>;
  n_categories: number;
}
interface LBData      { categories: string[]; models: LBModel[] }
interface LBNormModel { id: string; openRouterId: string | null }
interface LBNormData  { models: LBNormModel[] }
interface ORModel     { id: string; created: number }
interface ORData      { models: ORModel[] }

interface OllamaTag {
  name:          string;
  slug:          string;
  tag:           string;
  isOllamaLocal: boolean;
  isOllamaCloud: boolean;
}
interface OllamaIndex { tags: OllamaTag[] }
export interface InferenceEntry {
  ollamaCloud: boolean;
  ollamaLocal: boolean;
  openRouter:  boolean;
}

interface OutputModel {
  id:           string;  // native LB id
  slug:         string;
  name:         string;
  family:       string;
  brand:        string;
  type:         'open' | 'closed';
  released:     string;
  effort:       'low' | 'medium' | 'high' | 'xhigh' | null;
  vfl:          number;
  openRouterId:  string | null;
  inference:    InferenceEntry;
  sources:      string[];
  scores: Record<string, number | null>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function round1(v: number | undefined): number | null {
  return v != null && !isNaN(v) ? Math.round(v * 10) / 10 : null;
}

/** Extract standard thinking effort from the model ID. */
function extractEffort(id: string): 'low' | 'medium' | 'high' | 'xhigh' | null {
  const match = id.match(/-(low|medium|high|xhigh)(?:-effort)?$/i);
  if (match) return match[1].toLowerCase() as 'low' | 'medium' | 'high' | 'xhigh';
  return null;
}

/** Clean display name: check explicit table first; fall back to slug cleanup. */
function cleanLBName(id: string): string {
  if (LB_DISPLAY_NAMES[id]) return LB_DISPLAY_NAMES[id];
  // Generic cleanup: strip version tags, dates, platform suffixes; title-case
  let clean = id
    .replace(/[_]/g, '-')
    .replace(/:\w+$/, '')                          // strip :0 variants
    .replace(/-(low|medium|high|xhigh)(?:-effort)?$/i, '') // strip effort suffix
    .replace(/-thinking(?:-auto|-[\d]+k)?$/i, '')   // strip thinking auto/64k suffix
    .replace(/-\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?$/i, '')  // strip date suffix (and anything after if matched by greedy fallback)
    .replace(/-(instruct|chat|it|hf)$/i, '')        // trailing -instruct etc.
    .replace(/-v[\d.]+$/i, '');                     // trailing -v0.1 etc.

  clean = clean.split('-').map(w =>
    w.length <= 2
      ? w.toUpperCase()
      : w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');

  return clean || id;
}

/** Get a release date for a LB model id.
 *  Priority: static fallback table (override) → model-config cache → ID regex → OpenRouter created.
 */
function getLBDate(id: string, orCreated: number | null, configDates: Map<string, string>): string {
  if (LB_RELEASE_DATES_FALLBACK[id]) return LB_RELEASE_DATES_FALLBACK[id];
  if (configDates.has(id)) return configDates.get(id)!;
  const fromId = extractDate(id);
  if (fromId) return fromId;
  if (orCreated) return unixToDate(orCreated);
  return '2024-01-01';
}

function computeFamilyOrder(families: string[]): string[] {
  return [...families].sort((a, b) => {
    const ai = FAMILY_PRIORITY.indexOf(a);
    const bi = FAMILY_PRIORITY.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });
}

/** Create a URL-safe slug from a string (lowercased, spaces to dashes, strip special chars). */
function createSlug(s: string): string {
  return slugify(s, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const lb: LBData    = JSON.parse(readFileSync(path.join(OUT_DIR, 'livebench_scores.json'), 'utf8'));
  const norm: LBNormData = JSON.parse(readFileSync(path.join(OUT_DIR, 'livebench_normalized.json'), 'utf8'));
  const or: ORData    = JSON.parse(readFileSync(path.join(OUT_DIR, 'openrouter_models.json'), 'utf8'));

  // Load model-config cache (dates from bundle + page-scraping)
  const configDates = new Map<string, string>();
  const configFile  = path.join(OUT_DIR, 'livebench_model_config.json');
  if (existsSync(configFile)) {
    try {
      const cfg = JSON.parse(readFileSync(configFile, 'utf8')) as { models: Record<string, { version: string | null }> };
      for (const [id, m] of Object.entries(cfg.models)) {
        if (m.version) configDates.set(id, m.version);
      }
      console.log(`    Loaded ${configDates.size} model dates from livebench_model_config.json`);
    } catch { console.warn('⚠️  livebench_model_config.json unreadable — dates fall back to ID extraction'); }
  } else {
    console.warn('⚠️  livebench_model_config.json missing — run: pnpm run fetch:lb-model-config');
  }

  // Load ollama.json
  const ollamaPath = path.join(OUT_DIR, 'ollama.json');
  const slugLocal = new Set<string>();
  const slugCloud = new Set<string>();
  if (existsSync(ollamaPath)) {
    const ollamaData = JSON.parse(readFileSync(ollamaPath, 'utf8')) as OllamaIndex;
    for (const t of ollamaData.tags) {
      if (t.isOllamaLocal) slugLocal.add(t.slug);
      if (t.isOllamaCloud) slugCloud.add(t.slug);
    }
    console.log(`    Loaded ${ollamaData.tags.length} tags from ollama.json`);
  } else {
    console.warn('⚠️  ollama.json missing — run: pnpm run fetch:ollama');
  }

  // Build lookup: LB id → OpenRouter id (from normalized file)
  const lbToOrId = new Map<string, string>();
  for (const m of norm.models) {
    if (m.openRouterId) lbToOrId.set(m.id, m.openRouterId);
  }

  // Build lookup: OpenRouter id → created timestamp
  const orCreated = new Map<string, number>();
  for (const m of or.models) {
    orCreated.set(m.id, m.created);
  }

  // Build models with full metadata
  const intermediate: (OutputModel & { released: string })[] = [];

  for (const lbm of lb.models) {
    const { family, type } = getProviderForLBId(lbm.id);
    const openRouterId = lbToOrId.get(lbm.id) ?? null;
    const created = openRouterId ? (orCreated.get(openRouterId) ?? null) : null;

    const effort = extractEffort(lbm.id);
    const slug = createSlug(lbm.id);

    const ollamaTag = LB_OLLAMA_MAP[lbm.id];
    let ollamaLocal = false;
    let ollamaCloud = false;

    if (ollamaTag) {
      const ollamaSlug = ollamaTag.includes(':') ? ollamaTag.split(':')[0] : ollamaTag;
      ollamaLocal = slugLocal.has(ollamaSlug);
      ollamaCloud = slugCloud.has(ollamaSlug);
    }

    const inference: InferenceEntry = {
      ollamaCloud,
      ollamaLocal,
      openRouter: openRouterId !== null,
    };

    intermediate.push({
      id:       lbm.id,
      slug,
      name:     cleanLBName(lbm.id),
      family,
      brand:    getBrand(family),
      type,
      released: getLBDate(lbm.id, created, configDates),
      effort:   extractEffort(lbm.id),
      vfl:      0,  // computed below
      openRouterId,
      inference,
      sources:  ['livebench'],
      scores: {
        lb_avg:       round1(lbm.scores['global_average']),
        lb_coding:    round1(lbm.scores['coding']),
        lb_agentic:   round1(lbm.scores['agentic_coding']),
        lb_math:      round1(lbm.scores['mathematics']),
        lb_reasoning: round1(lbm.scores['reasoning']),
        lb_data:      round1(lbm.scores['data_analysis']),
        lb_lang:      round1(lbm.scores['language']),
        lb_instruct:  round1(lbm.scores['instruction_following']),
        // Tasks
        theory_of_mind:         round1(lbm.tasks?.['theory_of_mind']),
        zebra_puzzle:           round1(lbm.tasks?.['zebra_puzzle']),
        spatial:                round1(lbm.tasks?.['spatial']),
        logic_with_navigation:  round1(lbm.tasks?.['logic_with_navigation']),
        code_generation:        round1(lbm.tasks?.['code_generation']),
        code_completion:        round1(lbm.tasks?.['code_completion']),
        javascript:             round1(lbm.tasks?.['javascript']),
        typescript:             round1(lbm.tasks?.['typescript']),
        python:                 round1(lbm.tasks?.['python']),
        AMPS_Hard:              round1(lbm.tasks?.['AMPS_Hard']),
        integrals_with_game:    round1(lbm.tasks?.['integrals_with_game']),
        math_comp:              round1(lbm.tasks?.['math_comp']),
        olympiad:               round1(lbm.tasks?.['olympiad']),
        consecutive_events:     round1(lbm.tasks?.['consecutive_events']),
        tablejoin:              round1(lbm.tasks?.['tablejoin']),
        tablereformat:          round1(lbm.tasks?.['tablereformat']),
        connections:            round1(lbm.tasks?.['connections']),
        plot_unscrambling:      round1(lbm.tasks?.['plot_unscrambling']),
        typos:                  round1(lbm.tasks?.['typos']),
        paraphrase:             round1(lbm.tasks?.['paraphrase']),
        simplify:               round1(lbm.tasks?.['simplify']),
        story_generation:       round1(lbm.tasks?.['story_generation']),
        summarize:              round1(lbm.tasks?.['summarize']),
      },
    });
  }

  // Compute vfl
  const vflMap = computeVfl(intermediate);
  for (const m of intermediate) {
    m.vfl = vflMap.get(m.id) ?? 0;
  }

  // Sort: by family priority, then within family by vfl (0 = newest first)
  const familySet = new Set(intermediate.map(m => m.family));
  const familyOrder = computeFamilyOrder([...familySet]);
  const familyRank = new Map(familyOrder.map((f, i) => [f, i]));

  const models = [...intermediate].sort((a, b) => {
    const fr = (familyRank.get(a.family) ?? 999) - (familyRank.get(b.family) ?? 999);
    if (fr !== 0) return fr;
    return a.vfl - b.vfl;  // lower vfl (= newer) first
  });

  const output = {
    generated:  new Date().toISOString(),
    dataset:    'lb',
    openRouterOnly: false,
    modelCount: models.length,
    benchmarks: BENCHMARKS,
    familyOrder,
    models,
  };

  const outFile = path.join(OUT_DIR, 'benchmark_lb.json');
  const webFile = path.join(__dirname, '..', '..', 'website', 'static', 'benchmark_lb.json');
  
  const outputString = JSON.stringify(output, null, 2);
  writeFileSync(outFile, outputString, 'utf8');
  
  const webDir = path.dirname(webFile);
  if (!existsSync(webDir)) mkdirSync(webDir, { recursive: true });
  writeFileSync(webFile, outputString, 'utf8');

  // Generate data-hash.json
  const { generated, ...hashDataObj } = output;
  const hash = crypto.createHash('md5').update(JSON.stringify(hashDataObj)).digest('hex');
  const hashData = {
    hash,
    updatedAt: new Date().toISOString(),
    modelCount: output.models.length
  };
  const hashFile = path.join(webDir, 'data-hash.json');
  writeFileSync(hashFile, JSON.stringify(hashData, null, 2), 'utf8');

  // ── Summary ────────────────────────────────────────────────────────────────
  const withOpenRouterId = models.filter(m => m.openRouterId).length;
  const fullCover = models.filter(m => m.scores.lb_avg != null).length;

  console.log(`\n✅  LB Full export complete  →  ${outFile}`);
  console.log(`   Total models    : ${models.length}`);
  console.log(`   With OpenRouter linkage : ${withOpenRouterId}`);;
  console.log(`   Full 8-axis cover: ${fullCover}`);
  console.log(`   Families        : ${familyOrder.length}  (${familyOrder.join(', ')})`);
  console.log(`\n   Top 10 by LB Average:`);
  [...models]
    .filter(m => m.scores.lb_avg != null)
    .sort((a, b) => (b.scores.lb_avg ?? 0) - (a.scores.lb_avg ?? 0))
    .slice(0, 10)
    .forEach(m => {
      const avg = m.scores.lb_avg?.toFixed(1) ?? '—';
      console.log(`   ${m.id.padEnd(50)} avg:${avg}  family:${m.family}`);
    });
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
