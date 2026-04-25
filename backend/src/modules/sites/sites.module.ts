import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from './site.entity';
import { User } from '../users/user.entity';
import { SitesService } from './sites.service';
import { SitesController } from './sites.controller';
import { LicenseModule } from '../license/license.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Site, User]),
    LicenseModule,
  ],
  controllers: [SitesController],
  providers: [SitesService],
  exports: [SitesService, TypeOrmModule],
})
export class SitesModule { }
