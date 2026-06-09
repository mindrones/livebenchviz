<script lang="ts">
  import { RefreshCw, X } from '@lucide/svelte';
  import { serviceWorkerState, dismissUpdateBanner } from '$lib/notifications.svelte';
  import { fade, fly } from 'svelte/transition';
</script>

{#if serviceWorkerState.showInAppBanner}
  <div 
    class="notification-banner"
    in:fly={{ y: -50, duration: 400 }}
    out:fade={{ duration: 200 }}
    role="alert"
  >
    <div class="banner-glow"></div>
    <div class="banner-content">
      <div class="banner-text">
        <span class="banner-badge">UPDATE</span>
        <span class="banner-message">New benchmark data has been added!</span>
      </div>
      <div class="banner-actions">
        <button 
          class="btn-refresh" 
          onclick={() => dismissUpdateBanner(true)}
          aria-label="Refresh application to see new data"
        >
          <RefreshCw size={14} class="spin-hover" />
          <span>Refresh</span>
        </button>
        <button 
          class="btn-close" 
          onclick={() => dismissUpdateBanner(false)}
          aria-label="Close notification"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .notification-banner {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10000; /* Ensure it floats above modals */
    display: flex;
    align-items: center;
    width: max-content;
    max-width: 90vw;
    background: var(--color-bg-toast);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid color-mix(in srgb, var(--color-accent) 35%, transparent);
    box-shadow: 
      0 10px 30px -10px rgba(0, 0, 0, 0.5),
      0 1px 3px color-mix(in srgb, var(--color-accent) 10%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 10px 14px;
    overflow: hidden;
  }

  .banner-glow {
    position: absolute;
    top: 0;
    left: 10%;
    width: 80%;
    height: 1px;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-accent) 80%, transparent), transparent);
  }

  .banner-content {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
  }

  .banner-text {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .banner-badge {
    font-size: 9px;
    font-weight: 800;
    background: var(--color-accent-alpha);
    border: 1px solid color-mix(in srgb, var(--color-accent) 40%, transparent);
    color: var(--color-accent-light);
    padding: 2px 6px;
    border-radius: 6px;
    letter-spacing: 0.05em;
  }

  .banner-message {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .banner-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .btn-refresh {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--color-accent);
    color: var(--color-bg-primary);
    border: none;
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px var(--color-accent-alpha-hover);
  }

  .btn-refresh:hover {
    background: var(--color-accent-light);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-accent) 35%, transparent);
    transform: translateY(-1px);
  }

  .btn-refresh:active {
    transform: translateY(0);
  }

  :global(.spin-hover) {
    transition: transform 0.4s ease;
  }

  .btn-refresh:hover :global(.spin-hover) {
    transform: rotate(180deg);
  }

  .btn-close {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .btn-close:hover {
    color: var(--color-text-primary);
    background: color-mix(in srgb, var(--color-text-primary) 5%, transparent);
  }

  /* Responsive layout adjustment for smaller viewports */
  @media (max-width: 600px) {
    .notification-banner {
      width: calc(100% - 24px);
      left: 12px;
      transform: none;
      top: 12px;
    }
    .banner-content {
      gap: 10px;
    }
    .banner-text {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
    .banner-message {
      font-size: 12px;
      white-space: normal;
    }
  }
</style>
