import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// import { InjectQueue } from '@nestjs/bullmq';
// import { Queue } from 'bullmq';
import { Automation, AutomationType, DripStep, DripEnrollment } from './automation.entity';
import { CreateAutomationDto } from './dto/create-automation.dto';

@Injectable()
export class AutomationsService {
  constructor(
    @InjectRepository(Automation)
    private readonly automationRepo: Repository<Automation>,
    @InjectRepository(DripStep)
    private readonly dripStepRepo: Repository<DripStep>,
    @InjectRepository(DripEnrollment)
    private readonly enrollmentRepo: Repository<DripEnrollment>,
    // @InjectQueue('automations')
    // private readonly automationQueue: Queue,
  ) { }

  async create(siteId: string, dto: CreateAutomationDto): Promise<Automation> {
    const automation = this.automationRepo.create({
      siteId,
      name: dto.name,
      type: dto.type,
      triggerConfig: dto.triggerConfig || {},
      notificationTemplate: dto.notificationTemplate || {},
      targetConfig: dto.targetConfig,
      delaySeconds: dto.delaySeconds || 0,
    });

    const saved = await this.automationRepo.save(automation);

    // Create drip steps if provided
    if (dto.type === AutomationType.DRIP && dto.dripSteps?.length) {
      const steps = dto.dripSteps.map((step, index) =>
        this.dripStepRepo.create({
          automationId: saved.id,
          stepOrder: index + 1,
          delaySeconds: step.delaySeconds || 0,
          notificationTemplate: step.notificationTemplate || {},
        }),
      );
      await this.dripStepRepo.save(steps);
    }

    return this.automationRepo.findOne({
      where: { id: saved.id },
      relations: ['dripSteps'],
    }) as Promise<Automation>;
  }

  async findBySite(siteId: string) {
    return this.automationRepo.find({
      where: { siteId },
      relations: ['dripSteps'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string, siteId?: string): Promise<Automation> {
    const where: any = { id };
    if (siteId) where.siteId = siteId;
    const automation = await this.automationRepo.findOne({
      where,
      relations: ['dripSteps'],
    });
    if (!automation) throw new NotFoundException('Automation not found');
    return automation;
  }

  async toggle(id: string, siteId: string): Promise<Automation> {
    const automation = await this.findById(id, siteId);
    automation.isActive = !automation.isActive;
    return this.automationRepo.save(automation);
  }

  async delete(id: string, siteId: string): Promise<void> {
    const automation = await this.findById(id, siteId);
    await this.automationRepo.remove(automation);
  }

  async triggerWelcome(siteId: string, subscriberId: string) {
    const welcomeAutomations = await this.automationRepo.find({
      where: { siteId, type: AutomationType.WELCOME, isActive: true },
    });

    for (const automation of welcomeAutomations) {
      // TODO: Re-enable when Redis is available
      // const delay = automation.delaySeconds * 1000;
      // await this.automationQueue.add(
      //   'send-automation',
      //   {
      //     automationId: automation.id,
      //     subscriberId,
      //     siteId,
      //   },
      //   { delay },
      // );

      automation.lastTriggeredAt = new Date();
      automation.totalTriggered += 1;
      await this.automationRepo.save(automation);
    }
  }

  async triggerNewPost(siteId: string, postData: Record<string, any>) {
    const postAutomations = await this.automationRepo.find({
      where: { siteId, type: AutomationType.NEW_POST, isActive: true },
    });

    for (const automation of postAutomations) {
      // TODO: Re-enable when Redis is available
      // await this.automationQueue.add('send-post-notification', {
      //   automationId: automation.id,
      //   siteId,
      //   postData,
      // });

      automation.lastTriggeredAt = new Date();
      automation.totalTriggered += 1;
      await this.automationRepo.save(automation);
    }
  }

  /** Trigger a generic automation payload. This is a placeholder until the notification engine is fully implemented. */
  private async triggerAutomation(automation: Automation, payload: Record<string, any>): Promise<void> {
    console.log(`Triggering automation ${automation.id} with payload:`, payload);
  }

  async enrollInDrip(automationId: string, subscriberId: string) {
    const existing = await this.enrollmentRepo.findOne({
      where: { automationId, subscriberId },
    });

    if (existing) return existing;

    const automation = await this.findById(automationId);
    const firstStep = await this.dripStepRepo.findOne({
      where: { automationId, stepOrder: 1 },
    });

    const enrollment = this.enrollmentRepo.create({
      automationId,
      subscriberId,
      currentStep: 0,
      nextStepAt: firstStep
        ? new Date(Date.now() + firstStep.delaySeconds * 1000)
        : null,
    });

    return this.enrollmentRepo.save(enrollment);
  }

  /** Check RSS feeds for new content and trigger notifications */
  async checkRSSFeeds(siteId: string) {
    const rssAutomations = await this.automationRepo.find({
      where: { siteId, type: AutomationType.RSS_FEED, isActive: true },
    });

    for (const automation of rssAutomations) {
      try {
        const feedUrl = automation.triggerConfig.feedUrl;
        if (!feedUrl) continue;

        const newItems = await this.fetchRSSFeed(feedUrl, automation.lastTriggeredAt);

        for (const item of newItems) {
          await this.triggerAutomation(automation, {
            title: item.title,
            content: item.description,
            url: item.link,
            publishedAt: item.pubDate,
          });

          automation.lastTriggeredAt = new Date();
          automation.totalTriggered += 1;
        }

        await this.automationRepo.save(automation);
      } catch (error) {
        console.error(`RSS automation ${automation.id} failed:`, error);
      }
    }
  }

  /** Check YouTube channels for new videos */
  async checkYouTubeVideos(siteId: string) {
    const ytAutomations = await this.automationRepo.find({
      where: { siteId, type: AutomationType.YOUTUBE_VIDEO, isActive: true },
    });

    for (const automation of ytAutomations) {
      try {
        const channelId = automation.triggerConfig.channelId;
        const apiKey = automation.triggerConfig.youtubeApiKey;

        if (!channelId || !apiKey) continue;

        const newVideos = await this.fetchYouTubeVideos(channelId, apiKey, automation.lastTriggeredAt);

        for (const video of newVideos) {
          await this.triggerAutomation(automation, {
            title: video.title,
            content: video.description,
            url: `https://www.youtube.com/watch?v=${video.videoId}`,
            thumbnail: video.thumbnail,
            publishedAt: video.publishedAt,
          });

          automation.lastTriggeredAt = new Date();
          automation.totalTriggered += 1;
        }

        await this.automationRepo.save(automation);
      } catch (error) {
        console.error(`YouTube automation ${automation.id} failed:`, error);
      }
    }
  }

  /** Fetch new items from RSS feed */
  private async fetchRSSFeed(feedUrl: string, since?: Date | null): Promise<any[]> {
    // In a real implementation, use a proper RSS parser library
    // For now, return mock data
    return [
      {
        title: 'New Blog Post',
        description: 'This is a new blog post content...',
        link: 'https://example.com/post',
        pubDate: new Date(),
      }
    ].filter(item => !since || item.pubDate > since);
  }

  /** Fetch new YouTube videos */
  private async fetchYouTubeVideos(channelId: string, apiKey: string, since?: Date | null): Promise<any[]> {
    // In a real implementation, call YouTube Data API v3
    // For now, return mock data
    return [
      {
        videoId: 'abc123',
        title: 'New YouTube Video',
        description: 'Video description...',
        thumbnail: 'https://img.youtube.com/vi/abc123/maxresdefault.jpg',
        publishedAt: new Date(),
      }
    ].filter(video => !since || video.publishedAt > since);
  }
}
