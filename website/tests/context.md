# LiveBenchViz — Dashboard UI Source Analysis

## 1. Component Tree (What Renders What)

```
+layout.svelte
└── +page.svelte  (main page — owns all state)
    ├── <header> (inline: title, subtitle)
    ├── <div id="stats"> (inline: .stat cards)
    ├── <div class="legend"> (inline: family color pills)
    ├── <section class="chart-section">
    │   └── <ParallelCoords>  ($lib/components/ParallelCoords.svelte)
    ├── <Timeline>             ($lib/components/Timeline.svelte)
    ├── <Sidebar>              ($lib/components/Sidebar.svelte)
    └── <CitationModal>        ($lib/components/CitationModal.svelte)
```

### Rendering flow:
- **`+layout.ts`** runs `loadDataset(fetch)` which loads `/benchmark_lb.json` and `/inference.json`. Data is passed as `data.benchmarkData` and `data.inferenceMap`.
- **`+page.svelte`** is the **single source of truth** for all filter/UI state. It declares all reactive state variables (`$state`) and pass them as `$bindable` props or callbacks to child components.
- **`Sidebar.svelte`** receives all filter toggles as `$bindable` props and two-way binds them back to the page — so every checkbox/button edit flows to the page's derived computations.
- **`ParallelCoords.svelte`** receives `models`, `benchmarks`, `selectedIds`, `highlightedId`, `axisOrder`, `sortBy`, `selectedSortAxis` etc. It manages its own axis-brush state internally and syncs `parallelBrushIds` up via `$bindable`.
- **`Timeline.svelte`** receives `allModels`, `brushStart`/`brushEnd` (two-way bind), and `releaseHoverIds` (two-way bind). It manages its own brush-drag state.
- **`CitationModal.svelte`** is a simple overlay triggered by `showCitation`.

---

## 2. CSS Class Names Used in Templates

### Stats area (`+page.svelte`)
| Class | Element | Purpose |
|-------|---------|---------|
| `.stat` | `<div>` | Outer card for each stat |
| `.stat-label` | `<div>` | Label text (e.g. "Visible") |
| `.stat-value` | `<div>` | Large value (e.g. "42/250") |
| `.stat-sub` | `<div>` | Subtitle (e.g. "models", model name) |

### Sidebar — Family/Model tree (`Sidebar.svelte`)
| Class | Element | Purpose |
|-------|---------|---------|
| `.fam-name` | `<span>` | Family name text in grouped row |
| `.fam-row` | `<div>` | A family header row (click to expand/collapse) |
| `.fam-brand` | `<span>` | Brand name next to family |
| `.fam-count` | `<span>` | Model count badge for family |
| `.model-row` | `<div>` | A single model row (in both grouped & flat views) |
| `.model-name` | `<span>` | Model name text |
| `.model-date` | `<span>` | Release date (YYYY-MM) |
| `.children` | `<div>` | Container for child model rows under a family |
| `.tag.oss` | `<span>` | "OW" badge for open-weight models |
| `.tag.api` | `<span>` | "CW" badge for closed-weight models |
| `.tag.ol` | `<span>` | "Ol☁" / "Ol" badge for Ollama local (+ cloud indicator) |

### Sidebar — Controls (`Sidebar.svelte`)
| Class | Element | Purpose |
|-------|---------|---------|
| `.ctrl-btn` | `<button>` | Select all / Expand all / Collapse all buttons |
| `.sort-btn` | `<button>` | Category / Count / Alpha sort toggles |
| `.search-clr` | `<button>` | ✕ clear button inside search input |
| `.type-btn` | `<button>` | Open Weights / Closed Weights toggle buttons |

### Timeline (`Timeline.svelte`)
| Class | Element | Purpose |
|-------|---------|---------|
| `.tl-btn` | `<button>` | Preset buttons: "6 M", "1 Y", "2 Y", "3 Y", "All" |
| `.tl-btn.active` | `<button>` | Active preset (highlighted) |

### ParallelCoords (`ParallelCoords.svelte`)
| Class | Element | Purpose |
|-------|---------|---------|
| `.wrap` | `<div>` | Outer container for the SVG chart |
| `.sel-tag` | `<div>` | Selected model pill in the chart header |
| `.selected-tags` | `<div>` | Row of selected model pills |

