import {
  Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AbTestService } from './ab-test.service';

@ApiTags('A/B Tests')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('sites/:siteId/ab-tests')
export class AbTestController {
  constructor(private readonly abTestService: AbTestService) { }

  @Post()
  @ApiOperation({ summary: 'Create an A/B test' })
  create(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() body: any,
  ) {
    return this.abTestService.create(siteId, body);
  }

  @Get()
  @ApiOperation({ summary: 'List A/B tests for a site' })
  findAll(@Param('siteId', ParseUUIDPipe) siteId: string) {
    return this.abTestService.findBySite(siteId);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start an A/B test' })
  start(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.abTestService.start(id, siteId);
  }

  @Get(':id/results')
  @ApiOperation({ summary: 'Get A/B test results' })
  results(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.abTestService.getResults(id, siteId);
  }
}
