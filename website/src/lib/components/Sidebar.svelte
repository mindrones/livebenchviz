<script lang="ts">
  import { Info, ChevronDown, ChevronUp } from '@lucide/svelte';

  import type { Model, InferenceMap, Benchmark } from '$lib/types';
  import { familyColor } from '$lib/colors';
  import { SvelteSet } from 'svelte/reactivity';

  interface Props {
    benchmarks:       Benchmark[];                    // for category-sort label display
    expandedFamilies: Record<string, boolean>;  // $bindable – persisted by parent
    familyOrder:      string[];
    generatedDate:    number | string;
    groupByProvider:  boolean;            // $bindable – group tree vs flat list
    hidden:           SvelteSet<string>;
    selectedIds:      Set<string>;
    onToggleSelection: (id: string) => void;
    highlightedId:    string | null;                  // $bindable – hover sync with chart
    inferenceMap:     InferenceMap;       // per-model inference availability
    latest2:          boolean;
    models:           Model[];
    ollamaCloudOnly:  boolean;
    ollamaLocalOnly:  boolean;
    onReset:          () => void;
    openRouterOnly:   boolean;
    otherSourceOnly:  boolean;
    searchQuery:      string;                         // $bindable – lifted to page so chart reacts
    selectedSortAxis: string;                         // $bindable – which axis drives category sort
    showCitation:     boolean;
    showClosed:       boolean;
    showEffort:       Record<string, boolean>; // $bindable
    showOpen:         boolean;
    sortBy:           'count' | 'alpha' | 'category'; // $bindable – persisted by parent
    visibleIds:       Set<string>;        // models passing ALL filters incl. time brush
    compact?:         boolean;                         // mobile: remove fixed width/border
    settingsCollapsed?: boolean;                       // $bindable – persisted by parent across tab switches
  }

  let {
		familyOrder,
		hidden,
    selectedIds,
    onToggleSelection,
		inferenceMap,
		visibleIds,
    benchmarks,
    compact           = $bindable(false),
    expandedFamilies = $bindable(),
    generatedDate,
    groupByProvider  = $bindable(),
    highlightedId    = $bindable(null),
    latest2     = $bindable(),
    models,
    ollamaCloudOnly = $bindable(),
    ollamaLocalOnly = $bindable(),
    onReset,
    openRouterOnly   = $bindable(),
    otherSourceOnly  = $bindable(),
    searchQuery      = $bindable(),
    selectedSortAxis = $bindable(),
    showCitation     = $bindable(),
    showClosed  = $bindable(),
    showEffort  = $bindable(),
    showOpen    = $bindable(),
    sortBy           = $bindable(),
    settingsCollapsed = $bindable(false),
  }: Props = $props();

  // ── Category sort helpers ──
  const selectedAxisLabel = $derived(
    benchmarks.find(b => b.key === selectedSortAxis)?.label ?? selectedSortAxis
  );

  // ── Per-family helpers ──
  function familyModels(fam: string) {
    return models
      .filter(m => m.family === fam)
      .sort((a, b) => new Date(b.released).getTime() - new Date(a.released).getTime());
  }

  // ── Search ──
  const hasSearch = $derived(searchQuery.trim() !== '');

  function searchOk(m: Model): boolean {
    if (!hasSearch) return true;
    const q = searchQuery.trim().toLowerCase();
    return m.family.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
  }

  function typeOk(m: Model) {
    return (showOpen || m.type !== 'open') && (showClosed || m.type !== 'closed');
  }
  function rowVisible(m: Model): boolean {
    const inf     = inferenceMap[m.id];
    const isOther = !inf?.openRouter && !inf?.ollamaCloud && !inf?.ollamaLocal;
    const inferenceOk =
      (openRouterOnly  && !!inf?.openRouter)  ||
      (ollamaCloudOnly && !!inf?.ollamaCloud) ||
      (ollamaLocalOnly && !!inf?.ollamaLocal) ||
      (otherSourceOnly && isOther);
    return typeOk(m)
      && inferenceOk
      && (!latest2    || m.vfl <= 1)
      && visibleIds.has(m.id)
      && searchOk(m);
  }

  // ── GROUPED mode ──
  const visibleFamilies = $derived.by(() => {
    const base = familyOrder.filter(fam => familyModels(fam).some(m => rowVisible(m)));
    if (sortBy === 'alpha') {
      return [...base].sort((a, b) => a.localeCompare(b));
    }
    if (sortBy === 'category') {
      return [...base].sort((a, b) => {
        const msA = familyModels(a).filter(m => rowVisible(m)).map(m => m.scores[selectedSortAxis]).filter((s): s is number => s != null);
        const msB = familyModels(b).filter(m => rowVisible(m)).map(m => m.scores[selectedSortAxis]).filter((s): s is number => s != null);
        const avgA = msA.length ? msA.reduce((s, v) => s + v, 0) / msA.length : -Infinity;
        const avgB = msB.length ? msB.reduce((s, v) => s + v, 0) / msB.length : -Infinity;
        return avgB - avgA || a.localeCompare(b);
      });
    }
    // 'count': descending by visible-model count, alphabetical tiebreak
    return [...base].sort((a, b) => {
      const ca = familyModels(a).filter(m => rowVisible(m)).length;
      const cb = familyModels(b).filter(m => rowVisible(m)).length;
      return cb - ca || a.localeCompare(b);
    });
  });

  // ── FLAT mode ──
  const flatModels = $derived.by(() => {
    const visible = models.filter(m => rowVisible(m));
    if (sortBy === 'alpha') {
      return [...visible].sort((a, b) =>
        `${a.family}/${a.name}`.localeCompare(`${b.family}/${b.name}`)
      );
    }
    if (sortBy === 'category') {
      return [...visible].sort((a, b) => {
        const sa = a.scores[selectedSortAxis] ?? -Infinity;
        const sb = b.scores[selectedSortAxis] ?? -Infinity;
        return sb - sa;
      });
    }
    // 'count' in flat mode = newest first (date descending)
    return [...visible].sort((a, b) =>
      new Date(b.released).getTime() - new Date(a.released).getTime()
    );
  });

  // ── Within-group sort for category mode ──
  function sortedGroupModels(fam: string) {
    const base = familyModels(fam).filter(m => rowVisible(m));
    if (sortBy === 'category') {
      return [...base].sort((a, b) => {
        const sa = a.scores[selectedSortAxis] ?? -Infinity;
        const sb = b.scores[selectedSortAxis] ?? -Infinity;
        return sb - sa;
      });
    }
    return base;
  }

  // ── Grouped: check state ──
  type CheckState = 'all' | 'none' | 'mixed';
  function familyCheckState(fam: string): CheckState {
    const rows = familyModels(fam).filter(m => rowVisible(m));
    if (!rows.length) return 'none';
    const h = rows.filter(m => hidden.has(m.id)).length;
    if (h === 0)           return 'all';
    if (h === rows.length) return 'none';
    return 'mixed';
  }

  function indeterminate(node: HTMLInputElement, value: boolean) {
    node.indeterminate = value;
    return { update: (v: boolean) => { node.indeterminate = v; } };
  }

  // ── Handlers ──
  function toggleFamily(fam: string, checked: boolean) {
    for (const m of familyModels(fam).filter(m => rowVisible(m)))
      checked ? hidden.delete(m.id) : hidden.add(m.id);
  }
  function toggleModel(id: string, checked: boolean) {
    checked ? hidden.delete(id) : hidden.add(id);
  }

  function selectAll() {
    for (const m of models) if (rowVisible(m)) hidden.delete(m.id);
  }
  function deselectAll() {
    for (const m of models) if (rowVisible(m)) hidden.add(m.id);
  }

  const allSelected = $derived(
    models.filter(m => rowVisible(m)).every(m => !hidden.has(m.id))
  );

  // ── Effort toggle ──
  const allEffortsSelected = $derived(
    ['null', 'low', 'medium', 'high', 'xhigh'].every(k => showEffort[k])
  );
  function toggleAllEfforts() {
    const val = !allEffortsSelected;
    for (const k of ['null', 'low', 'medium', 'high', 'xhigh']) showEffort[k] = val;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->

<aside class:compact={compact}>
  <div class="sb-head">
    <div class="citation">
      <button class="livebench-btn" onclick={() => showCitation = true}>
        LiveBench <Info size="12" />
      </button>
      {new Date(generatedDate).toLocaleDateString()}
    </div>
    <div class="head-actions">
      {#if compact}
        <button class="collapse-btn" onclick={() => settingsCollapsed = !settingsCollapsed} title={settingsCollapsed ? 'Expand settings' : 'Collapse settings'}>
          {#if settingsCollapsed}<ChevronDown size={20} />{:else}<ChevronUp size={20} />{/if}
        </button>
      {/if}
      <button class="reset-btn" onclick={onReset} title="Reset all filters and preferences">↺ Reset</button>
    </div>
  </div>

  {#if !settingsCollapsed}
    <div class="settings-scroll">
      <div class="type-row">
        <button class="type-btn" class:on-open={showOpen}   onclick={() => (showOpen   = !showOpen)}>🟢 Open Weights</button>
        <button class="type-btn" class:on-closed={showClosed} onclick={() => (showClosed = !showClosed)}>🟡 Closed Weights</button>
      </div>

      <div class="filter-group">
        <span class="group-label">Inference</span>
        <label><input type="checkbox" bind:checked={ollamaCloudOnly} /> Available on Ollama Cloud</label>
        <label><input type="checkbox" bind:checked={ollamaLocalOnly} /> Available for Ollama Download</label>
        <label><input type="checkbox" bind:checked={openRouterOnly}  /> Available on OpenRouter</label>
        <label><input type="checkbox" bind:checked={otherSourceOnly} /> Other source</label>
      </div>
      <div class="filter-group">
        <span class="group-label">Display</span>
        <label><input type="checkbox" bind:checked={latest2}          /> Show latest 2 per series</label>
        <label><input type="checkbox" bind:checked={groupByProvider} /> Group by provider</label>
      </div>

      <!-- search -->
      <div class="search-row">
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input
            class="search-input"
            type="search"
            placeholder="Search models or providers…"
            bind:value={searchQuery}
          />
          {#if hasSearch}
            <button class="search-clr" onclick={() => (searchQuery = '')} title="Clear search">✕</button>
          {/if}
        </div>
      </div>

      <!-- effort panel -->
      <div class="filter-group effort-panel">
        <div class="effort-header">
          <span class="group-label">Thinking Effort</span>
          <button class="text-btn" onclick={toggleAllEfforts}>
            {allEffortsSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
        <div class="effort-grid">
          {#each ['null', 'low', 'medium', 'high', 'xhigh'] as eff}
            <label class="effort-chk">
              <input type="checkbox" bind:checked={showEffort[eff]} />
              <span class="effort-badge effort-{eff}">{eff === 'null' ? 'None' : eff}</span>
            </label>
          {/each}
        </div>
      </div>

      <!-- select / expand controls -->
      <div class="ctrl-row">
        <button class="ctrl-btn" onclick={() => allSelected ? deselectAll() : selectAll()}>
          {allSelected ? '☑' : '☐'} Select all
        </button>
        {#if groupByProvider}
          <button class="ctrl-btn" onclick={() => { for (const f of visibleFamilies) expandedFamilies[f] = true; }}>⊞ Expand all</button>
          <button class="ctrl-btn" onclick={() => { for (const f of visibleFamilies) expandedFamilies[f] = false; }}>⊟ Collapse all</button>
        {/if}
      </div>

      <!-- sort controls -->
      <div class="sort-row">
        <button class="sort-btn" class:active={sortBy === 'category'} title="Sort by benchmark metric (click an axis to select)"
          onclick={() => (sortBy = 'category')}>◈ Category</button>
        <button class="sort-btn" class:active={sortBy === 'count'} title={groupByProvider ? 'Sort by model count' : 'Sort by date (newest first)'}
          onclick={() => (sortBy = 'count')}>{groupByProvider ? '# ↓ Count' : '📅 Newest'}</button>
        <button class="sort-btn" class:active={sortBy === 'alpha'} title="Sort alphabetically"
          onclick={() => (sortBy = 'alpha')}>A–Z Name</button>
      </div>
      {#if sortBy === 'category'}
        <div class="sort-hint">▶ {selectedAxisLabel} · click an axis title to change</div>
      {/if}
    </div>
  {/if}

  <div class="tree">

    {#if groupByProvider}
      <!-- ── GROUPED VIEW ── -->
      {#each visibleFamilies as fam}
        {@const fms      = sortedGroupModels(fam)}
        {@const state    = familyCheckState(fam)}
        {@const expanded = hasSearch || (expandedFamilies[fam] ?? false)}

        <div class="family">
          <div class="fam-row" role="button" tabindex="0"
            onclick={() => (expandedFamilies[fam] = !expanded)}
            onkeypress={(e) => e.key === 'Enter' && (expandedFamilies[fam] = !expanded)}
          >
            <span class="arr" class:open={expanded}>▶</span>
            <input type="checkbox"
              checked={state === 'all'}
              use:indeterminate={state === 'mixed'}
              onclick={(e) => { e.stopPropagation(); toggleFamily(fam, e.currentTarget.checked); }}
            />
            <span class="dot" style:background={familyColor(fam)}></span>
            <span class="fam-name">{fam}</span>
            <span class="fam-brand">{fms[0]?.brand ?? ''}</span>
            <span class="fam-count">{fms.length}</span>
          </div>

					<!-- svelte-ignore a11y_no_static_element_interactions -->
          {#if expanded}
            <div class="children">
              {#each fms as m}
                <div class="model-row" class:highlighted={highlightedId === m.id} class:selected={selectedIds.has(m.id)}
                  onclick={() => onToggleSelection(m.id)}
                  onpointerenter={() => (highlightedId = m.id)}
                  onpointerleave={() => (highlightedId = null)}
                  ontouchstart={() => (highlightedId = m.id)}
                >
                  <input type="checkbox"
                    checked={!hidden.has(m.id)}
                    onclick={(e) => { e.stopPropagation(); toggleModel(m.id, e.currentTarget.checked); }}
                  />
                  <div class="model-col">
                    <span class="model-name" title={m.id}>{m.name}</span>
                    <div class="model-meta">
                      <span class="model-date">{m.released.slice(0, 7)}</span>
                      {#if m.effort}
                        <span class="tag effort-tag effort-{m.effort}">{m.effort}</span>
                      {/if}
                      <span class="tag {m.type === 'open' ? 'oss' : 'api'}">
                        {m.type === 'open' ? 'OW' : 'CW'}
                      </span>
                      {#if inferenceMap[m.id]?.ollamaLocal}
                        <span class="tag ol" title={inferenceMap[m.id]?.ollamaCloud ? 'Ollama local + cloud' : 'Ollama local only'}>
                          Ol{inferenceMap[m.id]?.ollamaCloud ? '☁' : ''}
                        </span>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}

    {:else}
      <!-- ── FLAT VIEW ── -->
      <div class="flat-list">
        {#each flatModels as m}
          <div class="model-row flat" class:highlighted={highlightedId === m.id} class:selected={selectedIds.has(m.id)}
            onclick={() => onToggleSelection(m.id)}
            onpointerenter={() => (highlightedId = m.id)}
            onpointerleave={() => (highlightedId = null)}
            ontouchstart={() => (highlightedId = m.id)}
          >
            <input type="checkbox"
              checked={!hidden.has(m.id)}
              onclick={(e) => { e.stopPropagation(); toggleModel(m.id, e.currentTarget.checked); }}
            />
            <span class="dot" style:background={familyColor(m.family)}></span>
            <div class="model-col">
              <span class="model-name" title={m.id}>{m.family}/{m.name}</span>
              <div class="model-meta">
                <span class="model-date">{m.released.slice(0, 7)}</span>
                {#if m.effort}
                  <span class="tag effort-tag effort-{m.effort}">{m.effort}</span>
                {/if}
                <span class="tag {m.type === 'open' ? 'oss' : 'api'}">
                  {m.type === 'open' ? 'OW' : 'CW'}
                </span>
                {#if inferenceMap[m.id]?.ollamaLocal}
                  <span class="tag ol" title={inferenceMap[m.id]?.ollamaCloud ? 'Ollama local + cloud' : 'Ollama local only'}>
                    Ol{inferenceMap[m.id]?.ollamaCloud ? '☁' : ''}
                  </span>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

  </div>
</aside>

<style>
  aside {
    width: 320px; min-width: 320px; background: var(--color-bg-surface);
    border-left: 1px solid var(--color-border); display: flex; flex-direction: column; overflow: hidden;
  }
  aside.compact {
    width: 100%; min-width: unset; border-left: none;
    display: flex; flex-direction: column;
  }
  .sb-head {
    padding: 10px 12px; border-bottom: 1px solid var(--color-border); flex-shrink: 0;
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
  }
  .head-actions {
    display: flex; align-items: center; gap: 6px;
  }
  .citation { font-size: 13px; color: var(--color-text-primary); display: flex; align-items: center; gap: 8px; }
  .livebench-btn { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-text-primary); background: transparent; border: 1px solid var(--color-text-primary); border-radius: 4px; padding: 2px 7px; cursor: pointer; transition: all .15s; }
  .livebench-btn:hover { background: var(--color-text-alpha); border-color: var(--color-text-primary); }
  .collapse-btn { padding: 4px; background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; transition: color .15s; display: flex; align-items: center; justify-content: center; }
  .collapse-btn:hover { color: var(--color-text-primary); }
  .reset-btn { font-size: 12px; padding: 4px 10px; border-radius: 5px; border: 1px solid var(--color-text-primary); background: transparent; color: var(--color-text-primary); cursor: pointer; transition: all .15s; }
  .reset-btn:hover { background: var(--color-text-alpha); border-color: var(--color-text-primary); }

  .settings-scroll {
    flex-shrink: 0;
  }
  .ctrl-row, .sort-row {
    display: flex; gap: 4px; padding: 6px 10px;
    border-bottom: 1px solid var(--color-border); background: var(--color-bg-elevated); flex-shrink: 0;
  }
  .ctrl-btn, .sort-btn {
    flex: 1; font-size: 12px; padding: 5px 6px; border-radius: 5px;
    border: 1px solid var(--color-border); background: transparent; color: var(--color-text-muted); cursor: pointer;
    text-align: center; white-space: nowrap;
  }
  .ctrl-btn:hover, .sort-btn:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
  .search-row { padding: 6px 10px; border-bottom: 1px solid var(--color-border); background: var(--color-bg-elevated); flex-shrink: 0; }
  .search-wrap { position: relative; display: flex; align-items: center; }
  .search-icon { position: absolute; left: 9px; font-size: 12px; pointer-events: none; opacity: .5; }
  .search-input {
    width: 100%; padding: 6px 32px 6px 28px; border-radius: 5px;
    border: 1px solid var(--color-border); background: var(--color-bg-input); color: var(--color-text-primary);
    font-size: 13px; outline: none;
  }
  .search-input::placeholder { color: var(--color-text-faint); }
  .search-input:focus { border-color: var(--color-accent); }
  .search-input::-webkit-search-cancel-button { display: none; }
  .search-clr {
    position: absolute; right: 7px; background: transparent; border: none;
    color: var(--color-text-muted); font-size: 12px; cursor: pointer; padding: 2px 4px; border-radius: 3px;
  }
  .search-clr:hover { color: var(--color-text-primary); }

  .sort-btn.active { border-color: var(--color-accent-light); color: var(--color-accent-light); background: color-mix(in srgb, var(--color-accent-light) 12%, transparent); }
  .sort-hint {
    padding: 3px 10px 5px; font-size: 11px; color: var(--color-closed);
    background: var(--color-bg-elevated); border-bottom: 1px solid var(--color-border); text-align: center; flex-shrink: 0;
  }

  .type-row { display: flex; gap: 1px; padding: 7px 10px; border-bottom: 1px solid var(--color-border); background: var(--color-bg-hover); flex-shrink: 0; }
  .type-btn { flex: 1; padding: 6px 4px; border-radius: 5px; border: 1px solid var(--color-border); background: transparent; color: var(--color-text-muted); font-size: 13px; cursor: pointer; text-align: center; }
  .type-btn.on-open   { border-color: var(--color-open); color: var(--color-open); background: var(--color-open-alpha); }
  .type-btn.on-closed { border-color: var(--color-closed); color: var(--color-closed); background: var(--color-closed-alpha); }

  .filter-group { padding: 6px 14px 8px; border-bottom: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }
  .group-label  { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--color-text-faint); margin-bottom: 2px; }
  .filter-group label { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--color-text-muted); cursor: pointer; }
  .filter-group label:hover { color: var(--color-text-primary); }
  .filter-group input { accent-color: var(--color-accent); width: 14px; height: 14px; cursor: pointer; }

  .effort-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
  .text-btn { font-size: 10px; color: var(--color-accent); background: none; border: none; cursor: pointer; padding: 0; }
  .text-btn:hover { color: var(--color-accent-light); text-decoration: underline; }
  .effort-grid { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-top: 4px; }
  .effort-chk { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-muted); cursor: pointer; }
  .effort-badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; background: var(--color-bg-hover); color: var(--color-text-muted); }
  .effort-low { color: var(--color-open); background: var(--color-open-alpha); }
  .effort-medium { color: var(--color-closed); background: var(--color-closed-alpha); }
  .effort-high { color: var(--color-error); background: var(--color-error-alpha); }
  .effort-xhigh { color: var(--color-accent-violet); background: var(--color-accent-violet-alpha); }

  /* ── Tree (grouped) ── */
  .tree { flex: 1; overflow-y: auto; padding: 4px 0 12px; }
  .fam-row { display: flex; align-items: center; gap: 6px; padding: 5px 10px 5px 6px; cursor: pointer; user-select: none; }
  .fam-row:hover { background: var(--color-bg-hover); }
  .arr { font-size: 9px; color: var(--color-text-muted); transition: transform .12s; display: inline-block; }
  .arr.open { transform: rotate(90deg); }
  .fam-row input { accent-color: var(--color-accent); width: 13px; height: 13px; cursor: pointer; flex-shrink: 0; }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .fam-name  { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
  .fam-brand { font-size: 12px; color: var(--color-text-muted); }
  .fam-count { font-size: 11px; color: var(--color-text-muted); margin-left: auto; }
  .children { padding-left: 22px; }

  /* ── Flat list ── */
  .flat-list { padding: 2px 0; }

  /* ── Model rows (shared grouped + flat) ── */
  .model-row { display: flex; gap: 6px; padding: 4px 8px 4px 4px; border-radius: 4px; cursor: default; }
  .model-row.flat { padding-left: 6px; }
  .model-row:hover, .model-row.highlighted { background: var(--color-bg-hover); }
  .model-row.selected { background: var(--color-accent-alpha); }
  .model-row.selected:hover, .model-row.selected.highlighted { background: var(--color-accent-alpha-hover); }
  .model-row.highlighted .model-name { color: var(--color-text-primary); }
  .model-row.selected .model-name { color: var(--color-text-primary); font-weight: 500; }
  .model-row input { accent-color: var(--color-accent); width: 13px; height: 13px; cursor: pointer; flex-shrink: 0; margin-top: 2px; }
  .model-row .dot { margin-top: 4px; }
  .model-col { display: flex; flex-direction: column; gap: 4px; flex: 1; overflow: hidden; }
  .model-name { font-size: 13px; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; line-height: 1.1; }
  .model-row:hover .model-name { color: var(--color-text-primary); }
  .model-meta { display: flex; align-items: center; justify-content: flex-end; gap: 5px; flex-wrap: wrap; }
  .model-date { font-size: 11px; color: var(--color-text-muted); flex-shrink: 0; line-height: 1; }
  .tag { font-size: 10px; padding: 1px 4px; border-radius: 2px; flex-shrink: 0; line-height: 1.2; }
  .tag.ol  { background: var(--color-olama-alpha); color: var(--color-olama); }
  .tag.oss { background: var(--color-open-alpha); color: var(--color-open); }
  .tag.api { background: var(--color-closed-alpha); color: var(--color-closed); }
  .effort-tag { font-weight: 600; text-transform: uppercase; font-size: 9px; padding: 1px 4px; border-radius: 3px; }

  /* ── Touch-friendly sizing on mobile ── */
  @media (max-width: 767px) {
    .model-row { min-height: 44px; }
    .filter-group input { width: 20px; height: 20px; }
    .search-clr { min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
    .ctrl-btn, .sort-btn { min-height: 44px; }
    .type-btn { min-height: 44px; }
    .fam-row { min-height: 44px; }
  }
</style>
