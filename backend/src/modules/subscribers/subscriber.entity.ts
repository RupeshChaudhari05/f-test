import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Site } from '../sites/site.entity';

export enum ConsentStatus {
  PENDING = 'pending',
  GRANTED = 'granted',
  DENIED = 'denied',
  REVOKED = 'revoked',
}

@Entity('subscribers')
export class Subscriber {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'site_id' })
  siteId: string;

  @Column({ type: 'varchar', length: 500 })
  endpoint: string;

  @Column({ nullable: true })
  p256dh: string;

  @Column({ name: 'auth_key', nullable: true })
  authKey: string;

  @Column({ name: 'fcm_token', nullable: true })
  fcmToken: string;

  @Column({ nullable: true, length: 50 })
  browser: string;

  @Column({ name: 'browser_version', nullable: true, length: 20 })
  browserVersion: string;

  @Column({ nullable: true, length: 50 })
  os: string;

  @Column({ name: 'os_version', nullable: true, length: 20 })
  osVersion: string;

  @Column({ name: 'device_type', default: 'desktop', length: 20 })
  deviceType: string;

  @Column({ nullable: true, length: 3 })
  country: string;

  @Column({ nullable: true, length: 100 })
  city: string;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true, length: 45 })
  ipAddress: string | null;

  @Column({ nullable: true, length: 50 })
  timezone: string;

  @Column({ nullable: true, length: 10 })
  language: string;

  @Column({ type: 'simple-json', default: '[]' })
  tags: string[];

  @Column({ name: 'custom_data', type: 'simple-json', default: '{}' })
  customData: Record<string, any>;

  @Column({
    name: 'consent_status',
    type: 'varchar',
    length: 20,
    default: ConsentStatus.PENDING,
  })
  consentStatus: ConsentStatus;

  @Column({ name: 'consent_timestamp', type: 'datetime', nullable: true })
  consentTimestamp: Date | null;

  @Column({ name: 'consent_ip', type: 'varchar', nullable: true, length: 45 })
  consentIp: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_seen_at', type: 'datetime', nullable: true })
  lastSeenAt: Date | null;

  @Column({ name: 'subscribed_at', type: 'datetime', nullable: true })
  subscribedAt: Date;

  @Column({ name: 'unsubscribed_at', type: 'datetime', nullable: true })
  unsubscribedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Site, (site) => site.subscribers)
  @JoinColumn({ name: 'site_id' })
  site: Site;
}
