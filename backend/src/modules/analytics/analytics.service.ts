import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AnalyticsDaily, Event, ClickEvent } from './analytics.entity';
import { Notification } from '../notifications/notification.entity';
import { Subscriber } from '../subscribers/subscriber.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsDaily)
    private readonly analyticsRepo: Repository<AnalyticsDaily>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(ClickEvent)
    private readonly clickEventRepo: Repository<ClickEvent>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(Subscriber)
    private readonly subscriberRepo: Repository<Subscriber>,
  ) { }

  async getDashboard(siteId: string, days = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get total subscribers (active only)
    const totalSubscribers = await this.subscriberRepo.count({
      where: { siteId, isActive: true },
    });

    // Get total notifications sent
    const totalNotifications = await this.notifRepo.count({
      where: { siteId },
    });

    // Get aggregate stats from all notifications
    const notificationStats = await this.notifRepo
      .createQueryBuilder('n')
      .select('SUM(n.total_sent)', 'totalSent')
      .addSelect('SUM(n.total_delivered)', 'totalDelivered')
      .addSelect('SUM(n.total_clicked)', 'totalClicked')
      .addSelect('SUM(n.total_failed)', 'totalFailed')
      .where('n.site_id = :siteId', { siteId })
      .andWhere('n.sent_at IS NOT NULL')
      .getRawOne();

    const totalDelivered = parseInt(notificationStats?.totalDelivered || '0');
    const totalClicked = parseInt(notificationStats?.totalClicked || '0');

    // Calculate CTR
    const ctr = totalDelivered > 0
      ? parseFloat(((totalClicked / totalDelivered) * 100).toFixed(1))
      : 0;

    // Get daily stats for the last 30 days (simplified - just return empty array for now)
    // In a real implementation, you'd aggregate from notifications by date
    const dailyStats: { date: string; subscribers: number; delivered: number; clicked: number }[] = [];

    return {
      totalSubscribers,
      totalNotifications,
      totalDelivered,
      totalClicked,
      ctr,
      dailyStats,
    };
  }

  async trackEvent(siteId: string, data: {
    subscriberId?: string;
    eventType: string;
    eventData?: Record<string, any>;
    pageUrl?: string;
    referrer?: string;
  }) {
    const event = this.eventRepo.create({
      siteId,
      subscriberId: data.subscriberId,
      eventType: data.eventType,
      eventData: data.eventData || {},
      pageUrl: data.pageUrl,
      referrer: data.referrer,
    });
    return this.eventRepo.save(event);
  }

  async trackClick(data: {
    notificationId: string;
    subscriberId?: string;
    clickUrl?: string;
    deviceType?: string;
    country?: string;
  }) {
    const click = this.clickEventRepo.create(data);
    return this.clickEventRepo.save(click);
  }

  async getClickHeatmap(notificationId: string) {
    return this.clickEventRepo.find({
      where: { notificationId },
      order: { clickedAt: 'DESC' },
    });
  }

  async getTopNotifications(siteId: string, limit = 10) {
    return this.notifRepo
      .createQueryBuilder('n')
      .where('n.siteId = :siteId', { siteId })
      .andWhere('n.totalSent > 0')
      .orderBy('n.totalClicked', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Geographic breakdown: number of active subscribers per country.
   * Returns the top N countries sorted by subscriber count descending.
   *
   * @param siteId  Site UUID.
   * @param limit   Max countries to return (default 20).
   */
  async getGeoBreakdown(
    siteId: string,
    limit = 20,
  ): Promise<{ country: string; count: number; percentage: number }[]> {
    const rows = await this.subscriberRepo
      .createQueryBuilder('sub')
      .select('sub.country', 'country')
      .addSelect('COUNT(sub.id)', 'count')
      .where('sub.siteId = :siteId', { siteId })
      .andWhere('sub.isActive = :active', { active: true })
      .andWhere('sub.country IS NOT NULL')
      .groupBy('sub.country')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany<{ country: string; count: string }>();

    const total = rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0);

    return rows.map((r) => ({
      country: r.country || 'Unknown',
      count: parseInt(r.count, 10),
      percentage: total > 0 ? parseFloat(((parseInt(r.count, 10) / total) * 100).toFixed(1)) : 0,
    }));
  }

  /**
   * Device-type breakdown: subscribers split by device type
   * (desktop, mobile, tablet, etc.).
   *
   * @param siteId  Site UUID.
   */
  async getDeviceBreakdown(
    siteId: string,
  ): Promise<{ deviceType: string; count: number; percentage: number }[]> {
    const rows = await this.subscriberRepo
      .createQueryBuilder('sub')
      .select('sub.deviceType', 'deviceType')
      .addSelect('COUNT(sub.id)', 'count')
      .where('sub.siteId = :siteId', { siteId })
      .andWhere('sub.isActive = :active', { active: true })
      .groupBy('sub.deviceType')
      .orderBy('count', 'DESC')
      .getRawMany<{ deviceType: string; count: string }>();

    const total = rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0);

    return rows.map((r) => ({
      deviceType: r.deviceType || 'unknown',
      count: parseInt(r.count, 10),
      percentage: total > 0 ? parseFloat(((parseInt(r.count, 10) / total) * 100).toFixed(1)) : 0,
    }));
  }

  /**
   * Browser breakdown: subscribers grouped by browser name.
   *
   * @param siteId  Site UUID.
   * @param limit   Max browsers to return (default 10).
   */
  async getBrowserBreakdown(
    siteId: string,
    limit = 10,
  ): Promise<{ browser: string; count: number; percentage: number }[]> {
    const rows = await this.subscriberRepo
      .createQueryBuilder('sub')
      .select('sub.browser', 'browser')
      .addSelect('COUNT(sub.id)', 'count')
      .where('sub.siteId = :siteId', { siteId })
      .andWhere('sub.isActive = :active', { active: true })
      .andWhere('sub.browser IS NOT NULL')
      .groupBy('sub.browser')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany<{ browser: string; count: string }>();

    const total = rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0);

    return rows.map((r) => ({
      browser: r.browser || 'Unknown',
      count: parseInt(r.count, 10),
      percentage: total > 0 ? parseFloat(((parseInt(r.count, 10) / total) * 100).toFixed(1)) : 0,
    }));
  }

  /**
   * OS breakdown: subscribers grouped by operating system.
   *
   * @param siteId  Site UUID.
   * @param limit   Max OS entries to return (default 10).
   */
  async getOsBreakdown(
    siteId: string,
    limit = 10,
  ): Promise<{ os: string; count: number; percentage: number }[]> {
    const rows = await this.subscriberRepo
      .createQueryBuilder('sub')
      .select('sub.os', 'os')
      .addSelect('COUNT(sub.id)', 'count')
      .where('sub.siteId = :siteId', { siteId })
      .andWhere('sub.isActive = :active', { active: true })
      .andWhere('sub.os IS NOT NULL')
      .groupBy('sub.os')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany<{ os: string; count: string }>();

    const total = rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0);

    return rows.map((r) => ({
      os: r.os || 'Unknown',
      count: parseInt(r.count, 10),
      percentage: total > 0 ? parseFloat(((parseInt(r.count, 10) / total) * 100).toFixed(1)) : 0,
    }));
  }

  /**
   * Daily subscriber growth: new subscribers per day for the last N days.
   *
   * @param siteId  Site UUID.
   * @param days    Look-back window (default 30).
   */
  async getSubscriberGrowth(
    siteId: string,
    days = 30,
  ): Promise<{ date: string; newSubscribers: number; totalActive: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const rows = await this.subscriberRepo
      .createQueryBuilder('sub')
      .select('DATE(sub.subscribedAt)', 'date')
      .addSelect('COUNT(sub.id)', 'newSubscribers')
      .where('sub.siteId = :siteId', { siteId })
      .andWhere('sub.subscribedAt >= :start', { start: startDate })
      .groupBy('DATE(sub.subscribedAt)')
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; newSubscribers: string }>();

    // Cumulative totals for context
    const totalActive = await this.subscriberRepo.count({
      where: { siteId, isActive: true },
    });

    return rows.map((r) => ({
      date: r.date,
      newSubscribers: parseInt(r.newSubscribers, 10),
      totalActive,
    }));
  }

  async computeDailyStats(siteId: string, date: string) {
    const dayStart = new Date(`${date}T00:00:00Z`);
    const dayEnd = new Date(`${date}T23:59:59Z`);

    const newSubscribers = await this.subscriberRepo
      .createQueryBuilder('sub')
      .where('sub.siteId = :siteId', { siteId })
      .andWhere('sub.subscribedAt BETWEEN :start AND :end', {
        start: dayStart, end: dayEnd,
      })
      .getCount();

    const unsubscribed = await this.subscriberRepo
      .createQueryBuilder('sub')
      .where('sub.siteId = :siteId', { siteId })
      .andWhere('sub.unsubscribedAt BETWEEN :start AND :end', {
        start: dayStart, end: dayEnd,
      })
      .getCount();

    const notifStats = await this.notifRepo
      .createQueryBuilder('n')
      .select('SUM(n.totalSent)', 'sent')
      .addSelect('SUM(n.totalDelivered)', 'delivered')
      .addSelect('SUM(n.totalClicked)', 'clicked')
      .addSelect('SUM(n.totalFailed)', 'failed')
      .where('n.siteId = :siteId', { siteId })
      .andWhere('n.sentAt BETWEEN :start AND :end', {
        start: dayStart, end: dayEnd,
      })
      .getRawOne();

    const totalSubscribers = await this.subscriberRepo.count({
      where: { siteId, isActive: true },
    });

    const sent = parseInt(notifStats?.sent || '0');
    const clicked = parseInt(notifStats?.clicked || '0');
    const ctr = sent > 0 ? parseFloat(((clicked / sent) * 100).toFixed(2)) : 0;

    await this.analyticsRepo.upsert(
      {
        siteId,
        date,
        totalSubscribers,
        newSubscribers,
        unsubscribed,
        notificationsSent: sent,
        notificationsDelivered: parseInt(notifStats?.delivered || '0'),
        notificationsClicked: clicked,
        notificationsFailed: parseInt(notifStats?.failed || '0'),
        ctr,
      },
      ['siteId', 'date'],
    );
  }

  /**
   * Find carts that were abandoned (cart_item_added event with no purchase, not already notified).
   * Compatible with SQLite, MySQL, and PostgreSQL — all filtering is done in memory.
   *
   * @param siteId               Site UUID.
   * @param abandonAfterSeconds  Seconds of inactivity before a cart is considered abandoned.
   */
  async findAbandonedCarts(
    siteId: string,
    abandonAfterSeconds: number,
  ): Promise<Array<{ subscriberId: string; cartId: string; cartData: Record<string, any>; cartEventAt: Date }>> {
    const cutoffTime = new Date(Date.now() - abandonAfterSeconds * 1000);

    // 1. Fetch all cart_item_added events older than the cutoff window
    const cartEvents = await this.eventRepo.find({
      where: { siteId, eventType: 'cart_item_added' },
      order: { createdAt: 'DESC' },
    });

    const oldCartEvents = cartEvents.filter(
      (e) => e.subscriberId && e.eventData?.cartId && e.createdAt <= cutoffTime,
    );

    if (oldCartEvents.length === 0) return [];

    // 2. Fetch recent purchase_completed events (look back 2× the abandon window)
    const lookbackTime = new Date(Date.now() - abandonAfterSeconds * 2 * 1000);
    const purchaseEvents = await this.eventRepo.find({
      where: { siteId, eventType: 'purchase_completed' },
    });

    const purchasedSubscriberIds = new Set(
      purchaseEvents
        .filter((e) => e.subscriberId && e.createdAt >= lookbackTime)
        .map((e) => e.subscriberId),
    );

    // 3. Fetch cart_abandonment_notified markers (avoids duplicate notifications)
    const notifiedEvents = await this.eventRepo.find({
      where: { siteId, eventType: 'cart_abandonment_notified' },
    });

    const notifiedCartIds = new Set(
      notifiedEvents.map((e) => e.eventData?.cartId).filter(Boolean),
    );

    // 4. Deduplicate by subscriber+cartId; keep the most recent event per cart
    const cartMap = new Map<string, typeof oldCartEvents[0]>();
    for (const event of oldCartEvents) {
      const key = `${event.subscriberId}_${event.eventData.cartId}`;
      if (!cartMap.has(key)) {
        cartMap.set(key, event);
      }
    }

    // 5. Filter out purchased or already-notified carts
    const result: Array<{ subscriberId: string; cartId: string; cartData: Record<string, any>; cartEventAt: Date }> = [];

    for (const [, event] of cartMap) {
      if (purchasedSubscriberIds.has(event.subscriberId)) continue;
      if (notifiedCartIds.has(event.eventData.cartId)) continue;

      result.push({
        subscriberId: event.subscriberId,
        cartId: event.eventData.cartId,
        cartData: event.eventData,
        cartEventAt: event.createdAt,
      });
    }

    return result;
  }

  /**
   * Persist a cart_abandonment_notified marker so the same cart is not messaged twice.
   */
  async markCartAbandoned(siteId: string, subscriberId: string, cartId: string): Promise<void> {
    await this.trackEvent(siteId, {
      subscriberId,
      eventType: 'cart_abandonment_notified',
      eventData: { cartId, notifiedAt: new Date().toISOString() },
    });
  }
}
