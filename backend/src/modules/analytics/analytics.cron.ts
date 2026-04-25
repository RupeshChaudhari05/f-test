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
}
