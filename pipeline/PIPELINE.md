# Pipeline — How the Data Gets Built

## The big picture

| Step | Source | Script | Output |
|------|--------|--------|--------|
| 1 | livebench.github.io | `fetchLiveBench` | `livebench.csv`, `livebench_categories.json` |
| 2 | `livebench.csv` + `livebench_categories.json` | `processLiveBench` | `livebench_scores.json` |
| 3 | GitHub / OpenRouter / HF APIs | `fetchLiveBenchModelConfig` | `livebench_model_config.json` |
| 4 | `livebench_scores.json` + `openrouter_models.json` | `normalizeModelIds` | `livebench_normalized.json` |
| 5 | openrouter.ai/api | `fetchOpenRouter` | `openrouter_models.json` |
| 6 | ollama.com | `fetchOllama` | `ollama.json` |
| 7 | `livebench_scores.json` + `livebench_normalized.json` + `openrouter_models.json` | `exportLBFull` | `benchmark_lb.json` |
| 8 | `ollama.json` + `benchmark_lb.json` | `exportInference` | `inference.json` |
| 9 | `benchmark_lb.json`, `inference.json` | `copyToWebsite` | `website/static/*.json` |

One command runs everything:

```bash
pnpm run all
```

(`pnpm run all:skip-ollama` reuses a cached `out/ollama.json` and skips the
Ollama scrape.)

## Step by step

### 1 · Fetch LiveBench (`fetchLiveBench.ts`)

Downloads the latest release CSV from `livebench.github.io/public/`.
Discovers the current release tag via the GitHub tree API, then fetches
`table_<release>.csv`. Also writes the category→tasks mapping for the release.

**Output:** `out/livebench.csv`, `out/livebench_release.txt`, `out/livebench_categories.json`

### 2 · Aggregate scores (`processLiveBench.ts`)

Reads the CSV and aggregates per-task scores into 7 category axes, using the
mapping in `livebench_categories.json`:

| Axis | Tasks |
|---|---|
| `coding` | code_generation, code_completion |
| `agentic_coding` | javascript, typescript, python |
| `mathematics` | AMPS_Hard, integrals_with_game, math_comp, olympiad |
| `data_analysis` | consecutive_events, tablejoin, tablereformat |
| `language` | connections, plot_unscrambling, typos |
| `instruction_following` | paraphrase, simplify, story_generation, summarize |
| `reasoning` | theory_of_mind, zebra_puzzle, spatial, logic_with_navigation |

A `global_average` is computed as the equal-weighted mean of all 7 category scores.
All values are rounded to 1 decimal place. No scores are modified or reweighted.

**Output:** `out/livebench_scores.json` (119 models as of 2026-01-08 release)

### 3 · Fetch model release dates (`fetchLiveBenchModelConfig.ts`)

For each model in the LB dataset, resolves a release date from multiple
sources in priority order: a manually-curated config, the OpenRouter API
`created` timestamp, and regex patterns on the model ID.

**Output:** `out/livebench_model_config.json`

### 4 · Normalise model IDs (`normalizeModelIds.ts`)

Attempts to match each LiveBench model slug to a live OpenRouter model ID.
Matching strategy (in order):

1. Explicit hand-maintained map (handles renamed/aliased models; a `null`
   entry means "known absent from OpenRouter")
2. Case-insensitive slug match against the OR catalogue
3. Provider-prefix heuristics

Every match is validated against the live OR catalogue. If two LB models
resolve to the same OR ID, the one with higher scores is kept. Models with
no OR match get `openRouterId: null`.

**Output:** `out/livebench_normalized.json`

### 5 · Fetch OpenRouter catalogue (`fetchOpenRouter.ts`)

Downloads the full model list from `openrouter.ai/api/v1/models`.
Used for display names and release dates of OR-linked models.

**Output:** `out/openrouter_models.json`

### 6 · Fetch Ollama catalogue (`fetchOllama.ts`)

Scrapes `ollama.com` to build a model catalogue with two flags per entry:
`isOllamaLocal` (pullable via `ollama pull`) and `isOllamaCloud` (hosted on
Ollama Cloud). Used by the inference export.

**Output:** `out/ollama.json`

### 7 · Export benchmarks (`exportLBFull.ts`)

Combines the LB scores, normalised OR IDs, and OR catalogue into a single
`BenchmarkData` JSON. The top-level object carries `generated`, `dataset`,
`openRouterOnly`, `modelCount`, a `benchmarks` definition map (the 8 axes),
`familyOrder`, and the `models` array.

For each model the export adds:

| Field | Source |
|---|---|
| `name` | Explicit override table, then generic slug cleanup |
| `family` | Inferred from model ID prefix |
| `brand` | Human-readable provider name |
| `type` | `'open'` or `'closed'` based on known open-weight providers |
| `released` | Model config cache → ID regex → OR timestamp → fallback table |
| `vfl` | Versions-from-latest rank within family + type group |
| `openRouterId` | From normalisation step (`null` if unmatched) |
| `sources` | Provenance tags (currently `['livebench']`) |
| `scores` | The 8 score axes (below) |

Score keys are renamed for the dashboard:

| Export key | LiveBench source |
|---|---|
| `lb_avg` | `global_average` |
| `lb_coding` | `coding` |
| `lb_agentic` | `agentic_coding` |
| `lb_math` | `mathematics` |
| `lb_reasoning` | `reasoning` |
| `lb_data` | `data_analysis` |
| `lb_lang` | `language` |
| `lb_instruct` | `instruction_following` |

**Output:** `out/benchmark_lb.json` (119 models, 33 with `openRouterId`)

### 8 · Export inference availability (`exportInference.ts`)

Builds a map from each LiveBench model ID to its inference availability across
three platforms: `ollamaCloud`, `ollamaLocal`, and `openRouter`. Sources are
the scraped `ollama.json`, the `openRouterId` field from `benchmark_lb.json`,
and a hand-curated `LB_OLLAMA_MAP` (LB-ID → Ollama `slug:tag`).

**Output:** `out/inference.json`

### 9 · Copy to website (`copyToWebsite.ts`)

Copies `out/benchmark_lb.json` and `out/inference.json` → `website/static/`.

**Output:** `website/static/benchmark_lb.json`, `website/static/inference.json`

## The `openRouterId` field and the OpenRouter toggle

Every model has `openRouterId: string | null`. The dashboard's "OpenRouter only"
checkbox filters client-side to `openRouterId !== null` — no second file or network
request is involved.

## Diagnostic tool

```bash
pnpm run compare   # generates out/coverage_matrix.html — Plotly heatmap of
                   # LB category coverage vs OR availability
```
