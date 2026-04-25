import { Injectable } from '@nestjs/common';
import { UserPlan } from '../users/user.entity';

@Injectable()
export class LicenseService {
  private readonly planLimits = {
    [UserPlan.FREE]: {
      maxSites: 1,
      maxSubscribers: 1000,
      maxNotifications: 100,
      features: ['basic_notifications', 'web_widget'],
    },
    [UserPlan.STARTER]: {
      maxSites: 3,
      maxSubscribers: 10000,
      maxNotifications: 1000,
      features: ['basic_notifications', 'web_widget', 'segments', 'automations'],
    },
    [UserPlan.PRO]: {
      maxSites: 10,
      maxSubscribers: 100000,
      maxNotifications: 10000,
      features: ['basic_notifications', 'web_widget', 'segments', 'automations', 'ab_testing', 'analytics'],
    },
    [UserPlan.ENTERPRISE]: {
      maxSites: -1, // unlimited
      maxSubscribers: -1, // unlimited
      maxNotifications: -1, // unlimited
      features: ['basic_notifications', 'web_widget', 'segments', 'automations', 'ab_testing', 'analytics', 'white_label', 'api_access'],
    },
  };

  getPlanLimits(plan: UserPlan) {
    return this.planLimits[plan] || this.planLimits[UserPlan.FREE];
  }

  canCreateSite(userPlan: UserPlan, currentSiteCount: number): boolean {
    const limits = this.getPlanLimits(userPlan);
    return limits.maxSites === -1 || currentSiteCount < limits.maxSites;
  }

  canSendNotification(userPlan: UserPlan, currentNotificationCount: number): boolean {
    const limits = this.getPlanLimits(userPlan);
    return limits.maxNotifications === -1 || currentNotificationCount < limits.maxNotifications;
  }

  hasFeature(userPlan: UserPlan, feature: string): boolean {
    const limits = this.getPlanLimits(userPlan);
    return limits.features.includes(feature);
  }

  getRemainingSites(userPlan: UserPlan, currentSiteCount: number): number {
    const limits = this.getPlanLimits(userPlan);
    if (limits.maxSites === -1) return -1; // unlimited
    return Math.max(0, limits.maxSites - currentSiteCount);
  }

  getRemainingNotifications(userPlan: UserPlan, currentNotificationCount: number): number {
    const limits = this.getPlanLimits(userPlan);
    if (limits.maxNotifications === -1) return -1; // unlimited
    return Math.max(0, limits.maxNotifications - currentNotificationCount);
  }
}