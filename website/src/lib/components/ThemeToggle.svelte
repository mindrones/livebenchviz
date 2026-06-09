<script lang="ts">
  import { Sun, Moon } from '@lucide/svelte';
  import { theme } from '$lib/stores/theme.svelte';
</script>

<button
  class="theme-toggle"
  onclick={() => theme.toggle()}
  aria-label={theme.isDark ? "Switch to light theme" : "Switch to dark theme"}
>
  {#if theme.isDark}
    <Sun size={20} />
  {:else}
    <Moon size={20} />
  {/if}
</button>

<style>
  .theme-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--color-text-secondary, var(--color-text-muted));
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .theme-toggle:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-hover);
  }
</style>
