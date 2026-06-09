<script lang="ts">
  import { HELP_PANELS } from '$lib/help-panels';

  interface Props {
    onclose?: () => void;
  }

  let { onclose }: Props = $props();
  const panels = HELP_PANELS;
</script>

<div class="mobile-help">
  <div class="help-header">
    <h2>How to Use</h2>
  </div>
  <div class="help-list">
    {#each panels as panel, i}
      <div class="help-item">
        <h3>{i + 1}. {panel.title}</h3>
        <p>{panel.body}</p>
      </div>
    {/each}
  </div>
</div>

<style>
  .mobile-help {
    height: 100%;
    overflow-y: auto;
    padding: 12px 16px 32px;
    background: var(--color-bg-primary, var(--color-bg-primary));
  }

  .help-header {
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 16px;
  }

  .help-header h2 {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
  }

  .help-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .help-item {
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 12px 14px;
  }

  .help-item h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-accent-light);
    margin: 0 0 6px;
  }

  .help-item p {
    font-size: 13px;
    line-height: 1.6;
    color: var(--color-text-primary);
    margin: 0;
  }
</style>