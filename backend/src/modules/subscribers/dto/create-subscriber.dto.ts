import {
  IsString, IsOptional, IsBoolean, IsArray, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubscriberDto {
  @ApiProperty()
  @IsString()
  endpoint: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  p256dh?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fcmToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  browser?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  browserVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  os?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  osVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  consentGranted?: boolean;
}
