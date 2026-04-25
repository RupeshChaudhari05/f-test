import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Site } from '../sites/site.entity';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'site_id' })
  siteId: string;

  @Column({ name: 'subscriber_id', nullable: true })
  subscriberId: string;

  @Column({ name: 'event_type', length: 50 })
  eventType: string;

  @Column({ name: 'event_data', type: 'simple-json', default: '{}' })
  eventData: Record<string, any>;

  @Column({ name: 'page_url', nullable: true })
  pageUrl: string;

  @Column({ nullable: true })
  referrer: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Site)
  @JoinColumn({ name: 'site_id' })
  site: Site;
}

@Entity('analytics_daily')
export class AnalyticsDaily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'site_id' })
  siteId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'total_subscribers', default: 0 })
  totalSubscribers: number;

  @Column({ name: 'new_subscribers', default: 0 })
  newSubscribers: number;

  @Column({ default: 0 })
  unsubscribed: number;

  @Column({ name: 'notifications_sent', default: 0 })
  notificationsSent: number;

  @Column({ name: 'notifications_delivered', default: 0 })
  notificationsDelivered: number;

  @Column({ name: 'notifications_clicked', default: 0 })
  notificationsClicked: number;

  @Column({ name: 'notifications_failed', default: 0 })
  notificationsFailed: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  ctr: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Site)
  @JoinColumn({ name: 'site_id' })
  site: Site;
}

@Entity('click_events')
export class ClickEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notification_id' })
  notificationId: string;

  @Column({ name: 'subscriber_id', nullable: true })
  subscriberId: string;

  @Column({ name: 'click_url', nullable: true })
  clickUrl: string;

  @Column({ name: 'click_position', type: 'simple-json', nullable: true })
  clickPosition: Record<string, any>;

  @Column({ name: 'device_type', nullable: true, length: 20 })
  deviceType: string;

  @Column({ nullable: true, length: 3 })
  country: string;

  @CreateDateColumn({ name: 'clicked_at' })
  clickedAt: Date;
}

@Entity('ab_tests')
export class AbTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'site_id' })
  siteId: string;

  @Column()
  name: string;

  @Column({ default: 'draft' })
  status: string;

  @Column({ name: 'variant_a_id', nullable: true })
  variantAId: string;

  @Column({ name: 'variant_b_id', nullable: true })
  variantBId: string;

  @Column({ name: 'split_percentage', default: 50 })
  splitPercentage: number;

  @Column({ name: 'winner_metric', default: 'ctr' })
  winnerMetric: string;

  @Column({ name: 'winner_variant', nullable: true, length: 1 })
  winnerVariant: string;

  @Column({ name: 'sample_size', nullable: true })
  sampleSize: number;

  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Site)
  @JoinColumn({ name: 'site_id' })
  site: Site;
}
