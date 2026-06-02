# Pipeline — Data Sources & Status

This folder contains the scripts that collect, normalise, and cross-reference
benchmark scores for the LLM dashboard. See [PIPELINE.md](./PIPELINE.md) for
the full step-by-step walkthrough.

## Data sources

### LiveBench

Benchmarks data is fetched from https://livebench.ai

- Fetched from the public GitHub Pages CSV (auto-discovers the latest release)
- 119 models as of release `2026_01_08`
- 7 benchmark categories: coding, agentic coding, mathematics, data analysis,
  language, instruction following, reasoning
- All scores are LiveBench's own — the pipeline aggregates tasks into
  categories and computes a global average, but does not modify any value

The dashboard exposes **8 score axes** per model: the global average (`lb_avg`)
plus the 7 categories (`lb_coding`, `lb_agentic`, `lb_math`, `lb_reasoning`,
`lb_data`, `lb_lang`, `lb_instruct`).

```
@inproceedings{livebench,
  title={LiveBench: A Challenging, Contamination-Free {LLM} Benchmark},
  author={Colin White and Samuel Dooley and Manley Roberts and Arka Pal and Benjamin Feuer and Siddhartha Jain and Ravid Shwartz-Ziv and Neel Jain and Khalid Saifullah and Sreemanti Dey and Shubh-Agrawal and Sandeep Singh Sandha and Siddartha Venkat Naidu and Chinmay Hegde and Yann LeCun and Tom Goldstein and Willie Neiswanger and Micah Goldblum},
  booktitle={The Thirteenth International Conference on Learning Representations},
  year={2025},
}
```

### OpenRouter & inference linkage

Models data is fetched from https://openrouter.ai/api/v1/models.

33 of the 119 models are matched to OpenRouter IDs (`openRouterId` field).
The dashboard's "OpenRouter only" toggle filters to these 33 client-side.

A separate `inference.json` records, per LiveBench model, availability across
three platforms — Ollama Cloud, Ollama local, and OpenRouter. No pricing data
is fetched; the OpenRouter and Ollama catalogues are used only for display
names, release dates, ID matching, and inference flags.

### Ollama

Models availability on Ollama is fetched from https://ollama.com/search.

## Running the pipeline

```bash
cd pipeline
pnpm run all              # full pipeline: fetch → process → export → copy
pnpm run all:skip-ollama  # same, but reuse cached out/ollama.json
pnpm run compare          # optional: generate coverage_matrix.html diagnostic
```

Individual steps:

```bash
pnpm run fetch:livebench          # download latest LiveBench CSV + categories
pnpm run fetch:lb-model-config    # resolve model release dates
pnpm run process:livebench        # aggregate task scores → categories
pnpm run normalize                # match LB ids → OpenRouter ids
pnpm run fetch:openrouter         # download OR model catalogue
pnpm run fetch:ollama             # download Ollama catalogue (cloud + local)
pnpm run export:all               # build benchmark_lb.json + inference.json
pnpm run export:lb                # build benchmark_lb.json only
pnpm run export:inference         # build inference.json only
pnpm run copy:website             # copy outputs to website/static/
```

## Outputs

The website consumes two files copied to `website/static/`:
- `benchmark_lb.json`: all 119 models with 8 score axes, metadata, `openRouterId`
- `inference.json`: per-model Ollama Cloud / Ollama local / OpenRouter flags
