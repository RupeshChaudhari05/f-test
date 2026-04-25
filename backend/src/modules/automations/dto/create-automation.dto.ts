import {
  IsString, IsOptional, IsEnum, IsNumber, IsArray, IsObject,
  MaxLength, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AutomationType } from '../automation.entity';

export class DripStepDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  delaySeconds: number;

  @ApiProperty()
  @IsObject()
  notificationTemplate: Record<string, any>;
}

export class CreateAutomationDto {
  @ApiProperty({ example: 'Welcome Series' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ enum: AutomationType })
  @IsEnum(AutomationType)
  type: AutomationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  triggerConfig?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  notificationTemplate?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  targetConfig?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  delaySeconds?: number;

  @ApiPropertyOptional({ type: [DripStepDto] })
  @IsOptional()
  @IsArray()
  dripSteps?: DripStepDto[];
}
