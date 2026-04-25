import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, ForbiddenException, NotFoundException, ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SubscribersService } from './subscribers.service';
import { CurrentUser } from '../auth/decorators/auth.decorators';
import { User, UserRole } from '../users/user.entity';
import { Site } from '../sites/site.entity';
import { FilterSubscribersDto } from './dto/filter-subscribers.dto';

@ApiTags('Subscribers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('sites/:siteId/subscribers')
export class SubscribersController {
  constructor(
    private readonly subscribersService: SubscribersService,
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
  ) { }

  /** Verify the authenticated user owns this site (or is super_admin) */
  private async verifySiteOwnership(siteId: string, user: User): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;
    const site = await this.siteRepo.findOne({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');
    if (site.userId !== user.id) throw new ForbiddenException('Access denied');
  }

  @Get()
  @ApiOperation({ summary: 'List subscribers for a site' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    await this.verifySiteOwnership(siteId, user);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.subscribersService.findBySite(siteId, pageNum, limitNum, search);
  }

  @Post('filter')
  @ApiOperation({ summary: 'Filter subscribers' })
  async filter(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @CurrentUser() user: User,
    @Body() dto: FilterSubscribersDto,
  ) {
    await this.verifySiteOwnership(siteId, user);
    return this.subscribersService.filter(siteId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscriber details' })
  async findOne(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.verifySiteOwnership(siteId, user);
    return this.subscribersService.findById(id, siteId);
  }

  @Put(':id/tags')
  @ApiOperation({ summary: 'Add tags to subscriber' })
  async addTags(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body('tags') tags: string[],
  ) {
    await this.verifySiteOwnership(siteId, user);
    return this.subscribersService.addTags(id, siteId, tags);
  }

  @Delete(':id/tags')
  @ApiOperation({ summary: 'Remove tags from subscriber' })
  async removeTags(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body('tags') tags: string[],
  ) {
    await this.verifySiteOwnership(siteId, user);
    return this.subscribersService.removeTags(id, siteId, tags);
  }

  @Post(':id/unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe a subscriber' })
  async unsubscribe(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.verifySiteOwnership(siteId, user);
    return this.subscribersService.unsubscribe(id, siteId);
  }

  @Delete(':id/data')
  @ApiOperation({ summary: 'Delete subscriber data (GDPR)' })
  async deleteData(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.verifySiteOwnership(siteId, user);
    return this.subscribersService.deleteData(id, siteId);
  }
}
