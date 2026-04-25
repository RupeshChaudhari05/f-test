import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from '../sites/site.entity';
import { Subscriber } from '../subscribers/subscriber.entity';
import { SdkController } from './sdk.controller';
import { SdkService } from './sdk.service';
import { SubscribersModule } from '../subscribers/subscribers.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AutomationsModule } from '../automations/automations.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Site, Subscriber]),
    SubscribersModule,
    AnalyticsModule,
    AutomationsModule,
    NotificationsModule,
  ],
  controllers: [SdkController],
  providers: [SdkService],
})
export class SdkModule { }
