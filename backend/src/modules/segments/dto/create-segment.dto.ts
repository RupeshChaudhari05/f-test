import { IsString, IsOptional, IsBoolean, IsArray, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSegmentDto {
  @ApiProperty({ example: 'US Mobile Users' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: [
      { field: 'country', operator: 'eq', value: 'US' },
      { field: 'deviceType', operator: 'eq', value: 'mobile' },
    ],
  })
  @IsOptional()
  @IsArray()
  rules?: Record<string, any>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAuto?: boolean;
}
