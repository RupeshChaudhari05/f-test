import { IsOptional, IsString, IsObject, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWidgetConfigDto {
  @ApiPropertyOptional({
    example: { color: '#4F46E5', size: 'medium', position: 'bottom-right' },
  })
  @IsOptional()
  @IsObject()
  buttonStyle?: {
    color?: string;
    size?: 'small' | 'medium' | 'large';
    position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  };

  @ApiPropertyOptional({ enum: ['bell', 'slide', 'modal'] })
  @IsOptional()
  @IsString()
  promptType?: 'bell' | 'slide' | 'modal';

  @ApiPropertyOptional({
    example: { type: 'delay', value: 5 },
  })
  @IsOptional()
  @IsObject()
  triggerRules?: {
    type: 'delay' | 'scroll' | 'exit_intent';
    value?: number;
  };

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  consentBanner?: {
    enabled?: boolean;
    text?: string;
  };
}