---

## 3. Ollama Checkboxes and Their Labels

There are **4** inference-related checkboxes, all in Sidebar's "Inference" filter group:

| Checkbox variable | Label | Default |
|---|---|---|
| `ollamaCloudOnly` | "Available on Ollama Cloud" | `true` (on) |
| `ollamaLocalOnly` | "Available for Ollama Download" | `true` (on) |
| `openRouterOnly` | "Available on OpenRouter" | `true` (on) |
| `otherSourceOnly` | "Other source" | `true` (on) |

### How they work (OR logic):
A model is visible if **any** of the checked inference sources match:
```ts
const isOther = !inf?.openRouter && !inf?.ollamaCloud && !inf?.ollamaLocal;
const inferenceOk =
  (openRouterOnly  && !!inf?.openRouter)  ||
  (ollamaCloudOnly && !!inf?.ollamaCloud) ||
  (ollamaLocalOnly && !!inf?.ollamaLocal) ||
  (otherSourceOnly && isOther);
```
So unchecking a checkbox **excludes** models from that source. All four are on by default means all models pass.

The `inferenceMap` is loaded from `/inference.json` and keyed by model `id`.

---

## 4. Filter Buttons / Controls

### Type toggles (two buttons)
- **🟢 Open Weights** (`showOpen` toggle) — class `.type-btn.on-open` when active
- **🟡 Closed Weights** (`showClosed` toggle) — class `.type-btn.on-closed` when active

These act as toggle filters. When "Open Weights" is off, models with `type === 'open'` are hidden. Same for closed.

### Inference checkboxes (see §3 above)

### Display checkboxes
- **Show latest 2 per series** (`latest2`) — filters to only models where `m.vfl <= 1` (i.e., at most the 2 newest per family)
- **Group by provider** (`groupByProvider`) — toggles between grouped tree view and flat list in sidebar

### Search input
- `<input class="search-input">` bound to `searchQuery`
- Clear button (`.search-clr`) appears when `hasSearch` is true

### Select/expand controls
- **☑/☐ Select all** (`ctrl-btn`) — checks/unchecks all visible models for chart visibility
- **⊞ Expand all** / **⊟ Collapse all** — expand/collapse all family groups (only in grouped mode)

### Sort buttons (`.sort-btn`)
- **◈ Category** — sorts by selected benchmark axis score (default)
- **# ↓ Count** (grouped) / **📅 Newest** (flat) — sorts by visible model count per family, or by date
- **A–Z Name** — alphabetical sort

When "Category" sort is active, a hint line shows: `▶ {selectedAxisLabel} · click an axis title to change`

### Timeline preset buttons (`.tl-btn`)
- **6 M** — brush to last 6 months
- **1 Y** / **2 Y** / **3 Y** — brush to last N years
- **All** — brush to full date range (clears time filter)

### Axis title click (ParallelCoords)
- Clicking an axis title in the chart sets `selectedSortAxis` to that axis key (for category sort)

---

## 5. How Search Filtering Works

1. The search input is bound to `searchQuery` (two-way bound between `+page.svelte` and `Sidebar.svelte`).
2. In `+page.svelte`, a derived `searchOk(m)` function checks:
   ```ts
   function searchOk(m): boolean {
     const q = searchQuery.trim().toLowerCase();
     if (!q) return true;
     return m.family.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
   }
   ```
   It matches against both `m.family` and `m.name` — case-insensitive substring match.
3. `searchOk` is used in both `visibleModels` (for ParallelCoords) and `visibleIds` (for Sidebar filtering).
4. In Sidebar, `searchOk(m)` is also used locally in `rowVisible(m)` for row display logic.
5. Additionally, when `hasSearch` is true, family groups are auto-expanded regardless of `expandedFamilies`.

---

## 6. How Sidebar Sort (Count vs Alpha vs Category) Works

The `sortBy` state can be `'count'` | `'alpha'` | `'category'` (default: `'category'`).

### In grouped mode (`groupByProvider = true`):

