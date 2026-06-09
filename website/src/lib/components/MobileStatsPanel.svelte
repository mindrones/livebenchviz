<script lang="ts">
  interface Props {
    stats: Array<{ label: string; value: string; sub: string }>;
  }

  let { stats }: Props = $props();
</script>

<div class="mobile-stats">
  {#each stats as s}
    <div class="stat-card">
      <div class="stat-label">{s.label}</div>
      <div class="stat-value">{s.value}</div>
      <div class="stat-sub">{s.sub}</div>
    </div>
  {/each}
</div>

<style>
  .mobile-stats {
    display: flex; flex-direction: column; gap: 10px;
    padding: 16px; overflow-y: auto; height: 100%;
    background: var(--color-bg-primary, var(--color-bg-primary));
  }

  .stat-card {
    background: var(--color-bg-surface); border: 1px solid var(--color-border); border-radius: 10px;
    padding: 14px 18px; display: flex; flex-direction: column; gap: 2px;
  }

  .stat-label {
    font-size: 11px; text-transform: uppercase; letter-spacing: .07em;
    color: var(--color-text-muted); font-weight: 600;
  }

  .stat-value {
    font-size: 28px; font-weight: 800; color: var(--color-text-primary);
    background: linear-gradient(135deg, var(--color-accent-light), var(--color-accent), var(--color-accent-violet));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .stat-sub {
    font-size: 13px; color: var(--color-text-muted); white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
  }
</style>