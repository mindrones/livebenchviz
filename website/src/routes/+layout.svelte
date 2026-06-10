<script lang="ts">
  import '../app.css';
  import { breakpoints } from '$lib/stores/breakpoints.svelte';
  import { initNotifications } from '$lib/notifications.svelte';
  import NotificationBanner from '$lib/components/NotificationBanner.svelte';
  import NotificationPrompt from '$lib/components/NotificationPrompt.svelte';
  import Tooltip from '$lib/components/Tooltip.svelte';

  let { children } = $props();

  // Initialise breakpoint listeners (module-level code only runs once,
  // but this reference ensures the store is imported and kept alive)
  void breakpoints;

  $effect(() => {
    initNotifications();
  });
</script>

{@render children()}
<NotificationBanner />
<NotificationPrompt />
<Tooltip />