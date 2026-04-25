import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Site } from '../sites/site.entity';
import { AutomationsService } from '../automations/automations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TargetType } from '../notifications/notification.entity';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    private readonly automationsService: AutomationsService,
    private readonly notificationsService: NotificationsService,
  ) { }

  async handleWordPressWebhook(apiKey: string, signature: string, payload: any) {
    const site = await this.siteRepo.findOne({ where: { apiKey, isActive: true } });
    if (!site) throw new NotFoundException('Invalid API key');

    // Verify webhook signature if secret is configured
    if (site.webhookSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', site.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    const { event, data } = payload;

    switch (event) {
      case 'post_published': {
        // Directly create and send push notification to all subscribers
        const result = await this.notificationsService.send(site.id, {
          title: data.title,
          message: data.excerpt || 'New post published',
          clickAction: data.url,
          iconUrl: data.thumbnail,
          targetType: TargetType.ALL,
        } as any);

        // Also trigger any configured automations
        await this.automationsService.triggerNewPost(site.id, {
          title: data.title,
          excerpt: data.excerpt,
          url: data.url,
          thumbnail: data.thumbnail,
        });

        return { status: 'processed', event, notification: result.notification?.id };
      }

      default:
        return { status: 'ignored', event };
    }
  }
}
