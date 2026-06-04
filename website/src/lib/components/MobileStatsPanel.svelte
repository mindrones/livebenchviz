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
    background: var(--color-bg-primary, #0f1117);
  }

  .stat-card {
    background: #1a1d27; border: 1px solid #2e3250; border-radius: 10px;
    padding: 14px 18px; display: flex; flex-direction: column; gap: 2px;
  }

  .stat-label {
    font-size: 11px; text-transform: uppercase; letter-spacing: .07em;
    color: #8892a4; font-weight: 600;
  }

  .stat-value {
    font-size: 28px; font-weight: 800; color: #e2e8f0;
    background: linear-gradient(135deg, #818cf8, #6366f1, #a78bfa);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .stat-sub {
    font-size: 13px; color: #8892a4; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
  }
</style>