import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Site } from '../sites/site.entity';
import { Subscriber } from '../subscribers/subscriber.entity';
import { Notification } from '../notifications/notification.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Site, Subscriber, Notification])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule { }
