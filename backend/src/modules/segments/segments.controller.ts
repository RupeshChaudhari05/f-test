import {
  Controller, Get, Post, Delete, Body, Param, UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SegmentsService } from './segments.service';
import { CreateSegmentDto } from './dto/create-segment.dto';

@ApiTags('Segments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('sites/:siteId/segments')
export class SegmentsController {
  constructor(private readonly segmentsService: SegmentsService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new segment' })
  create(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() dto: CreateSegmentDto,
  ) {
    return this.segmentsService.create(siteId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all segments for a site' })
  findAll(@Param('siteId', ParseUUIDPipe) siteId: string) {
    return this.segmentsService.findBySite(siteId);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'AI-suggested segments based on subscriber data' })
  suggest(@Param('siteId', ParseUUIDPipe) siteId: string) {
    return this.segmentsService.suggestSegments(siteId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get segment details' })
  findOne(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.segmentsService.findById(id, siteId);
  }

  @Get(':id/subscribers')
  @ApiOperation({ summary: 'Get subscribers in a segment' })
  getSubscribers(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.segmentsService.getSubscribers(id, siteId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a segment' })
  delete(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.segmentsService.delete(id, siteId);
  }
}
