import { IsOptional, IsString, IsArray, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterSubscribersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  browser?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  os?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}
