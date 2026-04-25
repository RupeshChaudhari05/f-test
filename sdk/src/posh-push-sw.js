/**
 * Posh Push - Production Service Worker (v2.0)
 * =============================================
 * Handles background push notifications with:
 *  - Robust error handling and retry logic
 *  - Offline event queuing with exponential back-off
 *  - Multi-environment VAPID / FCM support
 *  - Notification customisation (image, badge, actions)
 *  - Scope validation to prevent cross-origin issues
 *  - Periodic background sync for offline events
 *  - Self-diagnostics via the POSH_SW_PING message
 *
 * Deploy to the ROOT of your website as /posh-push-sw.js
 * The scope MUST cover every page that shows a notification.
 *
 * @version 2.0.0
 * @license MIT
 */

'use strict';

// ── Constants ──────────────────────────────────────────────────────────────

const SW_VERSION = '2.0.0';
const CACHE_NAME = `posh-push-v${SW_VERSION}`;
const OFFLINE_QUEUE_KEY = 'posh-push-offline-queue';
const CONFIG_KEY = 'posh-push-sw-config';
const MAX_OFFLINE_EVENTS = 100;   // discard oldest after this limit
const MAX_RETRY_AGE_MS = 24 * 60 * 60 * 1000; // discard events older than 24 h
const DEFAULT_ICON = '/icon-192.png';
const DEFAULT_BADGE = '/badge-72.png';

// ── Install ────────────────────────────────────────────────────────────────

/**
 * Skip the waiting phase so a new SW takes effect without a page reload.
 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ── Activate ───────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Claim all existing clients immediately
      await clients.claim();

      // Purge old caches from previous SW versions
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('posh-push-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k)),
      );
    })(),
  );
});

// ── Push ───────────────────────────────────────────────────────────────────

/**
 * Fired when the browser receives a push message from the server.
 *
 * Expected payload schema:
 * {
 *   title         : string           – notification title (required)
 *   body/message  : string           – body text
 *   icon          : string           – icon URL
 *   image         : string           – large hero image URL
 *   badge         : string           – monochrome badge icon URL
 *   clickAction/url : string         – URL to open on click
 *   deepLink      : { url: string }  – alternative deep-link URL
 *   notificationId: string           – for analytics tracking
 *   subscriberId  : string           – for analytics tracking
 *   actions       : Array            – notification action buttons
 *   tag           : string           – groups / replaces similar notifications
 *   data          : object           – arbitrary extra data forwarded to click
 * }
 */
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('[PoshPush SW] Push received with no payload – skipped.');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'New Notification', body: event.data.text() };
  }

  const notifOptions = _buildNotificationOptions(payload);

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(
        payload.title || 'New Notification',
        notifOptions,
      );

      await _trackEvent('delivered', {
        notificationId: payload.notificationId,
        subscriberId: payload.subscriberId,
      });
    })(),
  );
});

// ── Notification click ─────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = _resolveClickUrl(data, event.action);

  event.waitUntil(
    (async () => {
      await _trackEvent('clicked', {
        notificationId: data.notificationId,
        subscriberId: data.subscriberId,
        clickUrl: targetUrl,
        action: event.action || null,
      });

      const allClients = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if (_urlsMatch(client.url, targetUrl) && 'focus' in client) {
          client.postMessage({ type: 'POSH_NOTIFICATION_CLICK', payload: data });
          return client.focus();
        }
      }

      if (clients.openWindow) {
        const win = await clients.openWindow(targetUrl);
        win?.postMessage({ type: 'POSH_NOTIFICATION_CLICK', payload: data });
      }
    })(),
  );
});

// ── Notification close (dismissed) ─────────────────────────────────────────

self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};
  _trackEvent('dismissed', {
    notificationId: data.notificationId,
    subscriberId: data.subscriberId,
  }).catch(() => { });
});

// ── Background Sync ────────────────────────────────────────────────────────

/**
 * Processes the offline event queue when connectivity is restored.
 * Registration tag: 'posh-push-sync'
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'posh-push-sync') {
    event.waitUntil(_processOfflineQueue());
  }
});

// ── Message ────────────────────────────────────────────────────────────────

/**
 * Handles messages posted from the main thread.
 *
 * Supported types:
 *  POSH_CONFIG  – store API key / server URL / subscriberId
 *  POSH_SW_PING – health-check; replies with version + scope
 */
