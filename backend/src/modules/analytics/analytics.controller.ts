import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('sites/:siteId/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) { }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get analytics dashboard data' })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  getDashboard(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Query('days') days?: number,
  ) {
    return this.analyticsService.getDashboard(siteId, days || 30);
  }

  @Get('top-notifications')
  @ApiOperation({ summary: 'Get top performing notifications' })
  getTopNotifications(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Query('limit') limit?: number,
  ) {
    return this.analyticsService.getTopNotifications(siteId, limit);
  }

  @Get('heatmap/:notificationId')
  @ApiOperation({ summary: 'Get click heatmap for a notification' })
  getHeatmap(@Param('notificationId', ParseUUIDPipe) notificationId: string) {
    return this.analyticsService.getClickHeatmap(notificationId);
  }

  /** Geographic breakdown – subscribers per country */
  @Get('geo')
  @ApiOperation({ summary: 'Get geographic subscriber breakdown by country' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  getGeoBreakdown(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Query('limit') limit?: number,
  ) {
    return this.analyticsService.getGeoBreakdown(siteId, limit || 20);
  }

  /** Device-type breakdown (desktop / mobile / tablet) */
  @Get('devices')
  @ApiOperation({ summary: 'Get subscriber breakdown by device type' })
  getDeviceBreakdown(@Param('siteId', ParseUUIDPipe) siteId: string) {
    return this.analyticsService.getDeviceBreakdown(siteId);
  }

  /** Browser breakdown */
  @Get('browsers')
  @ApiOperation({ summary: 'Get subscriber breakdown by browser' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  getBrowserBreakdown(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Query('limit') limit?: number,
  ) {
    return this.analyticsService.getBrowserBreakdown(siteId, limit || 10);
  }

  /** OS breakdown */
  @Get('os')
  @ApiOperation({ summary: 'Get subscriber breakdown by operating system' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  getOsBreakdown(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Query('limit') limit?: number,
  ) {
    return this.analyticsService.getOsBreakdown(siteId, limit || 10);
  }

  /** Daily subscriber growth over the last N days */
  @Get('growth')
  @ApiOperation({ summary: 'Get daily subscriber growth trend' })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  getSubscriberGrowth(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Query('days') days?: number,
  ) {
    return this.analyticsService.getSubscriberGrowth(siteId, days || 30);
  }
}

