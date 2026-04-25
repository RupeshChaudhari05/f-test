import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as geoip from 'geoip-lite';
import * as UAParser from 'ua-parser-js';
import { Site } from '../sites/site.entity';
import { SubscribersService } from '../subscribers/subscribers.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AutomationsService } from '../automations/automations.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SdkService {
  constructor(
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    private readonly subscribersService: SubscribersService,
    private readonly analyticsService: AnalyticsService,
    private readonly automationsService: AutomationsService,
    private readonly notificationsService: NotificationsService,
  ) { }

  async getSiteConfig(apiKey: string) {
    const site = await this.siteRepo.findOne({ where: { apiKey, isActive: true } });
    if (!site) throw new NotFoundException('Invalid API key');

    return {
      siteId: site.id,
      vapidPublicKey: site.vapidPublicKey,
      widgetConfig: site.widgetConfig,
    };
  }

  async subscribe(apiKey: string, data: any, ip: string, userAgent: string) {
    const site = await this.siteRepo.findOne({ where: { apiKey, isActive: true } });
    if (!site) throw new NotFoundException('Invalid API key');

    // Parse user agent
    const ua = new UAParser.UAParser(userAgent);
    const browser = ua.getBrowser();
    const os = ua.getOS();
    const device = ua.getDevice();

    // Geo lookup
    const geo = geoip.lookup(ip);

    const subscriber = await this.subscribersService.create(
      site.id,
      {
        endpoint: data.endpoint,
        p256dh: data.keys?.p256dh,
        authKey: data.keys?.auth,
        fcmToken: data.fcmToken,
        browser: browser.name,
        browserVersion: browser.version,
        os: os.name,
        osVersion: os.version,
        deviceType: device.type === 'mobile' ? 'mobile' : device.type === 'tablet' ? 'tablet' : 'desktop',
        country: geo?.country,
        city: geo?.city,
        timezone: data.timezone,
        language: data.language,
        tags: data.tags || [],
        consentGranted: data.consentGranted || false,
      },
      ip,
    );

    // Trigger welcome automation
    await this.automationsService.triggerWelcome(site.id, subscriber.id);

    return {
      subscriberId: subscriber.id,
      status: 'subscribed',
    };
  }

  async unsubscribe(apiKey: string, subscriberId: string) {
    const site = await this.siteRepo.findOne({ where: { apiKey, isActive: true } });
    if (!site) throw new NotFoundException('Invalid API key');

    await this.subscribersService.unsubscribe(subscriberId, site.id);
    return { status: 'unsubscribed' };
  }

  async tagUser(apiKey: string, subscriberId: string, tags: string[]) {
    const site = await this.siteRepo.findOne({ where: { apiKey, isActive: true } });
    if (!site) throw new NotFoundException('Invalid API key');

    await this.subscribersService.addTags(subscriberId, site.id, tags);
    return { status: 'tagged' };
  }

  async trackEvent(apiKey: string, data: {
    subscriberId?: string;
    eventType: string;
    eventData?: Record<string, any>;
    pageUrl?: string;
    referrer?: string;
  }) {
    const site = await this.siteRepo.findOne({ where: { apiKey, isActive: true } });
    if (!site) throw new NotFoundException('Invalid API key');

    await this.analyticsService.trackEvent(site.id, data);

    // Auto-tag based on page visits
    if (data.subscriberId && data.pageUrl) {
      await this.subscribersService.updateLastSeen(data.subscriberId);
    }

    return { status: 'tracked' };
  }

  async trackDelivery(apiKey: string, data: {
    notificationId: string;
    subscriberId: string;
    event: 'delivered' | 'clicked';
    clickUrl?: string;
  }) {
    const site = await this.siteRepo.findOne({ where: { apiKey, isActive: true } });
    if (!site) throw new NotFoundException('Invalid API key');

    await this.notificationsService.trackDelivery(
      data.notificationId,
      data.subscriberId,
      data.event,
    );

    if (data.event === 'clicked' && data.clickUrl) {
      await this.analyticsService.trackClick({
        notificationId: data.notificationId,
        subscriberId: data.subscriberId,
        clickUrl: data.clickUrl,
      });
    }

    return { status: 'tracked' };
  }

  async deleteSubscriberData(apiKey: string, subscriberId: string) {
    const site = await this.siteRepo.findOne({ where: { apiKey, isActive: true } });
    if (!site) throw new NotFoundException('Invalid API key');

    await this.subscribersService.deleteData(subscriberId, site.id);
    return { status: 'deleted' };
  }

  async sendNotification(apiKey: string, data: {
    title: string;
    message: string;
    url?: string;
    iconUrl?: string;
  }) {
    const site = await this.siteRepo.findOne({ where: { apiKey, isActive: true } });
    if (!site) throw new NotFoundException('Invalid API key');

    const result = await this.notificationsService.send(site.id, {
      title: data.title,
      message: data.message,
      clickAction: data.url,
      iconUrl: data.iconUrl,
      targetType: 'all' as any,
    } as any);

    return { status: 'sent', notificationId: result.notification?.id };
  }

  async sendTestNotification(apiKey: string, data: {
    title: string;
    body: string;
    url?: string;
    test?: boolean;
    target?: string;
  }) {
    const site = await this.siteRepo.findOne({ where: { apiKey, isActive: true } });
    if (!site) throw new NotFoundException('Invalid API key');

    // For test notifications, we can send to a limited audience
    const targetType = data.target === 'current_user' ? 'segment' : 'all';
    const segmentId = data.target === 'current_user' ? undefined : undefined; // TODO: implement current user targeting

    const result = await this.notificationsService.send(site.id, {
      title: data.title,
      message: data.body,
      clickAction: data.url,
      targetType: targetType as any,
      segmentId,
      isTest: true,
    } as any);

    return {
      status: 'test_sent',
      notificationId: result.notification?.id,
      message: 'Test notification sent successfully'
    };
  }
}
