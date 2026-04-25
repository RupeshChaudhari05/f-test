import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Site } from '../sites/site.entity';

export enum NotificationStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENDING = 'sending',
  SENT = 'sent',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export enum TargetType {
  ALL = 'all',
  SEGMENT = 'segment',
  TAGS = 'tags',
  FILTER = 'filter',
  INDIVIDUAL = 'individual',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'site_id' })
  siteId: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'icon_url', nullable: true })
  iconUrl: string;

  @Column({ name: 'image_url', nullable: true })
  imageUrl: string;

  @Column({ name: 'badge_url', nullable: true })
  badgeUrl: string;

  @Column({ name: 'click_action', nullable: true })
  clickAction: string;

  @Column({ name: 'deep_link', type: 'simple-json', nullable: true })
  deepLink: Record<string, any>;

  @Column({ type: 'simple-json', default: '{}' })
  data: Record<string, any>;

  @Column({ type: 'varchar', length: 20, default: NotificationStatus.DRAFT })
  status: NotificationStatus;

  @Column({ name: 'scheduled_at', type: 'datetime', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'target_type', type: 'varchar', length: 20, default: TargetType.ALL })
  targetType: TargetType;

  @Column({ name: 'target_config', type: 'simple-json', default: '{}' })
  targetConfig: Record<string, any>;

  @Column({ name: 'timezone_aware', default: false })
  timezoneAware: boolean;

  @Column({ default: 86400 })
  ttl: number;

  @Column({ default: 'normal' })
  urgency: string;

  @Column({ name: 'ab_test_id', nullable: true })
  abTestId: string;

  @Column({ name: 'total_sent', default: 0 })
  totalSent: number;

  @Column({ name: 'total_delivered', default: 0 })
  totalDelivered: number;

  @Column({ name: 'total_clicked', default: 0 })
  totalClicked: number;

  @Column({ name: 'total_failed', default: 0 })
  totalFailed: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Site, (site) => site.notifications)
  @JoinColumn({ name: 'site_id' })
  site: Site;
}
