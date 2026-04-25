import {
  Controller, Get, Post, Delete, Body, Param, Headers,
  Req, Ip, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { SdkService } from './sdk.service';

@ApiTags('SDK API')
@ApiHeader({ name: 'x-api-key', required: true })
@Controller('sdk')
export class SdkController {
  constructor(private readonly sdkService: SdkService) { }

  @Get('config')
  @ApiOperation({ summary: 'Get site configuration for SDK initialization' })
  getConfig(@Headers('x-api-key') apiKey: string) {
    return this.sdkService.getSiteConfig(apiKey);
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Register a new push subscriber' })
  subscribe(
    @Headers('x-api-key') apiKey: string,
    @Body() body: any,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] || '';
    return this.sdkService.subscribe(apiKey, body, ip, userAgent);
  }

  @Post('unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from push notifications' })
  unsubscribe(
    @Headers('x-api-key') apiKey: string,
    @Body('subscriberId') subscriberId: string,
  ) {
    return this.sdkService.unsubscribe(apiKey, subscriberId);
  }

  @Post('tag')
  @ApiOperation({ summary: 'Add tags to a subscriber' })
  tagUser(
    @Headers('x-api-key') apiKey: string,
    @Body('subscriberId') subscriberId: string,
    @Body('tags') tags: string[],
  ) {
    return this.sdkService.tagUser(apiKey, subscriberId, tags);
  }

  @Post('event')
  @ApiOperation({ summary: 'Track a subscriber event' })
  trackEvent(
    @Headers('x-api-key') apiKey: string,
    @Body() body: any,
  ) {
    return this.sdkService.trackEvent(apiKey, body);
  }

  @Post('delivery')
  @ApiOperation({ summary: 'Track notification delivery/click' })
  trackDelivery(
    @Headers('x-api-key') apiKey: string,
    @Body() body: any,
  ) {
    return this.sdkService.trackDelivery(apiKey, body);
  }

  @Delete('subscriber/:id/data')
  @ApiOperation({ summary: 'Delete subscriber data (GDPR)' })
  deleteData(
    @Headers('x-api-key') apiKey: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sdkService.deleteSubscriberData(apiKey, id);
  }

  @Post('notify')
  @ApiOperation({ summary: 'Send a push notification to all subscribers (API key auth)' })
  notify(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { title: string; message: string; url?: string; iconUrl?: string },
  ) {
    return this.sdkService.sendNotification(apiKey, body);
  }

  @Post('test-notification')
  @ApiOperation({ summary: 'Send a test notification (for WordPress plugin testing)' })
  testNotification(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { title: string; body: string; url?: string; test?: boolean; target?: string },
  ) {
    return this.sdkService.sendTestNotification(apiKey, body);
  }
}
