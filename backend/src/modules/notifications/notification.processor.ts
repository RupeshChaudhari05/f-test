import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { Notification, NotificationStatus } from './notification.entity';
import { Subscriber } from '../subscribers/subscriber.entity';
import { Site } from '../sites/site.entity';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { SubscribersService } from '../subscribers/subscribers.service';

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService,
    private readonly subscribersService: SubscribersService,
  ) {
    super();
  }

  async process(job: Job<{ notificationId: string; siteId: string }>) {
    const { notificationId, siteId } = job.data;
    this.logger.log(`Processing notification ${notificationId} for site ${siteId}`);

    try {
      const notification = await this.notifRepo.findOne({ where: { id: notificationId } });
      if (!notification) {
        this.logger.error(`Notification ${notificationId} not found`);
        return;
      }

      if (notification.status === NotificationStatus.CANCELLED) {
        this.logger.log(`Notification ${notificationId} was cancelled`);
        return;
      }

      const site = await this.siteRepo.findOne({ where: { id: siteId } });
      if (!site) {
        this.logger.error(`Site ${siteId} not found`);
        return;
      }

      // Get target subscribers
      const subscriberIds = await this.getTargetSubscribers(notification);

      if (subscriberIds.length === 0) {
        this.logger.warn(`No subscribers for notification ${notificationId}`);
        notification.status = NotificationStatus.SENT;
        notification.sentAt = new Date();
        await this.notifRepo.save(notification);
        return;
      }

      // Create delivery records
      await this.notificationsService.createDeliveryRecords(notificationId, subscriberIds);

      // Process in batches
      const batchSize = 100;
      let sentCount = 0;
      let failedCount = 0;

      for (let i = 0; i < subscriberIds.length; i += batchSize) {
        const batchIds = subscriberIds.slice(i, i + batchSize);
        const subscribers = await this.subscribersService.getByIds(batchIds);

        const results = await Promise.allSettled(
          subscribers.map((subscriber) =>
            this.pushService.sendToSubscriber(site, subscriber, notification),
          ),
        );

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.success) {
            sentCount++;
            await this.notificationsService.markDeliverySent(
              notificationId,
              result.value.subscriberId,
            );
          } else {
            failedCount++;
            const error =
              result.status === 'fulfilled' ? result.value.error : result.reason?.message;
            const subscriberId =
              result.status === 'fulfilled' ? result.value.subscriberId : 'unknown';
            await this.notificationsService.markDeliveryFailed(
              notificationId,
              subscriberId,
              error || 'Unknown error',
            );
          }
        }

        // Update progress
        await job.updateProgress(
          Math.round(((i + batchIds.length) / subscriberIds.length) * 100),
        );
      }

      // Update notification status
      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
      notification.totalSent = sentCount;
      notification.totalFailed = failedCount;
      await this.notifRepo.save(notification);

      this.logger.log(
        `Notification ${notificationId} sent: ${sentCount} success, ${failedCount} failed`,
      );
    } catch (error: any) {
      this.logger.error(`Error processing notification ${notificationId}: ${error.message}`);

      await this.notifRepo.update(notificationId, {
        status: NotificationStatus.FAILED,
      });

      throw error;
    }
  }

  private async getTargetSubscribers(notification: Notification): Promise<string[]> {
    const filters: Record<string, any> = {};

    switch (notification.targetType) {
      case 'all':
        break;
      case 'tags':
        filters.tags = notification.targetConfig.tags;
        break;
      case 'filter':
        Object.assign(filters, notification.targetConfig);
        break;
      case 'segment':
        // Segment-based targeting handled separately
        filters.segmentId = notification.targetConfig.segmentId;
        break;
      case 'individual':
        return notification.targetConfig.subscriberIds || [];
    }

    return this.subscribersService.getActiveSubscriberIds(notification.siteId, filters);
  }
}
