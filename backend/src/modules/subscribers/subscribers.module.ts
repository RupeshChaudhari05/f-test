import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscriber } from './subscriber.entity';
import { SubscribersService } from './subscribers.service';
import { SubscribersController } from './subscribers.controller';
import { Site } from '../sites/site.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Subscriber, Site])],
  controllers: [SubscribersController],
  providers: [SubscribersService],
  exports: [SubscribersService],
})
export class SubscribersModule { }
