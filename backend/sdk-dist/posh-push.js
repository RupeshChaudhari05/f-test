(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.PoshPush = factory());
})(this, (function () { 'use strict';

    /**
     * Posh Push Notification SDK
     * Lightweight client-side SDK for integrating push notifications.
     *
     * Usage:
     *   PoshPush.init({ apiKey: 'YOUR_API_KEY' });
     *   PoshPush.subscribe();
     */
    const PoshPush = (() => {
        let config;
        let siteConfig = null;
        let subscriberId = null;
        let isInitialized = false;
        const STORAGE_KEY = 'posh_push_subscriber_id';
        // ---- Helpers ----
        function getServerUrl() {
            return (config.serverUrl || 'https://api.poshnotify.com').replace(/\/$/, '');
        }
        async function apiCall(endpoint, method = 'GET', body) {
            const url = `${getServerUrl()}/api/v1/sdk${endpoint}`;
            const headers = {
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
        function urlBase64ToUint8Array(base64String) {
            const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
            const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
            const rawData = atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
            }
            return outputArray;
        }
        function getStoredSubscriberId() {
            try {
                return localStorage.getItem(STORAGE_KEY);
            }
            catch (_a) {
                return null;
            }
        }
        function storeSubscriberId(id) {
            try {
                localStorage.setItem(STORAGE_KEY, id);
            }
            catch (_a) {
                // Ignore storage errors
            }
        }
        // ---- Widget UI ----
        function createWidget() {
            var _a, _b, _c;
            if (!siteConfig)
                return;
            const wc = siteConfig.widgetConfig;
            // Don't show widget if already subscribed
            if (subscriberId)
                return;
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
        background: ${((_a = wc.buttonStyle) === null || _a === void 0 ? void 0 : _a.color) || '#4F46E5'};
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
        background: ${((_b = wc.buttonStyle) === null || _b === void 0 ? void 0 : _b.color) || '#4F46E5'};
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
            const position = ((_c = wc.buttonStyle) === null || _c === void 0 ? void 0 : _c.position) || 'bottom-right';
            if (wc.promptType === 'bell' || wc.promptType === 'slide') {
                createBellWidget(position, wc);
            }
            else if (wc.promptType === 'modal') {
                showModal(wc);
            }
        }
        function createBellWidget(position, wc) {
            const widget = document.createElement('div');
            widget.className = `posh-push-widget ${position}`;
            widget.innerHTML = `
      <button class="posh-push-bell" id="posh-bell-btn">
        <svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
      </button>
    `;
            document.body.appendChild(widget);
            const bellBtn = document.getElementById('posh-bell-btn');
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
        function showPopup(position, wc) {
            var _a;
            // Remove existing popup
            const existing = document.getElementById('posh-push-popup');
            if (existing)
                existing.remove();
            const consentText = ((_a = wc.consentBanner) === null || _a === void 0 ? void 0 : _a.text) ||
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
            document.getElementById('posh-allow-btn').addEventListener('click', async () => {
                popup.remove();
                await subscribe();
            });
            document.getElementById('posh-deny-btn').addEventListener('click', () => {
                var _a;
                popup.remove();
                (_a = config.onPermissionDenied) === null || _a === void 0 ? void 0 : _a.call(config);
            });
        }
        function showModal(wc) {
            var _a;
            const consentText = ((_a = wc.consentBanner) === null || _a === void 0 ? void 0 : _a.text) ||
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
            document.getElementById('posh-modal-allow').addEventListener('click', async () => {
                overlay.remove();
                await subscribe();
            });
            document.getElementById('posh-modal-deny').addEventListener('click', () => {
                var _a;
                overlay.remove();
                (_a = config.onPermissionDenied) === null || _a === void 0 ? void 0 : _a.call(config);
            });
        }
        function applyTriggerRules(wc, callback) {
            const rules = wc.triggerRules;
            if (!rules)
                return;
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
                    const handler = (e) => {
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
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        // ---- Core Functions ----
        async function init(userConfig) {
            var _a;
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
            }
            catch (error) {
                console.error('PoshPush: Failed to fetch config', error);
                return;
            }
            isInitialized = true;
            // Register service worker
            if ('serviceWorker' in navigator) {
                try {
                    const swPath = config.serviceWorkerPath || '/posh-push-sw.js';
                    const registration = await navigator.serviceWorker.register(swPath, { scope: '/' });
                    console.log('PoshPush: Service worker registered');
                    // Wait for SW to be ready then send config so it can track events
                    const sendConfigToSW = async () => {
                        const sw = registration.active || registration.waiting || registration.installing;
                        if (sw) {
                            sw.postMessage({
                                type: 'POSH_PUSH_CONFIG',
                                config: {
                                    apiKey: config.apiKey,
                                    serverUrl: getServerUrl(),
                                },
                            });
                        }
                    };
                    if (registration.active) {
                        await sendConfigToSW();
                    }
                    else {
                        navigator.serviceWorker.addEventListener('controllerchange', sendConfigToSW, { once: true });
                    }
                }
                catch (error) {
                    console.error('PoshPush: Service worker registration failed', error);
                }
            }
            else {
                console.warn('PoshPush: Service workers not supported in this browser');
            }
            // Show widget if not subscribed
            if (!subscriberId) {
                if (config.autoSubscribe) {
                    await subscribe();
                }
                else {
                    createWidget();
                }
            }
            // Listen for messages from service worker
            (_a = navigator.serviceWorker) === null || _a === void 0 ? void 0 : _a.addEventListener('message', (event) => {
                var _a, _b;
                if (((_a = event.data) === null || _a === void 0 ? void 0 : _a.type) === 'POSH_NOTIFICATION_CLICK') {
                    (_b = config.onNotificationClick) === null || _b === void 0 ? void 0 : _b.call(config, event.data.payload);
                }
            });
        }
        async function subscribe() {
            var _a, _b;
            if (!isInitialized || !siteConfig) {
                console.error('PoshPush: Not initialized. Call init() first.');
                return null;
            }
            if (!('PushManager' in window)) {
                console.error('PoshPush: Push notifications are not supported');
                return null;
            }
            try {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    (_a = config.onPermissionDenied) === null || _a === void 0 ? void 0 : _a.call(config);
                    return null;
                }
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(siteConfig.vapidPublicKey),
                });
                const subJson = subscription.toJSON();
                const result = await apiCall('/subscribe', 'POST', {
                    endpoint: subJson.endpoint,
                    keys: subJson.keys,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    language: navigator.language,
                    consentGranted: true,
                });
                subscriberId = result.subscriberId;
                storeSubscriberId(subscriberId);
                // Send updated config (with subscriberId) to service worker
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
                widget === null || widget === void 0 ? void 0 : widget.remove();
                (_b = config.onSubscribe) === null || _b === void 0 ? void 0 : _b.call(config, subscriberId);
                return subscriberId;
            }
            catch (error) {
                console.error('PoshPush: Subscription failed', error);
                return null;
            }
        }
        async function tagUser(tags) {
            if (!subscriberId) {
                console.error('PoshPush: Not subscribed');
                return;
            }
            await apiCall('/tag', 'POST', { subscriberId, tags });
        }
        async function trackEvent(eventType, eventData) {
            await apiCall('/event', 'POST', {
                subscriberId,
                eventType,
                eventData,
                pageUrl: window.location.href,
                referrer: document.referrer,
            });
        }
        function getSubscriberId() {
            return subscriberId;
        }
        async function unsubscribe() {
            if (!subscriberId)
                return;
            try {
                await apiCall('/unsubscribe', 'POST', { subscriberId });
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                await (subscription === null || subscription === void 0 ? void 0 : subscription.unsubscribe());
                localStorage.removeItem(STORAGE_KEY);
                subscriberId = null;
            }
            catch (error) {
                console.error('PoshPush: Unsubscribe failed', error);
            }
        }
        async function deleteMyData() {
            if (!subscriberId)
                return;
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
        window.PoshPush = PoshPush;
    }

    return PoshPush;

}));
//# sourceMappingURL=posh-push.js.map
