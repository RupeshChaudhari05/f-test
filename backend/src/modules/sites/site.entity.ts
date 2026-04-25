import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Subscriber } from '../subscribers/subscriber.entity';
import { Notification } from '../notifications/notification.entity';
import { Segment } from '../segments/segment.entity';
import { Automation } from '../automations/automation.entity';

@Entity('sites')
export class Site {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  name: string;

  @Column()
  domain: string;

  @Column({ name: 'api_key', unique: true })
  apiKey: string;

  @Column({ name: 'api_secret', unique: true, select: false })
  apiSecret: string;

  @Column({ name: 'vapid_public_key', nullable: true })
  vapidPublicKey: string;

  @Column({ name: 'vapid_private_key', nullable: true, select: false })
  vapidPrivateKey: string;

  @Column({ name: 'fcm_server_key', nullable: true, select: false })
  fcmServerKey: string;

  @Column({ name: 'fcm_project_id', nullable: true })
  fcmProjectId: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'simple-json', default: '{}' })
  settings: Record<string, any>;

  @Column({ name: 'widget_config', type: 'simple-json', default: '{}' })
  widgetConfig: Record<string, any>;

  @Column({ name: 'webhook_url', nullable: true })
  webhookUrl: string;

  @Column({ name: 'webhook_secret', nullable: true })
  webhookSecret: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.sites)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Subscriber, (sub) => sub.site)
  subscribers: Subscriber[];

  @OneToMany(() => Notification, (n) => n.site)
  notifications: Notification[];

  @OneToMany(() => Segment, (seg) => seg.site)
  segments: Segment[];

  @OneToMany(() => Automation, (auto) => auto.site)
  automations: Automation[];
}
