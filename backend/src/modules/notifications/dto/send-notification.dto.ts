import { IsOptional, IsString, IsDateString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateNotificationDto } from './create-notification.dto';

export class SendNotificationDto extends CreateNotificationDto {
  @ApiPropertyOptional({ description: 'Existing notification ID to send' })
  @IsOptional()
  @IsUUID()
  notificationId?: string;

  @ApiPropertyOptional({ description: 'Schedule time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
