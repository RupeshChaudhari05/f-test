import { Controller, Post, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) { }

  @Post('wordpress')
  @ApiOperation({ summary: 'WordPress webhook endpoint' })
  wordpress(
    @Headers('x-api-key') apiKey: string,
    @Headers('x-webhook-signature') signature: string,
    @Body() body: any,
  ) {
    return this.webhooksService.handleWordPressWebhook(apiKey, signature, body);
  }
}
