<script lang="ts">
  import { ChevronLeft, ChevronRight, X, GripVertical } from '@lucide/svelte';

  interface Props {
    show: boolean;
    onclose: () => void;
  }

  let { show, onclose }: Props = $props();

  const panels = [
    {
      title: 'Timeline Brush',
      body: 'Drag the left or right handle on the release timeline to zoom into a date range. Models released outside the brush are hidden. Click outside the brush to re-center it. Use the quick-select buttons (6 M, 1 Y, 2 Y, 3 Y, All) to jump to common ranges.',
    },
    {
      title: 'Release Timeline Hover',
      body: 'Hover over the timeline track to snap to the nearest model release date. A red marker appears and the matching curve(s) highlight in the chart with a count label.',
    },
    {
      title: 'Hovering Curves',
      body: 'Move your cursor over any curve in the parallel-coordinates chart to highlight it. The curve turns white and score labels appear at each axis crossing. Hovering a sidebar row highlights the same curve — the link works both ways.',
    },
    {
      title: 'Selecting Curves',
      body: 'Click a highlighted curve or sidebar row to add it to your selection (up to 8). Selected curves appear in white and are listed as pills at the top of the chart. Click a pill\'s × to remove one, or "Clear all" to deselect everything. Click a selected curve again to toggle it off.',
    },
    {
      title: 'Axis Brushing',
      body: 'Drag vertically on any axis line to create a range filter. Only models whose score falls within every active brush remain fully visible; the rest dim. Each brush shows its range values and a small × to clear it. A "Clear all filters" link appears when any brush is active.',
    },
    {
      title: 'Axis Reordering',
      body: 'Grip the ⠿ icon next to any axis title and drag horizontally. The axis slides to its new position and the chart updates instantly. Reorder persists for the session.',
    },
    {
      title: 'Sort Axis Click',
      body: 'When sidebar sort is set to Category, click any axis title in the chart to switch the sort metric. The selected axis name appears in the sidebar sort hint.',
    },
    {
      title: 'Source Filters',
      body: 'Four checkboxes control which inference sources are visible: OpenRouter, Ollama Cloud, Ollama Download, and Other. Uncheck a source to remove all models available through it from the chart and sidebar.',
    },
    {
      title: 'Open / Closed Weights',
      body: 'Two toggle buttons switch Open Weights (🟢) and Closed Weights (🟡) on or off. Focus on only open-source or only proprietary models with one click.',
    },
    {
      title: 'Search',
      body: 'Type in the search field to filter by model name or provider family. The chart and sidebar update in real time. Hit the × to clear.',
    },
    {
      title: 'Sort Modes',
      body: 'Choose between three sorts: Category (ordered by score on the selected axis), Count (by model count or newest first in flat mode), or A–Z Name (alphabetical).',
    },
    {
      title: 'Group by Provider',
      body: 'Toggle "Group by provider" to switch between a tree view where families are expandable/collapsible and a flat alphabetical list.',
    },
    {
      title: 'Expand & Collapse',
      body: 'In grouped mode, click a family row to expand or collapse it. "Expand all" and "Collapse all" batch buttons open or close every family at once.',
    },
    {
      title: 'Model Visibility',
      body: 'Each model and family has a checkbox. Uncheck to hide a curve from the chart without removing it from the dataset. "Select all" and "Deselect all" toggle every visible model at once.',
    },
    {
      title: 'Latest 2 per Series',
      body: 'Enable "Show latest 2 per series" to keep only the two most recent models in every family. Older revisions fade out of the chart and sidebar.',
    },
    {
      title: 'URL Persistence',
      body: 'Every toggle, selection, sort choice, brush range, and search term is saved to the URL query string. Bookmark or share the URL to recreate your exact view.',
    },
    {
      title: 'Reset',
      body: 'The ↺ Reset button restores all filters, selections, brushes, and sort choices to their defaults.',
    },
  ];

  let current = $state(0);

  // ── Drag state ──
  let modalX = $state(window.innerWidth - 520);
  let modalY = $state(60);
  let dragging = $state(false);
  let dragOffX = 0;
  let dragOffY = 0;

  function onDragStart(e: PointerEvent) {
    // Don't start drag from interactive buttons
    const target = e.target as HTMLElement;
    if (target.closest('.nav-btn') || target.closest('.close-btn')) return;
    dragging = true;
    const rect = (e.currentTarget as HTMLElement).closest('.modal')!.getBoundingClientRect();
    dragOffX = e.clientX - rect.left;
    dragOffY = e.clientY - rect.top;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onDragMove(e: PointerEvent) {
    if (!dragging) return;
    let nx = e.clientX - dragOffX;
    let ny = e.clientY - dragOffY;
    const mw = 480;
    nx = Math.max(0, Math.min(window.innerWidth - mw, nx));
    ny = Math.max(0, Math.min(window.innerHeight - 80, ny));
    modalX = nx;
    modalY = ny;
  }

  function onDragEnd() {
    dragging = false;
  }

  function prev() {
    if (current > 0) current--;
  }
  function next() {
    if (current < panels.length - 1) current++;
  }

  function onKeydown(e: KeyboardEvent) {
    if (!show) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if show}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal" style:left="{modalX}px" style:top="{modalY}px">
    <div class="modal-header"
      onpointerdown={onDragStart}
      onpointermove={onDragMove}
      onpointerup={onDragEnd}
      onpointercancel={onDragEnd}
    >
      <span class="drag-grip" class:dragging><GripVertical size={14} /></span>
      <h2 class="panel-title">{panels[current].title}</h2>
      <span class="nav-info">{current + 1}/{panels.length}</span>
      <button class="nav-btn" onclick={prev} disabled={current === 0} aria-label="Previous">
        <ChevronLeft size={14} />
      </button>
      <button class="nav-btn" onclick={next} disabled={current === panels.length - 1} aria-label="Next">
        <ChevronRight size={14} />
      </button>
      <button class="close-btn" onclick={onclose} aria-label="Close">
        <X size={14} />
      </button>
    </div>
    <div class="modal-body">
      <p class="panel-body">{panels[current].body}</p>
    </div>
    <div class="modal-footer">
      <kbd>←</kbd><kbd>→</kbd>
      <span class="footer-hint">Use keyboard arrows to navigate</span>
    </div>
  </div>
{/if}

<style>
  .modal {
    position: fixed; z-index: 1000; user-select: none;
    background: #1a1d27; border: 1px solid #2e3250; border-radius: 12px;
    width: 480px; max-width: 92vw; box-shadow: 0 8px 32px rgba(0,0,0,.45),
    0 0 0 1px rgba(99,102,241,.08);
    display: flex; flex-direction: column;
  }
  .modal-header {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-bottom: 1px solid #2e3250;
    cursor: grab; touch-action: none;
  }
  .modal-header:active { cursor: grabbing; }
  .drag-grip {
    display: flex; align-items: center; color: #4a5568;
    transition: color .15s; flex-shrink: 0;
  }
  .drag-grip.dragging { color: #818cf8; }
  .modal-header:hover .drag-grip { color: #6b7280; }
  .panel-title {
    font-size: 14px; font-weight: 700; color: #e2e8f0; flex: 1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    pointer-events: none; margin: 0;
  }
  .nav-info {
    font-size: 11px; color: #6b7280; font-variant-numeric: tabular-nums;
    pointer-events: none; flex-shrink: 0;
  }
  .nav-btn {
    background: transparent; border: 1px solid #2e3250; border-radius: 4px;
    color: #8892a4; cursor: pointer; padding: 3px 5px; display: flex;
    align-items: center; justify-content: center; transition: all .15s;
    flex-shrink: 0;
  }
  .nav-btn:hover:not(:disabled) { color: #e2e8f0; border-color: #6366f1; }
  .nav-btn:disabled { opacity: .3; cursor: default; }
  .close-btn {
    background: transparent; border: 1px solid #2e3250; border-radius: 4px;
    color: #8892a4; cursor: pointer; padding: 3px 5px; display: flex;
    align-items: center; justify-content: center; transition: color .15s, border-color .15s;
    flex-shrink: 0;
  }
  .close-btn:hover { color: #e2e8f0; border-color: #6366f1; }

  .modal-body {
    padding: 14px 18px 18px; user-select: text;
  }
  .panel-body {
    font-size: 13px; line-height: 1.65; color: #c4cad8; margin: 0;
  }

  .modal-footer {
    display: flex; align-items: center; gap: 6px; justify-content: center;
    padding: 6px 14px 10px; border-top: 1px solid #2e3250;
  }
  kbd {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 22px; height: 20px; padding: 0 4px;
    background: #141620; border: 1px solid #3a4060; border-radius: 3px;
    font-family: inherit; font-size: 11px; color: #8892a4;
  }
  .footer-hint {
    font-size: 11px; color: #4a5568;
  }
</style>