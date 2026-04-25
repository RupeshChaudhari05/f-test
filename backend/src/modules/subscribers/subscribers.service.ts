import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Subscriber, ConsentStatus } from './subscriber.entity';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';
import { UpdateSubscriberDto } from './dto/update-subscriber.dto';
import { FilterSubscribersDto } from './dto/filter-subscribers.dto';

@Injectable()
export class SubscribersService {
  constructor(
    @InjectRepository(Subscriber)
    private readonly subRepo: Repository<Subscriber>,
  ) { }

  async create(siteId: string, dto: CreateSubscriberDto, ip?: string): Promise<Subscriber> {
    // Check if subscriber already exists (same endpoint for same site)
    let subscriber = await this.subRepo.findOne({
      where: { siteId, endpoint: dto.endpoint },
    });

    if (subscriber) {
      // Re-activate if previously unsubscribed
      subscriber.isActive = true;
      subscriber.p256dh = dto.p256dh || subscriber.p256dh;
      subscriber.authKey = dto.authKey || subscriber.authKey;
      subscriber.fcmToken = dto.fcmToken || subscriber.fcmToken;
      subscriber.unsubscribedAt = null;
      if (dto.consentGranted) {
        subscriber.consentStatus = ConsentStatus.GRANTED;
        subscriber.consentTimestamp = new Date();
        subscriber.consentIp = ip || null;
      }
      return this.subRepo.save(subscriber);
    }

    subscriber = this.subRepo.create({
      siteId,
      endpoint: dto.endpoint,
      p256dh: dto.p256dh,
      authKey: dto.authKey,
      fcmToken: dto.fcmToken,
      browser: dto.browser,
      browserVersion: dto.browserVersion,
      os: dto.os,
      osVersion: dto.osVersion,
      deviceType: dto.deviceType || 'desktop',
      country: dto.country,
      city: dto.city,
      ipAddress: ip || null,
      timezone: dto.timezone,
      language: dto.language,
      tags: dto.tags || [],
      consentStatus: dto.consentGranted ? ConsentStatus.GRANTED : ConsentStatus.PENDING,
      consentTimestamp: dto.consentGranted ? new Date() : null,
      consentIp: dto.consentGranted ? ip : null,
    });

    return this.subRepo.save(subscriber);
  }

  async findBySite(siteId: string, page = 1, limit = 50, search?: string) {
    const qb = this.subRepo
      .createQueryBuilder('sub')
      .where('sub.siteId = :siteId', { siteId });

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere(
        '(sub.browser LIKE :term OR sub.os LIKE :term OR sub.country LIKE :term OR sub.city LIKE :term OR sub.language LIKE :term)',
        { term },
      );
    }

    const [subscribers, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('sub.createdAt', 'DESC')
      .getManyAndCount();

    const activeCount = await this.subRepo.count({ where: { siteId, isActive: true } });

    return { subscribers, total, activeCount, page, limit, pages: Math.ceil(total / limit) };
  }

  async findById(id: string, siteId?: string): Promise<Subscriber> {
    const where: any = { id };
    if (siteId) where.siteId = siteId;
    const subscriber = await this.subRepo.findOne({ where });
    if (!subscriber) throw new NotFoundException('Subscriber not found');
    return subscriber;
  }

  async filter(siteId: string, dto: FilterSubscribersDto) {
    const qb = this.subRepo
      .createQueryBuilder('sub')
      .where('sub.siteId = :siteId', { siteId })
      .andWhere('sub.isActive = true');

    if (dto.tags?.length) {
      // Tags stored as simple-json (JSON string), use LIKE for MySQL compatibility
      dto.tags.forEach((tag, i) => {
        qb.andWhere(`sub.tags LIKE :tag${i}`, { [`tag${i}`]: `%"${tag}"%` });
      });
    }
    if (dto.country) {
      qb.andWhere('sub.country = :country', { country: dto.country });
    }
    if (dto.deviceType) {
      qb.andWhere('sub.deviceType = :deviceType', { deviceType: dto.deviceType });
    }
    if (dto.browser) {
      qb.andWhere('sub.browser = :browser', { browser: dto.browser });
    }
    if (dto.os) {
      qb.andWhere('sub.os = :os', { os: dto.os });
    }
    if (dto.language) {
      qb.andWhere('sub.language = :language', { language: dto.language });
    }

    const page = dto.page || 1;
    const limit = dto.limit || 50;

    const [subscribers, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('sub.createdAt', 'DESC')
      .getManyAndCount();

    return { subscribers, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async addTags(id: string, siteId: string, tags: string[]): Promise<Subscriber> {
    const subscriber = await this.findById(id, siteId);
    const uniqueTags = [...new Set([...subscriber.tags, ...tags])];
    subscriber.tags = uniqueTags;
    return this.subRepo.save(subscriber);
  }

  async removeTags(id: string, siteId: string, tags: string[]): Promise<Subscriber> {
    const subscriber = await this.findById(id, siteId);
    subscriber.tags = subscriber.tags.filter((t) => !tags.includes(t));
    return this.subRepo.save(subscriber);
  }

  async unsubscribe(id: string, siteId: string): Promise<void> {
    const subscriber = await this.findById(id, siteId);
    subscriber.isActive = false;
    subscriber.unsubscribedAt = new Date();
    subscriber.consentStatus = ConsentStatus.REVOKED;
    await this.subRepo.save(subscriber);
  }

  async deleteData(id: string, siteId: string): Promise<void> {
    const subscriber = await this.findById(id, siteId);
    await this.subRepo.remove(subscriber);
  }

  async getActiveSubscriberIds(siteId: string, filters?: Record<string, any>): Promise<string[]> {
    const qb = this.subRepo
      .createQueryBuilder('sub')
      .select('sub.id')
      .where('sub.siteId = :siteId', { siteId })
      .andWhere('sub.isActive = true')
      .andWhere('sub.consentStatus = :consent', { consent: ConsentStatus.GRANTED });

    if (filters?.tags?.length) {
      filters.tags.forEach((tag: string, i: number) => {
        qb.andWhere(`sub.tags LIKE :ftag${i}`, { [`ftag${i}`]: `%"${tag}"%` });
      });
    }
    if (filters?.country) {
      qb.andWhere('sub.country = :country', { country: filters.country });
    }
    if (filters?.deviceType) {
      qb.andWhere('sub.deviceType = :deviceType', { deviceType: filters.deviceType });
    }

    const results = await qb.getMany();
    return results.map((s) => s.id);
  }

  async getByIds(ids: string[]): Promise<Subscriber[]> {
    return this.subRepo.find({ where: { id: In(ids) } });
  }

  async updateLastSeen(id: string): Promise<void> {
    await this.subRepo.update(id, { lastSeenAt: new Date() });
  }

  async countBySite(siteId: string): Promise<number> {
    return this.subRepo.count({ where: { siteId, isActive: true } });
  }
}
