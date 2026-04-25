/**
 * Posh Push Notification SDK
 * Lightweight client-side SDK for integrating push notifications.
 *
 * Features:
 * - Automatic service worker registration with fallbacks
 * - Multiple widget types (bell, modal, slide-in)
 * - Consent management and GDPR compliance
 * - Cross-browser compatibility
 * - Error handling and retry logic
 * - AMP and Blogger variants available
 *
 * Usage:
 *   PoshPush.init({ apiKey: 'YOUR_API_KEY' });
 *   PoshPush.subscribe();
 *
 * @version 1.0.0
 * @author Posh Notify Team
 * @license MIT
 */

interface PoshPushConfig {
  apiKey: string;
  serverUrl?: string;
  autoSubscribe?: boolean;
  serviceWorkerPath?: string;
  onSubscribe?: (subscriberId: string) => void;
  onPermissionDenied?: () => void;
  onNotificationClick?: (data: any) => void;
}

interface WidgetConfig {
  buttonStyle: {
    color: string;
    size: string;
    position: string;
  };
  promptType: string;
  triggerRules: {
    type: string;
    value?: number;
  };
  language: string;
  consentBanner: {
    enabled: boolean;
    text: string;
  };
}

const PoshPush = (() => {
  let config: PoshPushConfig;
  let siteConfig: { siteId: string; vapidPublicKey: string; widgetConfig: WidgetConfig } | null = null;
  let subscriberId: string | null = null;
  let isInitialized = false;

  const STORAGE_KEY = 'posh_push_subscriber_id';

  // ---- Helpers ----

  function getServerUrl(): string {
    return (config.serverUrl || 'https://api.poshnotify.com').replace(/\/$/, '');
  }

  async function apiCall(endpoint: string, method = 'GET', body?: any): Promise<any> {
    const url = `${getServerUrl()}/api/v1/sdk${endpoint}`;
    const headers: Record<string, string> = {
      'x-api-key': config.apiKey,
      'Content-Type': 'application/json',
    };

    const resp = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      throw new Error(`PoshPush API error: ${resp.status} ${resp.statusText}`);
    }

    return resp.json();
  }

  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  function getStoredSubscriberId(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function storeSubscriberId(id: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Ignore storage errors
    }
  }

  // ---- Widget UI ----

  function createWidget(): void {
    if (!siteConfig) return;
    const wc = siteConfig.widgetConfig;

    // Don't show widget if already subscribed
    if (subscriberId) return;

    const style = document.createElement('style');
    style.textContent = `
      .posh-push-widget {
        position: fixed;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .posh-push-widget.bottom-right { bottom: 20px; right: 20px; }
      .posh-push-widget.bottom-left { bottom: 20px; left: 20px; }
      .posh-push-widget.top-right { top: 20px; right: 20px; }
      .posh-push-widget.top-left { top: 20px; left: 20px; }
      .posh-push-bell {
        width: 56px; height: 56px;
        border-radius: 50%;
        background: ${wc.buttonStyle?.color || '#4F46E5'};
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .posh-push-bell:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(0,0,0,0.2);
      }
      .posh-push-bell svg {
        width: 24px; height: 24px; fill: white;
      }
      .posh-push-popup {
        position: fixed;
        background: white;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.12);
        max-width: 360px;
        width: calc(100vw - 40px);
        z-index: 9999999;
        animation: posh-slide-in 0.3s ease;
      }
      .posh-push-popup.bottom-right { bottom: 90px; right: 20px; }
      .posh-push-popup.bottom-left { bottom: 90px; left: 20px; }
      .posh-push-popup.top-right { top: 90px; right: 20px; }
      .posh-push-popup.top-left { top: 90px; left: 20px; }
      @keyframes posh-slide-in {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .posh-push-popup h3 {
        margin: 0 0 8px; font-size: 16px; color: #1a1a1a;
      }
      .posh-push-popup p {
        margin: 0 0 16px; font-size: 14px; color: #666; line-height: 1.4;
      }
      .posh-push-popup .posh-btn-row {
        display: flex; gap: 8px; justify-content: flex-end;
      }
      .posh-push-popup .posh-btn {
        padding: 8px 16px; border-radius: 6px; border: none;
        cursor: pointer; font-size: 14px; font-weight: 500;
      }
      .posh-push-popup .posh-btn-primary {
        background: ${wc.buttonStyle?.color || '#4F46E5'};
        color: white;
      }
      .posh-push-popup .posh-btn-secondary {
        background: #f3f4f6; color: #374151;
      }
      .posh-push-modal-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 9999998;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .posh-push-modal {
        background: white;
        border-radius: 16px;
        padding: 32px;
        max-width: 400px;
        width: calc(100vw - 40px);
        text-align: center;
      }
    `;
    document.head.appendChild(style);

    const position = wc.buttonStyle?.position || 'bottom-right';

    if (wc.promptType === 'bell' || wc.promptType === 'slide') {
      createBellWidget(position, wc);
    } else if (wc.promptType === 'modal') {
      showModal(wc);
    }
  }

  function createBellWidget(position: string, wc: WidgetConfig): void {
    const widget = document.createElement('div');
    widget.className = `posh-push-widget ${position}`;
    widget.innerHTML = `
      <button class="posh-push-bell" id="posh-bell-btn">
        <svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
      </button>
    `;
    document.body.appendChild(widget);

    const bellBtn = document.getElementById('posh-bell-btn')!;
    bellBtn.addEventListener('click', () => {
      showPopup(position, wc);
    });

    // Apply trigger rules
    applyTriggerRules(wc, () => {
      if (wc.promptType === 'slide') {
        showPopup(position, wc);
      }
    });
  }

  function showPopup(position: string, wc: WidgetConfig): void {
    // Remove existing popup
    const existing = document.getElementById('posh-push-popup');
    if (existing) existing.remove();

    const consentText = wc.consentBanner?.text ||
      'We would like to send you push notifications. You can unsubscribe at any time.';

    const popup = document.createElement('div');
    popup.id = 'posh-push-popup';
    popup.className = `posh-push-popup ${position}`;
    popup.innerHTML = `
      <h3>Stay Updated!</h3>
      <p>${escapeHtml(consentText)}</p>
      <div class="posh-btn-row">
        <button class="posh-btn posh-btn-secondary" id="posh-deny-btn">No thanks</button>
        <button class="posh-btn posh-btn-primary" id="posh-allow-btn">Allow</button>
      </div>
    `;
    document.body.appendChild(popup);

    document.getElementById('posh-allow-btn')!.addEventListener('click', async () => {
      popup.remove();
      await subscribe();
    });

    document.getElementById('posh-deny-btn')!.addEventListener('click', () => {
      popup.remove();
      config.onPermissionDenied?.();
    });
  }

  function showModal(wc: WidgetConfig): void {
    const consentText = wc.consentBanner?.text ||
      'We would like to send you push notifications.';

    const overlay = document.createElement('div');
    overlay.className = 'posh-push-modal-overlay';
    overlay.innerHTML = `
      <div class="posh-push-modal">
        <h3 style="margin:0 0 12px;font-size:18px;">Enable Notifications</h3>
        <p style="margin:0 0 20px;color:#666;font-size:14px;">${escapeHtml(consentText)}</p>
        <div style="display:flex;gap:8px;justify-content:center;">
          <button class="posh-btn posh-btn-secondary" id="posh-modal-deny">Later</button>
          <button class="posh-btn posh-btn-primary" id="posh-modal-allow">Enable</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('posh-modal-allow')!.addEventListener('click', async () => {
      overlay.remove();
      await subscribe();
    });

    document.getElementById('posh-modal-deny')!.addEventListener('click', () => {
      overlay.remove();
      config.onPermissionDenied?.();
    });
  }

  function applyTriggerRules(wc: WidgetConfig, callback: () => void): void {
    const rules = wc.triggerRules;
    if (!rules) return;

    switch (rules.type) {
      case 'delay':
        setTimeout(callback, (rules.value || 5) * 1000);
        break;
      case 'scroll': {
        const threshold = rules.value || 50;
        const handler = () => {
          const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
          if (scrollPercent >= threshold) {
            window.removeEventListener('scroll', handler);
            callback();
          }
        };
        window.addEventListener('scroll', handler);
        break;
      }
      case 'exit_intent': {
        const handler = (e: MouseEvent) => {
          if (e.clientY <= 0) {
            document.removeEventListener('mouseout', handler);
            callback();
          }
        };
        document.addEventListener('mouseout', handler);
        break;
      }
    }
  }

  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ---- Core Functions ----

  /**
   * Initialize the Posh Push SDK
   * This method must be called before any other SDK methods
   *
   * @param userConfig - SDK configuration object
   * @param userConfig.apiKey - Your site's API key from the dashboard
   * @param userConfig.serverUrl - Backend server URL (optional, defaults to production)
   * @param userConfig.autoSubscribe - Automatically request subscription on init (optional)
   * @param userConfig.serviceWorkerPath - Custom service worker path (optional)
   * @param userConfig.onSubscribe - Callback when user subscribes (optional)
   * @param userConfig.onPermissionDenied - Callback when permission is denied (optional)
   * @param userConfig.onNotificationClick - Callback when notification is clicked (optional)
   */
  async function init(userConfig: PoshPushConfig): Promise<void> {
    config = userConfig;

    if (!config.apiKey) {
      console.error('PoshPush: API key is required');
      return;
    }

    // Check for existing subscription
    subscriberId = getStoredSubscriberId();

    // Fetch site config
    try {
      siteConfig = await apiCall('/config');
    } catch (error) {
      console.error('PoshPush: Failed to fetch config', error);
      return;
    }

    isInitialized = true;

    // Register service worker with enhanced error handling and fallbacks
    let registration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        const swPath = config.serviceWorkerPath || '/posh-push-sw.js';

        // Check if already registered
        const existingRegistration = await navigator.serviceWorker.getRegistration('/');
        if (existingRegistration) {
          console.log('PoshPush: Service worker already registered');
          registration = existingRegistration;
        } else {
          // Register new service worker
          registration = await navigator.serviceWorker.register(swPath, { scope: '/' });
          console.log('PoshPush: Service worker registered successfully');
        }

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;

        // Enhanced config sending with retry
        const sendConfigToSW = async (retryCount = 0) => {
          try {
            const sw = registration!.active || registration!.waiting || registration!.installing;
            if (sw) {
              sw.postMessage({
                type: 'POSH_PUSH_CONFIG',
                config: {
                  apiKey: config.apiKey,
                  serverUrl: getServerUrl(),
                  subscriberId: subscriberId,
                },
              });
              console.log('PoshPush: Config sent to service worker');
            } else if (retryCount < 3) {
              // Retry after a short delay
              setTimeout(() => sendConfigToSW(retryCount + 1), 1000);
            }
          } catch (error) {
            console.warn('PoshPush: Failed to send config to service worker', error);
          }
        };

        // Send config immediately if SW is active, otherwise wait
        if (registration!.active) {
          await sendConfigToSW();
        } else {
          // Wait for controller change or timeout
          const controllerPromise = new Promise<void>((resolve) => {
            const handler = () => {
              navigator.serviceWorker.removeEventListener('controllerchange', handler);
              sendConfigToSW();
              resolve();
            };
            navigator.serviceWorker.addEventListener('controllerchange', handler);

            // Timeout after 5 seconds
            setTimeout(() => {
              navigator.serviceWorker.removeEventListener('controllerchange', handler);
              sendConfigToSW();
              resolve();
            }, 5000);
          });
          await controllerPromise;
        }
      } catch (error) {
        console.error('PoshPush: Service worker registration failed - push notifications may not work', error);

        // Try alternative paths for common hosting scenarios
        const alternativePaths = [
          './posh-push-sw.js',
          '/wp-content/plugins/posh-push/posh-push-sw.js',
          `${window.location.pathname}posh-push-sw.js`
        ];

        for (const altPath of alternativePaths) {
          try {
            console.log(`PoshPush: Trying alternative service worker path: ${altPath}`);
            registration = await navigator.serviceWorker.register(altPath, { scope: '/' });
            console.log('PoshPush: Service worker registered with alternative path');
            break;
          } catch (altError) {
            console.warn(`PoshPush: Alternative path ${altPath} failed`, altError);
          }
        }
      }
    } else {
      console.warn('PoshPush: Service workers not supported - push notifications will not work');
    }

    // Show widget if not subscribed
    if (!subscriberId) {
      if (config.autoSubscribe) {
        await subscribe();
      } else {
        createWidget();
      }
    }

    // Listen for messages from service worker
    navigator.serviceWorker?.addEventListener('message', (event) => {
      if (event.data?.type === 'POSH_NOTIFICATION_CLICK') {
        config.onNotificationClick?.(event.data.payload);
      }
    });
  }

  /**
   * Request push notification permission and subscribe the user
   * This will show the browser's permission prompt and register the subscription
   *
   * @returns Promise<string | null> - Subscriber ID if successful, null if failed
   */
  async function subscribe(): Promise<string | null> {
    if (!isInitialized || !siteConfig) {
      console.error('PoshPush: Not initialized. Call init() first.');
      return null;
    }

    if (!('PushManager' in window)) {
      console.error('PoshPush: Push notifications are not supported in this browser');
      return null;
    }

    // Ensure service worker is registered and ready
    if (!navigator.serviceWorker) {
      console.error('PoshPush: Service workers not supported');
      return null;
    }

    try {
      // Wait for service worker to be ready
      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('PoshPush: Already subscribed, updating subscription');
        // Unsubscribe from old subscription first
        await existingSubscription.unsubscribe();
      }

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('PoshPush: Permission denied by user');
        config.onPermissionDenied?.();
        return null;
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(siteConfig.vapidPublicKey) as BufferSource,
      });

      const subJson = subscription.toJSON();

      // Validate subscription data
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error('Invalid subscription data received');
      }

      // Send to server
      const result = await apiCall('/subscribe', 'POST', {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        userAgent: navigator.userAgent,
        consentGranted: true,
      });

      if (!result?.subscriberId) {
        throw new Error('Invalid response from server');
      }

      subscriberId = result.subscriberId;
      storeSubscriberId(subscriberId!);

      // Send updated config to service worker
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'POSH_PUSH_CONFIG',
          config: {
            apiKey: config.apiKey,
            serverUrl: getServerUrl(),
            subscriberId: subscriberId,
          },
        });
      }

      // Remove widget
      const widget = document.querySelector('.posh-push-widget');
      widget?.remove();

      console.log('PoshPush: Successfully subscribed with ID:', subscriberId);
      config.onSubscribe?.(subscriberId!);
      return subscriberId;

    } catch (error) {
      console.error('PoshPush: Subscription failed', error);

      // Provide user-friendly error messages
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          config.onPermissionDenied?.();
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          console.error('PoshPush: Network error - check your internet connection');
        } else {
          console.error('PoshPush: Subscription error:', error.message);
        }
      }

      return null;
    }
  }

  async function tagUser(tags: string[]): Promise<void> {
    if (!subscriberId) {
      console.error('PoshPush: Not subscribed');
      return;
    }
    await apiCall('/tag', 'POST', { subscriberId, tags });
  }

  async function trackEvent(eventType: string, eventData?: Record<string, any>): Promise<void> {
    await apiCall('/event', 'POST', {
      subscriberId,
      eventType,
      eventData,
      pageUrl: window.location.href,
      referrer: document.referrer,
    });
  }

  function getSubscriberId(): string | null {
    return subscriberId;
  }

  async function unsubscribe(): Promise<void> {
    if (!subscriberId) return;

    try {
      await apiCall('/unsubscribe', 'POST', { subscriberId });

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      await subscription?.unsubscribe();

      localStorage.removeItem(STORAGE_KEY);
      subscriberId = null;
    } catch (error) {
      console.error('PoshPush: Unsubscribe failed', error);
    }
  }

  async function deleteMyData(): Promise<void> {
    if (!subscriberId) return;
    await apiCall(`/subscriber/${subscriberId}/data`, 'DELETE');
    localStorage.removeItem(STORAGE_KEY);
    subscriberId = null;
  }

  // Public API
  return {
    init,
    subscribe,
    tagUser,
    trackEvent,
    getSubscriberId,
    unsubscribe,
    deleteMyData,
  };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PoshPush;
}

// Attach to window for script tag usage
if (typeof window !== 'undefined') {
  (window as any).PoshPush = PoshPush;
}

export default PoshPush;
