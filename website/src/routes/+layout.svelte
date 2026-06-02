<script lang="ts">
  let { children } = $props();
</script>

{@render children()}

<style>
  :global(*) { box-sizing: border-box; margin: 0; padding: 0; }

  :global(body) {
    background: #0f1117;
    color: #e2e8f0;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 14px;
    height: 100vh;
    overflow: hidden;
  }

  :global(::-webkit-scrollbar)       { width: 5px; height: 5px; }
  :global(::-webkit-scrollbar-track) { background: transparent; }
  :global(::-webkit-scrollbar-thumb) { background: #2e3250; border-radius: 3px; }
</style>
