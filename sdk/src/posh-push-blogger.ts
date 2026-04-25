/**
 * Posh Push SDK - Blogger / Blogspot Variant (v2.0)
 * ==================================================
 * Full push notification SDK for Google Blogger / Blogspot sites.
 *
 * Blogger has several constraints compared to regular sites:
 *  - The service worker must be hosted on the blogger domain (blogspot.com or
 *    custom domain).  Deploy posh-push-sw.js there.
 *  - Blogger pages cannot install native SW directly; users must navigate to
 *    a page that owns the SW scope.
 *  - This SDK injects a fully self-contained subscription widget into the page.
 *
 * Features:
 *  - Animated bell button with badge counter
 *  - Consent modal with customisable text
 *  - Drip-suppression (won't show prompt again for N days after decline)
 *  - Auto-tags subscribers with 'blogger' and optionally the blog ID
 *  - Sends POSH_CONFIG message to the SW for analytics correlation
 *  - Clean unsubscribe flow
 *
 * Usage (add to Blogger theme HTML, before </body>):
 *   <script src="https://cdn.yourdomain.com/sdk/posh-push-blogger.js"></script>
 *   <script>
 *     PoshPushBlogger.init({
 *       apiKey: 'YOUR_API_KEY',
 *       blogId: 'my-cooking-blog',
 *       autoSubscribe: false,
 *     });
 *   </script>
 *
 * @version 2.0.0
 * @license MIT
 */

interface PoshPushBloggerConfig {
  /** Site API key from the Posh dashboard */
  apiKey: string;
  /** Override the default server URL */
  serverUrl?: string;
  /** Automatically trigger subscription (skip manual prompt) */
  autoSubscribe?: boolean;
  /** Blog identifier – used as a tag on subscribers for segmentation */
  blogId?: string;
  /** Days to wait before re-showing the prompt after the user dismisses */
  suppressDays?: number;
  /** Callback fired on successful subscription */
  onSubscribe?: (subscriberId: string) => void;
  /** Callback fired when user declines or push is unsupported */
  onDecline?: () => void;
}

interface BloggerSiteConfig {
  vapidPublicKey: string;
  widgetConfig?: {
    buttonStyle?: { color?: string; size?: string; position?: string };
    consentBanner?: { enabled?: boolean; text?: string; title?: string };
  };
}