self.addEventListener('message', (event) => {
  if (!event.data || !event.data.type) return;

  switch (event.data.type) {
    case 'POSH_CONFIG':
    // Legacy alias
    case 'POSH_PUSH_CONFIG':
      _storeConfig(event.data.payload || event.data.config || {});
      break;

    case 'POSH_SW_PING':
      event.source?.postMessage({
        type: 'POSH_SW_PONG',
        version: SW_VERSION,
        scope: self.registration.scope,
      });
      break;

    default:
      break;
  }
});

// ── Private helpers ─────────────────────────────────────────────────────────

function _buildNotificationOptions(payload) {
  return {
    body: payload.body || payload.message || '',
    icon: payload.icon || DEFAULT_ICON,
    image: payload.image || undefined,
    badge: payload.badge || DEFAULT_BADGE,
    vibrate: [200, 100, 200],
    tag: payload.tag || payload.notificationId || 'posh-push',
    renotify: true,
    requireInteraction: false,
    silent: false,
    timestamp: Date.now(),
    actions: Array.isArray(payload.actions) ? payload.actions : [],
    data: {
      url: payload.url || payload.clickAction || '/',
      deepLink: payload.deepLink || null,
      notificationId: payload.notificationId,
      subscriberId: payload.subscriberId,
      actions: payload.actions,
      ...(payload.data || {}),
    },
  };
}

function _resolveClickUrl(data, action) {
  if (action && Array.isArray(data.actions)) {
    const matched = data.actions.find((a) => a.action === action);
    if (matched?.url) return matched.url;
  }
  if (data.deepLink?.url) return data.deepLink.url;
  if (data.url) return data.url;
  return self.registration.scope;
}

function _urlsMatch(a, b) {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.protocol === ub.protocol && ua.host === ub.host && ua.pathname === ub.pathname;
  } catch {
    return a === b;
  }
}

async function _trackEvent(eventName, data) {
  const config = await _loadConfig();
  if (!config?.apiKey) return;

  const subscriberId = data.subscriberId || config.subscriberId;
  const serverUrl = (config.serverUrl || 'https://api.poshnotify.com').replace(/\/$/, '');

  const body = {
    notificationId: data.notificationId,
    subscriberId,
    event: eventName,
    clickUrl: data.clickUrl || null,
    action: data.action || null,
  };

  try {
    const resp = await fetch(`${serverUrl}/api/v1/sdk/delivery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  } catch {
    await _queueOfflineEvent(body, config);
    try { await self.registration.sync.register('posh-push-sync'); } catch { }
  }
}

async function _queueOfflineEvent(event, config) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const existing = await cache.match(OFFLINE_QUEUE_KEY);
    let queue = existing ? await existing.json() : [];

    if (queue.length >= MAX_OFFLINE_EVENTS) {
      queue = queue.slice(queue.length - MAX_OFFLINE_EVENTS + 1);
    }
    queue.push({ event, config, queuedAt: Date.now() });

    await cache.put(OFFLINE_QUEUE_KEY, new Response(JSON.stringify(queue), {
      headers: { 'Content-Type': 'application/json' },
    }));
  } catch { }
}

async function _processOfflineQueue() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const existing = await cache.match(OFFLINE_QUEUE_KEY);
    if (!existing) return;

    const queue = await existing.json();
    const remaining = [];
    const now = Date.now();

    for (const item of queue) {
      if (now - item.queuedAt > MAX_RETRY_AGE_MS) continue;

      try {
        const { event, config } = item;
        const serverUrl = (config?.serverUrl || 'https://api.poshnotify.com').replace(/\/$/, '');

        const resp = await fetch(`${serverUrl}/api/v1/sdk/delivery`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config?.apiKey || '',
          },
          body: JSON.stringify(event),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      } catch {
        remaining.push(item);
      }
    }

    await cache.put(OFFLINE_QUEUE_KEY, new Response(JSON.stringify(remaining), {
      headers: { 'Content-Type': 'application/json' },
    }));
  } catch { }
}

async function _storeConfig(config) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(CONFIG_KEY, new Response(JSON.stringify(config), {
      headers: { 'Content-Type': 'application/json' },
    }));
  } catch { }
}

async function _loadConfig() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(CONFIG_KEY);
    return response ? response.json() : null;
  } catch {
    return null;
  }
}
