/**
 * MigrationModule
 *
 * Registers the migration controller and service.
 * Imports the Subscriber TypeORM repository so the service can read/write it.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscriber } from '../subscribers/subscriber.entity';
import { MigrationController } from './migration.controller';
import { MigrationService } from './migration.service';

@Module({
  imports: [TypeOrmModule.forFeature([Subscriber])],
  controllers: [MigrationController],
  providers: [MigrationService],
  exports: [MigrationService],
})
export class MigrationModule { }
