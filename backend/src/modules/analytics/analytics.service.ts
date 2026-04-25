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
}
