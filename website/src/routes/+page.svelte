<script lang="ts">
  import {
    ChartColumn,
    CircleQuestionMark,
    Funnel,
    TrendingUp,
    GitFork,
  } from "@lucide/svelte";
  import { SvelteSet } from "svelte/reactivity";

  import { browser } from "$app/environment";
  import { replaceState, afterNavigate } from "$app/navigation";
  import { base } from "$app/paths";

  import { breakpoints } from "$lib/stores/breakpoints.svelte";
  import { version } from "../../../package.json";

  import Sidebar from "$lib/components/Sidebar.svelte";
  import ParallelCoords from "$lib/components/ParallelCoords.svelte";
  import Timeline from "$lib/components/Timeline.svelte";
  import CitationModal from "$lib/components/CitationModal.svelte";
  import HelpModal from "$lib/components/HelpModal.svelte";
  import MobileHelpPanel from "$lib/components/MobileHelpPanel.svelte";
  import MobileStatsPanel from "$lib/components/MobileStatsPanel.svelte";
  import NotificationBell from "$lib/components/NotificationBell.svelte";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";

  import { familyColor, AXIS_ABBREV, AXIS_CATEGORY_NAMES } from "$lib/colors";
  import type { BenchmarkData, InferenceMap } from "$lib/types";
  import type { LayoutData } from "./$types";

  // Data loaded by +layout.ts (default: lb_full). Reactive reloads in $effect below.
  let { data }: { data: LayoutData } = $props();

  let mounted = $state(false);
  afterNavigate(() => {
    mounted = true;
  });

  // ── Local benchmark data state (drives everything in this page) ─────────────
  let benchmarkData = $state<BenchmarkData | null>(data.benchmarkData ?? null);
  let inferenceMap = $state<InferenceMap>(data.inferenceMap ?? {});
  let loadError = $state<string | null>(data.error ?? null);
  let loadingData = $state(false);

  // ── Dataset axes come from the loaded JSON's `benchmarks` record ─────────

  // ─── URL search-param helpers ─────────────────────────────────────────────
  // All settings live in the URL. Defaults are never written → clean share URLs.
  // Convention: boolean defaults true  → written as `key=0` when false
  //             boolean defaults false → written as `key=1` when true
  function readUrlParams() {
    if (!browser) return null;
    const sp = new URLSearchParams(window.location.search);

    // Parse brush ranges: any param whose value is "lo-hi" (e.g. lb_math=79.7-91.2)
    // Pattern: two numbers separated by a single hyphen — won't match dates (2024-01-01 has two)
    const BRUSH_RE = /^(\d+\.?\d*)-(\d+\.?\d*)$/;
    const brushes: Record<string, [number, number]> = {};
    sp.forEach((value, key) => {
      const m = value.match(BRUSH_RE);
      if (m) {
        const lo = parseFloat(m[1]);
        const hi = parseFloat(m[2]);
        if (!isNaN(lo) && !isNaN(hi)) brushes[key] = [lo, hi];
      }
    });

    return {
      // inference group (default true — write =0 when off)
      openRouterOnly: sp.get("or") !== "0",
      ollamaCloudOnly: sp.get("oc") !== "0",
      ollamaLocalOnly: sp.get("ol") !== "0",
      otherSourceOnly: sp.get("os") !== "0",
      // display group
      showOpen: sp.get("showOss") !== "false", // keep legacy key
      showClosed: sp.get("showClosed") !== "false", // keep legacy key
      latest2: sp.get("latest2") === "1",
      groupByProvider: sp.get("group") !== "0",
      sortBy: (sp.get("sortBy") === "name"
        ? "alpha"
        : sp.get("sortBy") === "count"
          ? "count"
          : "category") as "count" | "alpha" | "category",
      selectedSortAxis: sp.get("sortAxis") ?? "lb_avg",
      searchQuery: sp.get("searchText") ?? "",
      brushStart: sp.has("from") ? new Date(sp.get("from")!) : null,
      brushEnd: sp.has("to") ? new Date(sp.get("to")!) : null,
      selectedSlugs: sp.getAll("sel"),
      brushes,
      tab: sp.get("tab"),
      eOff: sp.get("eOff")?.split(",") ?? [],
    };
  }
  const url0 = readUrlParams();

  // Brush ranges parsed directly in readUrlParams (pattern-matched from URL params).
  const initialBrushes = url0?.brushes ?? {};

  // ─── Filter & UI state ───────────────────────────────────────────────────
  // All persisted state lives in the URL (see readUrlParams above).
  // In-session-only state (hidden, expandedFamilies, axisOrder) resets on reload.
  // Inference group (default true):
  let openRouterOnly = $state<boolean>(url0?.openRouterOnly ?? true);
  let ollamaCloudOnly = $state<boolean>(url0?.ollamaCloudOnly ?? true);
  let ollamaLocalOnly = $state<boolean>(url0?.ollamaLocalOnly ?? true);
  let otherSourceOnly = $state<boolean>(url0?.otherSourceOnly ?? true);
  // Display group:
  let showOpen = $state<boolean>(url0?.showOpen ?? true);
  let showClosed = $state<boolean>(url0?.showClosed ?? true);
  let latest2 = $state<boolean>(url0?.latest2 ?? false);
  let showEffort = $state<Record<string, boolean>>({
    null: !url0?.eOff.includes("null"),
    low: !url0?.eOff.includes("low"),
    medium: !url0?.eOff.includes("medium"),
    high: !url0?.eOff.includes("high"),
    xhigh: !url0?.eOff.includes("xhigh"),
  });
  let groupByProvider = $state<boolean>(url0?.groupByProvider ?? true);
  let sortBy = $state<"count" | "alpha" | "category">(
    url0?.sortBy ?? "category",
  );
  let selectedSortAxis = $state<string>(url0?.selectedSortAxis ?? "lb_avg");
  let searchQuery = $state<string>(url0?.searchQuery ?? "");
  let brushStart = $state<Date | null>(url0?.brushStart ?? null);
  let brushEnd = $state<Date | null>(url0?.brushEnd ?? null);
  // In-session only (axisOrder is user-reorder; axisBrushes IS persisted to URL):
  let hidden = $state(new SvelteSet<string>());
  let expandedFamilies = $state<Record<string, boolean>>({});
  let axisOrder = $state<string[]>([]);
  let axisBrushes = $state<Record<string, [number, number]>>(initialBrushes);
  let highlightedId = $state<string | null>(null);
  let selectedIds = $state(new SvelteSet<string>());
  let userClearedSelection = $state(false); // Track explicit clear to prevent URL re-restoration
  let parallelBrushIds = $state<Set<string> | null>(null);
  let releaseHoverIds = $state<Set<string> | null>(null);
  let showCitation = $state(false);
  let showHelp = $state(false);
  let sidebarSettingsCollapsed = $state(false);

  // ── Mobile navigation state ────────────────────────────────────────────
  type MobileTab = "filter" | "chart" | "stats" | "help";
  const validTabs: MobileTab[] = ["filter", "chart", "stats", "help"];
  let activeTab: MobileTab = $state(
    url0?.tab && validTabs.includes(url0.tab as MobileTab)
      ? (url0.tab as MobileTab)
      : "chart",
  );

  // ─── Reactive dataset loading ─────────────────────────────────────────────
  // Data is loaded once by +layout.ts.  No reload on openRouterOnly change —
  // the filter is applied reactively in visibleModels / visibleIds below.

  // ─── Data ────────────────────────────────────────────────────────────────
  const bd = $derived(benchmarkData);
  const allBenchmarks = $derived(bd ? Object.values(bd.benchmarks) : []);
  const allModels = $derived(bd?.models ?? []);
  const familyOrder = $derived(bd?.familyOrder ?? []);

  // All axes come from the loaded JSON — pricing absent from static datasets.
  const activeBenchmarks = $derived(allBenchmarks);
  const benchmarks = activeBenchmarks; // alias used throughout the template

  // Ensure axisOrder is always valid when data loads OR dataset changes
  $effect(() => {
    const keys = activeBenchmarks.map((b) => b.key);
    if (!keys.length) return;
    const valid = axisOrder.filter((k) => keys.includes(k));
    const missing = keys.filter((k) => !valid.includes(k));
    if (valid.length !== keys.length || missing.length) {
      axisOrder = [...missing, ...valid]; // new axes go first
    }
  });

  // ─── Search filter (lifted from Sidebar so the chart reacts too) ──────────
  function searchOk(m: (typeof allModels)[number]): boolean {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      m.family.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    );
  }

  // ─── Visible models (ALL filters: type, hidden, inference, latest2, openRouterOnly, time brush, search) ──
  // NOTE: parallelBrushIds is intentionally NOT applied here — ParallelCoords manages its
  // own brush dimming internally. Applying it here would feed back into the chart's model
  // list and cause an infinite update cycle.
  const visibleModels = $derived(
    allModels.filter((m) => {
      const inf = inferenceMap[m.id];
      const isOther =
        !inf?.openRouter && !inf?.ollamaCloud && !inf?.ollamaLocal;
      if (
        !(openRouterOnly && inf?.openRouter) &&
        !(ollamaCloudOnly && inf?.ollamaCloud) &&
        !(ollamaLocalOnly && inf?.ollamaLocal) &&
        !(otherSourceOnly && isOther)
      )
        return false;
      if (!showOpen && m.type === "open") return false;
      if (!showClosed && m.type === "closed") return false;
      if (!showEffort[m.effort ?? "null"]) return false;
      if (latest2 && m.vfl > 1) return false;
      if (hidden.has(m.id)) return false;
      if (!searchOk(m)) return false;
      if (brushStart && brushEnd) {
        const d = new Date(m.released);
        if (d < brushStart || d > brushEnd) return false;
      }
      return true;
    }),
  );

  // ids of curves actually rendered in the chart — lets Timeline snap release-time
  // hover only to dates that have a visible curve.
  const chartIds = $derived(new Set(visibleModels.map((m) => m.id)));

  // visibleIds: all models that pass ALL filters (including brushes, search) even if not hidden-unchecked.
  // Used by Sidebar to decide which families/rows to display.
  // parallelBrushIds IS applied here — it filters the sidebar without affecting the chart's model list.
  const visibleIds = $derived.by(() => {
    return new Set<string>(
      allModels
        .filter((m) => {
          const inf = inferenceMap[m.id];
          const isOther =
            !inf?.openRouter && !inf?.ollamaCloud && !inf?.ollamaLocal;
          if (
            !(openRouterOnly && inf?.openRouter) &&
            !(ollamaCloudOnly && inf?.ollamaCloud) &&
            !(ollamaLocalOnly && inf?.ollamaLocal) &&
            !(otherSourceOnly && isOther)
          )
            return false;
          if (!showEffort[m.effort ?? "null"]) return false;
          if (latest2 && m.vfl > 1) return false;
          if (!searchOk(m)) return false;
          if (brushStart && brushEnd) {
            const d = new Date(m.released);
            if (d < brushStart || d > brushEnd) return false;
          }
          if (parallelBrushIds && !parallelBrushIds.has(m.id)) return false;
          return true;
        })
        .map((m) => m.id),
    );
  });

  // ─── Stats ───────────────────────────────────────────────────────────────
  function topScore(key: string) {
    return [...visibleModels]
      .filter((m) => m.scores[key] != null)
      .sort((a, b) => (b.scores[key] ?? 0) - (a.scores[key] ?? 0))[0];
  }
  const stats = $derived.by(() => [
    {
      label: "Visible",
      value: `${visibleModels.length}/${allModels.length}`,
      sub: "models",
    },
    {
      label: "Families",
      value: String(new Set(visibleModels.map((m) => m.family)).size),
      sub: "series",
    },
    {
      label: "Top Overall",
      value: (topScore("lb_avg")?.scores["lb_avg"] ?? "—") + "%",
      sub: topScore("lb_avg")?.name ?? "",
    },
    {
      label: "Top Coding",
      value: (topScore("lb_coding")?.scores["lb_coding"] ?? "—") + "%",
      sub: topScore("lb_coding")?.name ?? "",
    },
    {
      label: "Top Math",
      value: (topScore("lb_math")?.scores["lb_math"] ?? "—") + "%",
      sub: topScore("lb_math")?.name ?? "",
    },
  ]);

  const legendFamilies = $derived(
    familyOrder.filter((f) => visibleModels.some((m) => m.family === f)),
  );

  // Category legend items for the parallel-coords axes
  const categoryLegend = $derived.by(() => {
    const keys = activeBenchmarks.map((b) => b.key);
    return keys
      .filter((k) => AXIS_ABBREV[k])
      .map((k) => ({
        key: k,
        abbrev: AXIS_ABBREV[k] ?? k,
        name: AXIS_CATEGORY_NAMES[k] ?? k,
      }));
  });

  // ─── URL sync (all persisted settings) ──────────────────────────────────
  $effect(() => {
    if (!browser || !mounted) return;
    const sp = new URLSearchParams();
    // Inference group — write only non-defaults (default = true → write =0 when off)
    if (!openRouterOnly) sp.set("or", "0");
    if (!ollamaCloudOnly) sp.set("oc", "0");
    if (!ollamaLocalOnly) sp.set("ol", "0");
    if (!otherSourceOnly) sp.set("os", "0");
    // Display group
    if (!showOpen) sp.set("showOss", "false");
    if (!showClosed) sp.set("showClosed", "false");
    if (latest2) sp.set("latest2", "1");
    if (!groupByProvider) sp.set("group", "0");
    if (sortBy === "count") sp.set("sortBy", "count");
    if (sortBy === "alpha") sp.set("sortBy", "name");
    if (
      sortBy === "category" &&
      selectedSortAxis &&
      selectedSortAxis !== "lb_avg"
    )
      sp.set("sortAxis", selectedSortAxis);

    const eOff = ["null", "low", "medium", "high", "xhigh"].filter(
      (k) => !showEffort[k],
    );
    if (eOff.length > 0) sp.set("eOff", eOff.join(","));

    if (searchQuery.trim()) sp.set("searchText", searchQuery.trim());
    if (selectedIds.size > 0) {
      selectedModels.forEach((m) => sp.append("sel", m.slug));
    }
    if (brushStart && isFinite(brushStart.getTime()))
      sp.set("from", brushStart.toISOString().slice(0, 10));
    if (brushEnd && isFinite(brushEnd.getTime()))
      sp.set("to", brushEnd.toISOString().slice(0, 10));
    // Axis brushes — each as its own param: key=lo-hi (e.g. lb_math=79.7-91.2)
    for (const [key, [lo, hi]] of Object.entries(axisBrushes)) {
      sp.set(key, `${Math.round(lo * 10) / 10}-${Math.round(hi * 10) / 10}`);
    }
    // Mobile tab — only persist on mobile viewport to keep URLs clean on desktop
    if (breakpoints.isMobile && activeTab !== "chart") sp.set("tab", activeTab);
    const qs = sp.toString();
    replaceState(qs ? `?${qs}` : window.location.pathname, {});
  });

  // ─── Selection ─────────────────────────────────────────────────────────────
  // Restore canonical IDs from slugs in URL params once data is ready
  // Only restore if user hasn't explicitly cleared the selection
  $effect(() => {
    if (
      url0?.selectedSlugs.length &&
      allModels.length &&
      selectedIds.size === 0 &&
      !userClearedSelection
    ) {
      for (const slug of url0.selectedSlugs) {
        const match = allModels.find((m) => m.slug === slug);
        if (match) selectedIds.add(match.id);
      }
    }
  });

  function toggleSelection(id: string) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      if (selectedIds.size >= 8) return;
      selectedIds.add(id);
      userClearedSelection = false; // Reset flag when user adds a new selection
    }
  }
  function clearSelection() {
    selectedIds.clear();
    userClearedSelection = true; // Mark as user-cleared to prevent URL re-restoration
  }

  const selectedModels = $derived(
    allModels.filter((m) => selectedIds.has(m.id)),
  );

  // Breakpoint detection lives in $lib/stores/breakpoints.svelte
  // (initialised in +layout.svelte); read breakpoints.isMobile / isTablet / isDesktop

  // ─── Reset ───────────────────────────────────────────────────────────────
  function resetAll() {
    openRouterOnly = true;
    ollamaCloudOnly = true;
    ollamaLocalOnly = true;
    otherSourceOnly = true;
    showOpen = true;
    showClosed = true;
    showEffort = {
      null: true,
      low: true,
      medium: true,
      high: true,
      xhigh: true,
    };
    latest2 = false;
    groupByProvider = true;
    hidden = new SvelteSet();
    selectedIds.clear();
    brushStart = null;
    brushEnd = null;
    axisBrushes = {};
    expandedFamilies = {};
    axisOrder = activeBenchmarks.map((b) => b.key);
    sortBy = "category";
    selectedSortAxis = "lb_avg";
    groupByProvider = true;
    searchQuery = "";
  }