**`visibleFamilies`** is derived by filtering `familyOrder` to those with any visible model, then sorting:

- **Category**: Sort families by their average score on the `selectedSortAxis` (default `lb_avg`), descending. Tiebreak alphabetically.
- **Count**: Sort families by number of visible models descending, alphabetical tiebreak.
- **Alpha**: Sort families alphabetically.

**Within-group sort** (`sortedGroupModels`):
- In "category" mode: models within a family sorted by `selectedSortAxis` score descending.
- Otherwise: models sorted by `released` date descending (newest first).

### In flat mode (`groupByProvider = false`):

**`flatModels`** is all visible models sorted:
- **Category**: by `selectedSortAxis` score descending.
- **Count** (labelled "📅 Newest"): by release date descending.
- **Alpha**: by `family/name` string comparison.

### `selectedSortAxis`:
- Defaults to `'lb_avg'`.
- Clicking an axis title in ParallelCoords sets `selectedSortAxis` to that benchmark key.
- This axis is highlighted in orange in the chart and used for category ordering.

---

## 7. How Timeline Preset Buttons Work

The Timeline component has 5 preset buttons using `activeYears` and `activeMonths` state:

| Button | Action |
|--------|--------|
| **6 M** | Calls `setMonths(6)`: brushes from `now - 6 months` to `now` |
| **1 Y** | Calls `setYears(1)`: brushes from `now - 1 year` to `now` |
| **2 Y** | Calls `setYears(2)`: brushes from `now - 2 years` to `now` |
| **3 Y** | Calls `setYears(3)`: brushes from `now - 3 years` to `now` |
| **All** | Calls `setYears(0)`: sets brushStart/brushEnd to `null` (full range) |

```ts
function setYears(y: number) {
  activeYears  = y;
  activeMonths = 0;
  if (y === 0) { applyBrush(minDate, maxDate); return; }
  const end   = clampDate(new Date());
  const start = clampDate(new Date(end.getFullYear() - y, end.getMonth(), end.getDate()));
  applyBrush(start, end);
}
```

`applyBrush` sets `brushStart`/`brushEnd` (two-way bound to page). If the brushed range covers >99.9% of the full span, it sets both to `null` (i.e., "All" mode).

Manual brush dragging:
- **Left edge drag**: resizes left boundary.
- **Right edge drag**: resizes right boundary.
- **Center drag**: moves the entire brush window.
- **Click outside brush**: recenters brush at click position.
- Minimum brush span: 7 days.

---

## 8. How "Latest 2" Checkbox Works

- **State**: `latest2` (boolean, default `false`, stored in URL as `?latest2=1`)
- **Filter logic** in `visibleModels` and `visibleIds`:
  ```ts
  if (latest2 && m.vfl > 1) return false;
  ```
- Each model has a `vfl` (version-family-level) field. `vfl === 0` means the newest model in its family, `vfl === 1` means the second-newest, etc.
- When `latest2` is `true`, only models with `vfl <= 1` (the 2 most recent per family) pass the filter.
- This filter is applied **after** inference and type filters but **before** time brush.

---

## 9. How localStorage Persistence Works

**There is no direct localStorage usage for filter/persistence state.** Instead, all persistent settings are stored in **URL search parameters** via `history.replaceState`. This means:

- The URL is the single source of truth for persisted state.
- Sharing the URL preserves all settings.
- On page load, `readUrlParams()` reads the URL and initializes state.
- On any state change, the `$effect` in `+page.svelte` writes changes back to the URL.

### URL parameter mapping:

| Parameter | State | Default | Encoding |
|-----------|-------|---------|----------|
| `or` | `openRouterOnly` | `true` | `or=0` when false |
| `oc` | `ollamaCloudOnly` | `true` | `oc=0` when false |
| `ol` | `ollamaLocalOnly` | `true` | `ol=0` when false |
| `os` | `otherSourceOnly` | `true` | `os=0` when false |
| `showOss` | `showOpen` | `true` | `showOss=false` when off |
| `showClosed` | `showClosed` | `true` | `showClosed=false` when off |
| `latest2` | `latest2` | `false` | `latest2=1` when on |
| `group` | `groupByProvider` | `true` | `group=0` when off |
| `sortBy` | `sortBy` | `'category'` | `name` for alpha, `count` for count |
| `sortAxis` | `selectedSortAxis` | `'lb_avg'` | Omitted when default |
| `searchText` | `searchQuery` | `''` | URL-encoded string |
| `from` | `brushStart` | `null` | ISO date (`YYYY-MM-DD`) |
| `to` | `brushEnd` | `null` | ISO date (`YYYY-MM-DD`) |
| `sel` | `selectedIds` | `[]` | Multiple `sel=slug` params |

