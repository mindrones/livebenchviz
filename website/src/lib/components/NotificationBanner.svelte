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
    background: rgba(26, 29, 39, 0.85);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid rgba(99, 102, 241, 0.35);
    box-shadow: 
      0 10px 30px -10px rgba(0, 0, 0, 0.5),
      0 1px 3px rgba(99, 102, 241, 0.1),
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
    background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.8), transparent);
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
    color: #e2e8f0;
  }

  .banner-badge {
    font-size: 9px;
    font-weight: 800;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.4);
    color: #818cf8;
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
    background: #6366f1;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
  }

  .btn-refresh:hover {
    background: #818cf8;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
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
    color: #8892a4;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .btn-close:hover {
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.05);
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
