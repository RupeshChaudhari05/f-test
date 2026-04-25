import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from '../../sites/site.entity';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const site = await this.siteRepo.findOne({
      where: { apiKey, isActive: true },
    });

    if (!site) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.site = site;
    return true;
  }
}
