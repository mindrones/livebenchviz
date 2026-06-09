<script lang="ts">
  import { Bell, X } from '@lucide/svelte';
  import { serviceWorkerState, requestNotificationPermission } from '$lib/notifications.svelte';
  import { fade, fly } from 'svelte/transition';
  import { browser } from '$app/environment';

  let dismissed = $state(false);

  // Read dismissal state from localStorage on mount
  $effect(() => {
    if (browser) {
      dismissed = localStorage.getItem('livebench_notifications_prompt_dismissed') === 'true';
    }
  });

  async function handleSubscribe() {
    const granted = await requestNotificationPermission();
    if (granted) {
      dismissed = true;
    }
  }

  function handleDismiss() {
    dismissed = true;
    if (browser) {
      localStorage.setItem('livebench_notifications_prompt_dismissed', 'true');
    }
  }

  // Determine if we should show the prompt card
  const showPrompt = $derived(
    browser &&
    !dismissed &&
    serviceWorkerState.permission === 'default'
  );
</script>

{#if showPrompt}
  <div 
    class="notification-prompt"
    in:fly={{ y: 50, duration: 400 }}
    out:fade={{ duration: 200 }}
    role="dialog"
    aria-labelledby="prompt-title"
  >
    <div class="prompt-glow"></div>
    <div class="prompt-header">
      <div class="icon-wrapper">
        <span class="bell-icon">
          <Bell size={18} />
        </span>
      </div>
      <h3 id="prompt-title">Stay Updated</h3>
      <button 
        class="btn-close" 
        onclick={handleDismiss}
        aria-label="Dismiss subscription prompt"
      >
        <X size={16} />
      </button>
    </div>
    <p class="prompt-body">
      Get background notifications when new model scores and benchmark updates are published.
    </p>
    <div class="prompt-actions">
      <button 
        class="btn-dismiss" 
        onclick={handleDismiss}
      >
        Not Now
      </button>
      <button 
        class="btn-subscribe" 
        onclick={handleSubscribe}
      >
        Subscribe
      </button>
    </div>
  </div>
{/if}

<style>
  .notification-prompt {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 320px;
    background: rgba(26, 29, 39, 0.9);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid var(--color-border);
    box-shadow: 
      0 12px 40px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    border-radius: 14px;
    padding: 18px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
    transition: border-color 0.3s;
  }

  .notification-prompt:hover {
    border-color: rgba(59, 130, 246, 0.5);
  }

  .prompt-glow {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 120px;
    height: 120px;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%);
    pointer-events: none;
  }

  .prompt-header {
    display: flex;
    align-items: center;
    gap: 10px;
    position: relative;
  }

  .icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    color: var(--color-accent-light);
    padding: 6px;
    border-radius: 8px;
  }

  .bell-icon {
    display: inline-flex;
    animation: sway 4s infinite ease-in-out;
  }

  @keyframes sway {
    0%, 100% { transform: rotate(0); }
    5% { transform: rotate(15deg); }
    10% { transform: rotate(-12deg); }
    15% { transform: rotate(10deg); }
    20% { transform: rotate(-8deg); }
    25% { transform: rotate(0); }
  }

  h3 {
    font-size: 14px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
  }

  .btn-close {
    margin-left: auto;
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
    background: rgba(255, 255, 255, 0.05);
  }

  .prompt-body {
    font-size: 12px;
    color: var(--color-text-muted);
    line-height: 1.5;
    margin: 0;
  }

  .prompt-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }

  .btn-dismiss {
    background: transparent;
    border: 1px solid transparent;
    color: var(--color-text-muted);
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-dismiss:hover {
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.03);
  }

  .btn-subscribe {
    background: var(--color-accent);
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
  }

  .btn-subscribe:hover {
    background: var(--color-accent-light);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    transform: translateY(-1px);
  }

  .btn-subscribe:active {
    transform: translateY(0);
  }

  /* Mobile layout handling */
  @media (max-width: 600px) {
    .notification-prompt {
      bottom: 74px; /* Float above the mobile navigation bar */
      left: 12px;
      right: 12px;
      width: calc(100% - 24px);
    }
  }
</style>
