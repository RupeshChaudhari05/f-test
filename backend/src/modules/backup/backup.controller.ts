/**
 * BackupController
 *
 * Exposes REST endpoints for creating and restoring data backups.
 *
 * Base path: /api/v1/sites/:siteId/backup
 *
 * POST /backup      – Create a new backup and send to chosen destination.
 * POST /restore     – Restore site data from a previously created backup JSON.
 */

import {
  Controller,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { BackupService } from './backup.service';
import { CreateBackupDto, RestoreBackupDto } from './dto/backup.dto';

@ApiTags('Backup & Restore')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('sites/:siteId/backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) { }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create a site backup',
    description:
      'Exports all subscribers, notifications, and automations for the site ' +
      'and sends the result to the chosen storage destination.',
  })
  @ApiParam({ name: 'siteId', description: 'Target site UUID' })
  @ApiResponse({ status: 200, description: 'Backup result including remote URL / data blob' })
  @ApiResponse({ status: 400, description: 'Missing or invalid credentials' })
  async createBackup(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() dto: CreateBackupDto,
  ) {
    return this.backupService.createBackup(siteId, dto);
  }

  @Post('restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restore a site from a backup',
    description:
      'Accepts a JSON backup object previously created by the backup endpoint ' +
      'and restores any missing subscribers, notifications, and automations.',
  })
  @ApiParam({ name: 'siteId', description: 'Target site UUID' })
  @ApiResponse({ status: 200, description: 'Counts of restored records per entity type' })
  @ApiResponse({ status: 400, description: 'Invalid backup format or version mismatch' })
  async restoreBackup(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() dto: RestoreBackupDto,
  ) {
    return this.backupService.restoreBackup(siteId, dto.backupData);
  }
}
