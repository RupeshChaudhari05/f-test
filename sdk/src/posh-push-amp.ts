/**
 * Posh Push SDK - AMP (Accelerated Mobile Pages) Variant
 * ========================================================
 * Enables web push subscription on AMP pages.
 *
 * AMP imposes strict constraints on JavaScript; this variant:
 *  - Works alongside amp-consent for GDPR compliance
 *  - Defers all heavy work until after AMP consent is granted
 *  - Supports both direct subscription and consent-gated subscription
 *  - Posts messages to the SW using the POSH_CONFIG message type so the
 *    service worker can track deliveries correctly
 *  - Falls back gracefully when push is not supported
 *
 * Usage (in AMP page):
 *   <script async custom-element="amp-script" src="https://cdn.ampproject.org/v0/amp-script-0.1.js"></script>
 *   <amp-script src="https://cdn.yourdomain.com/sdk/posh-push-amp.js">
 *     <button id="posh-subscribe-btn">Enable Notifications</button>
 *   </amp-script>
 *
 * Programmatic usage:
 *   PoshPushAMP.init({ apiKey: 'YOUR_API_KEY' });
 *   PoshPushAMP.subscribe(); // call after consent is obtained
 *
 * @version 2.0.0
 * @license MIT
 */

interface PoshPushAMPConfig {
  /** Site API key from the Posh dashboard */
  apiKey: string;
  /** Override the default server URL */
  serverUrl?: string;
  /**
   * When true, the SDK will wait for an amp:consent:response event before
   * attempting subscription.  When false, subscription begins immediately.
   */
  consentRequired?: boolean;
  /** Callback fired on successful subscription */
  onSubscribe?: (subscriberId: string) => void;
  /** Callback fired when push is not supported or user denies permission */
  onError?: (reason: string) => void;
}

interface SiteConfig {
  vapidPublicKey: string;
  widgetConfig?: Record<string, any>;
}

