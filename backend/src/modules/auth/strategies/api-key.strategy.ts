import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from '../../sites/site.entity';
import { Request } from 'express';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
  ) {
    super();
  }

  async validate(req: Request): Promise<Site> {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const site = await this.siteRepo.findOne({
      where: { apiKey, isActive: true },
    });

    if (!site) {
      throw new UnauthorizedException('Invalid API key');
    }

    return site;
  }
}