const PoshPushBlogger = (() => {
  let _config: PoshPushBloggerConfig;
  let _siteConfig: BloggerSiteConfig | null = null;
  let _subscriberId: string | null = null;

  const STORAGE_KEY = 'posh_push_subscriber_id';
  const SUPPRESS_KEY = 'posh_push_suppress_until';

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Initialise the Blogger SDK and inject the subscription widget.
   */
  function init(cfg: PoshPushBloggerConfig): void {
    _config = { suppressDays: 7, ...cfg };

    if (typeof window === 'undefined') return;

    try { _subscriberId = localStorage.getItem(STORAGE_KEY); } catch { }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _setup);
    } else {
      _setup();
    }
  }

  /**
   * Programmatically show the subscription prompt.
   * Useful when you want to trigger it from a custom button.
   */
  function showPrompt(): void {
    _showConsentModal();
  }

  /**
   * Programmatically subscribe without showing the modal.
   * Only call this after you have obtained explicit consent.
   */
  async function subscribe(): Promise<string | null> {
    return _doSubscribe();
  }

  /**
   * Unsubscribe the current visitor.
   */
  async function unsubscribe(): Promise<void> {
    return _doUnsubscribe();
  }

  /** Returns true if the visitor is already subscribed. */
  function isSubscribed(): boolean {
    return Boolean(_subscriberId);
  }

  // ── Private helpers ────────────────────────────────────────────────────

  async function _setup(): Promise<void> {
    if (!_isPushSupported()) {
      console.info('[PoshPush Blogger] Push not supported in this browser.');
      return;
    }

    // Fetch site config from the API
    _siteConfig = await _fetchSiteConfig();
    if (!_siteConfig) return;

    // Register the service worker (must be on same domain)
    try {
      const reg = await navigator.serviceWorker.register('/posh-push-sw.js', { scope: '/' });

      // Ping the SW with credentials for analytics
      navigator.serviceWorker.ready.then((r) => {
        r.active?.postMessage({
          type: 'POSH_CONFIG',
          payload: {
            apiKey: _config.apiKey,
            serverUrl: _getServerUrl(),
            subscriberId: _subscriberId,
          },
        });
      });

      // If already subscribed at browser level, nothing else to do
      const existingBrowserSub = await reg.pushManager.getSubscription();
      if (existingBrowserSub && _subscriberId) return;
    } catch (err) {
      console.error('[PoshPush Blogger] SW registration failed:', err);
      return;
    }

    // Inject the widget unless already subscribed
    if (!_subscriberId) {
      _injectWidget();

      if (_config.autoSubscribe) {
        _doSubscribe();
      } else if (!_isSuppressed()) {
        // Small delay so the page finishes loading before we show the prompt
        setTimeout(_showConsentModal, 3000);
      }
    }
  }

  async function _fetchSiteConfig(): Promise<BloggerSiteConfig | null> {
    try {
      const resp = await fetch(`${_getServerUrl()}/api/v1/sdk/config`, {
        headers: { 'x-api-key': _config.apiKey },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    } catch (err) {
      console.error('[PoshPush Blogger] Config fetch failed:', err);
      return null;
    }
  }

  function _isPushSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function _isSuppressed(): boolean {
    try {
      const until = localStorage.getItem(SUPPRESS_KEY);
      if (!until) return false;
      return Date.now() < parseInt(until, 10);
    } catch { return false; }
  }

  function _setSuppression(): void {
    try {
      const days = _config.suppressDays ?? 7;
      const until = Date.now() + days * 24 * 60 * 60 * 1000;
      localStorage.setItem(SUPPRESS_KEY, String(until));
    } catch { }
  }

  // ── Widget injection ───────────────────────────────────────────────────

  function _injectWidget(): void {
    if (document.getElementById('posh-push-blogger-widget')) return;
    if (!_siteConfig?.widgetConfig) return;

    const wc = _siteConfig.widgetConfig;
    const col = wc.buttonStyle?.color || '#4F46E5';
    const pos = wc.buttonStyle?.position || 'bottom-right';

    const style = document.createElement('style');
    style.textContent = `
      #posh-push-blogger-widget {
        position: fixed;
        ${pos.includes('bottom') ? 'bottom: 24px;' : 'top: 24px;'}
        ${pos.includes('right') ? 'right: 24px;' : 'left: 24px;'}
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      #posh-push-blogger-btn {
        width: 56px; height: 56px;
        border-radius: 50%;
        background: ${col};
        border: none;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 14px rgba(0,0,0,0.25);
        transition: transform 0.2s, box-shadow 0.2s;
        position: relative;
      }
      #posh-push-blogger-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 20px rgba(0,0,0,0.3);
      }
      #posh-push-blogger-btn svg { width: 26px; height: 26px; fill: white; }
      #posh-push-overlay {
        display: none; position: fixed; inset: 0;
        background: rgba(0,0,0,0.5); z-index: 2147483646;
        align-items: center; justify-content: center;
      }
      #posh-push-overlay.active { display: flex; }
      #posh-push-modal {
        background: #fff; border-radius: 16px; padding: 28px;
        max-width: 380px; width: 90%; text-align: center;
        box-shadow: 0 12px 40px rgba(0,0,0,0.3);
        animation: posh-slide-in 0.3s ease;
      }
      @keyframes posh-slide-in {
        from { opacity: 0; transform: translateY(20px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      #posh-push-modal h3 { margin: 0 0 10px; color: #111; font-size: 18px; }
      #posh-push-modal p  { margin: 0 0 20px; color: #555; font-size: 14px; line-height: 1.6; }
      .posh-btn-row { display: flex; gap: 12px; justify-content: center; }
      .posh-btn { padding: 10px 22px; border-radius: 8px; font-size: 14px; cursor: pointer; border: none; font-weight: 600; }
      .posh-btn-later { background: #f1f1f1; color: #333; }
      .posh-btn-subscribe { background: ${col}; color: #fff; }
    `;
    document.head.appendChild(style);

    // Bell button
    const widget = document.createElement('div');
    widget.id = 'posh-push-blogger-widget';
    widget.innerHTML = `
      <button id="posh-push-blogger-btn" title="Subscribe to notifications" aria-label="Subscribe to push notifications">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
      </button>
    `;
    document.body.appendChild(widget);

    // Consent modal
    const overlay = document.createElement('div');
    overlay.id = 'posh-push-overlay';
    const title = wc.consentBanner?.title || 'Stay in the loop!';
    const text = wc.consentBanner?.text || 'Get notified about new posts on this blog. You can unsubscribe anytime.';
    overlay.innerHTML = `
      <div id="posh-push-modal" role="dialog" aria-modal="true" aria-label="Push notification consent">
        <h3>${_escapeHtml(title)}</h3>
        <p>${_escapeHtml(text)}</p>
        <div class="posh-btn-row">
          <button class="posh-btn posh-btn-later" id="posh-push-later">Later</button>
          <button class="posh-btn posh-btn-subscribe" id="posh-push-allow">Allow</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Event listeners
    document.getElementById('posh-push-blogger-btn')!.addEventListener('click', () => {
      if (_subscriberId) {
        // Already subscribed: offer unsubscribe
        _showUnsubscribeToast();
      } else {
        _showConsentModal();
      }
    });

    document.getElementById('posh-push-later')!.addEventListener('click', () => {
      _hideConsentModal();
      _setSuppression();
      _config.onDecline?.();
    });

    document.getElementById('posh-push-allow')!.addEventListener('click', () => {
      _hideConsentModal();
      _doSubscribe();
    });

    // Close modal on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        _hideConsentModal();
        _setSuppression();
      }
    });
  }

  function _showConsentModal(): void {
    const overlay = document.getElementById('posh-push-overlay');
    overlay?.classList.add('active');
  }

  function _hideConsentModal(): void {
    const overlay = document.getElementById('posh-push-overlay');
    overlay?.classList.remove('active');
  }

  function _showUnsubscribeToast(): void {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; bottom: 90px; right: 24px; background: #333; color: #fff;
      padding: 10px 16px; border-radius: 8px; font-size: 13px; z-index: 2147483647;
      display: flex; gap: 12px; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    toast.innerHTML = `
      <span>You're subscribed.</span>
      <button style="background:transparent;border:1px solid rgba(255,255,255,0.5);color:#fff;
        padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;"
        id="posh-unsubscribe-btn">Unsubscribe</button>
    `;
    document.body.appendChild(toast);
    document.getElementById('posh-unsubscribe-btn')?.addEventListener('click', async () => {
      await _doUnsubscribe();
      toast.remove();
    });
    setTimeout(() => toast.remove(), 5000);
  }

  // ── Subscription logic ─────────────────────────────────────────────────

  async function _doSubscribe(): Promise<string | null> {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        _config.onDecline?.();
        return null;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlBase64ToUint8Array(_siteConfig!.vapidPublicKey),
      });

      const subJson = subscription.toJSON();

      const resp = await fetch(`${_getServerUrl()}/api/v1/sdk/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': _config.apiKey },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
          consentGranted: true,
          platform: 'blogger',
          tags: ['blogger', _config.blogId].filter(Boolean),
        }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      _subscriberId = data.subscriberId;
      try { localStorage.setItem(STORAGE_KEY, _subscriberId!); } catch { }

      // Update SW config
      registration.active?.postMessage({
        type: 'POSH_CONFIG',
        payload: { apiKey: _config.apiKey, serverUrl: _getServerUrl(), subscriberId: _subscriberId },
      });

      // Hide the widget bell (subscriber already enrolled)
      const widget = document.getElementById('posh-push-blogger-widget');
      if (widget) {
        const btn = document.getElementById('posh-push-blogger-btn');
        if (btn) btn.style.background = '#22c55e'; // green = subscribed
      }

      _config.onSubscribe?.(_subscriberId!);
      return _subscriberId;
    } catch (err) {
      console.error('[PoshPush Blogger] Subscription failed:', err);
      return null;
    }
  }

  async function _doUnsubscribe(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      if (_subscriberId) {
        await fetch(`${_getServerUrl()}/api/v1/sdk/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': _config.apiKey },
          body: JSON.stringify({ subscriberId: _subscriberId }),
        });
      }

      _subscriberId = null;
      try { localStorage.removeItem(STORAGE_KEY); } catch { }

      // Reset bell colour
      const btn = document.getElementById('posh-push-blogger-btn');
      if (btn) btn.style.background = _siteConfig?.widgetConfig?.buttonStyle?.color || '#4F46E5';
    } catch (err) {
      console.error('[PoshPush Blogger] Unsubscribe failed:', err);
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────────

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

  /** Escape user-supplied strings before inserting into innerHTML. */
  function _escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Public interface ────────────────────────────────────────────────────

  return { init, subscribe, unsubscribe, showPrompt, isSubscribed };
})();

// Expose globally for Blogger <script> tags
if (typeof window !== 'undefined') {
  (window as any).PoshPushBlogger = PoshPushBlogger;
}

export default PoshPushBlogger;


interface PoshPushBloggerConfig {
  apiKey: string;
  serverUrl?: string;
  autoSubscribe?: boolean;
  blogId?: string;
}

const PoshPushBlogger = (() => {
  let config: PoshPushBloggerConfig;
  let siteConfig: any = null;

  function init(cfg: PoshPushBloggerConfig) {
    config = { ...cfg };
    console.log('PoshPush Blogger initialized');

    if (typeof window !== 'undefined') {
      // Blogger-specific initialization
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
      } else {
        setup();
      }
    }
  }

  async function setup() {
    try {
      // Fetch site config
      const response = await fetch(`${getServerUrl()}/api/v1/sdk/config`, {
        headers: { 'x-api-key': config.apiKey }
      });
      siteConfig = await response.json();

      // Blogger-specific widget injection
      injectBloggerWidget();

      if (config.autoSubscribe) {
        await subscribe();
      }
    } catch (error) {
      console.error('Blogger setup failed:', error);
    }
  }

  function injectBloggerWidget() {
    if (!siteConfig?.widgetConfig) return;

    const wc = siteConfig.widgetConfig;

    // Create Blogger-compatible widget
    const widget = document.createElement('div');
    widget.id = 'posh-push-blogger-widget';
    widget.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1000;
      font-family: Arial, sans-serif;
    `;

    widget.innerHTML = `
      <div style="
        background: ${wc.buttonStyle?.color || '#4F46E5'};
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
      " onclick="PoshPushBlogger.showPrompt()">
        <span>🔔</span>
        <span>Subscribe to Notifications</span>
      </div>
    `;

    document.body.appendChild(widget);
  }

  function showPrompt() {
    // Blogger-specific prompt
    const consentText = siteConfig.widgetConfig?.consentBanner?.text ||
      'Get notified about new posts on this blog. You can unsubscribe anytime.';

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    overlay.innerHTML = `
      <div style="
        background: white;
        padding: 24px;
        border-radius: 12px;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 8px 30px rgba(0,0,0,0.3);
      ">
        <h3 style="margin: 0 0 12px; color: #333;">Stay Updated!</h3>
        <p style="margin: 0 0 20px; color: #666; line-height: 1.5;">${escapeHtml(consentText)}</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button onclick="this.parentElement.parentElement.parentElement.remove()"
                  style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer;">
            Later
          </button>
          <button onclick="PoshPushBlogger.doSubscribe(); this.parentElement.parentElement.parentElement.remove()"
                  style="padding: 8px 16px; border: none; background: ${siteConfig.widgetConfig?.buttonStyle?.color || '#4F46E5'}; color: white; border-radius: 6px; cursor: pointer;">
            Subscribe
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  async function doSubscribe() {
    try {
      await subscribe();
      // Hide widget after successful subscription
      const widget = document.getElementById('posh-push-blogger-widget');
      if (widget) widget.style.display = 'none';
    } catch (error) {
      console.error('Blogger subscription failed:', error);
    }
  }

  async function subscribe() {
    if (!siteConfig) throw new Error('Not initialized');

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push notifications not supported');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Permission denied');
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(siteConfig.vapidPublicKey) as BufferSource,
    });

    const subJson = subscription.toJSON();
    const response = await fetch(`${getServerUrl()}/api/v1/sdk/subscribe`, {
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
        tags: ['blogger', config.blogId].filter(Boolean),
      }),
    });

    if (!response.ok) {
      throw new Error('Subscription failed');
    }

    console.log('Blogger: Successfully subscribed');
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

  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return {
    init,
    subscribe: doSubscribe,
    showPrompt,
  };
})();

// Make it available globally for Blogger
if (typeof window !== 'undefined') {
  (window as any).PoshPushBlogger = PoshPushBlogger;
}