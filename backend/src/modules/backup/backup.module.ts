/**
 * BackupModule
 *
 * Registers the backup controller and service.
 * Imports Subscriber, Notification, and Automation repositories.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscriber } from '../subscribers/subscriber.entity';
import { Notification } from '../notifications/notification.entity';
import { Automation } from '../automations/automation.entity';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

@Module({
  imports: [TypeOrmModule.forFeature([Subscriber, Notification, Automation])],
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule { }
