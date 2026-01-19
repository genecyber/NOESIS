'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[App] Service worker registered:', registration.scope);

          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000); // Check every hour

          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available
                  console.log('[App] New service worker available');
                  // Could dispatch event to show update banner
                  window.dispatchEvent(new CustomEvent('sw-update-available'));
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('[App] Service worker registration failed:', error);
        });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC_COMPLETE') {
          console.log('[App] Background sync complete');
          window.dispatchEvent(new CustomEvent('sync-complete'));
        }
      });
    }
  }, []);

  return null;
}

// Utility to trigger manual sync
export function triggerSync() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC' });
  }
}

// Utility to request background sync
export async function requestBackgroundSync(tag: string = 'metamorph-sync') {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      try {
        await (registration as any).sync.register(tag);
        console.log('[App] Background sync registered:', tag);
        return true;
      } catch (error) {
        console.error('[App] Background sync registration failed:', error);
        return false;
      }
    }
  }
  return false;
}
