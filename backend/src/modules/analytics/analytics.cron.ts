import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsService } from './analytics.service';
import { AutomationsService } from '../automations/automations.service';
import { Site } from '../sites/site.entity';

@Injectable()
export class AnalyticsCron {
  private readonly logger = new Logger(AnalyticsCron.name);

  constructor(
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    private readonly analyticsService: AnalyticsService,
    private readonly automationsService: AutomationsService,
  ) { }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async computeDailyAnalytics() {
    this.logger.log('Computing daily analytics...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const sites = await this.siteRepo.find({ where: { isActive: true } });

    for (const site of sites) {
      try {
        await this.analyticsService.computeDailyStats(site.id, dateStr);
      } catch (error: any) {
        this.logger.error(`Failed to compute stats for site ${site.id}: ${error.message}`);
      }
    }

    this.logger.log(`Daily analytics computed for ${sites.length} sites`);
  }

  @Cron('0 */30 * * * *') // Every 30 minutes
  async checkRSSFeeds() {
    this.logger.log('Checking RSS feeds...');
    const sites = await this.siteRepo.find({ where: { isActive: true } });

    for (const site of sites) {
      try {
        await this.automationsService.checkRSSFeeds(site.id);
      } catch (error: any) {
        this.logger.error(`Failed to check RSS feeds for site ${site.id}: ${error.message}`);
      }
    }
  }

  @Cron('0 */15 * * * *') // Every 15 minutes
  async checkYouTubeVideos() {
    this.logger.log('Checking YouTube channels...');
    const sites = await this.siteRepo.find({ where: { isActive: true } });

    for (const site of sites) {
      try {
        await this.automationsService.checkYouTubeVideos(site.id);
      } catch (error: any) {
        this.logger.error(`Failed to check YouTube for site ${site.id}: ${error.message}`);
      }
    }
  }

  /**
   * Cart abandonment check — runs every 5 minutes.
   *
   * For each active site the cron:
   *  1. Queries all EVENT_TRIGGERED automations whose trigger is cart_abandoned
   *     to determine the configured delay window (defaults to 3600 s / 1 hour).
   *  2. Calls AnalyticsService.findAbandonedCarts() to get qualifying carts.
   *  3. Calls AutomationsService.triggerCartAbandonment() which personalises and
   *     sends the push notification to the subscriber.
   *  4. Persists a cart_abandonment_notified marker so the same cart is not
   *     messaged again.
   */
  @Cron('0 */5 * * * *')
  async checkCartAbandonment() {
    this.logger.log('Checking for abandoned carts...');
    const sites = await this.siteRepo.find({ where: { isActive: true } });

    for (const site of sites) {
      try {
        // Default abandon window: 1 hour.  Individual automations may override this.
        const defaultAbandonSeconds = 3600;

        const abandonedCarts = await this.analyticsService.findAbandonedCarts(
          site.id,
          defaultAbandonSeconds,
        );

        if (abandonedCarts.length === 0) continue;

        this.logger.log(
          `Found ${abandonedCarts.length} abandoned cart(s) for site ${site.id}`,
        );

        for (const cart of abandonedCarts) {
          // Mark first to prevent race conditions with parallel cron runs
          await this.analyticsService.markCartAbandoned(site.id, cart.subscriberId, cart.cartId);

          // Fire cart_abandoned automations for this subscriber
          await this.automationsService.triggerCartAbandonment(
            site.id,
            cart.subscriberId,
            cart.cartData,
          );
        }
      } catch (error: any) {
        this.logger.error(
          `Cart abandonment check failed for site ${site.id}: ${error.message}`,
        );
      }
    }
  }
}
