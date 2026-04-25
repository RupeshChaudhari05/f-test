import {
  Controller, Get, Post, Put, Delete, Body, Param, UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AutomationsService } from './automations.service';
import { CreateAutomationDto } from './dto/create-automation.dto';

@ApiTags('Automations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('sites/:siteId/automations')
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) { }

  @Post()
  @ApiOperation({ summary: 'Create an automation' })
  create(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() dto: CreateAutomationDto,
  ) {
    return this.automationsService.create(siteId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List automations for a site' })
  findAll(@Param('siteId', ParseUUIDPipe) siteId: string) {
    return this.automationsService.findBySite(siteId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get automation details' })
  findOne(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.automationsService.findById(id, siteId);
  }

  @Put(':id/toggle')
  @ApiOperation({ summary: 'Toggle automation active/inactive' })
  toggle(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.automationsService.toggle(id, siteId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an automation' })
  delete(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.automationsService.delete(id, siteId);
  }
}
