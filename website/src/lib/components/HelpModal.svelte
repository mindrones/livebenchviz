<script lang="ts">
  import { ChevronLeft, ChevronRight, X, GripVertical } from '@lucide/svelte';
  import { HELP_PANELS } from '$lib/help-panels';

  interface Props {
    show: boolean;
    onclose: () => void;
  }

  let { show, onclose }: Props = $props();

  const panels = HELP_PANELS;

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
    background: var(--color-bg-surface); border: 1px solid var(--color-border); border-radius: 12px;
    width: 480px; max-width: 92vw; box-shadow: 0 8px 32px rgba(0,0,0,.45),
    0 0 0 1px rgba(99,102,241,.08);
    display: flex; flex-direction: column;
  }
  .modal-header {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-bottom: 1px solid var(--color-border);
    cursor: grab; touch-action: none;
  }
  .modal-header:active { cursor: grabbing; }
  .drag-grip {
    display: flex; align-items: center; color: var(--color-text-faint);
    transition: color .15s; flex-shrink: 0;
  }
  .drag-grip.dragging { color: var(--color-accent-light); }
  .modal-header:hover .drag-grip { color: #6b7280; }
  .panel-title {
    font-size: 14px; font-weight: 700; color: var(--color-text-primary); flex: 1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    pointer-events: none; margin: 0;
  }
  .nav-info {
    font-size: 11px; color: #6b7280; font-variant-numeric: tabular-nums;
    pointer-events: none; flex-shrink: 0;
  }
  .nav-btn {
    background: transparent; border: 1px solid var(--color-border); border-radius: 4px;
    color: var(--color-text-muted); cursor: pointer; padding: 3px 5px; display: flex;
    align-items: center; justify-content: center; transition: all .15s;
    flex-shrink: 0;
  }
  .nav-btn:hover:not(:disabled) { color: var(--color-text-primary); border-color: var(--color-accent); }
  .nav-btn:disabled { opacity: .3; cursor: default; }
  .close-btn {
    background: transparent; border: 1px solid var(--color-border); border-radius: 4px;
    color: var(--color-text-muted); cursor: pointer; padding: 3px 5px; display: flex;
    align-items: center; justify-content: center; transition: color .15s, border-color .15s;
    flex-shrink: 0;
  }
  .close-btn:hover { color: var(--color-text-primary); border-color: var(--color-accent); }

  .modal-body {
    padding: 14px 18px 18px; user-select: text;
  }
  .panel-body {
    font-size: 13px; line-height: 1.65; color: var(--color-text-primary); margin: 0;
  }

  .modal-footer {
    display: flex; align-items: center; gap: 6px; justify-content: center;
    padding: 6px 14px 10px; border-top: 1px solid var(--color-border);
  }
  kbd {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 22px; height: 20px; padding: 0 4px;
    background: var(--color-bg-input); border: 1px solid var(--color-border); border-radius: 3px;
    font-family: inherit; font-size: 11px; color: var(--color-text-muted);
  }
  .footer-hint {
    font-size: 11px; color: var(--color-text-faint);
  }
</style>