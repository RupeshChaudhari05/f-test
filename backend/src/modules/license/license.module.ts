import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LicenseService } from './license.service';
import { LicenseController } from './license.controller';
import { UsersModule } from '../users/users.module';
import { Site } from '../sites/site.entity';
import { Notification } from '../notifications/notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Site, Notification]),
    UsersModule,
  ],
  controllers: [LicenseController],
  providers: [LicenseService],
  exports: [LicenseService],
})
export class LicenseModule { }