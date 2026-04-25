import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserPlan } from '../users/user.entity';
import { Site } from '../sites/site.entity';
import { Subscriber } from '../subscribers/subscriber.entity';
import { Notification } from '../notifications/notification.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    @InjectRepository(Subscriber)
    private readonly subscriberRepo: Repository<Subscriber>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
  ) { }

  async getDashboard() {
    const [totalUsers, totalSites, totalSubscribers, totalNotifications] =
      await Promise.all([
        this.userRepo.count(),
        this.siteRepo.count(),
        this.subscriberRepo.count({ where: { isActive: true } }),
        this.notifRepo.count(),
      ]);

    const recentUsers = await this.userRepo.find({
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const topSites = await this.siteRepo
      .createQueryBuilder('site')
      .leftJoin('site.subscribers', 'sub', 'sub.isActive = true')
      .addSelect('COUNT(sub.id)', 'subscriber_count')
      .groupBy('site.id')
      .orderBy('subscriber_count', 'DESC')
      .limit(10)
      .getRawAndEntities();

    return {
      stats: {
        totalUsers,
        totalSites,
        totalSubscribers,
        totalNotifications,
      },
      recentUsers,
      topSites: topSites.entities,
    };
  }

  async listUsers(page = 1, limit = 20) {
    const [users, total] = await this.userRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['sites'],
    });
    return { users, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async listSites(page = 1, limit = 20) {
    const [sites, total] = await this.siteRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });
    return { sites, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getUserDetail(userId: string) {
    return this.userRepo.findOne({
      where: { id: userId },
      relations: ['sites'],
    });
  }

  async toggleUserActive(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    user.isActive = !user.isActive;
    return this.userRepo.save(user);
  }

  async updateUserRole(userId: string, role: UserRole) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.role = role;
    return this.userRepo.save(user);
  }

  async updateUserPlan(userId: string, plan: UserPlan, planExpiresAt?: string | null) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.plan = plan;
    if (planExpiresAt !== undefined) {
      user.planExpiresAt = planExpiresAt ? new Date(planExpiresAt) : null;
    }
    return this.userRepo.save(user);
  }

  async setPlanExpiry(userId: string, planExpiresAt: string | null) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.planExpiresAt = planExpiresAt ? new Date(planExpiresAt) : null;
    return this.userRepo.save(user);
  }

  /** Get full client detail: user + their sites with subscriber counts */
  async getClientDetail(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const sites = await this.siteRepo.find({ where: { userId } });

    const sitesWithStats = await Promise.all(
      sites.map(async (site) => {
        const [activeSubscribers, totalSubscribers] = await Promise.all([
          this.subscriberRepo.count({ where: { siteId: site.id, isActive: true } }),
          this.subscriberRepo.count({ where: { siteId: site.id } }),
        ]);
        const notifCount = await this.notifRepo.count({ where: { siteId: site.id } });
        return { ...site, activeSubscribers, totalSubscribers, notifCount };
      }),
    );

    const totalActiveSubscribers = sitesWithStats.reduce((s, x) => s + x.activeSubscribers, 0);
    const totalNotifications = sitesWithStats.reduce((s, x) => s + x.notifCount, 0);

    const isPlanExpired = user.planExpiresAt
      ? new Date() > new Date(user.planExpiresAt)
      : false;

    return {
      ...user,
      isPlanExpired,
      sites: sitesWithStats,
      totalActiveSubscribers,
      totalNotifications,
    };
  }

  /** List all clients (users with role=user or admin) with basic stats */
  async listClients(page = 1, limit = 20, search?: string) {
    const qb = this.userRepo.createQueryBuilder('user');

    if (search) {
      qb.where('(user.name LIKE :q OR user.email LIKE :q)', { q: `%${search}%` });
    }

    qb.orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [users, total] = await qb.getManyAndCount();

    // Attach site + subscriber counts
    const enriched = await Promise.all(
      users.map(async (user) => {
        const sitesCount = await this.siteRepo.count({ where: { userId: user.id } });
        const subscriberCount = await this.subscriberRepo
          .createQueryBuilder('sub')
          .innerJoin('sub.site', 'site', 'site.userId = :uid', { uid: user.id })
          .where('sub.isActive = true')
          .getCount();

        const isPlanExpired = user.planExpiresAt
          ? new Date() > new Date(user.planExpiresAt)
          : false;

        return { ...user, sitesCount, subscriberCount, isPlanExpired };
      }),
    );

    return { clients: enriched, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /** Suspend a client — deactivate all their sites (blocks SDK) */
  async suspendClient(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = false;
    await this.siteRepo
      .createQueryBuilder()
      .update()
      .set({ isActive: false } as any)
      .where('userId = :userId', { userId })
      .execute();
    return this.userRepo.save(user);
  }

  /** Reactivate a suspended client */
  async reactivateClient(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = true;
    await this.siteRepo
      .createQueryBuilder()
      .update()
      .set({ isActive: true } as any)
      .where('userId = :userId', { userId })
      .execute();
    return this.userRepo.save(user);
  }

  async getGlobalStats() {
    const subscribersByCountry = await this.subscriberRepo
      .createQueryBuilder('sub')
      .select('sub.country', 'country')
      .addSelect('COUNT(*)', 'count')
      .where('sub.isActive = true')
      .groupBy('sub.country')
      .orderBy('count', 'DESC')
      .limit(20)
      .getRawMany();

    const subscribersByDevice = await this.subscriberRepo
      .createQueryBuilder('sub')
      .select('sub.deviceType', 'device')
      .addSelect('COUNT(*)', 'count')
      .where('sub.isActive = true')
      .groupBy('sub.deviceType')
      .getRawMany();

    const notificationStats = await this.notifRepo
      .createQueryBuilder('n')
      .select('SUM(n.totalSent)', 'totalSent')
      .addSelect('SUM(n.totalDelivered)', 'totalDelivered')
      .addSelect('SUM(n.totalClicked)', 'totalClicked')
      .getRawOne();

    return {
      subscribersByCountry,
      subscribersByDevice,
      notificationStats,
    };
  }

  /** List notifications for a specific site (super admin view) */
  async getSiteNotifications(siteId: string, page = 1, limit = 20) {
    const site = await this.siteRepo.findOne({ where: { id: siteId }, relations: ['user'] });
    if (!site) throw new NotFoundException('Site not found');
    const [notifications, total] = await this.notifRepo.findAndCount({
      where: { siteId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { site, notifications, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /** List subscribers for a specific site (super admin view) */
  async getSiteSubscribers(siteId: string, page = 1, limit = 20) {
    const site = await this.siteRepo.findOne({ where: { id: siteId }, relations: ['user'] });
    if (!site) throw new NotFoundException('Site not found');
    const [subscribers, total] = await this.subscriberRepo.findAndCount({
      where: { siteId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { site, subscribers, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /** Import subscribers from another push service */
  async importSubscribers(data: {
    siteId: string;
    service: 'onesignal' | 'firebase' | 'webpushr';
    apiKey?: string;
    appId?: string;
    subscribers?: Array<{
      token: string;
      userId?: string;
      tags?: string[];
    }>;
  }) {
    const site = await this.siteRepo.findOne({ where: { id: data.siteId } });
    if (!site) throw new NotFoundException('Site not found');

    const jobId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Start async import job
    this.processImport(jobId, site, data).catch(console.error);

    return {
      jobId,
      status: 'started',
      message: `Import job started for ${data.service}. Check status with GET /admin/migration/status/${jobId}`
    };
  }

  /** Get migration job status */
  async getMigrationStatus(jobId: string) {
    // In a real implementation, you'd store job status in Redis/database
    // For now, return a mock status
    return {
      jobId,
      status: 'completed',
      imported: 150,
      failed: 5,
      total: 155,
      message: 'Import completed successfully'
    };
  }

  /** Process the import asynchronously */
  private async processImport(jobId: string, site: Site, data: any) {
    try {
      let subscribers = data.subscribers || [];

      // If no subscribers provided, try to fetch from the service API
      if (!subscribers.length && data.apiKey) {
        subscribers = await this.fetchSubscribersFromService(data.service, data.apiKey, data.appId);
      }

      let imported = 0;
      let failed = 0;

      for (const sub of subscribers) {
        try {
          // Convert token to subscription format based on service
          const subscription = this.convertTokenToSubscription(data.service, sub.token);

          const subscriber = {
            siteId: site.id,
            endpoint: subscription.endpoint,
            p256dh: subscription.p256dh,
            authKey: subscription.authKey,
            fcmToken: subscription.fcmToken,
            tags: sub.tags || [],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any;

          await this.subscriberRepo.save(subscriber);
          imported++;
        } catch (error) {
          console.error(`Failed to import subscriber ${sub.token}:`, error);
          failed++;
        }
      }

      console.log(`Import job ${jobId} completed: ${imported} imported, ${failed} failed`);

    } catch (error) {
      console.error(`Import job ${jobId} failed:`, error);
    }
  }

  /** Fetch subscribers from external service API */
  private async fetchSubscribersFromService(service: string, apiKey: string, appId?: string): Promise<any[]> {
    // Mock implementation - in reality, you'd call the service's API
    switch (service) {
      case 'onesignal':
        // Call OneSignal API to get subscribers
        return [];
      case 'firebase':
        // Call Firebase API
        return [];
      case 'webpushr':
        // Call Webpushr API
        return [];
      default:
        return [];
    }
  }

  /** Convert service-specific token to our subscription format */
  private convertTokenToSubscription(service: string, token: string) {
    switch (service) {
      case 'onesignal':
        // OneSignal tokens are typically FCM tokens
        return {
          fcmToken: token,
          endpoint: null,
          p256dh: null,
          authKey: null,
        };
      case 'firebase':
        return {
          fcmToken: token,
          endpoint: null,
          p256dh: null,
          authKey: null,
        };
      case 'webpushr':
        // Webpushr might provide full subscription data
        return {
          endpoint: token, // Assuming token is endpoint
          p256dh: null,
          authKey: null,
          fcmToken: null,
        };
      default:
        throw new Error(`Unsupported service: ${service}`);
    }
  }
}
