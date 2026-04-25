import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbTest } from '../analytics/analytics.entity';
import { Notification } from '../notifications/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscribersService } from '../subscribers/subscribers.service';
import { TargetType } from '../notifications/notification.entity';

@Injectable()
export class AbTestService {
  constructor(
    @InjectRepository(AbTest)
    private readonly abTestRepo: Repository<AbTest>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    private readonly notificationsService: NotificationsService,
    private readonly subscribersService: SubscribersService,
  ) { }

  async create(siteId: string, dto: {
    name: string;
    variantA: { title: string; message: string; iconUrl?: string; imageUrl?: string; clickAction?: string };
    variantB: { title: string; message: string; iconUrl?: string; imageUrl?: string; clickAction?: string };
    splitPercentage?: number;
    winnerMetric?: string;
    targetConfig?: Record<string, any>;
  }) {
    // Create variant A notification
    const variantA = await this.notificationsService.create(siteId, {
      title: dto.variantA.title,
      message: dto.variantA.message,
      iconUrl: dto.variantA.iconUrl,
      imageUrl: dto.variantA.imageUrl,
      clickAction: dto.variantA.clickAction,
    });

    // Create variant B notification
    const variantB = await this.notificationsService.create(siteId, {
      title: dto.variantB.title,
      message: dto.variantB.message,
      iconUrl: dto.variantB.iconUrl,
      imageUrl: dto.variantB.imageUrl,
      clickAction: dto.variantB.clickAction,
    });

    const abTest = this.abTestRepo.create({
      siteId,
      name: dto.name,
      variantAId: variantA.id,
      variantBId: variantB.id,
      splitPercentage: dto.splitPercentage || 50,
      winnerMetric: dto.winnerMetric || 'ctr',
    });

    return this.abTestRepo.save(abTest);
  }

  async start(id: string, siteId: string) {
    const test = await this.abTestRepo.findOne({ where: { id, siteId } });
    if (!test) throw new NotFoundException('A/B test not found');

    // Get all active subscribers
    const subscriberIds = await this.subscribersService.getActiveSubscriberIds(siteId);

    // Split subscribers
    const splitIndex = Math.floor(subscriberIds.length * (test.splitPercentage / 100));
    const shuffled = subscriberIds.sort(() => Math.random() - 0.5);
    const groupA = shuffled.slice(0, splitIndex);
    const groupB = shuffled.slice(splitIndex);

    // Send variant A
    if (test.variantAId) {
      await this.notificationsService.send(siteId, {
        notificationId: test.variantAId,
        title: '', message: '', // Will be ignored since notificationId is provided
        targetType: TargetType.INDIVIDUAL,
        targetConfig: { subscriberIds: groupA },
      });
    }

    // Send variant B
    if (test.variantBId) {
      await this.notificationsService.send(siteId, {
        notificationId: test.variantBId,
        title: '', message: '',
        targetType: TargetType.INDIVIDUAL,
        targetConfig: { subscriberIds: groupB },
      });
    }

    test.status = 'running';
    test.startedAt = new Date();
    test.sampleSize = subscriberIds.length;
    return this.abTestRepo.save(test);
  }

  async getResults(id: string, siteId: string) {
    const test = await this.abTestRepo.findOne({ where: { id, siteId } });
    if (!test) throw new NotFoundException('A/B test not found');

    const [statsA, statsB] = await Promise.all([
      test.variantAId ? this.notificationsService.getDeliveryStats(test.variantAId) : null,
      test.variantBId ? this.notificationsService.getDeliveryStats(test.variantBId) : null,
    ]);

    let winner: string | null = null;
    if (statsA && statsB) {
      const metricA = statsA[test.winnerMetric] || 0;
      const metricB = statsB[test.winnerMetric] || 0;
      if (metricA > metricB) winner = 'A';
      else if (metricB > metricA) winner = 'B';
    }

    return {
      test,
      variantA: statsA,
      variantB: statsB,
      winner,
    };
  }

  async findBySite(siteId: string) {
    return this.abTestRepo.find({
      where: { siteId },
      order: { createdAt: 'DESC' },
    });
  }
}
