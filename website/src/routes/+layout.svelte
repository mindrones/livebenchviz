<script lang="ts">
  import '../app.css';
  import { breakpoints } from '$lib/stores/breakpoints.svelte';
  let { children } = $props();

  // Initialise breakpoint listeners (module-level code only runs once,
  // but this reference ensures the store is imported and kept alive)
  void breakpoints;
</script>

{@render children()}