import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Segment } from './segment.entity';
import { Subscriber } from '../subscribers/subscriber.entity';
import { CreateSegmentDto } from './dto/create-segment.dto';

@Injectable()
export class SegmentsService {
  constructor(
    @InjectRepository(Segment)
    private readonly segmentRepo: Repository<Segment>,
    @InjectRepository(Subscriber)
    private readonly subscriberRepo: Repository<Subscriber>,
  ) { }

  async create(siteId: string, dto: CreateSegmentDto): Promise<Segment> {
    const segment = this.segmentRepo.create({
      siteId,
      name: dto.name,
      description: dto.description,
      rules: dto.rules || [],
      isAuto: dto.isAuto || false,
    });

    const saved = await this.segmentRepo.save(segment);

    // Calculate initial subscriber count
    await this.recalculateCount(saved.id, siteId);

    return this.segmentRepo.findOne({ where: { id: saved.id } }) as Promise<Segment>;
  }

  async findBySite(siteId: string) {
    return this.segmentRepo.find({
      where: { siteId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string, siteId?: string): Promise<Segment> {
    const where: any = { id };
    if (siteId) where.siteId = siteId;
    const segment = await this.segmentRepo.findOne({ where });
    if (!segment) throw new NotFoundException('Segment not found');
    return segment;
  }

  async getSubscribers(segmentId: string, siteId: string) {
    const segment = await this.findById(segmentId, siteId);
    return this.buildSegmentQuery(siteId, segment.rules).getMany();
  }

  async getSubscriberIds(segmentId: string, siteId: string): Promise<string[]> {
    const segment = await this.findById(segmentId, siteId);
    const subscribers = await this.buildSegmentQuery(siteId, segment.rules)
      .select('sub.id')
      .getMany();
    return subscribers.map((s) => s.id);
  }

  async delete(id: string, siteId: string): Promise<void> {
    const segment = await this.findById(id, siteId);
    await this.segmentRepo.remove(segment);
  }

  async suggestSegments(siteId: string) {
    // Basic rule engine: suggest segments based on data patterns
    const suggestions = [];

    // Check if there are subscribers from multiple countries
    const countries = await this.subscriberRepo
      .createQueryBuilder('sub')
      .select('sub.country')
      .addSelect('COUNT(*)', 'count')
      .where('sub.siteId = :siteId', { siteId })
      .andWhere('sub.isActive = true')
      .andWhere('sub.country IS NOT NULL')
      .groupBy('sub.country')
      .having('COUNT(*) > 5')
      .getRawMany();

    for (const c of countries) {
      suggestions.push({
        name: `Subscribers from ${c.sub_country}`,
        rules: [{ field: 'country', operator: 'eq', value: c.sub_country }],
        estimatedCount: parseInt(c.count),
      });
    }

    // Suggest by device type
    const devices = await this.subscriberRepo
      .createQueryBuilder('sub')
      .select('sub.deviceType')
      .addSelect('COUNT(*)', 'count')
      .where('sub.siteId = :siteId', { siteId })
      .andWhere('sub.isActive = true')
      .groupBy('sub.deviceType')
      .having('COUNT(*) > 5')
      .getRawMany();

    for (const d of devices) {
      suggestions.push({
        name: `${d.sub_deviceType} users`,
        rules: [{ field: 'deviceType', operator: 'eq', value: d.sub_deviceType }],
        estimatedCount: parseInt(d.count),
      });
    }

    // Suggest by popular tags - use simple-json compatible query
    // Tags are stored as JSON arrays, so we can't use unnest. Instead, get all tags and count manually.
    const tagsRows = await this.subscriberRepo
      .createQueryBuilder('sub')
      .select('sub.tags', 'tags')
      .where('sub.siteId = :siteId', { siteId })
      .andWhere('sub.isActive = true')
      .andWhere('sub.tags IS NOT NULL')
      .getRawMany();

    const tagCounts: Record<string, number> = {};
    for (const row of tagsRows) {
      let tags: string[] = [];
      try { tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []); } catch { continue; }
      for (const tag of tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    Object.entries(tagCounts)
      .filter(([, count]) => count > 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([tag, count]) => {
        suggestions.push({
          name: `Tagged: ${tag}`,
          rules: [{ field: 'tags', operator: 'contains', value: tag }],
          estimatedCount: count,
        });
      });

    return suggestions;
  }

  private buildSegmentQuery(siteId: string, rules: Record<string, any>[]) {
    const qb = this.subscriberRepo
      .createQueryBuilder('sub')
      .where('sub.siteId = :siteId', { siteId })
      .andWhere('sub.isActive = true');

    for (const rule of rules) {
      switch (rule.operator) {
        case 'eq':
          qb.andWhere(`sub.${rule.field} = :${rule.field}`, {
            [rule.field]: rule.value,
          });
          break;
        case 'neq':
          qb.andWhere(`sub.${rule.field} != :${rule.field}`, {
            [rule.field]: rule.value,
          });
          break;
        case 'contains':
          if (rule.field === 'tags') {
            qb.andWhere(`sub.tags LIKE :tagContains`, { tagContains: `%"${rule.value}"%` });
          }
          break;
        case 'in':
          qb.andWhere(`sub.${rule.field} IN (:...values)`, {
            values: rule.value,
          });
          break;
      }
    }

    return qb;
  }

  private async recalculateCount(segmentId: string, siteId: string) {
    const segment = await this.findById(segmentId);
    const count = await this.buildSegmentQuery(siteId, segment.rules).getCount();
    await this.segmentRepo.update(segmentId, { subscriberCount: count });
  }
}
