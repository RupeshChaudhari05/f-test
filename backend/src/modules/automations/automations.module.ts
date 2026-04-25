import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// import { BullModule } from '@nestjs/bullmq'; // Temporarily disabled
import { Automation, DripStep, DripEnrollment } from './automation.entity';
import { AutomationsService } from './automations.service';
import { AutomationsController } from './automations.controller';
import { AutomationProcessor } from './automation.processor';
import { RssAutomationService } from './rss-automation.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscribersModule } from '../subscribers/subscribers.module';
import { Notification } from '../notifications/notification.entity';
import { Site } from '../sites/site.entity';
import { Subscriber } from '../subscribers/subscriber.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Automation, DripStep, DripEnrollment, Notification, Site, Subscriber]),
    // BullModule.registerQueue({ name: 'automations' }), // Temporarily disabled
    NotificationsModule,
    SubscribersModule,
  ],
  controllers: [AutomationsController],
  providers: [AutomationsService, AutomationProcessor, RssAutomationService],
  exports: [AutomationsService, RssAutomationService],
})
export class AutomationsModule { }
