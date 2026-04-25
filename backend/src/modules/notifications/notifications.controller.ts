import {
  Controller, Get, Post, Body, Param, Query, UseGuards,
  ParseUUIDPipe, ForbiddenException, NotFoundException, ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { CurrentUser } from '../auth/decorators/auth.decorators';
import { User, UserRole } from '../users/user.entity';
import { Site } from '../sites/site.entity';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('sites/:siteId/notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
  ) { }

  private async verifySiteOwnership(siteId: string, user: User): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;
    const site = await this.siteRepo.findOne({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');
    if (site.userId !== user.id) throw new ForbiddenException('Access denied');
  }

  @Post()
  @ApiOperation({ summary: 'Create a notification draft' })
  async create(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateNotificationDto,
  ) {
    await this.verifySiteOwnership(siteId, user);
    return this.notificationsService.create(siteId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List notifications for a site' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.verifySiteOwnership(siteId, user);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.notificationsService.findBySite(siteId, pageNum, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification details' })
  async findOne(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.verifySiteOwnership(siteId, user);
    return this.notificationsService.findById(id, siteId);
  }

  @Post('send')
  @ApiOperation({ summary: 'Send a notification (immediate or scheduled)' })
  async send(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @CurrentUser() user: User,
    @Body() dto: SendNotificationDto,
  ) {
    await this.verifySiteOwnership(siteId, user);
    return this.notificationsService.send(siteId, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a scheduled notification' })
  async cancel(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.verifySiteOwnership(siteId, user);
    return this.notificationsService.cancel(id, siteId);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get notification delivery stats' })
  async getStats(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.verifySiteOwnership(siteId, user);
    return this.notificationsService.getDeliveryStats(id);
  }
}
