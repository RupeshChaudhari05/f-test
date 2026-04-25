import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsDaily, Event, ClickEvent } from './analytics.entity';
import { Notification } from '../notifications/notification.entity';
import { Subscriber } from '../subscribers/subscriber.entity';
import { Site } from '../sites/site.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsCron } from './analytics.cron';
import { AutomationsModule } from '../automations/automations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalyticsDaily, Event, ClickEvent, Notification, Subscriber, Site]),
    forwardRef(() => AutomationsModule),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsCron],
  exports: [AnalyticsService],
})
export class AnalyticsModule { }