const PoshPushAMP = (() => {
  let _config: PoshPushAMPConfig;
  let _siteConfig: SiteConfig | null = null;
  let _subscriberId: string | null = null;
  const STORAGE_KEY = 'posh_push_subscriber_id';

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Initialise the AMP SDK.  Must be called before any other method.
   *
   * @param cfg  Configuration object.
   */
  function init(cfg: PoshPushAMPConfig): void {
    _config = { ...cfg };

    if (typeof window === 'undefined') return;

    // Retrieve any existing subscriber ID from storage
    try {
      _subscriberId = localStorage.getItem(STORAGE_KEY);
    } catch { }

    if (_config.consentRequired) {
      _listenForAmpConsent();
    } else {
      _setup();
    }
  }

  /**
   * Manually trigger the push subscription flow.
   * Useful when consent is managed externally.
   */
  async function subscribe(): Promise<string | null> {
    return _subscribe();
  }

  /**
   * Check whether the current visitor is already subscribed.
   */
  function isSubscribed(): boolean {
    return Boolean(_subscriberId);
  }

  // ── Private helpers ────────────────────────────────────────────────────

  /** Listen for the AMP consent framework's response event. */
  function _listenForAmpConsent(): void {
    document.addEventListener('amp:consent:response', (event: any) => {
      const state = event?.detail?.consentState;
      if (state === 'accepted' || state === 'sufficient') {
        _setup();
      } else {
        _config.onError?.('AMP consent denied or insufficient.');
      }
    });
  }

  /** Fetch site config from the Posh API. */
  async function _fetchSiteConfig(): Promise<SiteConfig | null> {
    try {
      const resp = await fetch(`${_getServerUrl()}/api/v1/sdk/config`, {
        headers: { 'x-api-key': _config.apiKey },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    } catch (err) {
      console.error('[PoshPush AMP] Failed to fetch site config:', err);
      return null;
    }
  }

  /** Gate check: is push supported in this browser / context? */
  function _isPushSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  /** Main setup sequence: config fetch → SW registration → auto-subscribe. */
  async function _setup(): Promise<void> {
    if (!_isPushSupported()) {
      _config.onError?.('Push notifications are not supported in this browser.');
      return;
    }

    _siteConfig = await _fetchSiteConfig();
    if (!_siteConfig) return;

    // Register the service worker
    try {
      const swPath = '/posh-push-sw.js';
      const registration = await navigator.serviceWorker.register(swPath, { scope: '/' });

      // Send config to the SW so it can send analytics
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({
          type: 'POSH_CONFIG',
          payload: {
            apiKey: _config.apiKey,
            serverUrl: _config.serverUrl || 'https://api.poshnotify.com',
            subscriberId: _subscriberId,
          },
        });
      });

      // If already subscribed at browser level, sync the ID
      const existing = await registration.pushManager.getSubscription();
      if (existing && _subscriberId) return; // already done

      // Otherwise subscribe
      if (!_subscriberId) {
        await _subscribe();
      }
    } catch (err) {
      console.error('[PoshPush AMP] Service worker registration failed:', err);
      _config.onError?.(`Service worker error: ${(err as Error).message}`);
    }
  }

  /** Perform the push subscription and register the subscriber with the API. */
  async function _subscribe(): Promise<string | null> {
    if (!_isPushSupported()) {
      _config.onError?.('Push not supported.');
      return null;
    }

    if (!_siteConfig) {
      _siteConfig = await _fetchSiteConfig();
      if (!_siteConfig) return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlBase64ToUint8Array(_siteConfig.vapidPublicKey),
      });

      const subJson = subscription.toJSON();

      const resp = await fetch(`${_getServerUrl()}/api/v1/sdk/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': _config.apiKey,
        },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
          consentGranted: true,
          platform: 'amp',
        }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      _subscriberId = data.subscriberId;

      try { localStorage.setItem(STORAGE_KEY, _subscriberId!); } catch { }

      // Update the SW with the new subscriber ID
      registration.active?.postMessage({
        type: 'POSH_CONFIG',
        payload: {
          apiKey: _config.apiKey,
          serverUrl: _config.serverUrl || 'https://api.poshnotify.com',
          subscriberId: _subscriberId,
        },
      });

      _config.onSubscribe?.(_subscriberId!);
      return _subscriberId;
    } catch (err) {
      console.error('[PoshPush AMP] Subscription failed:', err);
      _config.onError?.(`Subscription failed: ${(err as Error).message}`);
      return null;
    }
  }

  function _getServerUrl(): string {
    return (_config.serverUrl || 'https://api.poshnotify.com').replace(/\/$/, '');
  }

  function _urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const output = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
    return output;
  }

  // ── Public interface ────────────────────────────────────────────────────

  return { init, subscribe, isSubscribed };
})();

// Expose globally for AMP script execution context
if (typeof window !== 'undefined') {
  (window as any).PoshPushAMP = PoshPushAMP;
}

export default PoshPushAMP;


interface PoshPushAMPConfig {
  apiKey: string;
  serverUrl?: string;
  consentRequired?: boolean;
}

const PoshPushAMP = (() => {
  let config: PoshPushAMPConfig;

  function init(cfg: PoshPushAMPConfig) {
    config = { ...cfg };
    console.log('PoshPush AMP initialized');

    // AMP-specific initialization
    if (typeof window !== 'undefined') {
      // Listen for AMP consent events
      if (config.consentRequired) {
        listenForConsent();
      } else {
        setupSubscription();
      }
    }
  }

  function listenForConsent() {
    // AMP consent listener
    document.addEventListener('amp:consent:response', (event: any) => {
      if (event.detail && event.detail.consentState === 'accepted') {
        setupSubscription();
      }
    });
  }

  function setupSubscription() {
    // Check if push is supported
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      // Register service worker
      navigator.serviceWorker.register('/posh-push-sw.js', { scope: '/' })
        .then(registration => {
          console.log('AMP: Service worker registered');
          return registration.pushManager.getSubscription();
        })
        .then(existingSubscription => {
          if (!existingSubscription) {
            return subscribe();
          }
        })
        .catch(console.error);
    }
  }

  async function subscribe() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const response = await fetch(`${getServerUrl()}/api/v1/sdk/config`, {
        headers: { 'x-api-key': config.apiKey }
      });
      const siteConfig = await response.json();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(siteConfig.vapidPublicKey) as BufferSource,
      });

      const subJson = subscription.toJSON();
      await fetch(`${getServerUrl()}/api/v1/sdk/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey
        },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
          consentGranted: true,
        }),
      });

      console.log('AMP: Successfully subscribed');
    } catch (error) {
      console.error('AMP: Subscription failed', error);
    }
  }

  function getServerUrl(): string {
    return (config.serverUrl || 'https://api.poshnotify.com').replace(/\/$/, '');
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

  return {
    init,
    subscribe,
  };
})();

// Make it available globally for AMP
if (typeof window !== 'undefined') {
  (window as any).PoshPushAMP = PoshPushAMP;
}