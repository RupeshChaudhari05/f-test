import { Injectable, NotFoundException, Optional, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationStatus, TargetType } from './notification.entity';
import { NotificationDelivery, DeliveryStatus } from './notification-delivery.entity';
import { SubscribersService } from '../subscribers/subscribers.service';
import { PushService } from './push.service';
import { LicenseService } from '../license/license.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { Site } from '../sites/site.entity';
import { Subscriber } from '../subscribers/subscriber.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    @InjectRepository(Subscriber)
    private readonly subRepo: Repository<Subscriber>,
    private readonly subscribersService: SubscribersService,
    private readonly pushService: PushService,
    private readonly licenseService: LicenseService,
  ) { }

  async create(siteId: string, dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notifRepo.create({
      siteId,
      title: dto.title,
      message: dto.message,
      iconUrl: dto.iconUrl,
      imageUrl: dto.imageUrl,
      clickAction: dto.clickAction,
      deepLink: dto.deepLink,
      data: dto.data,
      targetType: dto.targetType || TargetType.ALL,
      targetConfig: dto.targetConfig || {},
      timezoneAware: dto.timezoneAware || false,
      ttl: dto.ttl || 86400,
      urgency: dto.urgency || 'normal',
    });

    return this.notifRepo.save(notification);
  }

  async findBySite(siteId: string, page = 1, limit = 20) {
    const [notifications, total] = await this.notifRepo.findAndCount({
      where: { siteId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { notifications, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findById(id: string, siteId?: string): Promise<Notification> {
    const where: any = { id };
    if (siteId) where.siteId = siteId;
    const notification = await this.notifRepo.findOne({ where });
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  async send(siteId: string, dto: SendNotificationDto, userPlan?: string) {
    let notification: Notification;

    if (dto.notificationId) {
      notification = await this.findById(dto.notificationId, siteId);
    } else {
      notification = await this.create(siteId, dto as CreateNotificationDto);
    }

    // Schedule for later
    if (dto.scheduledAt) {
      notification.status = NotificationStatus.SCHEDULED;
      notification.scheduledAt = new Date(dto.scheduledAt);
      await this.notifRepo.save(notification);
      return { message: 'Notification scheduled', notification };
    }

    // Send immediately - process in background
    notification.status = NotificationStatus.SENDING;
    await this.notifRepo.save(notification);

    // Process delivery asynchronously (non-blocking)
    this.processNotificationDelivery(siteId, notification).catch((err) => {
      this.logger.error(`Notification delivery failed: ${err.message}`);
    });

    return { message: 'Notification is being sent', notification };
  }

  private async processNotificationDelivery(siteId: string, notification: Notification) {
    try {
      // Explicitly select vapidPrivateKey (excluded by default due to select: false)
      const site = await this.siteRepo
        .createQueryBuilder('site')
        .addSelect('site.vapidPrivateKey')
        .where('site.id = :id', { id: siteId })
        .getOne();
      if (!site) throw new Error('Site not found');

      // Get target subscribers
      const subscribers = await this.subRepo.find({
        where: { siteId, isActive: true },
      });

      if (subscribers.length === 0) {
        notification.status = NotificationStatus.SENT;
        notification.sentAt = new Date();
        await this.notifRepo.save(notification);
        return;
      }

      // Create delivery records
      await this.createDeliveryRecords(notification.id, subscribers.map((s) => s.id));

      // Send in batches of 50
      const batchSize = 50;
      let sentCount = 0;
      let failedCount = 0;

      for (let i = 0; i < subscribers.length; i += batchSize) {
        const batch = subscribers.slice(i, i + batchSize);
        const promises = batch.map(async (subscriber) => {
          try {
            const result = await this.pushService.sendToSubscriber(site, subscriber, notification);
            if (result.success) {
              await this.markDeliverySent(notification.id, subscriber.id);
              sentCount++;
            } else {
              await this.markDeliveryFailed(notification.id, subscriber.id, result.error || 'Unknown');
              failedCount++;
            }
          } catch (err: any) {
            await this.markDeliveryFailed(notification.id, subscriber.id, err.message);
            failedCount++;
          }
        });
        await Promise.all(promises);
      }

      // Update notification status
      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
      notification.totalSent = sentCount;
      notification.totalDelivered = sentCount; // count push-service accepted = delivered
      notification.totalFailed = failedCount;
      await this.notifRepo.save(notification);

      this.logger.log(`Notification ${notification.id} sent: ${sentCount} success, ${failedCount} failed`);
    } catch (err: any) {
      notification.status = NotificationStatus.FAILED;
      await this.notifRepo.save(notification);
      this.logger.error(`Notification ${notification.id} delivery error: ${err.message}`);
    }
  }

  async cancel(id: string, siteId: string): Promise<Notification> {
    const notification = await this.findById(id, siteId);
    if (
      notification.status !== NotificationStatus.SCHEDULED &&
      notification.status !== NotificationStatus.DRAFT
    ) {
      throw new Error('Can only cancel scheduled or draft notifications');
    }
    notification.status = NotificationStatus.CANCELLED;
    return this.notifRepo.save(notification);
  }

  async getDeliveryStats(notificationId: string) {
    const stats = await this.deliveryRepo
      .createQueryBuilder('d')
      .select('d.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('d.notificationId = :notificationId', { notificationId })
      .groupBy('d.status')
      .getRawMany();

    const result: Record<string, number> = {
      pending: 0,
      sent: 0,
      delivered: 0,
      clicked: 0,
      failed: 0,
    };

    stats.forEach((s) => {
      result[s.status] = parseInt(s.count, 10);
    });

    const total = Object.values(result).reduce((a, b) => a + b, 0);
    result['ctr'] = total > 0 ? parseFloat(((result.clicked / total) * 100).toFixed(2)) : 0;

    return result;
  }

  async trackDelivery(notificationId: string, subscriberId: string, event: 'delivered' | 'clicked') {
    const delivery = await this.deliveryRepo.findOne({
      where: { notificationId, subscriberId },
    });

    if (!delivery) return;

    if (event === 'delivered') {
      delivery.status = DeliveryStatus.DELIVERED;
      delivery.deliveredAt = new Date();
    } else if (event === 'clicked') {
      delivery.status = DeliveryStatus.CLICKED;
      delivery.clickedAt = new Date();
    }

    await this.deliveryRepo.save(delivery);

    // Update notification aggregate counts
    await this.updateNotificationCounts(notificationId);
  }

  async createDeliveryRecords(notificationId: string, subscriberIds: string[]) {
    const records = subscriberIds.map((subscriberId) => ({
      notificationId,
      subscriberId,
      status: DeliveryStatus.PENDING,
    }));

    // Batch insert in chunks of 1000
    const chunkSize = 1000;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      await this.deliveryRepo
        .createQueryBuilder()
        .insert()
        .into(NotificationDelivery)
        .values(chunk)
        .execute();
    }
  }

  async markDeliverySent(notificationId: string, subscriberId: string) {
    await this.deliveryRepo.update(
      { notificationId, subscriberId },
      { status: DeliveryStatus.SENT, sentAt: new Date() },
    );
  }

  async markDeliveryFailed(notificationId: string, subscriberId: string, reason: string) {
    await this.deliveryRepo.update(
      { notificationId, subscriberId },
      { status: DeliveryStatus.FAILED, failedReason: reason },
    );
  }

  private async updateNotificationCounts(notificationId: string) {
    const counts = await this.deliveryRepo
      .createQueryBuilder('d')
      .select('d.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('d.notificationId = :notificationId', { notificationId })
      .groupBy('d.status')
      .getRawMany();

    const update: Partial<Notification> = {};
    counts.forEach((c) => {
      const count = parseInt(c.count, 10);
      switch (c.status) {
        case 'sent': update.totalSent = count; break;
        case 'delivered': update.totalDelivered = count; break;
        case 'clicked': update.totalClicked = count; break;
        case 'failed': update.totalFailed = count; break;
      }
    });

    await this.notifRepo.update(notificationId, update);
  }
}
