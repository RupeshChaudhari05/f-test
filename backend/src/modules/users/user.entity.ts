import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Site } from '../sites/site.entity';

export enum UserRole {
  USER = 'user',
  ADMIN = 'client',
  SUPER_ADMIN = 'super_admin',
}

export enum UserPlan {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 20, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'varchar', length: 20, default: UserPlan.FREE })
  plan: UserPlan;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt: Date | null;

  @Column({ name: 'plan_expires_at', type: 'datetime', nullable: true })
  planExpiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Site, (site) => site.user)
  sites: Site[];
}
