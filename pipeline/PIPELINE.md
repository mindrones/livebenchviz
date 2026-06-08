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
| 10 | `dvc.yaml` | `generateLayout` | `website/static/pipeline_graph.json` |

**Architecture Note:** The execution order and caching of these steps is declaratively managed by **DVC** (`dvc.yaml`). We use DVC purely as a DAG orchestrator (`cache: false` on outputs), meaning the generated data files remain tracked by standard Git to enable seamless deployments.

One command runs the entire pipeline intelligently (skipping unchanged steps):

```bash
dvc repro
```

*(Alternatively, `pnpm run all` serves as an alias to `dvc repro`)*

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

### 10 · Generate Pipeline Graph (`generateLayout.ts`)

Parses the `dvc.yaml` file to dynamically determine the dependencies between all data sources, scripts, and output files. Uses `dagre` to statically compute a visual directed acyclic graph (DAG) layout with X/Y coordinates.

The Svelte frontend fetches this static JSON to draw the pipeline diagram, guaranteeing it perfectly mirrors the backend backend execution structure without requiring client-side layout calculation.

**Output:** `website/static/pipeline_graph.json`

## DVC Optimizations & Incremental Caching

The pipeline is designed to be completely autonomous and heavily optimized using DVC's native features. Instead of manually running `skip-*` scripts, DVC intelligently manages what needs to run based on file hashes and explicit configurations.

1. **Autonomous Polling (`always_changed: true`)**
   - The `fetchLiveBench` and `fetchOpenRouter` stages are configured to run *every time* you invoke `dvc repro`.
   - They poll their respective APIs/Repos. If the downloaded data is identical to the previous run (e.g. no new LiveBench release), DVC detects that the file hash hasn't changed and **gracefully halts**, skipping all downstream processing.

2. **Incremental State Caching (`persist: true`)**
   - The `fetchOllama` and `fetchLiveBenchModelConfig` stages maintain an internal state (e.g. `out/ollama.json` and `out/livebench_model_config.json`).
   - By declaring these outputs with `persist: true` in `dvc.yaml`, DVC does not delete them before running the script.
   - The scripts are written to read these existing files on startup, allowing them to instantly skip slow HTTP/Scraping requests for models they have already processed in the past. They only perform network requests for newly discovered slugs.

3. **Dependency Triggers (`deps`)**
   - `fetchOllama` and `fetchLiveBenchModelConfig` explicitly depend on `out/livebench.csv`.
   - This means even though they have local caches, they are only triggered to run when DVC detects that the core LiveBench dataset has actually changed.

To force a full, fresh run of an incremental stage (e.g. to completely re-scrape Ollama), simply delete its output file (`rm out/ollama.json`) and run `dvc repro`.

## The `openRouterId` field and the OpenRouter toggle

Every model has `openRouterId: string | null`. The dashboard's "OpenRouter only"
checkbox filters client-side to `openRouterId !== null` — no second file or network
request is involved.

## Metadata Resolution Fallbacks

Here is the exact precedence order the pipeline uses to resolve metadata, clean up names, determine open-weight status, and establish release dates.

* **Model Release Date**: The date (YYYY-MM-DD) when a model was officially launched or announced by its creator. Used for chronological sorting, timeline filtering, and calculating the versions-from-latest (`vfl`) ranking.
  1. `modelLinks.js` (unminified source config): Checks the `version` field. This is the most authoritative date provided directly by the LiveBench website maintainers.
  2. Announcement URL regex: If the date is encoded directly in the announcement URL path (e.g., `/blog/2025-06-02-title` or `/news1226`), extracts it directly.
  3. Hugging Face API: For models with Hugging Face links, calls the `/api/models/{org}/{id}` endpoint to get the repository's `createdAt` date. Highly accurate for open-weights.
  4. Model ID regex: Parses dates embedded in the model slug/ID (e.g., extracting `2024-12-17` from `o1-2024-12-17-high`).
  5. Page Meta-Tag Scraping: Fetches the announcement URL and parses HTML metadata tags (`og:published_time` or `datePublished`).
  6. OpenRouter API: Converted from the `created` timestamp in `openrouter_models.json`. Serves as a fallback for API models, though it represents catalog integration date and can be slightly delayed.
  7. Manual Override: Checks `LB_RELEASE_DATES_FALLBACK` in `exportLBFull.ts` for legacy, obscure, or unscrapable models.
  8. Default Fallback: Defaults to `'2024-01-01'` if no other date can be resolved.

* **Model Family and Brand Name**: The provider family identifier (e.g., `openai`, `google`, `meta-llama`) and its clean display brand name (e.g., `OpenAI`, `Google`, `Meta`). Used for grouping and sorting.
  1. Exact Match overrides: Hardcoded exact slug mappings in `providerMeta.ts` (e.g., `o1` ➔ `openai`, `azerogpt` ➔ `other`).
  2. Regex Prefix Rules: Matches prefix patterns case-insensitively in `providerMeta.ts` (e.g., `gpt-`/`chatgpt-` ➔ `openai`, `gemini-` ➔ `google`, `qwq-`/`qwen-` ➔ `qwen`).
  3. Brand Name Mapping: Maps the parsed family slug to a display name in the `BRAND_NAMES` lookup.
  4. Fallback Brand Cleanup: Title-cases the family name (e.g., `some-provider` ➔ `Some Provider`).

* **Open-Weight Status (`type` = `'open' | 'closed'`)**: Indicates if a model's weights are publicly available for local download/execution, or if it is a commercial API-only model.
  1. Provider-level checks: Any model belonging to a family in `OPEN_PROVIDERS` (e.g., `meta-llama`, `deepseek`, `qwen`, `microsoft`) is marked as `'open'`.
  2. Sub-provider rules: Google models starting with `gemma` or `pali` are marked as `'open'`, while `gemini` or `learnlm` are marked as `'closed'`.
  3. Model ID keyword matches: Checks if keywords like `llama`, `gemma`, `mixtral`, `openweight`, or `nemotron` are in the ID.
  4. Default Fallback: Marked as `'closed'` for known closed-source providers, otherwise defaults to `'open'`.

* **OpenRouter Linkage (`openRouterId`)**: The canonical OpenRouter ID (e.g., `openai/gpt-4o`) linked to the LiveBench model. Used to populate catalog prices and enable the "OpenRouter only" toggle.
  1. Explicit Exclusion: Set to `null` if the model ID is explicitly listed in `NOT_ON_OPENROUTER` or mapped to `null` in `EXPLICIT_MAP`.
  2. Explicit Mapping: Checks `EXPLICIT_MAP` in `normalizeModelIds.ts` for manually curated mappings.
  3. Case-Insensitive Slug Match: Checks if the model ID matches an OpenRouter slug (e.g., `sonar-pro` matches `perplexity/sonar-pro`).
  4. Provider Heuristics: Prepends known provider prefixes (e.g., `openai/` + `gpt-4o`) and checks if the resulting ID exists in the OpenRouter API catalog list.

## Diagnostic tool

```bash
pnpm run compare   # generates out/coverage_matrix.html — Plotly heatmap of
                   # LB category coverage vs OR availability
```
