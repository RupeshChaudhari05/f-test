(function () {
  'use strict';

  /**
   * Posh Push - Service Worker
   * Handles push notifications in the background.
   *
   * Deploy this file to the root of your website as /posh-push-sw.js
   */

  const CACHE_NAME = 'posh-push-v1';
  const OFFLINE_QUEUE_KEY = 'posh-push-offline-queue';

  // Push event - received a push notification
  self.addEventListener('push', function (event) {
    if (!event.data) return;

    let payload;
    try {
      payload = event.data.json();
    } catch (e) {
      payload = {
        title: 'New Notification',
        body: event.data.text(),
      };
    }

    const options = {
      body: payload.body || payload.message || '',
      icon: payload.icon || '/icon-192.png',
      image: payload.image || undefined,
      badge: payload.badge || '/badge-72.png',
      vibrate: [200, 100, 200],
      tag: payload.notificationId || 'posh-push',
      renotify: true,
      requireInteraction: false,
      data: {
        url: payload.url || payload.clickAction || '/',
        deepLink: payload.deepLink || null,
        notificationId: payload.notificationId,
        subscriberId: payload.subscriberId,
        ...payload.data,
      },
      actions: payload.actions || [],
    };

    event.waitUntil(
      self.registration.showNotification(payload.title, options)
        .then(() => {
          // Track delivery
          return trackEvent('delivered', {
            notificationId: payload.notificationId,
            subscriberId: payload.subscriberId,
          });
        })
    );
  });

  // Notification click event
  self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const data = event.notification.data || {};
    let targetUrl = data.url || '/';

    // Handle deep links
    if (data.deepLink) {
      const deepLink = data.deepLink;
      if (deepLink.url) {
        targetUrl = deepLink.url;
      }
    }

    // Track click
    trackEvent('clicked', {
      notificationId: data.notificationId,
      subscriberId: data.subscriberId,
      clickUrl: targetUrl,
    });

    // Open or focus the target URL
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
        // Check if there's already a window open with this URL
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            // Send message to existing client
            client.postMessage({
              type: 'POSH_NOTIFICATION_CLICK',
              payload: data,
            });
            return client.focus();
          }
        }

        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl).then(function (windowClient) {
            if (windowClient) {
              windowClient.postMessage({
                type: 'POSH_NOTIFICATION_CLICK',
                payload: data,
              });
            }
          });
        }
      })
    );
  });

  // Notification close event
  self.addEventListener('notificationclose', function (event) {
    const data = event.notification.data || {};
    trackEvent('dismissed', {
      notificationId: data.notificationId,
      subscriberId: data.subscriberId,
    });
  });

  // Helper: track events back to server
  async function trackEvent(eventName, data) {
    // Get API key from stored config
    const apiKey = await getStoredApiKey();
    if (!apiKey) return;

    const serverUrl = await getStoredServerUrl();

    // Use subscriberId from data or fall back to stored one
    const subscriberId = data.subscriberId || await getStoredSubscriberId();

    const url = `${serverUrl}/api/v1/sdk/delivery`;

    const body = {
      notificationId: data.notificationId,
      subscriberId: subscriberId,
      event: eventName,
      clickUrl: data.clickUrl,
    };

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      // Queue for retry when back online
      await queueOfflineEvent(body);
    }
  }

  // Offline queue management
  async function queueOfflineEvent(event) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const response = await cache.match(OFFLINE_QUEUE_KEY);
      let queue = [];
      if (response) {
        queue = await response.json();
      }
      queue.push({ ...event, timestamp: Date.now() });
      await cache.put(OFFLINE_QUEUE_KEY, new Response(JSON.stringify(queue)));
    } catch (e) {
      // Silently fail
    }
  }

  async function processOfflineQueue() {
    try {
      const cache = await caches.open(CACHE_NAME);
      const response = await cache.match(OFFLINE_QUEUE_KEY);
      if (!response) return;

      const queue = await response.json();
      if (!queue.length) return;

      const apiKey = await getStoredApiKey();
      const serverUrl = await getStoredServerUrl();

      const remaining = [];
      for (const event of queue) {
        try {
          await fetch(`${serverUrl}/api/v1/sdk/delivery`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
            },
            body: JSON.stringify(event),
          });
        } catch (e) {
          remaining.push(event);
        }
      }

      await cache.put(OFFLINE_QUEUE_KEY, new Response(JSON.stringify(remaining)));
    } catch (e) {
      // Silently fail
    }
  }

  // Process offline queue when coming back online
  self.addEventListener('sync', function (event) {
    if (event.tag === 'posh-push-sync') {
      event.waitUntil(processOfflineQueue());
    }
  });

  // Message handler for configuration
  self.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'POSH_PUSH_CONFIG') {
      // Store config in IndexedDB or cache
      caches.open(CACHE_NAME).then(function (cache) {
        cache.put('config', new Response(JSON.stringify(event.data.config)));
      });
    }
  });

  // Helper to get stored API key
  async function getStoredApiKey() {
    try {
      const cache = await caches.open(CACHE_NAME);
      const response = await cache.match('config');
      if (response) {
        const config = await response.json();
        return config.apiKey;
      }
    } catch (e) { }
    return null;
  }

  // Helper to get stored server URL
  async function getStoredServerUrl() {
    try {
      const cache = await caches.open(CACHE_NAME);
      const response = await cache.match('config');
      if (response) {
        const config = await response.json();
        return config.serverUrl || 'https://api.poshnotify.com';
      }
    } catch (e) { }
    return 'https://api.poshnotify.com';
  }

  // Helper to get stored subscriber ID
  async function getStoredSubscriberId() {
    try {
      const cache = await caches.open(CACHE_NAME);
      const response = await cache.match('config');
      if (response) {
        const config = await response.json();
        return config.subscriberId || null;
      }
    } catch (e) { }
    return null;
  }

})();
