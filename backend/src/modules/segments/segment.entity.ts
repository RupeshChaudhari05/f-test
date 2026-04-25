import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Site } from '../sites/site.entity';

@Entity('segments')
export class Segment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'site_id' })
  siteId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'simple-json', default: '[]' })
  rules: Record<string, any>[];

  @Column({ name: 'is_auto', default: false })
  isAuto: boolean;

  @Column({ name: 'subscriber_count', default: 0 })
  subscriberCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Site, (site) => site.segments)
  @JoinColumn({ name: 'site_id' })
  site: Site;
}
