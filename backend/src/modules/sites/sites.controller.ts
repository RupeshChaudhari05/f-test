import {
  Controller, Get, Post, Put, Delete, Body, Param, UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SitesService } from './sites.service';
import { CurrentUser } from '../auth/decorators/auth.decorators';
import { User } from '../users/user.entity';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { UpdateWidgetConfigDto } from './dto/update-widget-config.dto';

@ApiTags('Sites')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('sites')
export class SitesController {
  constructor(private readonly sitesService: SitesService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new site' })
  create(@CurrentUser() user: User, @Body() dto: CreateSiteDto) {
    return this.sitesService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all sites for current user' })
  findAll(@CurrentUser() user: User) {
    return this.sitesService.findAllByUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get site details' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.sitesService.findById(id, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update site settings' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateSiteDto,
  ) {
    return this.sitesService.update(id, user.id, dto);
  }

  @Put(':id/widget-config')
  @ApiOperation({ summary: 'Update site widget configuration' })
  updateWidgetConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateWidgetConfigDto,
  ) {
    return this.sitesService.updateWidgetConfig(id, user.id, dto);
  }

  @Post(':id/regenerate-key')
  @ApiOperation({ summary: 'Regenerate API key for a site' })
  regenerateKey(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.sitesService.regenerateApiKey(id, user.id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get site statistics' })
  getStats(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.sitesService.getStats(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a site' })
  delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.sitesService.delete(id, user.id);
  }
}