</script>

<div class="app" class:mobile={breakpoints.isMobile}>
  {#if loadError}
    <div class="error-wrap">
      <div class="error-box">
        <h3>⚠️ Data file not found</h3>
        <p>{loadError}</p>
        <code>node fetch_benchmarks.js</code>
      </div>
    </div>
  {:else if loadingData || !bd}
    <div class="loading">
      <div class="spin"></div>
      <span>Loading…</span>
    </div>
  {:else}
    {#if breakpoints.isMobile}
      <!-- ══════════════ MOBILE LAYOUT ══════════════ -->
      <header class="mobile-header">
        <div class="header-title">
          <h1>LLMs Benchmarks</h1>
          <div class="header-actions">
            <span class="app-version">{version}</span>
            <ThemeToggle />
            <NotificationBell />
            <a
              href="{base}/pipeline"
              class="pipeline-link"
              aria-label="Pipeline Data Flow"
            >
              <GitFork size={20} />
            </a>
            <a
              href="https://github.com/mindrones/livebenchviz"
              target="_blank"
              rel="noopener noreferrer"
              class="github-link"
              aria-label="View on GitHub"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"
                ></path>
                <path d="M9 18c-4.51 2-5-2-7-2"></path>
              </svg>
            </a>
          </div>
        </div>
      </header>

      <div class="mobile-content">
        {#if activeTab === "chart"}
          {#if !breakpoints.isXl}
            <div class="legend category-legend">
              {#each categoryLegend as item (item.key)}
                <span class="category-pill"
                  ><span class="category-abbr">{item.abbrev}</span> = {item.name}</span
                >
              {/each}
            </div>
          {/if}

          <section class="chart-section">
            <ParallelCoords
              isMobile={breakpoints.isMobile}
              isXl={breakpoints.isXl}
              {releaseHoverIds}
              {selectedIds}
              {sortBy}
              benchmarks={activeBenchmarks}
              bind:axisBrushes
              bind:axisOrder
              bind:highlightedId
              bind:parallelBrushIds
              bind:selectedSortAxis
              models={visibleModels}
              onClearSelection={clearSelection}
              onToggleSelection={toggleSelection}
            />
          </section>

          <Timeline
            {chartIds}
            isMobile={breakpoints.isMobile}
            bind:brushEnd
            bind:brushStart
            bind:releaseHoverIds
            models={allModels}
          />
        {:else if activeTab === "filter"}
          <Sidebar
            {familyOrder}
            {hidden}
            {inferenceMap}
            {selectedIds}
            {visibleIds}
            benchmarks={allBenchmarks}
            bind:expandedFamilies
            bind:groupByProvider
            bind:highlightedId
            bind:latest2
            bind:ollamaCloudOnly
            bind:ollamaLocalOnly
            bind:openRouterOnly
            bind:otherSourceOnly
            bind:searchQuery
            bind:selectedSortAxis
            bind:settingsCollapsed={sidebarSettingsCollapsed}
            bind:showCitation
            bind:showClosed
            bind:showEffort
            bind:showOpen
            bind:sortBy
            compact={true}
            generatedDate={bd.generated}
            models={allModels}
            onReset={resetAll}
            onToggleSelection={toggleSelection}
          />
        {:else if activeTab === "stats"}
          <div class="legend stats-legend">
            {#each legendFamilies as fam}
              <span class="legend-pill" style:color={familyColor(fam)}>
                <span class="legend-dot" style:background={familyColor(fam)}
                ></span>{fam}
              </span>
            {/each}
          </div>
          <MobileStatsPanel {stats} />
        {:else if activeTab === "help"}
          <MobileHelpPanel />
        {/if}
      </div>

      <nav class="mobile-nav">
        <button
          class="nav-btn"
          class:active={activeTab === "filter"}
          onclick={() => (activeTab = "filter")}
        >
          <Funnel size={20} />
          <span>Filter</span>
        </button>
        <button
          class="nav-btn"
          class:active={activeTab === "chart"}
          onclick={() => (activeTab = "chart")}
        >
          <ChartColumn size={20} />
          <span>Chart</span>
        </button>
        <button
          class="nav-btn"
          class:active={activeTab === "stats"}
          onclick={() => (activeTab = "stats")}
        >
          <TrendingUp size={20} />
          <span>Stats</span>
        </button>
        <button
          class="nav-btn"
          class:active={activeTab === "help"}
          onclick={() => (activeTab = "help")}
        >
          <CircleQuestionMark size={20} />
          <span>Help</span>
        </button>
      </nav>
    {:else}
      <!-- ══════════════ DESKTOP LAYOUT (unchanged) ══════════════ -->
      <main>
        <header>
          <div class="header-title">
            <h1>LLMs Benchmarks</h1>
            <div class="header-actions">
              <span class="app-version">{version}</span>
              <ThemeToggle />
              <NotificationBell />
              <a
                href="{base}/pipeline"
                class="pipeline-link-btn"
                aria-label="Pipeline Data Flow"
              >
                <GitFork size={15} />
                <span>Data Flow</span>
              </a>
              <button
                class="help-link"
                onclick={() => (showHelp = true)}
                aria-label="How to use"
              >
                <CircleQuestionMark size={20} />
              </button>
              <a
                href="https://github.com/mindrones/livebenchviz"
                target="_blank"
                rel="noopener noreferrer"
                class="github-link"
                aria-label="View on GitHub"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"
                  ></path>
                  <path d="M9 18c-4.51 2-5-2-7-2"></path>
                </svg>
              </a>
            </div>
          </div>
        </header>

        <div id="stats">
          {#each stats as s}
            <div class="stat">
              <div class="stat-label">{s.label}</div>
              <div class="stat-value">{s.value}</div>
              <div class="stat-sub">{s.sub}</div>
            </div>
          {/each}
        </div>

        {#if !breakpoints.isXl}
          <div class="legend category-legend">
            {#each categoryLegend as item (item.key)}
              <span class="category-pill"
                ><span class="category-abbr">{item.abbrev}</span> = {item.name}</span
              >
            {/each}
          </div>
        {/if}

        <section class="chart-section">
          <ParallelCoords
            isMobile={breakpoints.isMobile}
            isXl={breakpoints.isXl}
            {releaseHoverIds}
            {selectedIds}
            {sortBy}
            benchmarks={activeBenchmarks}
            bind:axisBrushes
            bind:axisOrder
            bind:highlightedId
            bind:parallelBrushIds
            bind:selectedSortAxis
            models={visibleModels}
            onClearSelection={clearSelection}
            onToggleSelection={toggleSelection}
          />
        </section>

        <Timeline
          {chartIds}
          isMobile={breakpoints.isMobile}
          bind:brushEnd
          bind:brushStart
          bind:releaseHoverIds
          models={allModels}
        />
      </main>

      <Sidebar
        {familyOrder}
        {hidden}
        {selectedIds}
        onToggleSelection={toggleSelection}
        {inferenceMap}
        {visibleIds}
        benchmarks={allBenchmarks}
        bind:expandedFamilies
        bind:groupByProvider
        bind:highlightedId
        bind:latest2
        bind:ollamaCloudOnly
        bind:ollamaLocalOnly
        bind:openRouterOnly
        bind:otherSourceOnly
        bind:searchQuery
        bind:selectedSortAxis
        bind:showCitation
        bind:showClosed
        bind:showEffort
        bind:showOpen
        bind:sortBy
        generatedDate={bd.generated}
        models={allModels}
        onReset={resetAll}
      />
    {/if}

    <CitationModal show={showCitation} onclose={() => (showCitation = false)} />
    <HelpModal show={showHelp} onclose={() => (showHelp = false)} />
  {/if}
</div>

<style>
  .app {
    display: flex;
    height: 100dvh;
    overflow: hidden;
    background: var(--color-bg-primary);
  }
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    flex: 1;
    color: var(--color-text-muted);
  }
  .spin {
    width: 36px;
    height: 36px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .error-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .error-box {
    background: var(--color-bg-surface);
    border: 1px solid #ef4444;
    border-radius: 10px;
    padding: 24px 28px;
    max-width: 500px;
  }
  .error-box h3 {
    color: #ef4444;
    font-size: 16px;
    margin-bottom: 8px;
  }
  .error-box p {
    color: var(--color-text-muted);
    font-size: 13px;
    line-height: 1.6;
  }
  .error-box code {
    display: block;
    background: var(--color-bg-hover);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 10px 14px;
    margin-top: 10px;
    font-family: monospace;
    font-size: 13px;
    color: var(--color-text-primary);
  }

  main {
    flex: 1;
    overflow-y: auto;
    padding: 18px 24px 0;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 12px;
    gap: 0;
  }
  .header-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }
  h1 {
    font-size: 20px;
    font-weight: 800;
    background: linear-gradient(135deg, var(--color-accent-light), var(--color-accent), var(--color-accent-violet));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .app-version {
    font-size: 12px;
    color: var(--color-text-muted);
    font-weight: 600;
  }
  .help-link {
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    padding: 4px;
    border-radius: 6px;
    transition:
      color 0.2s,
      background 0.2s;
    background: none;
    border: none;
    cursor: pointer;
  }
  .help-link:hover {
    color: var(--color-accent-light);
    background: var(--color-border);
  }
  .github-link {
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    padding: 4px;
    border-radius: 6px;
    transition:
      color 0.2s,
      background 0.2s;
  }
  .github-link:hover {
    color: var(--color-accent-violet);
    background: var(--color-border);
  }
  .pipeline-link {
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    padding: 4px;
    border-radius: 6px;
    transition:
      color 0.2s,
      background 0.2s;
  }
  .pipeline-link:hover {
    color: var(--color-accent-light);
    background: var(--color-border);
  }
  .pipeline-link-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-text-muted);
    font-size: 12px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: rgba(255, 255, 255, 0.02);
    text-decoration: none;
    transition: all 0.2s;
  }
  .pipeline-link-btn:hover {
    color: var(--color-accent-light);
    background: var(--color-border);
    border-color: var(--color-text-faint);
  }

  #stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }
  .stat {
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border);
    border-radius: 7px;
    padding: 8px 12px;
    flex: 1;
    min-width: 88px;
  }
  .stat-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
  }
  .stat-value {
    font-size: 17px;
    font-weight: 800;
  }
  .stat-sub {
    font-size: 10px;
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
    padding: 6px 10px;
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border);
    border-radius: 7px;
  }
  .legend-pill {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    padding: 2px 7px;
    border-radius: 10px;
    border: 1px solid transparent;
  }
  .legend-pill:hover {
    border-color: currentColor;
  }
  .legend-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .stats-legend {
    margin: 0 16px 10px 16px;
  }

  .category-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    margin-bottom: 8px;
    padding: 6px 10px;
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border);
    border-radius: 7px;
  }
  .category-pill {
    font-size: 11px;
    color: var(--color-text-primary);
    padding: 2px 0;
  }
  .category-abbr {
    font-weight: 700;
    color: var(--color-accent-light);
    margin-right: 2px;
  }

  .chart-section {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Mobile layout ─────────────────────────────────────────────────── */
  .app.mobile {
    flex-direction: column;
  }

  .mobile-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 10px 14px 6px;
    flex-shrink: 0;
    background: var(--color-bg-primary);
  }
  .mobile-header .header-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }
  .mobile-header h1 {
    font-size: 17px;
  }

  .mobile-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--color-bg-primary);
    touch-action: pan-y;
    padding: 0 10px;
  }

  .mobile-nav {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    background: var(--color-bg-surface);
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .nav-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 8px 0;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.15s;
    font-size: 11px;
    font-family: "Inter", system-ui, sans-serif;
  }
  .nav-btn:active {
    transform: scale(0.95);
  }
  .nav-btn.active {
    color: var(--color-accent-light);
    background: rgba(129, 140, 248, 0.08);
    box-shadow: inset 0 2px 0 var(--color-accent);
  }
  .nav-btn:hover {
    color: var(--color-accent-light);
  }
  .nav-btn span {
    font-size: 10px;
    letter-spacing: 0.02em;
  }
</style>
