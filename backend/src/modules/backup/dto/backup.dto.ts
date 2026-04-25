/**
 * Backup DTOs
 *
 * Defines the request/response shapes for the backup and restore endpoints.
 * Supports three cloud storage destinations:
 *  - Google Drive (via service-account credentials)
 *  - Dropbox (via OAuth2 access token)
 *  - AWS S3 (via access-key + secret)
 *
 * Local backups (returned as a downloadable JSON blob) require no credentials.
 */

import {
  IsEnum,
  IsOptional,
  IsString,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BackupDestination {
  LOCAL = 'local',
  GOOGLE_DRIVE = 'google_drive',
  DROPBOX = 'dropbox',
  AWS_S3 = 'aws_s3',
}

// ---------------------------------------------------------------------------
// Cloud-provider credential sub-DTOs
// ---------------------------------------------------------------------------

export class GoogleDriveCredentials {
  @ApiProperty({ description: 'Google Service Account JSON key as a string' })
  @IsString()
  @IsNotEmpty()
  serviceAccountJson: string;

  @ApiPropertyOptional({ description: 'Specific folder ID to upload into' })
  @IsOptional()
  @IsString()
  folderId?: string;
}

export class DropboxCredentials {
  @ApiProperty({ description: 'Dropbox OAuth2 access token' })
  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @ApiPropertyOptional({ description: 'Dropbox upload path, e.g. /backups', example: '/posh-backups' })
  @IsOptional()
  @IsString()
  uploadPath?: string;
}

export class AwsS3Credentials {
  @ApiProperty({ description: 'AWS Access Key ID' })
  @IsString()
  @IsNotEmpty()
  accessKeyId: string;

  @ApiProperty({ description: 'AWS Secret Access Key' })
  @IsString()
  @IsNotEmpty()
  secretAccessKey: string;

  @ApiProperty({ description: 'S3 bucket name' })
  @IsString()
  @IsNotEmpty()
  bucket: string;

  @ApiPropertyOptional({ description: 'AWS region', example: 'us-east-1' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ description: 'Key prefix (folder path)', example: 'posh-backups/' })
  @IsOptional()
  @IsString()
  prefix?: string;
}

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

export class CreateBackupDto {
  @ApiProperty({ enum: BackupDestination, example: BackupDestination.LOCAL })
  @IsEnum(BackupDestination)
  destination: BackupDestination;

  @ApiPropertyOptional({ type: () => GoogleDriveCredentials })
  @IsOptional()
  @ValidateNested()
  @Type(() => GoogleDriveCredentials)
  googleDrive?: GoogleDriveCredentials;

  @ApiPropertyOptional({ type: () => DropboxCredentials })
  @IsOptional()
  @ValidateNested()
  @Type(() => DropboxCredentials)
  dropbox?: DropboxCredentials;

  @ApiPropertyOptional({ type: () => AwsS3Credentials })
  @IsOptional()
  @ValidateNested()
  @Type(() => AwsS3Credentials)
  awsS3?: AwsS3Credentials;
}

export class RestoreBackupDto {
  /**
   * JSON backup data previously produced by this system.
   * The object must contain at minimum a `version` and `data` key.
   */
  @ApiProperty({ description: 'JSON backup object produced by a previous backup run' })
  @IsNotEmpty()
  backupData: Record<string, any>;
}
