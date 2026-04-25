import {
  IsString, IsOptional, IsObject, IsBoolean, IsNumber,
  IsEnum, MaxLength, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TargetType } from '../notification.entity';

export class CreateNotificationDto {
  @ApiProperty({ example: 'New Blog Post!' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'Check out our latest article on web push notifications.' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ example: 'https://example.com/icon.png' })
  @IsOptional()
  @IsString()
  iconUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/badge.png' })
  @IsOptional()
  @IsString()
  badgeUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/post/123' })
  @IsOptional()
  @IsString()
  clickAction?: string;

  @ApiPropertyOptional({ example: { type: 'post', id: '123', url: '/post/123' } })
  @IsOptional()
  @IsObject()
  deepLink?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional({ enum: TargetType })
  @IsOptional()
  @IsEnum(TargetType)
  targetType?: TargetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  targetConfig?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  timezoneAware?: boolean;

  @ApiPropertyOptional({ example: 86400 })
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(2419200)
  ttl?: number;

  @ApiPropertyOptional({ enum: ['very-low', 'low', 'normal', 'high'] })
  @IsOptional()
  @IsString()
  urgency?: string;
}
