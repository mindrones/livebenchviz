<script lang="ts">
  /**
   * ParallelCoords — Svelte 5 runes.
   *
   * D3 for calculations only: scalePoint, scaleLinear, d3line, d3max.
   * Svelte renders every SVG element declaratively.
   *
   * Interactions:
   *   • Drag axis LABEL (margin area) horizontally → reorder axes.
   *   • Drag axis LINE (chart body) vertically  → brush that axis.
   *   • Hover model LINE (between axes)          → highlight model.
   *   All three targets are spatially separate and never conflict.
   */
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { showTooltip, hideTooltip } from '$lib/tooltip.svelte';
  import { scalePoint, scaleLinear } from 'd3';
  import { line as d3line, max as d3max, quadtree as d3quadtree } from 'd3';

  import { familyColor, AXIS_ABBREV, AXIS_CATEGORY_NAMES } from '$lib/colors';
  import type { Model, Benchmark } from '$lib/types';

  interface Props {
    benchmarks:       Benchmark[];
    models:           Model[];
    highlightedId:    string | null;
    selectedIds:      Set<string>;
    onToggleSelection: (id: string) => void;
    onClearSelection: () => void;
    axisOrder:        string[];        // $bindable — user can reorder
    axisBrushes:      Record<string, [number, number]>; // $bindable — brush ranges per axis (persisted to URL)
    parallelBrushIds: Set<string> | null; // $bindable — brushed model ids (null = no brush)
    releaseHoverIds:  Set<string> | null; // release-time hover from Timeline (null = inactive)
    sortBy:           'count' | 'alpha' | 'category'; // read-only, drives axis highlight
    selectedSortAxis: string;          // $bindable — axis key driving category sort
    isMobile?: boolean;                // mobile viewport – disables hover/select, enlarges touch targets
    isXl?: boolean;                    // ≥1280px (Tailwind xl) – show full axis labels
    showAggBenchmarks?: boolean;
  }
  let {
    benchmarks,
    models,
    highlightedId    = $bindable(null),
    selectedIds,
    onToggleSelection,
    onClearSelection,
    axisOrder        = $bindable([] as string[]),
    axisBrushes      = $bindable({} as Record<string, [number, number]>),
    parallelBrushIds = $bindable(null as Set<string> | null),
    releaseHoverIds  = null as Set<string> | null,
    sortBy,
    selectedSortAxis = $bindable(),
    isMobile          = false,
    isXl              = false,
    showAggBenchmarks = true,
  }: Props = $props();

  // (dataset-switch sync effect is further down, after axisBrushes is declared)

  // ── Container size ──
  let containerW = $state(0);
  let containerH = $state(0);
  let headerH   = $state(0);   // measured height of the HTML header div
  let svgEl      = $state<SVGSVGElement | null>(null);

  const svgH     = $derived(Math.max(0, containerH - headerH));
  const M = $derived(isMobile
    ? { top: 36, right: 40, bottom: 20, left: 40 }
    : { top: 60, right: 52, bottom: 24, left: 52 }
  );
  const innerW = $derived(Math.max(0, containerW - M.left - M.right));
  const innerH = $derived(Math.max(0, svgH - M.top  - M.bottom));

  // Vertical padding inside the plot so extreme points / labels don't clip
  const plotPad = $derived(Math.min(20, Math.max(0, innerH * 0.08)));

  // ── Axis drag state ──
  let dragKey        = $state<string | null>(null);
  let dragCurrentX   = $state(0);    // current x in inner coords
  let dragStartMouseX = 0;           // viewport x when drag started
  let dragAxisOriginX = 0;           // xScale(dragKey) when drag started
  let dragMinX       = $state(0);
  let dragMaxX       = $state(9999);


  // Display order: always includes ALL current benchmark keys.
  // Stale axisOrder entries (from a previous dataset) are dropped;
  // new benchmark keys are prepended so they appear immediately.
  // This is a synchronous $derived — no effects gap when dataset switches.
  const displayOrder = $derived.by(() => {
    const bKeys = benchmarks.map(b => b.key);
    const bSet  = new Set(bKeys);
    const filtered = axisOrder.filter(k => bSet.has(k));
    const missing  = bKeys.filter(k => !filtered.includes(k));
    const base = [...missing, ...filtered];
    if (!dragKey) return base;
    const others = base.filter(k => k !== dragKey);
    const N      = others.length + 1;
    const step   = N > 1 ? innerW / (N - 1) : 0;
    const slot   = Math.max(0, Math.min(N - 1, Math.round(dragCurrentX / step)));
    const result = [...others];
    result.splice(slot, 0, dragKey);
    return result;
  });

  // ── Category Groups (for rendering umbrellas when sub-benchmarks are shown) ──
  const categoryGroups = $derived.by(() => {
    if (showAggBenchmarks) return [];
    const groups: { parentKey: string, label: string, minX: number, maxX: number }[] = [];
    const byParent: Record<string, number[]> = {};
    for (const key of displayOrder) {
      const b = benchmarks.find(x => x.key === key);
      if (b?.parentKey) {
        if (!byParent[b.parentKey]) byParent[b.parentKey] = [];
        byParent[b.parentKey].push(dragKey === key ? dragCurrentX : (xScale(key) ?? 0));
      }
    }
    for (const parentKey of Object.keys(byParent)) {
      const xs = byParent[parentKey];
      groups.push({
        parentKey,
        label: AXIS_CATEGORY_NAMES[parentKey] ?? parentKey,
        minX: Math.min(...xs),
        maxX: Math.max(...xs)
      });
    }
    return groups;
  });

  // ── D3: x scale (uses displayOrder so other axes slide during drag) ──
  const xScale = $derived(
    scalePoint<string>()
      .domain(displayOrder)
      .range([0, innerW])
      .padding(0)
  );

  // ── D3: per-axis y scales ──
  const yScales = $derived.by(() => {
    const out: Record<string, (v: number) => number> = {};
    const bottom = Math.max(plotPad, innerH - plotPad);
    const top    = plotPad;
    for (const b of benchmarks) {
      if (b.higherIsBetter !== false) {
        const s = scaleLinear().domain([0, 100]).range([bottom, top]).clamp(true);
        out[b.key] = (v: number) => s(v);
      } else {
        const vals = models.map(m => m.scores[b.key] ?? 0).filter(v => v > 0);
        const hi   = (d3max(vals) ?? 1) * 1.15;
        const s    = scaleLinear().domain([0, hi]).range([bottom, top]).clamp(true);
        out[b.key] = (v: number) => s(v);
      }
    }
    return out;
  });

  const axisDomainMax = $derived.by(() => {
    const m: Record<string, number> = {};
    for (const b of benchmarks) {
      if (b.higherIsBetter !== false) { m[b.key] = 100; }
      else {
        const vals = models.map(mo => mo.scores[b.key] ?? 0).filter(v => v > 0);
        m[b.key] = (d3max(vals) ?? 1) * 1.15;
      }
    }
    return m;
  });

  // Manual invert: pixel y → score value (no d3 invert needed)
  // Rounded to 1 decimal — matches pipeline precision (round1) so brush
  // ranges are meaningful, URLs stay short, and floating-point noise is eliminated.
  function invertY(pixelY: number, key: string): number {
    const pad = plotPad;
    const plotH = Math.max(1, innerH - 2 * pad);
    const hi = axisDomainMax[key] ?? 100;
    const normalized = Math.max(0, Math.min(1, (innerH - pad - pixelY) / plotH));
    return Math.round(normalized * hi * 10) / 10;
  }

  // ── D3: line generator ──
  interface Pt { x: number; y: number | null }
  const lineGen = $derived(
    d3line<Pt>()
      .defined((d: Pt) => d.y !== null)
      .x((d: Pt) => d.x)
      .y((d: Pt) => d.y as number)
  );

  function modelPath(m: Model): string | null {
    if (showAggBenchmarks) {
      return lineGen(
        displayOrder.map(key => {
          const s = m.scores[key];
          const x = dragKey === key ? dragCurrentX : (xScale(key) ?? 0);
          return { x, y: s != null ? yScales[key](s) : null };
        })
      );
    }

    const pts: Pt[] = [];
    let lastParent: string | null = null;
    for (let i = 0; i < displayOrder.length; i++) {
      const key = displayOrder[i];
      const b = benchmarks.find(x => x.key === key);
      const parent = b?.parentKey ?? key;

      if (i > 0 && parent !== lastParent) {
        pts.push({ x: 0, y: null });
      }

      const s = m.scores[key];
      const x = dragKey === key ? dragCurrentX : (xScale(key) ?? 0);
      pts.push({ x, y: s != null ? yScales[key](s) : null });

      lastParent = parent;
    }
    return lineGen(pts);
  }

  // Ticks
  const PERF_TICKS = [0, 20, 40, 60, 80, 100];
  // ── Highlight ──
  const highlightedModel = $derived(
    highlightedId ? (models.find(m => m.id === highlightedId) ?? null) : null
  );

  // Pre-baked label positions for the highlighted curve (computed once, not per template pixel)
  const highlightedLabels = $derived.by(() => {
    if (!highlightedModel) return [] as Array<{ key: string; x: number; y: number; label: string; labelY: number; isPerf: boolean }>;
    return displayOrder
      .map((key, i) => {
        const score = highlightedModel.scores[key];
        if (score == null) return null;

        const x = dragKey === key ? dragCurrentX : (xScale(key) ?? 0);
        const y = yScales[key](score);
        const bench = benchmarks.find(b => b.key === key);
        const isPerf = bench?.higherIsBetter !== false;
        const label = isPerf ? Math.round(score).toString() : '$' + score.toFixed(2);

        const prevKey = displayOrder[i - 1];
        const nextKey = displayOrder[i + 1];

        let prevScore = null;
        if (prevKey != null) {
          const prevBench = benchmarks.find(b => b.key === prevKey);
          if (showAggBenchmarks || (prevBench?.parentKey ?? prevKey) === (bench?.parentKey ?? key)) {
            prevScore = highlightedModel.scores[prevKey];
          }
        }

        let nextScore = null;
        if (nextKey != null) {
          const nextBench = benchmarks.find(b => b.key === nextKey);
          if (showAggBenchmarks || (nextBench?.parentKey ?? nextKey) === (bench?.parentKey ?? key)) {
            nextScore = highlightedModel.scores[nextKey];
          }
        }
        const prevX = prevScore != null ? (dragKey === prevKey ? dragCurrentX : (xScale(prevKey) ?? 0)) : null;
        const nextX = nextScore != null ? (dragKey === nextKey ? dragCurrentX : (xScale(nextKey) ?? 0)) : null;
        const prevY = prevScore != null ? yScales[prevKey](prevScore) : null;
        const nextY = nextScore != null ? yScales[nextKey](nextScore) : null;

        const angleLeft  = prevX != null && prevY != null ? Math.atan2(y - prevY, x - prevX) : null;
        const angleRight = nextX != null && nextY != null ? Math.atan2(nextY - y, nextX - x) : null;

        const labelAbove = angleLeft != null && angleRight != null
          ? angleLeft <= angleRight
          : angleRight != null
            ? angleRight > 0
            : angleLeft != null
              ? angleLeft < 0
              : true;

        const labelY = labelAbove ? y - 17 : y + 17; // 12 + 5px extra safety

        return { key, x, y, label, labelY, isPerf };
      })
      .filter((d): d is NonNullable<typeof d> => d != null);
  });

  // ── Release-time hover (driven by Timeline) ──
  const releaseHoverModels = $derived(
    releaseHoverIds ? models.filter(m => releaseHoverIds!.has(m.id)) : []
  );
  const releaseHoverLabel = $derived.by(() => {
    if (!releaseHoverModels.length) return null;
    const date = new Date(releaseHoverModels[0].released)
      .toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
    return { date, models: releaseHoverModels, count: releaseHoverModels.length };
  });

  // ── Brush state ──
  // (axisBrushes is now a $bindable prop — owned by the page, persists across remounts)
  let pillHoverId = $state<string | null>(null);

  // When the benchmark set changes (dataset toggle): synchronously, displayOrder
  // already self-heals. This effect handles two async clean-ups:
  //   1. Remove stale axis brushes — an LB brush on an HF dataset would dim ALL
  //      HF models to opacity 0.07 because their scores for the LB key are null.
  //   2. Sync axisOrder so it only contains current benchmark keys (persistence).
  $effect(() => {
    const keys = new Set(benchmarks.map(b => b.key));
    const stale = Object.keys(axisBrushes).filter(k => !keys.has(k));
    if (stale.length) {
      axisBrushes = Object.fromEntries(Object.entries(axisBrushes).filter(([k]) => keys.has(k)));
    }
    const validOrder  = axisOrder.filter(k => keys.has(k));
    const missingKeys = [...keys].filter(k => !validOrder.includes(k));
    if (validOrder.length !== axisOrder.length || missingKeys.length) {
      axisOrder = [...missingKeys, ...validOrder];
    }
  });

  const brushPassIds = $derived.by((): Set<string> | null => {
    const entries = Object.entries(axisBrushes) as [string, [number, number]][];
    if (!entries.length) return null;
    return new Set(
      models.filter(m => entries.every(([key, [lo, hi]]) => {
        const s = m.scores[key]; return s != null && s >= lo && s <= hi;
      })).map(m => m.id)
    );
  });

  // Sync derived brushPassIds up to parent via the bindable prop
  $effect(() => { parallelBrushIds = brushPassIds; });

  function lineOpacity(m: Model): number {
    const ok = !brushPassIds || brushPassIds.has(m.id);
    if (!ok) return 0.07;
    if (releaseHoverIds) return releaseHoverIds.has(m.id) ? 1 : 0.12;

    // If hovering a specific selection pill
    if (pillHoverId) {
      if (m.id === pillHoverId) return 1;
      if (selectedIds.has(m.id)) return 0.25;
      return 0.05;
    }

    if (highlightedId === m.id) return 1;
    if (selectedIds.has(m.id)) return 0.9;
    if (selectedIds.size > 0) return 0.12;
    if (highlightedId && highlightedId !== m.id) return 0.28;
    return 0.56;
  }
  function lineWidth(m: Model): number {
    if (releaseHoverIds && releaseHoverIds.has(m.id)) return highlightedId === m.id ? 2.6 : 1.9;

    // If hovering a specific selection pill
    if (pillHoverId && m.id === pillHoverId) return 3.2;

    if (selectedIds.has(m.id)) return highlightedId === m.id ? 3.2 : 2.2;
    if (!brushPassIds) return highlightedId === m.id ? 3.0 : 1.4;
    return brushPassIds.has(m.id) ? (highlightedId === m.id ? 3.0 : 1.6) : 0.8;
  }

  // ── Brush drag ──
  type BrushMode = 'new' | 'move' | 'top' | 'bot';
  interface BrushDrag { key: string; mode: BrushMode; startScore: number; origBrush: [number,number]|null }
  let brushDrag = $state<BrushDrag | null>(null);
  const handleHitPx = $derived(isMobile ? 28 : 14);  // brush handle hit area (larger on touch)
  const brushZoneW = $derived(isMobile ? 44 : 16);     // axis brush zone width (wider on touch)
  let labelDragMoved = $state(false);                  // track whether label drag actually moved
  let labelHoverX = $state<number | null>(null);      // x position within label overlay for cursor feedback
  const MIN_RANGE = 0.5;

  function clientYtoScore(clientY: number, key: string): number {
    const rect = svgEl!.getBoundingClientRect();
    return invertY(clientY - rect.top - M.top, key);
  }

  function onAxisDown(e: PointerEvent, key: string) {
    e.preventDefault();
    const rect   = svgEl!.getBoundingClientRect();
    const pixelY = e.clientY - rect.top - M.top;
    const score  = invertY(pixelY, key);
    const brush  = axisBrushes[key] as [number, number] | undefined;
    let mode: BrushMode = 'new';
    let origBrush: [number, number] | null = null;
    if (brush) {
      const topPx = yScales[key](brush[1]);
      const botPx = yScales[key](brush[0]);
      if      (Math.abs(pixelY - topPx) <= handleHitPx)                          { mode = 'top'; origBrush = [...brush]; }
      else if (Math.abs(pixelY - botPx) <= handleHitPx)                          { mode = 'bot'; origBrush = [...brush]; }
      else if (pixelY > topPx - handleHitPx && pixelY < botPx + handleHitPx)       { mode = 'move'; origBrush = [...brush]; }
    }
    if (mode === 'new') axisBrushes = { ...axisBrushes, [key]: [score, score] };
    brushDrag = { key, mode, startScore: score, origBrush };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    e.stopPropagation();
  }

  function onAxisMove(e: PointerEvent, key: string) {
    if (!brushDrag || brushDrag.key !== key) return;
    const score = clientYtoScore(e.clientY, key);
    const hi    = axisDomainMax[key] ?? 100;
    const { mode, startScore, origBrush } = brushDrag;
    if      (mode === 'new')  axisBrushes = { ...axisBrushes, [key]: [Math.min(startScore,score), Math.max(startScore,score)] };
    else if (mode === 'top'  && origBrush) axisBrushes = { ...axisBrushes, [key]: [origBrush[0], Math.max(origBrush[0]+0.5, Math.min(hi, score))] };
    else if (mode === 'bot'  && origBrush) axisBrushes = { ...axisBrushes, [key]: [Math.min(origBrush[1]-0.5, Math.max(0, score)), origBrush[1]] };
    else if (mode === 'move' && origBrush) {
      const d = score - startScore, span = origBrush[1] - origBrush[0];
      const lo = Math.max(0, Math.min(hi - span, origBrush[0] + d));
      axisBrushes = { ...axisBrushes, [key]: [lo, lo + span] };
    }
  }
  function onAxisUp(e: PointerEvent, key: string) {
    if (!brushDrag || brushDrag.key !== key) return;
    const b = axisBrushes[key] as [number, number] | undefined;
    if (b && (b[1] - b[0]) < MIN_RANGE) { const { [key]: _, ...rest } = axisBrushes; axisBrushes = rest; }
    brushDrag = null;
  }



  // ── Quadtree for proximity hover ────────────────────────────────────────────────────
  // Rebuilt as a pure $derived whenever models, axis order, or scales change.
  // D3 quadtree is used ONLY for the spatial lookup calculation — no DOM.
  interface QPoint { x: number; y: number; id: string }
  const qt = $derived.by(() => {
    const pts: QPoint[] = [];
    for (const m of models) {
      // Collect defined vertices for this model in display order
      const verts: Array<{ x: number; y: number }> = [];
      for (const key of displayOrder) {
        const s = m.scores[key];
        if (s == null) continue;
        const x = dragKey === key ? dragCurrentX : (xScale(key) ?? 0);
        const y = yScales[key](s);
        verts.push({ x, y });
        pts.push({ x, y, id: m.id });
      }
      // Interpolate midpoints along each segment (≈30px spacing) for denser coverage
      for (let i = 0; i < verts.length - 1; i++) {
        const a = verts[i], b = verts[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const n  = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 28));
        for (let j = 1; j < n; j++) {
          const t = j / n;
          pts.push({ x: a.x + dx * t, y: a.y + dy * t, id: m.id });
        }
      }
    }
    return d3quadtree<QPoint>()
      .x(p => p.x)
      .y(p => p.y)
      .addAll(pts);
  });

  const HOVER_THRESHOLD = 28; // px — max distance to trigger highlight

  function onChartPointerMove(e: PointerEvent) {
    if (!svgEl || dragKey || brushDrag) { highlightedId = null; return; }
    // On mobile layout, disable hover — users select via Filter tab
    if (isMobile) return;
    const rect = svgEl.getBoundingClientRect();
    const mx = e.clientX - rect.left - M.left;
    const my = e.clientY - rect.top  - M.top;
    const found = qt.find(mx, my, HOVER_THRESHOLD);
    highlightedId = found?.id ?? null;
  }

  function onChartClick(e: MouseEvent) {
    // On mobile, curve clicking is disabled — use Filter tab for selection
    if (isMobile) return;
    if (dragKey || brushDrag) return;
    if (highlightedId) {
      onToggleSelection(highlightedId);
    }
  }

  // ── Axis label (reorder) drag ──
  function onLabelDown(e: PointerEvent, key: string) {
    if (brushDrag) return;
    e.preventDefault();
    // Constrain drag to group bounds
    const b = benchmarks.find(x => x.key === key);
    if (!showAggBenchmarks && b?.parentKey) {
      const siblings = displayOrder.filter(k => benchmarks.find(x => x.key === k)?.parentKey === b.parentKey);
      if (siblings.length > 0) {
        const indices = siblings.map(k => displayOrder.indexOf(k));
        const minIdx = Math.min(...indices);
        const maxIdx = Math.max(...indices);
        const N = displayOrder.length;
        const step = N > 1 ? innerW / (N - 1) : 0;
        dragMinX = minIdx * step;
        dragMaxX = maxIdx * step;
      } else {
        dragMinX = 0; dragMaxX = innerW;
      }
    } else {
      dragMinX = 0; dragMaxX = innerW;
    }
    // Capture the axis's current pixel x BEFORE setting dragKey.
    const axisX = xScale(key) ?? 0;
    dragStartMouseX = e.clientX;
    dragAxisOriginX = axisX;
    dragCurrentX    = axisX;   // start visually at current position
    dragKey         = key;     // set last so displayOrder reacts to correct dragCurrentX
    labelDragMoved  = false;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    e.stopPropagation();
  }
  function onLabelMove(e: PointerEvent, key: string) {
    if (!dragKey || dragKey !== key) return;
    const dx = e.clientX - dragStartMouseX;
    if (Math.abs(dx) > 3) labelDragMoved = true;
    dragCurrentX = Math.max(dragMinX, Math.min(dragMaxX, dragAxisOriginX + dx));
  }
  function onLabelUp(_e: PointerEvent, _key: string) {
    if (!dragKey) return;
    if (!labelDragMoved) {
      // No drag movement — treat as a tap/click to sort by this axis
      selectedSortAxis = _key;
    }
    axisOrder = [...displayOrder];
    dragKey   = null;
  }

  // ── Axis title click (selects sort axis in category mode) ──
  function onAxisTitleClick(key: string) {
    selectedSortAxis = key;
  }

  const selectedModels = $derived(
    Array.from(selectedIds).map(id => models.find(m => m.id === id)).filter((m): m is Model => !!m)
  );

  function onDeselectModel(e: MouseEvent, id: string) {
    e.stopPropagation();
    onToggleSelection(id);
    if (pillHoverId === id) pillHoverId = null;
    if (highlightedId === id) highlightedId = null;
  }

  function onClearAll(e: MouseEvent) {
    e.stopPropagation();
    onClearSelection(); // Use the new callback to clear all selections at once
    pillHoverId = null;
    highlightedId = null;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->

<div class="wrap" bind:clientWidth={containerW} bind:clientHeight={containerH}>
  {#if containerW > 0 && containerH > 0}

    <!-- ── HTML header: hint or model name + selected tags ── -->
    <div class="chart-header" bind:clientHeight={headerH}>
      {#if releaseHoverLabel}
        <div class="header-title" style="color: var(--color-error);">
          ▾ {releaseHoverLabel.date} · {releaseHoverLabel.count} model{releaseHoverLabel.count === 1 ? '' : 's'}
        </div>
        <div class="selected-tags">
          {#each releaseHoverLabel.models as m (m.id)}
            <div class="sel-tag">
              <span class="sel-name">{m.name}</span>
              {#if m.effort}
                <span class="effort-tag effort-{m.effort}">{m.effort}</span>
              {/if}
            </div>
          {/each}
        </div>
      {:else if highlightedModel || selectedIds.size > 0}
        <div class="header-title">
          {#if highlightedModel}
            {highlightedModel.name}
            {#if highlightedModel.effort}
              <span class="effort-badge effort-{highlightedModel.effort}">{highlightedModel.effort}</span>
            {/if}
            <span class="header-id">({highlightedModel.id})</span>
          {:else}
            {selectedModels[0]?.name}{selectedModels.length > 1 ? ', ...' : ''}
          {/if}
        </div>
        <div class="selected-tags">
          {#each selectedModels as m (m.id)}
            <div class="sel-tag"
              class:hovered={highlightedId === m.id || pillHoverId === m.id}
              onpointerenter={() => (pillHoverId = m.id)}
              onpointerleave={() => (pillHoverId = null)}
            >
              <span class="sel-name">{m.name}</span>
              {#if m.effort}
                <span class="effort-tag effort-{m.effort}">{m.effort}</span>
              {/if}
              <button class="sel-remove" onclick={(e) => onDeselectModel(e, m.id)} title="Remove from selection">✕</button>
            </div>
          {/each}
          {#if selectedIds.size > 0}
            <button class="clear-btn" onclick={onClearAll}>Clear all</button>
          {/if}
        </div>
      {:else}
        <div class="hint-row" style="font-size:{isMobile ? '11.5px' : '13px'};">
          <span class="hint-chip pointer-fine-only">hover/click a curve to toggle models</span>
          <span class="hint-chip">drag axis labels to reorder</span>
          <span class="hint-chip">brush axes to filter</span>
        </div>
      {/if}
    </div>

    <svg width={containerW} height={svgH} bind:this={svgEl}
      style:cursor={dragKey ? 'grabbing' : (highlightedId && (selectedIds.has(highlightedId) || selectedIds.size < 8)) ? 'pointer' : null}
      style:touch-action="none"
      oncontextmenu={(e) => e.preventDefault()}
      onpointermove={onChartPointerMove}
      onclick={onChartClick}
      onpointerleave={() => {
        if (!brushDrag && !dragKey) {
          highlightedId = null;
          pillHoverId = null;
        }
      }}
    >

      <g transform="translate({M.left},{M.top})">

        <!-- ═══ LAYER 0: category backgrounds ═══ -->
        <g class="category-bg-layer" pointer-events="none">
          {#if !showAggBenchmarks && categoryGroups.length > 0}
            {@const step = displayOrder.length > 1 ? innerW / (displayOrder.length - 1) : 0}
            {#each categoryGroups as group, i}
              {#if i % 2 === 1}
                <rect
                  x={group.minX - step / 2}
                  y={-28}
                  width={(group.maxX - group.minX) + step}
                  height={svgH - M.top + 28}
                  fill="var(--color-bg-elevated)"
                />
              {/if}
            {/each}
          {/if}
        </g>

        <!-- ═══ LAYER 1: axis visuals (no pointer events) ═══ -->
        {#each benchmarks as bench}
          {@const key    = bench.key}
          {@const x      = dragKey === key ? dragCurrentX : (xScale(key) ?? 0)}
          {@const isPerf = bench.higherIsBetter !== false}
          {@const brush  = axisBrushes[key] as [number,number] | undefined}

          <g transform="translate({x},0)" opacity={dragKey===key ? 0.7 : 1}>
            <!-- Axis line -->
            <line x1={0} y1={0} x2={0} y2={innerH} stroke="var(--color-border)" stroke-width={1.5}
              pointer-events="none" />

            <!-- Performance: label + ticks ABOVE -->
              {#each PERF_TICKS as tick}
                {@const ty = yScales[key](tick)}
                <line x1={-5} y1={ty} x2={5} y2={ty} stroke="var(--color-border)" pointer-events="none" />
                <text x={-9} y={ty} text-anchor="end" dominant-baseline="middle"
                  fill="#4b5563" font-size={9} pointer-events="none">{tick}%</text>
              {/each}
              <!-- Touch-friendly overlay for axis label (drag reorder + tap sort) -->
              <rect x={-22} y={-56} width={44} height={52} rx={4}
                fill="transparent" pointer-events="all"
                style="cursor:{dragKey === key ? 'grabbing' : (labelHoverX !== null && labelHoverX < 15 ? 'grab' : 'pointer')};user-select:none"
                onpointerdown={(e) => { hideTooltip(); onLabelDown(e, key); }}
                onpointermove={(e) => {
                  onLabelMove(e, key);
                  if (bench.desc && dragKey === null) {
                    showTooltip(e, bench.label, bench.desc);
                  } else {
                    hideTooltip();
                  }
                  const rect = svgEl?.getBoundingClientRect();
                  if (rect) {
                    const svgLocalX = e.clientX - rect.left - M.left;
                    const axisX = xScale(key) ?? 0;
                    labelHoverX = svgLocalX - axisX + 22; // 22 is the offset of the rect's left edge
                  }
                }}
                onpointerup={(e) => onLabelUp(e, key)}
                onpointercancel={(e) => { onLabelUp(e, key); labelHoverX = null; hideTooltip(); }}
                onpointerleave={() => { labelHoverX = null; hideTooltip(); }}
              />
              <!-- Visual label (no pointer events — overlay rect handles interaction) -->
              <text x={0} y={(!showAggBenchmarks && !bench.parentKey) ? -36 : -14} text-anchor="middle" font-size={isXl ? 12 : 13} font-weight={600} pointer-events="none">
                {#if showAggBenchmarks || !bench.parentKey}
                  <tspan
                    fill="var(--color-text-muted)"
                    font-size={11} font-weight={400}
                    style="user-select:none"
                  >⠿</tspan>
                {/if}
                <tspan
                  dx={(showAggBenchmarks || !bench.parentKey) ? 5 : 0}
                  fill={sortBy === 'category' && key === selectedSortAxis ? '#f97316' : 'var(--color-text-primary)'}
                  style="user-select:none"
                >{bench.abbrev ?? (isXl ? bench.label : (AXIS_ABBREV[key] ?? bench.label))}</tspan>
              </text>

            <!-- Brush visual (pointer-events:none) -->
            {#if brush}
              {@const bTop = yScales[key](brush[1])}
              {@const bBot = yScales[key](brush[0])}
              {@const bH   = bBot - bTop}
              <rect x={-18} y={bTop} width={36} height={bH}
                fill="rgba(99,102,241,0.28)" pointer-events="none" />
              <rect x={-14} y={bTop-4} width={28} height={8} rx={2}
                fill="var(--color-accent)" pointer-events="none" />
              <rect x={-14} y={bBot-4} width={28} height={8} rx={2}
                fill="var(--color-accent)" pointer-events="none" />
              <text x={22} y={bTop+4} fill="var(--color-accent-light)" font-size={9} pointer-events="none">
                {isPerf ? brush[1].toFixed(0)+'%' : '$'+brush[1].toFixed(2)}
              </text>
              <text x={22} y={bBot+4} fill="var(--color-accent-light)" font-size={9} pointer-events="none">
                {isPerf ? brush[0].toFixed(0)+'%' : '$'+brush[0].toFixed(2)}
              </text>
            {/if}
          </g>
        {/each}

        <!-- ═══ CATEGORY GROUPS ═══ -->
        {#if !showAggBenchmarks && categoryGroups.length > 0}
          {@const step = displayOrder.length > 1 ? innerW / (displayOrder.length - 1) : 0}
          {#each categoryGroups as group}
            {@const cx = (group.minX + group.maxX) / 2}
            <text x={cx} y={-36} text-anchor="middle" fill="var(--color-text-primary)" font-size={isXl ? 12 : 13} font-weight={600} pointer-events="none">
              {isXl ? group.label : (AXIS_ABBREV[group.parentKey] ?? group.label)}
            </text>
            <line
              x1={group.minX - step * 0.35}
              x2={group.maxX + step * 0.35}
              y1={-28} y2={-28}
              stroke="var(--color-border)"
              stroke-width={1.5}
              stroke-linecap="round"
            />
          {/each}
        {/if}

        <!-- ═══ LAYER 2: axis overlay rects (brush + reorder) ═══
             No hit-paths for models — hover is handled by SVG onmousemove + quadtree. -->
        {#each benchmarks as bench}
          {@const key    = bench.key}
          {@const x      = dragKey === key ? dragCurrentX : (xScale(key) ?? 0)}
          {@const brush  = axisBrushes[key] as [number,number] | undefined}

          <g transform="translate({x},0)">
            <!-- Brush zone: 16px wide (±8px) — narrow enough not to block hover between axes -->
            <rect x={-brushZoneW/2} y={0} width={brushZoneW} height={innerH}
              fill="transparent"
              style:cursor={brush ? 'ns-resize' : 'crosshair'}
              role="slider" tabindex="0" aria-valuenow="50" aria-label="Brush {bench.label} axis"
              onpointerdown={(e) => onAxisDown(e, key)}
              onpointermove={(e) => onAxisMove(e, key)}
              onpointerup={(e)   => onAxisUp(e, key)}
              onpointercancel={(e) => onAxisUp(e, key)}
            />

          </g>
        {/each}

        <!-- ═══ LAYER 4: visible coloured model lines (no pointer events) ═══ -->
        {#each models as m (m.id)}
          {@const d = modelPath(m)}
          {#if d}
            <path {d} fill="none"
              stroke={selectedIds.has(m.id) ? 'var(--color-text-primary)' : familyColor(m.family)}
              stroke-width={lineWidth(m)}
              opacity={lineOpacity(m)}
              pointer-events="none"
            />
          {/if}
        {/each}

        <!-- ═══ LAYER 5: highlighted model overlay (no pointer events) ═══ -->
        {#if highlightedModel}
          {@const hd = modelPath(highlightedModel)}
          {#if hd}
            <path d={hd} fill="none" stroke="var(--color-text-primary)" stroke-width={2.8} pointer-events="none" />
            {#each highlightedLabels as item (item.key)}
              <circle cx={item.x} cy={item.y} r={4} fill="var(--color-text-primary)" pointer-events="none" />
              <text x={item.x} y={item.labelY} text-anchor="middle" dominant-baseline="middle"
                fill="var(--color-text-primary)" font-size={22} font-weight={700}
                stroke="var(--color-bg-primary)" stroke-width={3} stroke-opacity={0.8} paint-order="stroke"
                font-family="Inter,system-ui,sans-serif" pointer-events="none"
              >{item.label}{item.isPerf ? '%' : ''}</text>
            {/each}
          {/if}
        {/if}

      </g>
    </svg>
  {/if}
</div>

<style>
  .wrap { width: 100%; height: 100%; flex: 1; min-height: 0; display: flex; flex-direction: column; }

  /* ── HTML header above SVG ── */
  .chart-header {
    flex-shrink: 0;
    text-align: center;
    padding: 2px 0 0;
    min-height: 28px;
  }
  .header-title {
    font-size: 18px; font-weight: 700; font-family: Inter, system-ui, sans-serif;
    color: var(--color-text-primary);
  }
  .selected-tags {
    display: flex; justify-content: center; gap: 6px; flex-wrap: wrap;
    padding: 2px 20px 0;
  }
  .sel-tag {
    display: flex; align-items: center; gap: 4px;
    background: var(--color-border); color: var(--color-text-primary); font-size: 11px;
    padding: 2px 6px; border-radius: 4px;
    border: 1px solid var(--color-border); cursor: default; transition: border-color 0.1s;
  }
  .sel-tag:hover { border-color: var(--color-accent) !important; }
  .sel-tag.hovered { border-color: var(--color-accent) !important; background: var(--color-border) !important; }
  .sel-name { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sel-id { font-size: 10px; color: var(--color-text-muted); margin-left: 2px; }
  .header-id { font-size: 13px; font-weight: 400; color: var(--color-text-muted); margin-left: 8px; font-family: monospace; }
  .effort-badge { padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; background: var(--color-bg-hover); color: var(--color-text-muted); margin-left: 6px; vertical-align: middle; }
  .effort-tag { font-weight: 600; text-transform: uppercase; font-size: 9px; padding: 1px 4px; margin-left: 4px; border-radius: 3px; }
  .effort-low { color: var(--color-open); background: var(--color-open-alpha); }
  .effort-medium { color: var(--color-closed); background: var(--color-closed-alpha); }
  .effort-high { color: var(--color-error); background: var(--color-error-alpha); }
  .effort-xhigh { color: var(--color-accent-violet); background: var(--color-accent-violet-alpha); }
  .sel-remove {
    background: none; border: none; color: var(--color-text-muted); cursor: pointer;
    padding: 0 2px; font-size: 12px; display: flex; align-items: center; justify-content: center;
  }
  .sel-remove:hover { color: var(--color-error); }
  .clear-btn {
    background: transparent; border: 1px solid var(--color-error)55; color: var(--color-error);
    font-size: 10px; padding: 2px 6px; border-radius: 4px; cursor: pointer;
  }
  .clear-btn:hover { border-color: var(--color-error); }

  .hint-row {
    display: flex; flex-wrap: wrap; gap: 4px 14px;
    align-items: center; justify-content: center;
    font-style: italic; font-family: Inter, system-ui, sans-serif;
    color: var(--color-text-muted); padding: 4px 12px 0;
  }
  .hint-chip { white-space: nowrap; }
  .pointer-fine-only { display: none; }
  @media (pointer: fine) { .pointer-fine-only { display: inline; } }
</style>
