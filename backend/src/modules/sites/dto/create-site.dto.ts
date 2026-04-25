import { IsString, IsUrl, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSiteDto {
  @ApiProperty({ example: 'My Blog' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'https://myblog.com' })
  @IsUrl({ require_tld: false })
  domain: string;

  @ApiPropertyOptional()
  @IsOptional()
  widgetConfig?: Record<string, any>;
}
