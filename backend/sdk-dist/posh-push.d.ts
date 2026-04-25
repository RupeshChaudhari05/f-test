/**
 * Posh Push Notification SDK
 * Lightweight client-side SDK for integrating push notifications.
 *
 * Usage:
 *   PoshPush.init({ apiKey: 'YOUR_API_KEY' });
 *   PoshPush.subscribe();
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
declare const PoshPush: {
    init: (userConfig: PoshPushConfig) => Promise<void>;
    subscribe: () => Promise<string | null>;
    tagUser: (tags: string[]) => Promise<void>;
    trackEvent: (eventType: string, eventData?: Record<string, any>) => Promise<void>;
    getSubscriberId: () => string | null;
    unsubscribe: () => Promise<void>;
    deleteMyData: () => Promise<void>;
};
export default PoshPush;
