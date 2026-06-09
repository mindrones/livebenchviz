<script lang="ts">
  /**
   * Timeline — brushable release timeline.
   *
   * D3 used ONLY for calculations:
   *   • scaleTime  → maps Date values to SVG x pixels
   *   • timeYear   → generates year tick positions
   *
   * Svelte renders every SVG element declaratively.
   * Drag logic lives in plain TypeScript; pointer capture keeps drag reliable.
   */
  import { scaleTime }   from 'd3';
  import { timeYear }    from 'd3';
  import type { Model }  from '$lib/types';
  import { familyColor } from '$lib/colors';

  interface Props {
    brushEnd:   Date | null;
    brushStart: Date | null;
    chartIds:   Set<string> | null;  // ids of curves currently visible in the chart
    isMobile?:  boolean;
    models:     Model[];
    releaseHoverIds: Set<string> | null;
  }

  let {
    brushEnd   = $bindable(null),
    brushStart = $bindable(null),
    chartIds = null,
    isMobile = false,
    models: allModels,
    releaseHoverIds = $bindable(null),
  }: Props = $props();

  // ── Geometry ──
  const TRACK_H  = 52;   // height of the tick + brush area
  const AXIS_H   = 20;   // height below the track for year labels
  const SVG_H    = TRACK_H + AXIS_H;
  const ML       = 12;   // left margin
  const MR       = 12;   // right margin
  const EDGE_PX  = $derived(isMobile ? 16 : 8);    // brush edge grab zone (larger on touch)

  let containerW  = $state(0);
  let activeYears  = $state(0);        // 0 = All
  let activeMonths = $state(0);        // 0 = inactive

  // ── Date bounds — derived from all models ──
  const baseBounds = $derived.by(() => {
    if (!allModels.length) return null;
    const times = allModels.map(m => new Date(m.released).getTime()).filter(t => isFinite(t));
    if (!times.length) return null;
    return { min: Math.min(...times), max: Math.max(...times) };
  });

  const timePaddingMs = $derived.by(() => {
    if (!baseBounds || containerW <= 0) return 14 * 86400000;
    const span = baseBounds.max - baseBounds.min || 86400000;
    const pxWidth = containerW - ML - MR;
    return (span / Math.max(10, pxWidth)) * 14; // 14px padding to safely clear the handle width
  });

  const minDate = $derived(baseBounds ? new Date(baseBounds.min - timePaddingMs) : null);
  const maxDate = $derived(baseBounds ? new Date(baseBounds.max + timePaddingMs) : null);

  // Initialise brush to full range once bounds are known
  $effect(() => {
    if (!brushStart && !brushEnd && minDate && maxDate) {
      // full range → no filter applied
    }
  });

  // ── D3 time scale (calculation only) ──
  const timeScale = $derived(
    (minDate && maxDate)
      ? scaleTime().domain([minDate, maxDate]).range([ML, containerW - MR])
      : scaleTime().domain([new Date(2023, 0, 1), new Date()]).range([ML, containerW - MR])
  );

  const yearTicks = $derived(
    (containerW > 0 && minDate && maxDate) ? timeYear.range(minDate, maxDate) : [] as Date[]
  );

  // ── Brush pixel positions ──
  // When brushStart/brushEnd are null we show the full range selected
  const bx0 = $derived(timeScale(brushStart ?? minDate ?? new Date(2023, 0, 1)));
  const bx1 = $derived(timeScale(brushEnd   ?? maxDate ?? new Date()));

  // ── Drag state (local, not reactive storage) ──
  type DragMode = 'move' | 'left' | 'right';
  interface DragState {
    mode: DragMode;
    startX: number;
    origStart: Date;
    origEnd:   Date;
  }
  let drag: DragState | null = null;

  function clampDate(d: Date): Date {
    if (!minDate || !maxDate) return d;
    return new Date(Math.max(minDate.getTime(), Math.min(maxDate.getTime(), d.getTime())));
  }
  function pxToDate(x: number): Date {
    return timeScale.invert(x) as Date;
  }
  function dxToMs(dx: number): number {
    if (!minDate || !maxDate) return 0;
    return (dx / (containerW - ML - MR)) * (maxDate.getTime() - minDate.getTime());
  }

  function applyBrush(start: Date, end: Date) {
    if (!minDate || !maxDate) return;
    const fullSpan = maxDate.getTime() - minDate.getTime();
    const isAll    = (end.getTime() - start.getTime()) / fullSpan > 0.999;
    brushStart = isAll ? null : start;
    brushEnd   = isAll ? null : end;
  }

  // ── Year / Month button handlers ──
  function setYears(y: number) {
    activeYears  = y;
    activeMonths = 0;
    if (y === 0) { applyBrush(minDate, maxDate); return; }
    const end   = clampDate(new Date());
    const start = clampDate(new Date(end.getFullYear() - y, end.getMonth(), end.getDate()));
    applyBrush(start, end);
  }

  function setMonths(m: number) {
    activeMonths = m;
    activeYears  = -1;   // no year button active
    const end   = clampDate(new Date());
    const start = clampDate(new Date(end.getFullYear(), end.getMonth() - m, end.getDate()));
    applyBrush(start, end);
  }

  // ── Pointer handlers (drag logic in TS, no D3) ──
  function hitTest(mx: number): DragMode | 'outside' {
    if (Math.abs(mx - bx0) < EDGE_PX)         return 'left';
    if (Math.abs(mx - bx1) < EDGE_PX)         return 'right';
    if (mx > bx0 + EDGE_PX && mx < bx1 - EDGE_PX) return 'move';
    return 'outside';
  }

  function onPointerDown(e: PointerEvent, svgEl: SVGSVGElement) {
    const rect = svgEl.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    if (e.clientY - rect.top > TRACK_H) return;

    const hit = hitTest(mx);
    if (hit === 'outside') {
      // Re-centre brush at click, keeping span
      const spanMs = (brushEnd ?? maxDate!).getTime() - (brushStart ?? minDate!).getTime();
      let ns = new Date(pxToDate(mx).getTime() - spanMs / 2);
      let ne = new Date(ns.getTime() + spanMs);
      if (ns < minDate!) { ns = minDate!; ne = new Date(ns.getTime() + spanMs); }
      if (ne > maxDate!) { ne = maxDate!; ns = new Date(ne.getTime() - spanMs); }
      activeYears  = -1;
      activeMonths = 0;
      applyBrush(clampDate(ns), clampDate(ne));
      return;
    }

    drag = {
      mode:      hit,
      startX:    e.clientX,
      origStart: new Date(brushStart ?? minDate!),
      origEnd:   new Date(brushEnd   ?? maxDate!),
    };
    svgEl.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent, svgEl: SVGSVGElement) {
    if (!drag) return;
    const dx   = e.clientX - drag.startX;
    const dMs  = dxToMs(dx);
    const minSpan = 7 * 24 * 3600 * 1000;

    if (drag.mode === 'move') {
      const span = drag.origEnd.getTime() - drag.origStart.getTime();
      let ns = new Date(drag.origStart.getTime() + dMs);
      let ne = new Date(drag.origEnd.getTime()   + dMs);
      if (ns < minDate!) { ns = minDate!; ne = new Date(ns.getTime() + span); }
      if (ne > maxDate!) { ne = maxDate!; ns = new Date(ne.getTime() - span); }
      activeYears  = -1;
      activeMonths = 0;
      applyBrush(clampDate(ns), clampDate(ne));
    } else if (drag.mode === 'left') {
      const ns = clampDate(new Date(Math.min(drag.origStart.getTime() + dMs, drag.origEnd.getTime() - minSpan)));
      activeYears  = -1;
      activeMonths = 0;
      applyBrush(ns, new Date(brushEnd ?? drag.origEnd));
    } else {
      const ne = clampDate(new Date(Math.max(drag.origEnd.getTime() + dMs, drag.origStart.getTime() + minSpan)));
      activeYears  = -1;
      activeMonths = 0;
      applyBrush(new Date(brushStart ?? drag.origStart), ne);
    }
  }

  function onPointerUp() { drag = null; }

  // ── Release-time hover (highlights matching curves + red triangle marker) ──
  let hoverReleaseX    = $state<number | null>(null);
  let hoverReleaseDate = $state<Date | null>(null);
  let hoverReleaseCount = $state(0);

  function clearReleaseHover() {
    hoverReleaseX     = null;
    hoverReleaseDate  = null;
    hoverReleaseCount = 0;
    releaseHoverIds   = null;
  }

  function onReleaseHover(mx: number, my: number) {
    // Only active while hovering inside the brushed portion of the track
    if (drag || my < 0 || my > TRACK_H || mx < bx0 || mx > bx1) {
      if (hoverReleaseX !== null) clearReleaseHover();
      return;
    }
    // Nearest *visible* model release time within the brush window.
    // Restricting to chartIds guarantees the snapped date always has curves.
    let bestTime = NaN;
    let bestDist = Infinity;
    for (const m of allModels) {
      if (chartIds && !chartIds.has(m.id)) continue;
      const t = new Date(m.released).getTime();
      if (!isFinite(t)) continue;
      const x = timeScale(new Date(t));
      if (x < bx0 || x > bx1) continue;
      const dist = Math.abs(x - mx);
      if (dist < bestDist) { bestDist = dist; bestTime = t; }
    }
    if (!isFinite(bestTime)) { clearReleaseHover(); return; }
    const ids = allModels
      .filter(m => (!chartIds || chartIds.has(m.id)) && new Date(m.released).getTime() === bestTime)
      .map(m => m.id);
    hoverReleaseX     = timeScale(new Date(bestTime));
    hoverReleaseDate  = new Date(bestTime);
    hoverReleaseCount = ids.length;
    releaseHoverIds   = new Set(ids);
  }

  // Cursor shape based on hover position
  function cursorForX(mx: number, my: number): string {
    if (my > TRACK_H) return 'default';
    const h = hitTest(mx);
    if (h === 'move')    return 'grab';
    if (h === 'outside') return 'crosshair';
    return 'ew-resize';
  }
  let cursor = $state('default');
  function onMouseMove(e: MouseEvent, rect: DOMRect) {
    if (drag) return;
    cursor = cursorForX(e.clientX - rect.left, e.clientY - rect.top);
  }

  // Format helper
  function fmt(d: Date | null) {
    if (!d) return '';
    return d.toLocaleDateString('en', { year: 'numeric', month: 'short' });
  }
  function fmtFull(d: Date | null) {
    if (!d) return '';
    return d.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Derive the ref so we can pass it into handlers
  let svgEl = $state<SVGSVGElement | null>(null);
</script>

<div class="tl-outer">
  <!-- Year buttons -->
  <div class="tl-top">
    <span class="tl-title">Release timeline</span>
    <div class="tl-btns">
      <button
        class="tl-btn"
        class:active={activeMonths === 6}
        onclick={() => setMonths(6)}
      >6 M</button>
      {#each [1, 2, 3] as y}
        <button
          class="tl-btn"
          class:active={activeYears === y}
          onclick={() => setYears(y)}
        >{y} Y</button>
      {/each}
      <button
        class="tl-btn"
        class:active={activeYears === 0}
        onclick={() => setYears(0)}
      >All</button>
    </div>
  </div>

  <!-- Date range label — sits between header row and the SVG track -->
  <div class="tl-range">
    {#if hoverReleaseDate}
      <span class="tl-hover-date">▾ {fmtFull(hoverReleaseDate)} · {hoverReleaseCount} model{hoverReleaseCount === 1 ? '' : 's'}</span>
    {:else if brushStart && brushEnd}
      {fmt(brushStart)} – {fmt(brushEnd)}
    {:else}
      all time
    {/if}
  </div>

  <!-- SVG timeline -->
  <div class="tl-svg-wrap" bind:clientWidth={containerW}>
    {#if containerW > 0}
      <svg
        width={containerW}
        height={SVG_H}
        role="img"
        aria-label="Model release timeline with brushable range selector"
        bind:this={svgEl}
        style:cursor={cursor}
        style:touch-action="none"
        oncontextmenu={(e) => e.preventDefault()}
        onpointermove={(e) => {
          onPointerMove(e, svgEl!);
          if (svgEl) {
            const rect = svgEl.getBoundingClientRect();
            onMouseMove(e, rect);
            onReleaseHover(e.clientX - rect.left, e.clientY - rect.top);
          }
        }}
        onpointerdown={(e) => svgEl && onPointerDown(e, svgEl)}
        onpointerup={onPointerUp}
        onpointerleave={clearReleaseHover}
      >
        <!-- Background -->
        <rect width={containerW} height={TRACK_H} fill="var(--color-bg-surface)" />

        <!-- Dim mask outside brush -->
        <rect x={ML}  y={0} width={bx0 - ML}               height={TRACK_H} fill="rgba(0,0,0,.52)" />
        <rect x={bx1} y={0} width={containerW - MR - bx1}  height={TRACK_H} fill="rgba(0,0,0,.52)" />

        <!-- Model release ticks — one per model, colored by family -->
        {#each allModels as m (m.id)}
          {@const mx = timeScale(new Date(m.released))}
          {@const inside = mx >= bx0 && mx <= bx1}
          {#if mx >= ML && mx <= containerW - MR}
            <line
              x1={mx} y1={6} x2={mx} y2={TRACK_H - 6}
              stroke={familyColor(m.family)}
              stroke-width={inside ? 1.8 : 1}
              opacity={inside ? 0.85 : 0.3}
            />
          {/if}
        {/each}

        <!-- Brush border -->
        <rect
          x={bx0 + 1} y={1.5}
          width={Math.max(0, bx1 - bx0 - 2)} height={TRACK_H - 3}
          fill="none" stroke="var(--color-accent)" stroke-width={1.5} rx={2}
          pointer-events="none"
        />

        <!-- Left drag handle -->
        <rect
          x={bx0 - 3} y={8}
          width={6} height={TRACK_H - 16}
          fill="var(--color-accent)" rx={2}
          style="cursor: ew-resize"
        />
        <!-- Right drag handle -->
        <rect
          x={bx1 - 3} y={8}
          width={6} height={TRACK_H - 16}
          fill="var(--color-accent)" rx={2}
          style="cursor: ew-resize"
        />

        <!-- Selected release-time marker (red triangle + line) -->
        {#if hoverReleaseX != null}
          <line
            x1={hoverReleaseX} y1={0} x2={hoverReleaseX} y2={TRACK_H}
            stroke="#ef4444" stroke-width={1} opacity={0.55}
            pointer-events="none"
          />
          <polygon
            points="{hoverReleaseX - 5},0 {hoverReleaseX + 5},0 {hoverReleaseX},8"
            fill="#ef4444"
            pointer-events="none"
          />
        {/if}

        <!-- Year axis labels — positions from D3 ticks, rendered by Svelte -->
        {#each yearTicks as tick}
          {@const tx = timeScale(tick)}
          <line x1={tx} y1={TRACK_H} x2={tx} y2={TRACK_H + 5} stroke="var(--color-border)" />
          <text x={tx} y={SVG_H - 2} text-anchor="middle" fill="#6b7280" font-size={10}>
            {tick.getFullYear()}
          </text>
        {/each}
      </svg>
    {/if}
  </div>
</div>

<style>
  .tl-outer { padding: 10px 0 14px; }

  .tl-top {
    display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
  }
  .tl-title {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: .06em; color: var(--color-text-muted);
  }
  .tl-btns { display: flex; gap: 4px; margin-left: auto; }
  .tl-btn {
    font-size: 11px; padding: 3px 9px; border-radius: 4px;
    border: 1px solid var(--color-border); background: transparent; color: var(--color-text-muted); cursor: pointer;
  }
  .tl-btn:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
  .tl-btn.active { background: rgba(99,102,241,.18); border-color: var(--color-accent); color: var(--color-accent-light); }

  /* ── Touch-friendly sizing on mobile ── */
  @media (max-width: 767px) {
    .tl-btn { min-width: 44px; min-height: 44px; padding: 6px 12px; font-size: 13px; }
    .tl-range { min-height: 28px; display: flex; align-items: center; justify-content: center; }
  }

  .tl-svg-wrap { width: 100%; }

  .tl-range {
    text-align: center;
    font-size: 11px;
    color: var(--color-accent-light);
    letter-spacing: .03em;
    margin: 2px 0 4px;
    min-height: 16px;
  }
  .tl-hover-date { color: #f87171; font-weight: 600; }
</style>
