import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Site } from '../sites/site.entity';

export enum AutomationType {
  WELCOME = 'welcome',
  NEW_POST = 'new_post',
  SCHEDULED = 'scheduled',
  DRIP = 'drip',
  EVENT_TRIGGERED = 'event_triggered',
  RSS_FEED = 'rss_feed',
  YOUTUBE_VIDEO = 'youtube_video',
}

@Entity('automations')
export class Automation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'site_id' })
  siteId: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 30 })
  type: AutomationType;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'trigger_config', type: 'simple-json', default: '{}' })
  triggerConfig: Record<string, any>;

  @Column({ name: 'notification_template', type: 'simple-json', default: '{}' })
  notificationTemplate: Record<string, any>;

  @Column({ name: 'target_config', type: 'simple-json', nullable: true })
  targetConfig: Record<string, any>;

  @Column({ name: 'delay_seconds', default: 0 })
  delaySeconds: number;

  @Column({ name: 'last_triggered_at', type: 'datetime', nullable: true })
  lastTriggeredAt: Date | null;

  @Column({ name: 'total_triggered', default: 0 })
  totalTriggered: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Site, (site) => site.automations)
  @JoinColumn({ name: 'site_id' })
  site: Site;

  @OneToMany(() => DripStep, (step) => step.automation)
  dripSteps: DripStep[];
}

@Entity('drip_steps')
export class DripStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'automation_id' })
  automationId: string;

  @Column({ name: 'step_order' })
  stepOrder: number;

  @Column({ name: 'delay_seconds', default: 0 })
  delaySeconds: number;

  @Column({ name: 'notification_template', type: 'simple-json', default: '{}' })
  notificationTemplate: Record<string, any>;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Automation, (auto) => auto.dripSteps)
  @JoinColumn({ name: 'automation_id' })
  automation: Automation;
}

@Entity('drip_enrollments')
export class DripEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'automation_id' })
  automationId: string;

  @Column({ name: 'subscriber_id' })
  subscriberId: string;

  @Column({ name: 'current_step', default: 0 })
  currentStep: number;

  @Column({ default: 'active' })
  status: string;

  @Column({ name: 'next_step_at', type: 'datetime', nullable: true })
  nextStepAt: Date | null;

  @Column({ name: 'enrolled_at', type: 'datetime', nullable: true })
  enrolledAt: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;
}
