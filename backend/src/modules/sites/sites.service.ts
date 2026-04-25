import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as webPush from 'web-push';
import * as crypto from 'crypto';
import { Site } from './site.entity';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { UpdateWidgetConfigDto } from './dto/update-widget-config.dto';
import { LicenseService } from '../license/license.service';
import { User } from '../users/user.entity';

@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly configService: ConfigService,
    private readonly licenseService: LicenseService,
  ) { }

  private async getUserWithPlan(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(userId: string, dto: CreateSiteDto): Promise<Site> {
    // Get user and check site limits
    const user = await this.getUserWithPlan(userId);
    const userSites = await this.siteRepo.count({ where: { userId } });

    if (!this.licenseService.canCreateSite(user.plan, userSites)) {
      const remaining = this.licenseService.getRemainingSites(user.plan, userSites);
      throw new ForbiddenException(
        `Site limit reached. Your ${user.plan} plan allows ${remaining === 0 ? 'no more' : remaining} additional sites.`
      );
    }

    // Generate VAPID keys for this site
    const vapidKeys = webPush.generateVAPIDKeys();

    const site = this.siteRepo.create({
      userId,
      name: dto.name,
      domain: dto.domain,
      apiKey: crypto.randomBytes(32).toString('hex'),
      apiSecret: crypto.randomBytes(32).toString('hex'),
      vapidPublicKey: vapidKeys.publicKey,
      vapidPrivateKey: vapidKeys.privateKey,
      widgetConfig: dto.widgetConfig || {
        buttonStyle: { color: '#4F46E5', size: 'medium', position: 'bottom-right' },
        promptType: 'bell',
        triggerRules: { type: 'delay', value: 5 },
        language: 'en',
        consentBanner: {
          enabled: true,
          text: 'We would like to send you push notifications.',
        },
      },
    });

    return this.siteRepo.save(site);
  }

  async findAllByUser(userId: string) {
    return this.siteRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string, userId?: string): Promise<Site> {
    const where: any = { id };
    if (userId) where.userId = userId;

    const site = await this.siteRepo.findOne({ where });
    if (!site) throw new NotFoundException('Site not found');
    return site;
  }

  async findByApiKey(apiKey: string): Promise<Site> {
    const site = await this.siteRepo.findOne({ where: { apiKey, isActive: true } });
    if (!site) throw new NotFoundException('Site not found');
    return site;
  }

  async update(id: string, userId: string, dto: UpdateSiteDto): Promise<Site> {
    const site = await this.findById(id, userId);
    Object.assign(site, dto);
    return this.siteRepo.save(site);
  }

  async updateWidgetConfig(id: string, userId: string, dto: UpdateWidgetConfigDto): Promise<Site> {
    const site = await this.findById(id, userId);
    site.widgetConfig = { ...site.widgetConfig, ...dto };
    return this.siteRepo.save(site);
  }

  async regenerateApiKey(id: string, userId: string): Promise<{ apiKey: string }> {
    const site = await this.findById(id, userId);
    site.apiKey = crypto.randomBytes(32).toString('hex');
    await this.siteRepo.save(site);
    return { apiKey: site.apiKey };
  }

  async delete(id: string, userId: string): Promise<void> {
    const site = await this.findById(id, userId);
    await this.siteRepo.remove(site);
  }

  async getStats(id: string, userId: string) {
    const site = await this.findById(id, userId);
    const subscriberCount = await this.siteRepo
      .createQueryBuilder('site')
      .leftJoin('site.subscribers', 'sub')
      .where('site.id = :id', { id })
      .andWhere('sub.isActive = true')
      .getCount();

    return { siteId: site.id, subscriberCount };
  }
}
