import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Notification } from './notification.entity';
import { Subscriber } from '../subscribers/subscriber.entity';

export enum DeliveryStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  CLICKED = 'clicked',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

@Entity('notification_deliveries')
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notification_id' })
  notificationId: string;

  @Column({ name: 'subscriber_id' })
  subscriberId: string;

  @Column({ type: 'varchar', length: 20, default: DeliveryStatus.PENDING })
  status: DeliveryStatus;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'delivered_at', type: 'datetime', nullable: true })
  deliveredAt: Date | null;

  @Column({ name: 'clicked_at', type: 'datetime', nullable: true })
  clickedAt: Date | null;

  @Column({ name: 'failed_reason', nullable: true })
  failedReason: string;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Notification)
  @JoinColumn({ name: 'notification_id' })
  notification: Notification;

  @ManyToOne(() => Subscriber)
  @JoinColumn({ name: 'subscriber_id' })
  subscriber: Subscriber;
}
