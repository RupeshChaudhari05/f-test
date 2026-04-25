import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbTest } from '../analytics/analytics.entity';
import { Notification } from '../notifications/notification.entity';
import { AbTestService } from './ab-test.service';
import { AbTestController } from './ab-test.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscribersModule } from '../subscribers/subscribers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AbTest, Notification]),
    NotificationsModule,
    SubscribersModule,
  ],
  controllers: [AbTestController],
  providers: [AbTestService],
})
export class AbTestModule { }
