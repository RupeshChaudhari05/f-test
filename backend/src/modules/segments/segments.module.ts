import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Segment } from './segment.entity';
import { Subscriber } from '../subscribers/subscriber.entity';
import { SegmentsService } from './segments.service';
import { SegmentsController } from './segments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Segment, Subscriber])],
  controllers: [SegmentsController],
  providers: [SegmentsService],
  exports: [SegmentsService],
})
export class SegmentsModule { }
