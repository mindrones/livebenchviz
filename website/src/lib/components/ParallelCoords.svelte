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
  import { scalePoint, scaleLinear } from 'd3';
  import { line as d3line, max as d3max, quadtree as d3quadtree } from 'd3';
  import type { Model, Benchmark } from '$lib/types';
  import { familyColor, AXIS_CATEGORIES } from '$lib/colors';

  interface Props {
    benchmarks:       Benchmark[];
    models:           Model[];
    highlightedId:    string | null;
    selectedIds:      Set<string>;
    onToggleSelection: (id: string) => void;
    onClearSelection: () => void;
    axisOrder:        string[];        // $bindable — user can reorder
    parallelBrushIds: Set<string> | null; // $bindable — brushed model ids (null = no brush)
    releaseHoverIds:  Set<string> | null; // release-time hover from Timeline (null = inactive)
    sortBy:           'count' | 'alpha' | 'category'; // read-only, drives axis highlight
    selectedSortAxis: string;          // $bindable — axis key driving category sort
  }
  let {
    benchmarks,
    models,
    highlightedId    = $bindable(null),
    selectedIds,
    onToggleSelection,
    onClearSelection,
    axisOrder        = $bindable([] as string[]),
    parallelBrushIds = $bindable(null as Set<string> | null),
    releaseHoverIds  = null as Set<string> | null,
    sortBy,
    selectedSortAxis = $bindable('lb_avg'),
  }: Props = $props();

  // (dataset-switch sync effect is further down, after axisBrushes is declared)

  // ── Container size ──
  let containerW = $state(0);
  let containerH = $state(0);
  let svgEl      = $state<SVGSVGElement | null>(null);

  // Bottom margin is only needed for cost-axis labels/titles (drawn BELOW the
  // axis). When the dataset has no cost axes, reserving that space leaves the
  // bottom of the container empty — so make it dynamic and let the y-scales
  // (range [innerH, 0]) stretch into the freed space.
  const hasCostAxis = $derived(benchmarks.some(b => b.higherIsBetter === false));
  const M = $derived({ top: 100, right: 52, bottom: hasCostAxis ? 80 : 24, left: 52 });
  const innerW = $derived(Math.max(0, containerW - M.left - M.right));
  const innerH = $derived(Math.max(0, containerH - M.top  - M.bottom));

  // Vertical padding inside the plot so extreme points / labels don't clip
  const plotPad = $derived(Math.min(20, Math.max(0, innerH * 0.08)));

  // ── Axis drag state ──
  let dragKey        = $state<string | null>(null);
  let dragCurrentX   = $state(0);    // current x in inner coords
  let dragStartMouseX = 0;           // viewport x when drag started
  let dragAxisOriginX = 0;           // xScale(dragKey) when drag started


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
  function invertY(pixelY: number, key: string): number {
    const pad = plotPad;
    const plotH = Math.max(1, innerH - 2 * pad);
    const hi = axisDomainMax[key] ?? 100;
    const normalized = Math.max(0, Math.min(1, (innerH - pad - pixelY) / plotH));
    return normalized * hi;
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
    return lineGen(
      displayOrder.map(key => {
        const s = m.scores[key];
        const x = dragKey === key ? dragCurrentX : (xScale(key) ?? 0);
        return { x, y: s != null ? yScales[key](s) : null };
      })
    );
  }

  // Ticks
  const PERF_TICKS = [0, 20, 40, 60, 80, 100];
  function costTicks(key: string) {
    const hi = axisDomainMax[key] ?? 1;
    return [0, hi * 0.25, hi * 0.5, hi * 0.75, hi].map(v => ({
      val: v, y: yScales[key](v),
      label: v === 0 ? 'Free' : (v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(1)}`),
    }));
  }

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
        const prevScore = prevKey != null ? highlightedModel.scores[prevKey] : null;
        const nextScore = nextKey != null ? highlightedModel.scores[nextKey] : null;
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
  let axisBrushes    = $state<Record<string, [number, number]>>({});
  const activeBrushCount = $derived(Object.keys(axisBrushes).length);

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
    if (pillHoverId && m.id === pillHoverId) return 2.8;

    if (selectedIds.has(m.id)) return highlightedId === m.id ? 2.8 : 1.8;
    if (!brushPassIds) return highlightedId === m.id ? 2.6 : 1.1;
    return brushPassIds.has(m.id) ? (highlightedId === m.id ? 2.6 : 1.4) : 0.6;
  }

  // ── Brush drag ──
  type BrushMode = 'new' | 'move' | 'top' | 'bot';
  interface BrushDrag { key: string; mode: BrushMode; startScore: number; origBrush: [number,number]|null }
  let brushDrag = $state<BrushDrag | null>(null);
  const HANDLE_PX = 14;
  const MIN_RANGE = 0.5;

  function clientYtoScore(clientY: number, key: string): number {
    const rect = svgEl!.getBoundingClientRect();
    return invertY(clientY - rect.top - M.top, key);
  }

  function onAxisDown(e: PointerEvent, key: string) {
    const rect   = svgEl!.getBoundingClientRect();
    const pixelY = e.clientY - rect.top - M.top;
    const score  = invertY(pixelY, key);
    const brush  = axisBrushes[key] as [number, number] | undefined;
    let mode: BrushMode = 'new';
    let origBrush: [number, number] | null = null;
    if (brush) {
      const topPx = yScales[key](brush[1]);
      const botPx = yScales[key](brush[0]);
      if      (Math.abs(pixelY - topPx) <= HANDLE_PX)                          { mode = 'top'; origBrush = [...brush]; }
      else if (Math.abs(pixelY - botPx) <= HANDLE_PX)                          { mode = 'bot'; origBrush = [...brush]; }
      else if (pixelY > topPx - HANDLE_PX && pixelY < botPx + HANDLE_PX)       { mode = 'move'; origBrush = [...brush]; }
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

  function clearBrush(key: string, e: MouseEvent) { e.stopPropagation(); const { [key]: _, ...rest } = axisBrushes; axisBrushes = rest; }
  function clearAllBrushes() { axisBrushes = {}; }

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

  function onChartMouseMove(e: MouseEvent) {
    if (!svgEl || dragKey || brushDrag) { highlightedId = null; return; }
    const rect = svgEl.getBoundingClientRect();
    const mx = e.clientX - rect.left - M.left;
    const my = e.clientY - rect.top  - M.top;
    const found = qt.find(mx, my, HOVER_THRESHOLD);
    highlightedId = found?.id ?? null;
  }

  function onChartClick(e: MouseEvent) {
    if (dragKey || brushDrag) return;
    if (highlightedId) {
      onToggleSelection(highlightedId);
    }
  }

  // ── Axis label (reorder) drag ──
  function onLabelDown(e: PointerEvent, key: string) {
    if (brushDrag) return;
    // Capture the axis's current pixel x BEFORE setting dragKey.
    // Setting dragKey would immediately re-derive displayOrder (inserting the
    // axis at slot 0 because dragCurrentX hasn't been set yet), which would
    // re-derive xScale, making xScale(key) return 0 — the jump bug.
    const axisX = xScale(key) ?? 0;
    dragStartMouseX = e.clientX;
    dragAxisOriginX = axisX;
    dragCurrentX    = axisX;   // start visually at current position
    dragKey         = key;     // set last so displayOrder reacts to correct dragCurrentX
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    e.stopPropagation();
  }
  function onLabelMove(e: PointerEvent, key: string) {
    if (!dragKey || dragKey !== key) return;
    const dx = e.clientX - dragStartMouseX;
    dragCurrentX = Math.max(0, Math.min(innerW, dragAxisOriginX + dx));
  }
  function onLabelUp(_e: PointerEvent, _key: string) {
    if (!dragKey) return;
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
    <svg width={containerW} height={containerH} bind:this={svgEl}
      style:cursor={dragKey ? 'grabbing' : (highlightedId && (selectedIds.has(highlightedId) || selectedIds.size < 8)) ? 'pointer' : null}
      onmousemove={onChartMouseMove}
      onclick={onChartClick}
      onmouseleave={() => {
        if (!brushDrag && !dragKey) {
          highlightedId = null;
          pillHoverId = null;
        }
      }}
    >

      <!-- ── Fixed hover label (top-centre, never moves) ── -->
      {#if releaseHoverLabel}
        <text x={containerW/2} y={26} text-anchor="middle" fill="#f87171"
          font-size={16} font-weight={700} font-family="Inter,system-ui,sans-serif"
          pointer-events="none"
        >▾ {releaseHoverLabel.date} · {releaseHoverLabel.count} model{releaseHoverLabel.count === 1 ? '' : 's'}</text>
        <foreignObject x={0} y={34} width={containerW} height={42} pointer-events="none">
          <div class="selected-tags" style="display:flex; justify-content:center; gap:6px; flex-wrap:wrap; padding: 0 20px;">
            {#each releaseHoverLabel.models as m (m.id)}
              <div class="sel-tag"
                style="pointer-events:auto; display:flex; align-items:center; gap:4px; background:#2e3250; color:#e2e8f0; font-size:11px; padding:2px 6px; border-radius:4px; border:1px solid #3a4060; cursor:default; transition: border-color 0.1s;"
              >
                <span style="max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{m.name}</span>
              </div>
            {/each}
          </div>
        </foreignObject>
      {:else if highlightedModel || selectedIds.size > 0}
        <text x={containerW/2} y={26} text-anchor="middle" fill="#e2e8f0"
          font-size={18} font-weight={700} font-family="Inter,system-ui,sans-serif"
          pointer-events="none"
        >
          {#if highlightedModel}
            {highlightedModel.name}
          {:else}
            {selectedModels[0]?.name}{selectedModels.length > 1 ? ', ...' : ''}
          {/if}
        </text>

        <!-- Selected list with little crosses -->
        <foreignObject x={0} y={34} width={containerW} height={42} pointer-events="none">
          <div class="selected-tags" style="display:flex; justify-content:center; gap:6px; flex-wrap:wrap; padding: 0 20px;">
            {#each selectedModels as m (m.id)}
              <div class="sel-tag"
                class:hovered={highlightedId === m.id || pillHoverId === m.id}
                style="pointer-events:auto; display:flex; align-items:center; gap:4px; background:#2e3250; color:#e2e8f0; font-size:11px; padding:2px 6px; border-radius:4px; border:1px solid { (highlightedId === m.id || pillHoverId === m.id) ? '#818cf8' : '#3a4060'}; cursor:default; transition: border-color 0.1s;"
                onmouseenter={() => (pillHoverId = m.id)}
                onmouseleave={() => (pillHoverId = null)}
              >
                <span style="max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{m.name}</span>
                <button
                  onclick={(e) => onDeselectModel(e, m.id)}
                  style="background:none; border:none; color:#8892a4; cursor:pointer; padding:0 2px; font-size:12px; display:flex; align-items:center; justify-content:center;"
                  title="Remove from selection"
                >✕</button>
              </div>
            {/each}
            {#if selectedIds.size > 0}
              <button
                onclick={onClearAll}
                style="pointer-events:auto; background:transparent; border:1px solid #f8717155; color:#f87171; font-size:10px; padding:2px 6px; border-radius:4px; cursor:pointer;"
              >Clear all</button>
            {/if}
          </div>
        </foreignObject>
      {:else}
        <text x={containerW/2} y={36} text-anchor="middle" fill="#3a4060"
          font-size={13} font-style="italic" font-family="Inter,system-ui,sans-serif"
          pointer-events="none"
        >hover a curve · drag axis labels to reorder · drag axis lines to filter</text>
      {/if}
      {#if activeBrushCount > 0}
        <text x={containerW/2} y={62} text-anchor="middle" fill="#a5b4fc"
          font-size={11} font-family="Inter,system-ui,sans-serif" pointer-events="none"
        >{activeBrushCount} filter{activeBrushCount>1?'s':''} active — {brushPassIds?.size ?? models.length} model{brushPassIds?.size===1?'':' s'} match</text>
        <text x={containerW/2} y={77} text-anchor="middle" fill="#f87171"
          font-size={11} font-family="Inter,system-ui,sans-serif"
          style="cursor:pointer" role="button" tabindex="0"
          onclick={clearAllBrushes} onkeypress={(e)=>e.key==='Enter'&&clearAllBrushes()}
        >✕ Clear all filters</text>
      {/if}

      <g transform="translate({M.left},{M.top})">

        <!-- ═══ LAYER 1: axis visuals (no pointer events) ═══ -->
        {#each benchmarks as bench}
          {@const key    = bench.key}
          {@const x      = dragKey === key ? dragCurrentX : (xScale(key) ?? 0)}
          {@const isPerf = bench.higherIsBetter !== false}
          {@const brush  = axisBrushes[key] as [number,number] | undefined}

          <g transform="translate({x},0)" opacity={dragKey===key ? 0.7 : 1}>
            <!-- Axis line -->
            <line x1={0} y1={0} x2={0} y2={innerH} stroke="#2e3250" stroke-width={1.5}
              pointer-events="none" />

            <!-- Performance: label + ticks ABOVE -->
            {#if isPerf}
              {#each PERF_TICKS as tick}
                {@const ty = yScales[key](tick)}
                <line x1={-5} y1={ty} x2={5} y2={ty} stroke="#3a4060" pointer-events="none" />
                <text x={-9} y={ty} text-anchor="end" dominant-baseline="middle"
                  fill="#4b5563" font-size={9} pointer-events="none">{tick}%</text>
              {/each}
              <!-- Category label -->
              <text x={0} y={-30} text-anchor="middle" fill="#6b7280" font-size={10.5}
                pointer-events="none">{AXIS_CATEGORIES[key] ?? ''}</text>
              <!-- Title + drag icon: tspans carry their own cursor + handlers directly -->
              <text x={0} y={-14} text-anchor="middle" font-size={13} font-weight={600}>
                <tspan
                  fill="#8892a4"
                  font-size={11} font-weight={400}
                  pointer-events="all" style:cursor={dragKey === key ? 'grabbing' : 'grab'} style="user-select:none"
                  onpointerdown={(e) => onLabelDown(e, key)}
                  onpointermove={(e) => onLabelMove(e, key)}
                  onpointerup={(e)   => onLabelUp(e, key)}
                  onpointercancel={(e) => onLabelUp(e, key)}
                >⠿</tspan><tspan
                  dx={5}
                  fill={sortBy === 'category' && key === selectedSortAxis ? '#f97316' : '#c4cad8'}
                  pointer-events="all" style="cursor:pointer;user-select:none"
                  onclick={() => onAxisTitleClick(key)}
                  onkeypress={(e) => e.key === 'Enter' && onAxisTitleClick(key)}
                >{bench.label}</tspan>
              </text>

            {:else}
              <!-- Cost: ticks + label BELOW -->
              {#each costTicks(key) as t}
                <line x1={-5} y1={t.y} x2={5} y2={t.y} stroke="#3a4060" pointer-events="none" />
                <text x={9} y={t.y} text-anchor="start" dominant-baseline="middle"
                  fill="#9ca3af" font-size={9} pointer-events="none">{t.label}</text>
              {/each}
              <!-- Title + drag icon: tspans carry their own cursor + handlers directly -->
              <text x={0} y={innerH+16} text-anchor="middle" font-size={13} font-weight={600}>
                <tspan
                  fill="#8892a4"
                  font-size={11} font-weight={400}
                  pointer-events="all" style:cursor={dragKey === key ? 'grabbing' : 'grab'} style="user-select:none"
                  onpointerdown={(e) => onLabelDown(e, key)}
                  onpointermove={(e) => onLabelMove(e, key)}
                  onpointerup={(e)   => onLabelUp(e, key)}
                  onpointercancel={(e) => onLabelUp(e, key)}
                >⠿</tspan><tspan
                  dx={5}
                  fill={sortBy === 'category' && key === selectedSortAxis ? '#f97316' : '#fca5a5'}
                  pointer-events="all" style="cursor:pointer;user-select:none"
                  onclick={() => onAxisTitleClick(key)}
                  onkeypress={(e) => e.key === 'Enter' && onAxisTitleClick(key)}
                >{bench.label}</tspan>
              </text>
              <text x={0} y={innerH+30} text-anchor="middle" fill="#9ca3af" font-size={10.5}
                pointer-events="none">{AXIS_CATEGORIES[key] ?? ''}</text>
            {/if}

            <!-- Brush visual (pointer-events:none) -->
            {#if brush}
              {@const bTop = yScales[key](brush[1])}
              {@const bBot = yScales[key](brush[0])}
              {@const bH   = bBot - bTop}
              <rect x={-18} y={bTop} width={36} height={bH}
                fill="rgba(99,102,241,0.28)" pointer-events="none" />
              <rect x={-14} y={bTop-4} width={28} height={8} rx={2}
                fill="#6366f1" pointer-events="none" />
              <rect x={-14} y={bBot-4} width={28} height={8} rx={2}
                fill="#6366f1" pointer-events="none" />
              <text x={22} y={bTop+4} fill="#a5b4fc" font-size={9} pointer-events="none">
                {isPerf ? brush[1].toFixed(0)+'%' : '$'+brush[1].toFixed(2)}
              </text>
              <text x={22} y={bBot+4} fill="#a5b4fc" font-size={9} pointer-events="none">
                {isPerf ? brush[0].toFixed(0)+'%' : '$'+brush[0].toFixed(2)}
              </text>
              <!-- Clear button (above/below chart area, outside brush zone) -->
              <text x={0} y={isPerf ? -46 : innerH+46}
                text-anchor="middle" fill="#f87171" font-size={14}
                style="cursor:pointer" role="button" tabindex="0"
                onclick={(e)=>clearBrush(key,e)}
                onkeypress={(e)=>e.key==='Enter'&&clearBrush(key,new MouseEvent('click'))}
              >×</text>
            {/if}
          </g>
        {/each}

        <!-- ═══ LAYER 2: axis overlay rects (brush + reorder) ═══
             No hit-paths for models — hover is handled by SVG onmousemove + quadtree. -->
        {#each benchmarks as bench}
          {@const key    = bench.key}
          {@const x      = dragKey === key ? dragCurrentX : (xScale(key) ?? 0)}
          {@const brush  = axisBrushes[key] as [number,number] | undefined}

          <g transform="translate({x},0)">
            <!-- Brush zone: 16px wide (±8px) — narrow enough not to block hover between axes -->
            <rect x={-8} y={0} width={16} height={innerH}
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
              stroke={selectedIds.has(m.id) ? 'white' : familyColor(m.family)}
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
            <path d={hd} fill="none" stroke="white" stroke-width={2.8} pointer-events="none" />
            {#if selectedIds.size <= 1}
              {#each highlightedLabels as item (item.key)}
                <circle cx={item.x} cy={item.y} r={4} fill="white" pointer-events="none" />
                <text x={item.x} y={item.labelY} text-anchor="middle" dominant-baseline="middle"
                  fill="white" font-size={22} font-weight={700}
                  stroke="#000" stroke-width={3} stroke-opacity={0.6} paint-order="stroke"
                  font-family="Inter,system-ui,sans-serif" pointer-events="none"
                >{item.label}{item.isPerf ? '%' : ''}</text>
              {/each}
            {/if}
          {/if}
        {/if}

      </g>
    </svg>
  {/if}
</div>

<style>
  .wrap { width: 100%; height: 100%; flex: 1; min-height: 0; }
  .sel-tag:hover { border-color: #6366f1 !important; }
  .sel-tag button:hover { color: #f87171 !important; }
  .sel-tag.hovered { border-color: #6366f1 !important; background: #3a4060 !important; }
</style>
