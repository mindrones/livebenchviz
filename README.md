# livebenchviz — LiveBench Dashboard

An interactive dashboard that visualises [LiveBench](https://livebench.ai)
scores for 119 LLMs across 8 axes, with OpenRouter and Ollama inference
linkage.

LiveBench is a contamination-free, monthly-updated benchmark. It draws its
questions from recent (post-training-cutoff) math competitions, news, and
coding contests, so scores are genuinely hard to inflate through
memorisation. This project uses **LiveBench as its sole benchmark source** —
no scores are reweighted or modified; the pipeline only aggregates LiveBench's
own per-task scores into categories and a global average.

---

## Shown benchmarks

Every model in the dashboard carries **8 score axes** (0–100, higher is
better), all sourced directly from LiveBench's published release table. Each
category is the mean of LiveBench's underlying tasks.

| Axis (export key) | LiveBench category | Underlying tasks | What it probes |
|---|---|---|---|
| `lb_avg` | **Global average** | equal-weighted mean of the 7 categories below | Overall general capability |
| `lb_coding` | **Coding** | code_generation, code_completion | LiveCodeBench-style function synthesis & completion |
| `lb_agentic` | **Agentic Coding** | javascript, typescript, python | Real-world, repo-style coding tasks |
| `lb_math` | **Mathematics** | AMPS_Hard, integrals_with_game, math_comp, olympiad | Competition & symbolic mathematics |
| `lb_reasoning` | **Reasoning** | theory_of_mind, zebra_puzzle, spatial, logic_with_navigation | Multi-step logical & spatial reasoning |
| `lb_data` | **Data Analysis** | consecutive_events, tablejoin, tablereformat | Tabular reasoning & transformation |
| `lb_lang` | **Language** | connections, plot_unscrambling, typos | Language manipulation & comprehension |
| `lb_instruct` | **Instruction Following** | paraphrase, simplify, story_generation, summarize | Following precise natural-language instructions |

`lb_avg` is the equal-weighted mean of the seven category scores. All values
are rounded to one decimal place. The pipeline does not modify, reweight, or
re-normalise any LiveBench score.

### Inference & availability linkage

Alongside the scores, the dashboard exposes availability metadata:

- **`openRouterId`** — for the 33 (of 119) models matched to a live OpenRouter
  model. The "OpenRouter only" toggle filters to these client-side.
- **`inference.json`** — per model, whether it is available on **Ollama Cloud**,
  pullable for **Ollama local**, and/or served on **OpenRouter**.

No pricing data is fetched. OpenRouter and Ollama catalogues are used only for
display names, release dates, ID matching, and inference flags.

---

## Repository layout

| Path | Purpose |
|---|---|
| `pipeline/` | Scripts that fetch, normalise, and export LiveBench data → `benchmark_lb.json` + `inference.json` |
| `website/` | SvelteKit dashboard that renders the exported JSON |

### Building the data

```bash
cd pipeline
pnpm install
pnpm run all # fetch → process → export → copy to website/static
```

See [`pipeline/README.md`](./pipeline/README.md) for data
sources and status, and
[`pipeline/PIPELINE.md`](./pipeline/PIPELINE.md) for the
full step-by-step walkthrough.

### Running the dashboard

```bash
pnpm install
pnpm run dev
```
