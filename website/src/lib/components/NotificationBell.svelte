<script lang="ts">
  import { Bell, BellOff, BellRing, Settings } from '@lucide/svelte';
  import { 
    serviceWorkerState, 
    requestNotificationPermission, 
    registerPeriodicSync, 
    unregisterPeriodicSync,
    triggerManualSWCheck
  } from '$lib/notifications.svelte';
  
  let showTooltip = $state(false);
  let isChecking = $state(false);

  async function handleToggle() {
    if (serviceWorkerState.permission === 'denied') {
      alert("Notification permission is blocked. Please enable notifications in your browser's site settings to receive updates.");
      return;
    }
    
    if (serviceWorkerState.permission === 'default') {
      await requestNotificationPermission();
      return;
    }

    if (serviceWorkerState.permission === 'granted') {
      if (serviceWorkerState.periodicSyncRegistered) {
        await unregisterPeriodicSync();
      } else {
        await registerPeriodicSync();
      }
    }
  }

  // Trigger manual check for test/debug (hidden, but triggerable by shift-clicking or long press)
  async function handleDebugCheck(e: MouseEvent) {
    if (e.shiftKey) {
      isChecking = true;
      console.log('Manually checking for updates via service worker...');
      await triggerManualSWCheck();
      setTimeout(() => {
        isChecking = false;
      }, 1000);
    }
  }
</script>

<div class="notification-bell-container">
  <button 
    class="bell-btn"
    class:active={serviceWorkerState.permission === 'granted' && serviceWorkerState.periodicSyncRegistered}
    class:muted={serviceWorkerState.permission === 'granted' && !serviceWorkerState.periodicSyncRegistered}
    class:blocked={serviceWorkerState.permission === 'denied'}
    class:checking={isChecking}
    onclick={handleToggle}
    onmousedown={handleDebugCheck}
    onmouseenter={() => showTooltip = true}
    onmouseleave={() => showTooltip = false}
    onfocus={() => showTooltip = true}
    onblur={() => showTooltip = false}
    aria-label="Toggle benchmark notifications"
  >
    {#if serviceWorkerState.permission === 'denied'}
      <BellOff size={18} />
    {:else if serviceWorkerState.permission === 'granted' && serviceWorkerState.periodicSyncRegistered}
      <span class="pulse-ring">
        <BellRing size={18} />
      </span>
      <span class="active-badge"></span>
    {:else}
      <Bell size={18} />
    {/if}
  </button>

  {#if showTooltip}
    <div class="bell-tooltip">
      <div class="tooltip-arrow"></div>
      <div class="tooltip-title">
        {#if serviceWorkerState.permission === 'default'}
          Subscribe to Updates
        {:else if serviceWorkerState.permission === 'denied'}
          Notifications Blocked
        {:else if serviceWorkerState.periodicSyncRegistered}
          Notifications Active
        {:else}
          Notifications Enabled
        {/if}
      </div>
      <div class="tooltip-body">
        {#if serviceWorkerState.permission === 'default'}
          Get notified when new model benchmarks are published.
        {:else if serviceWorkerState.permission === 'denied'}
          Unblock notifications in site settings to enable updates.
        {:else if serviceWorkerState.periodicSyncRegistered}
          Checking for updates daily in the background. Shift-click to force check.
        {:else if serviceWorkerState.periodicSyncSupported}
          Background checking is off. Click to register sync.
        {:else}
          Background sync unsupported on this browser. In-app updates active.
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .notification-bell-container {
    position: relative;
    display: inline-flex;
  }

  .bell-btn {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    border-radius: 6px;
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .bell-btn:hover {
    color: var(--color-accent-light);
    background: var(--color-border);
    border-color: var(--color-text-faint);
    transform: translateY(-1px);
  }

  .bell-btn:active {
    transform: translateY(0);
  }

  .bell-btn.active {
    color: var(--color-accent-light);
    border-color: rgba(59, 130, 246, 0.4);
    background: rgba(59, 130, 246, 0.08);
  }

  .bell-btn.active:hover {
    color: var(--color-accent-light);
    background: rgba(59, 130, 246, 0.15);
  }

  .bell-btn.blocked {
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.2);
    background: rgba(239, 68, 68, 0.03);
  }

  .bell-btn.checking {
    animation: pulse 1s infinite alternate;
  }

  .active-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 6px;
    height: 6px;
    background-color: var(--color-accent);
    border-radius: 50%;
    box-shadow: 0 0 6px var(--color-accent);
  }

  @keyframes pulse {
    0% { opacity: 0.6; }
    100% { opacity: 1; }
  }

  .pulse-ring {
    display: inline-flex;
    animation: ring 2s infinite ease-in-out;
  }

  @keyframes ring {
    0% { transform: rotate(0); }
    10% { transform: rotate(15deg); }
    20% { transform: rotate(-15deg); }
    30% { transform: rotate(10deg); }
    40% { transform: rotate(-10deg); }
    50% { transform: rotate(0); }
    100% { transform: rotate(0); }
  }

  /* Tooltip styling */
  .bell-tooltip {
    position: absolute;
    top: calc(100% + 8px);
    right: 50%;
    transform: translateX(50%);
    width: 200px;
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 8px 12px;
    z-index: 1000;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    pointer-events: none;
    animation: fadeIn 0.15s ease-out;
  }

  .tooltip-arrow {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 6px;
    border-style: solid;
    border-color: transparent transparent var(--color-border) transparent;
  }

  .tooltip-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin-bottom: 3px;
  }

  .tooltip-body {
    font-size: 10px;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translate(50%, -4px); }
    to { opacity: 1; transform: translate(50%, 0); }
  }

  /* Adjust tooltip positioning for mobile viewports */
  @media (max-width: 600px) {
    .bell-tooltip {
      right: 0;
      transform: none;
    }
    .tooltip-arrow {
      left: auto;
      right: 12px;
      transform: none;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  }
</style>