### In-session (non-persisted) state:
These reset on page reload:
- `hidden` (SvelteSet of model IDs hidden from chart)
- `expandedFamilies` (which tree nodes are expanded)
- `axisOrder` (order of parallel-coords axes — though it is re-synced on data load)
- `highlightedId` (hover highlight)
- `selectedIds` is persisted via URL `sel` slugs (restored on load unless user explicitly cleared selection)
- `parallelBrushIds` (axis brush filter in ParallelCoords)
- `releaseHoverIds` (timeline hover highlight)
- `showCitation` (modal visibility)

### For dataset caching:
`+layout.ts` uses the `loadDataset` function in `$lib/data.ts` which fetches JSON files. The browser's standard HTTP cache + SvelteKit's load function handle caching. There's no explicit localStorage caching of the JSON data in the current code.

---

## 10. How Reset Button Clears State

The **↺ Reset** button in the sidebar calls `onReset` which is bound to `resetAll()` in `+page.svelte`:

```ts
function resetAll() {
  openRouterOnly   = true;
  ollamaCloudOnly  = true;
  ollamaLocalOnly  = true;
  otherSourceOnly  = true;
  showOpen         = true;
  showClosed       = true;
  latest2          = false;
  groupByProvider  = true;
  hidden           = new SvelteSet();
  selectedIds.clear();
  brushStart       = null;
  brushEnd         = null;
  expandedFamilies = {};
  axisOrder        = activeBenchmarks.map(b => b.key);
  sortBy           = 'category';
  selectedSortAxis = 'lb_avg';
  groupByProvider  = true;
  searchQuery      = '';
}
```

This resets:
- All 4 inference checkboxes → on
- Both type toggles → on
- Latest 2 → off
- Group by provider → on
- All hidden models → cleared
- All selected models → cleared
- Time brush → full range
- Expanded families → collapsed
- Axis order → default order from data
- Sort → category, axis → lb_avg
- Search query → empty

Since `resetAll()` sets all the `$state` variables back to defaults, the URL-sync `$effect` will fire and replace the URL with a clean path (no query params), effectively clearing persisted state too.

Note: `userClearedSelection` is NOT reset — but since `selectedIds` is cleared, and the URL `sel` params will be removed, this is fine. Actually, looking closer: `userClearedSelection` is set to `true` only via `clearSelection()`, not via `resetAll`. But since the URL effect will clear the `sel` params, restoring from URL won't re-add them (since the URL will have no `sel` params after reset).

---

## Appendix: File Inventory

| File | Role |
|------|------|
| `src/routes/+layout.svelte` | Global CSS reset, dark theme body |
| `src/routes/+layout.ts` | Loads `benchmark_lb.json` + `inference.json`, passes to page |
| `src/routes/+page.svelte` | Main page: all state, filter logic, stats, legend, layout |
| `src/routes/+page.ts` | Disables prerender (client-side only) |
| `src/lib/components/Sidebar.svelte` | Sidebar: filters, tree/flat list, search, sort |
| `src/lib/components/Timeline.svelte` | Timeline: brushable date range, preset buttons |
| `src/lib/components/ParallelCoords.svelte` | Main chart: parallel coordinates, axis drag/brush, hover/selection |
| `src/lib/components/CitationModal.svelte` | Citation overlay modal |
| `src/lib/data.ts` | `loadDataset()` — async fetch of JSON files |
| `src/lib/types.ts` | TypeScript interfaces: `Model`, `Benchmark`, `InferenceEntry`, `InferenceMap`, `BenchmarkData` |
| `src/lib/colors.ts` | Family colour map + deterministic fallback, axis category labels |