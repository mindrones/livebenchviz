import { base } from '$app/paths';
import { browser, dev } from '$app/environment';

export const serviceWorkerState = $state({
  registered: false,
  permission: browser ? Notification.permission : 'default',
  periodicSyncSupported: false,
  periodicSyncRegistered: false,
  updateAvailable: false,
  latestHash: '',
  latestCount: 0,
  hasNewModels: false,
  showInAppBanner: false
});

export async function initNotifications() {
  if (!browser || !('serviceWorker' in navigator)) return;
  
  try {
    const registration = await navigator.serviceWorker.register(`${base}/service-worker.js`, {
      scope: `${base}/`,
      type: dev ? 'module' : 'classic'
    });
    serviceWorkerState.registered = true;
    serviceWorkerState.permission = Notification.permission;
    
    // Check if Periodic Sync is supported
    if ('periodicSync' in registration) {
      serviceWorkerState.periodicSyncSupported = true;
      const tags = await (registration as any).periodicSync.getTags();
      serviceWorkerState.periodicSyncRegistered = tags.includes('update-check');
    }
    
    // Listen for controller changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Reload on update if needed
    });
    
    // Run an in-app check on load
    await checkUpdatesInApp();
  } catch (err) {
    console.error('Service Worker registration failed:', err);
  }
}

export async function requestNotificationPermission() {
  if (!browser || !('Notification' in window)) return false;
  
  const permission = await Notification.requestPermission();
  serviceWorkerState.permission = permission;
  
  if (permission === 'granted') {
    // Seed our SW cache if possible
    try {
      const registration = await navigator.serviceWorker.ready;
      // Register periodic sync
      await registerPeriodicSync();
    } catch (e) {
      console.warn('Could not register periodic sync automatically:', e);
    }
    return true;
  }
  return false;
}

export async function registerPeriodicSync() {
  if (!browser || !('serviceWorker' in navigator)) return;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    if ('periodicSync' in registration) {
      await (registration as any).periodicSync.register('update-check', {
        minInterval: 24 * 60 * 60 * 1000 // 24 hours
      });
      serviceWorkerState.periodicSyncRegistered = true;
      console.log('Periodic Background Sync registered successfully!');
    }
  } catch (err) {
    console.warn('Periodic Sync registration failed (usually requires PWA installation):', err);
  }
}

export async function unregisterPeriodicSync() {
  if (!browser || !('serviceWorker' in navigator)) return;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    if ('periodicSync' in registration) {
      await (registration as any).periodicSync.unregister('update-check');
      serviceWorkerState.periodicSyncRegistered = false;
      console.log('Periodic Background Sync unregistered.');
    }
  } catch (err) {
    console.error('Periodic Sync unregistration failed:', err);
  }
}

export async function checkUpdatesInApp() {
  if (!browser) return;
  try {
    const res = await fetch(`${base}/data-hash.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const latest = await res.json();
    
    const lastSeenHash = localStorage.getItem('livebench_last_seen_hash');
    const lastSeenCount = parseInt(localStorage.getItem('livebench_last_seen_count') || '0', 10);
    
    if (lastSeenHash && lastSeenHash !== latest.hash) {
      serviceWorkerState.updateAvailable = true;
      serviceWorkerState.latestHash = latest.hash;
      serviceWorkerState.latestCount = latest.modelCount || 0;
      serviceWorkerState.hasNewModels = serviceWorkerState.latestCount > lastSeenCount;
      serviceWorkerState.showInAppBanner = true;
    } else if (!lastSeenHash) {
      // First-time visit, save the current hash silently
      localStorage.setItem('livebench_last_seen_hash', latest.hash);
      if (latest.modelCount) {
        localStorage.setItem('livebench_last_seen_count', latest.modelCount.toString());
      }
      
      // Also write it to livebench-notification-cache to keep SW aligned
      try {
        const cache = await caches.open('livebench-notification-cache');
        await cache.put('data-hash-version', new Response(JSON.stringify(latest)));
      } catch (e) {
        // Ignored
      }
    }
  } catch (err) {
    console.error('Error checking for updates in-app:', err);
  }
}

export function dismissUpdateBanner(accept: boolean) {
  if (accept && serviceWorkerState.latestHash) {
    localStorage.setItem('livebench_last_seen_hash', serviceWorkerState.latestHash);
    if (serviceWorkerState.latestCount > 0) {
      localStorage.setItem('livebench_last_seen_count', serviceWorkerState.latestCount.toString());
    }
    window.location.reload();
  } else {
    serviceWorkerState.showInAppBanner = false;
  }
}

// Helper to manually trigger the SW update check (primarily for testing)
export async function triggerManualSWCheck() {
  if (!browser || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({ type: 'CHECK_FOR_UPDATES' });
      console.log('Dispatched CHECK_FOR_UPDATES message to service worker.');
    }
  } catch (err) {
    console.error('Failed to trigger manual SW check:', err);
  }
}

if (browser && dev) {
  (window as any).__swState = serviceWorkerState;
}

