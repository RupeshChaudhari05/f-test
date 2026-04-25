import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Job } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Automation, DripStep, DripEnrollment } from './automation.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscribersService } from '../subscribers/subscribers.service';
import { TargetType } from '../notifications/notification.entity';

@Processor('automations')
export class AutomationProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationProcessor.name);

  constructor(
    @InjectRepository(Automation)
    private readonly automationRepo: Repository<Automation>,
    @InjectRepository(DripStep)
    private readonly dripStepRepo: Repository<DripStep>,
    @InjectRepository(DripEnrollment)
    private readonly enrollmentRepo: Repository<DripEnrollment>,
    private readonly notificationsService: NotificationsService,
    private readonly subscribersService: SubscribersService,
  ) {
    super();
  }

  async process(job: Job) {
    switch (job.name) {
      case 'send-automation':
        return this.handleAutomationSend(job.data);
      case 'send-post-notification':
        return this.handlePostNotification(job.data);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async handleAutomationSend(data: {
    automationId: string;
    subscriberId: string;
    siteId: string;
  }) {
    const automation = await this.automationRepo.findOne({
      where: { id: data.automationId },
    });
    if (!automation || !automation.isActive) return;

    const template = automation.notificationTemplate;
    await this.notificationsService.send(data.siteId, {
      title: template.title,
      message: template.message,
      iconUrl: template.iconUrl,
      imageUrl: template.imageUrl,
      clickAction: template.clickAction,
      targetType: TargetType.INDIVIDUAL,
      targetConfig: { subscriberIds: [data.subscriberId] },
    });
  }

  private async handlePostNotification(data: {
    automationId: string;
    siteId: string;
    postData: Record<string, any>;
  }) {
    const automation = await this.automationRepo.findOne({
      where: { id: data.automationId },
    });
    if (!automation || !automation.isActive) return;

    const template = automation.notificationTemplate;
    const postData = data.postData;

    // Replace template variables with post data
    const title = (template.title || 'New Post: {{title}}')
      .replace('{{title}}', postData.title || '');
    const message = (template.message || '{{excerpt}}')
      .replace('{{excerpt}}', postData.excerpt || '');
    const clickAction = (template.clickAction || '{{url}}')
      .replace('{{url}}', postData.url || '');

    await this.notificationsService.send(data.siteId, {
      title,
      message,
      iconUrl: template.iconUrl || postData.thumbnail,
      imageUrl: postData.thumbnail,
      clickAction,
      targetType: TargetType.ALL,
      targetConfig: {},
    });
  }

  // Process drip campaigns
  @Cron(CronExpression.EVERY_MINUTE)
  async processDripCampaigns() {
    const now = new Date();
    const dueEnrollments = await this.enrollmentRepo.find({
      where: {
        status: 'active',
        nextStepAt: LessThanOrEqual(now),
      },
    });

    for (const enrollment of dueEnrollments) {
      try {
        const nextStepOrder = enrollment.currentStep + 1;
        const step = await this.dripStepRepo.findOne({
          where: { automationId: enrollment.automationId, stepOrder: nextStepOrder },
        });

        if (!step || !step.isActive) {
          enrollment.status = 'completed';
          enrollment.completedAt = new Date();
          await this.enrollmentRepo.save(enrollment);
          continue;
        }

        const automation = await this.automationRepo.findOne({
          where: { id: enrollment.automationId },
        });
        if (!automation || !automation.isActive) continue;

        // Send the drip step notification
        await this.notificationsService.send(automation.siteId, {
          title: step.notificationTemplate.title,
          message: step.notificationTemplate.message,
          iconUrl: step.notificationTemplate.iconUrl,
          clickAction: step.notificationTemplate.clickAction,
          targetType: TargetType.INDIVIDUAL,
          targetConfig: { subscriberIds: [enrollment.subscriberId] },
        });

        // Advance to next step
        enrollment.currentStep = nextStepOrder;
        const nextStep = await this.dripStepRepo.findOne({
          where: { automationId: enrollment.automationId, stepOrder: nextStepOrder + 1 },
        });

        if (nextStep) {
          enrollment.nextStepAt = new Date(Date.now() + nextStep.delaySeconds * 1000);
        } else {
          enrollment.status = 'completed';
          enrollment.completedAt = new Date();
        }

        await this.enrollmentRepo.save(enrollment);
      } catch (error: any) {
        this.logger.error(`Drip processing error for enrollment ${enrollment.id}: ${error.message}`);
      }
    }
  }
}
