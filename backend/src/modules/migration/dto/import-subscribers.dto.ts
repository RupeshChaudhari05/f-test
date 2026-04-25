/**
 * DTOs for the Migration / Import module.
 *
 * Supports bulk import of subscribers exported from:
 *  - OneSignal (CSV / JSON)
 *  - Firebase Cloud Messaging (JSON)
 *  - Generic CSV (see GenericCsvImportDto)
 *
 * All imports are validated at the request boundary; downstream code may
 * assume the data is structurally correct.
 */

import {
  IsEnum,
  IsString,
  IsArray,
  IsOptional,
  IsObject,
  ArrayMinSize,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Supported source platforms */
export enum ImportSource {
  ONESIGNAL = 'onesignal',
  FIREBASE = 'firebase',
  GENERIC_CSV = 'generic_csv',
}

// ---------------------------------------------------------------------------
// OneSignal import
// ---------------------------------------------------------------------------

/**
 * A single subscriber row as exported from OneSignal's CSV export tool.
 * Only the push-subscription endpoint is mandatory; all geo / device fields
 * are optional because OneSignal does not always include them.
 */
export class OneSignalSubscriberRow {
  @ApiProperty({ example: 'https://fcm.googleapis.com/fcm/send/...' })
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @ApiPropertyOptional({ example: 'BNcR...' })
  @IsOptional()
  @IsString()
  p256dh?: string;

  @ApiPropertyOptional({ example: 'abc123' })
  @IsOptional()
  @IsString()
  auth?: string;

  @ApiPropertyOptional({ example: 'US' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Chrome' })
  @IsOptional()
  @IsString()
  browser?: string;

  @ApiPropertyOptional({ example: 'desktop' })
  @IsOptional()
  @IsString()
  deviceType?: string;
}

export class OneSignalImportDto {
  @ApiProperty({ isArray: true, type: () => OneSignalSubscriberRow })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OneSignalSubscriberRow)
  subscribers: OneSignalSubscriberRow[];

  /** Optional mapping of OneSignal tags → Posh tags */
  @ApiPropertyOptional({ example: { vip: 'vip', trial: 'trial' } })
  @IsOptional()
  @IsObject()
  tagMapping?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Firebase import
// ---------------------------------------------------------------------------

/**
 * A single token entry from a Firebase export (or manually collected FCM
 * registration tokens).
 */
export class FirebaseSubscriberRow {
  @ApiProperty({ description: 'FCM registration token', example: 'eX...' })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;

  @ApiPropertyOptional({ example: 'US' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Android' })
  @IsOptional()
  @IsString()
  os?: string;

  @ApiPropertyOptional({ example: 'mobile' })
  @IsOptional()
  @IsString()
  deviceType?: string;
}

export class FirebaseImportDto {
  @ApiProperty({ isArray: true, type: () => FirebaseSubscriberRow })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FirebaseSubscriberRow)
  tokens: FirebaseSubscriberRow[];
}

// ---------------------------------------------------------------------------
// Generic CSV import
// ---------------------------------------------------------------------------

/** Column map telling the importer which CSV header maps to which field. */
export class GenericCsvColumnMap {
  @ApiPropertyOptional({ example: 'Endpoint' })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional({ example: 'P256DH' })
  @IsOptional()
  @IsString()
  p256dh?: string;

  @ApiPropertyOptional({ example: 'Auth' })
  @IsOptional()
  @IsString()
  auth?: string;

  @ApiPropertyOptional({ example: 'FCM Token' })
  @IsOptional()
  @IsString()
  fcmToken?: string;

  @ApiPropertyOptional({ example: 'Country' })
  @IsOptional()
  @IsString()
  country?: string;
}

export class GenericCsvImportDto {
  /**
   * Raw CSV content as a UTF-8 string. The first line must be a header row.
   * Maximum accepted size: 5 MB (enforced by the controller).
   */
  @ApiProperty({ description: 'Raw CSV string with header row' })
  @IsString()
  @IsNotEmpty()
  csvContent: string;

  @ApiPropertyOptional({ type: () => GenericCsvColumnMap })
  @IsOptional()
  @ValidateNested()
  @Type(() => GenericCsvColumnMap)
  columnMap?: GenericCsvColumnMap;
}

// ---------------------------------------------------------------------------
// Generic response
// ---------------------------------------------------------------------------

export class ImportSourceDto {
  @ApiProperty({ enum: ImportSource })
  @IsEnum(ImportSource)
  source: ImportSource;
}
