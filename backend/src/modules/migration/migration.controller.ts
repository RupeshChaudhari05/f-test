/**
 * MigrationController
 *
 * REST endpoints for bulk-importing subscribers from external platforms.
 *
 * Base path: /api/v1/sites/:siteId/migration
 *
 * All routes:
 *  - Require a valid JWT bearer token.
 *  - Are rate-limited (see ThrottlerGuard in AppModule).
 *  - Accept JSON bodies validated by class-validator DTOs.
 *  - Return a structured ImportReport.
 *
 * CSV upload endpoint accepts the raw CSV as a JSON string field to avoid
 * multipart complexity.  For large files, clients should split into batches
 * of ≤ 50 000 rows.
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
  PayloadTooLargeException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { MigrationService } from './migration.service';
import {
  OneSignalImportDto,
  FirebaseImportDto,
  GenericCsvImportDto,
} from './dto/import-subscribers.dto';

/** Maximum allowed CSV body size: 5 MB */
const MAX_CSV_BYTES = 5 * 1024 * 1024;

@ApiTags('Migration')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('sites/:siteId/migration')
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) { }

  // ---------------------------------------------------------------------------
  // OneSignal
  // ---------------------------------------------------------------------------

  @Post('onesignal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Import subscribers from OneSignal',
    description:
      'Accepts an array of OneSignal subscriber objects (exported via their CSV or API) ' +
      'and imports them as Posh subscribers.  Duplicate endpoints are skipped.',
  })
  @ApiParam({ name: 'siteId', description: 'Target site UUID' })
  @ApiResponse({ status: 200, description: 'Import report with counts' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async importOneSignal(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() dto: OneSignalImportDto,
  ) {
    return this.migrationService.importFromOneSignal(siteId, dto);
  }

  // ---------------------------------------------------------------------------
  // Firebase
  // ---------------------------------------------------------------------------

  @Post('firebase')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Import FCM tokens from Firebase',
    description:
      'Accepts an array of Firebase registration tokens and registers them as ' +
      'FCM-capable subscribers.  Duplicate tokens are skipped.',
  })
  @ApiParam({ name: 'siteId', description: 'Target site UUID' })
  @ApiResponse({ status: 200, description: 'Import report with counts' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async importFirebase(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() dto: FirebaseImportDto,
  ) {
    return this.migrationService.importFromFirebase(siteId, dto);
  }

  // ---------------------------------------------------------------------------
  // Generic CSV
  // ---------------------------------------------------------------------------

  @Post('csv')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Import subscribers from a generic CSV',
    description:
      'Accepts raw CSV content (as a JSON string field) with a customisable ' +
      'column mapping.  The first row must be a header row.  Max size: 5 MB.',
  })
  @ApiParam({ name: 'siteId', description: 'Target site UUID' })
  @ApiResponse({ status: 200, description: 'Import report with counts' })
  @ApiResponse({ status: 400, description: 'CSV parse error or validation error' })
  @ApiResponse({ status: 413, description: 'CSV content exceeds 5 MB limit' })
  async importCsv(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() dto: GenericCsvImportDto,
  ) {
    // Guard against oversized payloads (belt-and-suspenders; Nginx also limits body size)
    if (Buffer.byteLength(dto.csvContent, 'utf8') > MAX_CSV_BYTES) {
      throw new PayloadTooLargeException('CSV content exceeds the 5 MB limit.');
    }

    return this.migrationService.importFromCsv(siteId, dto);
  }
}
