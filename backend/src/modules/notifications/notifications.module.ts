import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { NotificationDelivery } from './notification-delivery.entity';
import { Subscriber } from '../subscribers/subscriber.entity';
import { Site } from '../sites/site.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PushService } from './push.service';
import { NotificationProcessor } from './notification.processor';
import { SubscribersModule } from '../subscribers/subscribers.module';
import { LicenseModule } from '../license/license.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationDelivery, Subscriber, Site]),
    SubscribersModule,
    LicenseModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, PushService, NotificationProcessor],
  exports: [NotificationsService, PushService],
})
export class NotificationsModule { }
