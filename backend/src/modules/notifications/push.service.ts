import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webPush from 'web-push';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from '../sites/site.entity';
import { Subscriber } from '../subscribers/subscriber.entity';
import { Notification } from './notification.entity';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  badge?: string;
  url?: string;
  deepLink?: Record<string, any>;
  data?: Record<string, any>;
  notificationId: string;
  subscriberId: string;
}

export interface PushResult {
  subscriberId: string;
  success: boolean;
  error?: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    private readonly configService: ConfigService,
  ) { }

  async sendWebPush(
    site: Site,
    subscriber: Subscriber,
    notification: Notification,
  ): Promise<PushResult> {
    try {
      const vapidPublicKey = site.vapidPublicKey || this.configService.get('VAPID_PUBLIC_KEY');
      const vapidPrivateKey = site.vapidPrivateKey || this.configService.get('VAPID_PRIVATE_KEY');
      const vapidSubject = this.configService.get('VAPID_SUBJECT', 'mailto:admin@poshnotify.com');

      if (!vapidPublicKey || !vapidPrivateKey) {
        return {
          subscriberId: subscriber.id,
          success: false,
          error: 'VAPID keys not configured',
        };
      }

      webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

      const payload: PushPayload = {
        title: notification.title,
        body: notification.message,
        icon: notification.iconUrl || undefined,
        image: notification.imageUrl || undefined,
        badge: notification.badgeUrl || undefined,
        url: notification.clickAction || undefined,
        deepLink: notification.deepLink || undefined,
        data: notification.data || {},
        notificationId: notification.id,
        subscriberId: subscriber.id,
      };

      const pushSubscription = {
        endpoint: subscriber.endpoint,
        keys: {
          p256dh: subscriber.p256dh,
          auth: subscriber.authKey,
        },
      };

      await webPush.sendNotification(
        pushSubscription,
        JSON.stringify(payload),
        {
          TTL: notification.ttl || 86400,
          urgency: notification.urgency as any || 'normal',
        },
      );

      return { subscriberId: subscriber.id, success: true };
    } catch (error: any) {
      this.logger.error(`Push failed for subscriber ${subscriber.id}: ${error.message}`);

      // If status 410, subscriber has unsubscribed
      if (error.statusCode === 410 || error.statusCode === 404) {
        // Mark subscriber as inactive
        subscriber.isActive = false;
        subscriber.unsubscribedAt = new Date();
      }

      return {
        subscriberId: subscriber.id,
        success: false,
        error: error.message,
      };
    }
  }

  async sendFCM(
    site: Site,
    subscriber: Subscriber,
    notification: Notification,
  ): Promise<PushResult> {
    try {
      // Dynamic import to avoid issues when Firebase is not configured
      const admin = await import('firebase-admin');

      if (!admin.apps.length && site.fcmProjectId) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: site.fcmProjectId || this.configService.get('FIREBASE_PROJECT_ID'),
            clientEmail: this.configService.get('FIREBASE_CLIENT_EMAIL'),
            privateKey: this.configService.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
          }),
        });
      }

      if (!subscriber.fcmToken) {
        return {
          subscriberId: subscriber.id,
          success: false,
          error: 'No FCM token',
        };
      }

      const message = {
        token: subscriber.fcmToken,
        notification: {
          title: notification.title,
          body: notification.message,
          imageUrl: notification.imageUrl || undefined,
        },
        webpush: {
          fcmOptions: {
            link: notification.clickAction || undefined,
          },
        },
        data: {
          notificationId: notification.id,
          subscriberId: subscriber.id,
          ...(notification.deepLink ? { deepLink: JSON.stringify(notification.deepLink) } : {}),
        },
      };

      await admin.messaging().send(message);

      return { subscriberId: subscriber.id, success: true };
    } catch (error: any) {
      this.logger.error(`FCM failed for subscriber ${subscriber.id}: ${error.message}`);
      return {
        subscriberId: subscriber.id,
        success: false,
        error: error.message,
      };
    }
  }

  async sendToSubscriber(
    site: Site,
    subscriber: Subscriber,
    notification: Notification,
  ): Promise<PushResult> {
    // Try Web Push first, then FCM as fallback
    if (subscriber.endpoint && subscriber.p256dh) {
      const result = await this.sendWebPush(site, subscriber, notification);
      if (result.success) return result;
    }

    if (subscriber.fcmToken) {
      return this.sendFCM(site, subscriber, notification);
    }

    return {
      subscriberId: subscriber.id,
      success: false,
      error: 'No valid push channel',
    };
  }
}
