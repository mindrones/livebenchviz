<script lang="ts">
  import { tooltipState } from '$lib/tooltip.svelte';
</script>

{#if tooltipState.visible}
  <div
    class="global-tooltip"
    style="left: {tooltipState.x}px; top: {tooltipState.y + 15}px;"
  >
    <div class="tooltip-title">{tooltipState.title}</div>
    {#if tooltipState.content}
      <div class="tooltip-content">{tooltipState.content}</div>
    {/if}
  </div>
{/if}

<style>
  .global-tooltip {
    position: fixed;
    z-index: 99999;
    background: var(--color-bg-elevated, #1a1a1a);
    border: 1px solid var(--color-border, #333);
    border-radius: 6px;
    padding: 8px 12px;
    color: var(--color-text-primary, #fff);
    pointer-events: none;
    max-width: 280px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    font-size: 13px;
    transform: translateX(-50%);
    transition: opacity 0.1s ease-in-out;
  }
  .tooltip-title {
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--color-accent, #6366f1);
  }
  .tooltip-content {
    font-size: 12.5px;
    color: var(--color-text-muted, #aaa);
    line-height: 1.4;
  }
</style>
