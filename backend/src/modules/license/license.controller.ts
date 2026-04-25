import {
  Controller, Get, Put, Param, Body, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LicenseService } from './license.service';
import { UsersService } from '../users/users.service';
import { Roles } from '../auth/decorators/auth.decorators';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateUserDto, AdminUpdateUserDto } from '../users/dto/update-user.dto';
import { UserRole, UserPlan, User } from '../users/user.entity';
import { CurrentUser } from '../auth/decorators/auth.decorators';
import { Site } from '../sites/site.entity';
import { Notification } from '../notifications/notification.entity';

@ApiTags('License')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('license')
export class LicenseController {
  constructor(
    private readonly licenseService: LicenseService,
    private readonly usersService: UsersService,
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
  ) { }

  @Get('limits')
  @ApiOperation({ summary: 'Get current user plan limits and usage' })
  async getLimits(@CurrentUser() user: User) {
    const limits = this.licenseService.getPlanLimits(user.plan);
    const sites = await this.siteRepo.count({ where: { userId: user.id } });
    const notifications = await this.notifRepo.count({ where: { site: { userId: user.id } } });

    return {
      plan: user.plan,
      limits,
      usage: {
        sites,
        notifications,
      },
      remaining: {
        sites: this.licenseService.getRemainingSites(user.plan, sites),
        notifications: this.licenseService.getRemainingNotifications(user.plan, notifications),
      },
    };
  }

  @Put('users/:userId/plan')
  @ApiOperation({ summary: 'Update user plan (Super Admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async updateUserPlan(
    @Param('userId') userId: string,
    @Body() body: AdminUpdateUserDto,
  ) {
    const user = await this.usersService.findById(userId);
    user.plan = body.plan!;
    return this.usersService.update(userId, body);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Get all available plans' })
  getPlans() {
    return {
      [UserPlan.FREE]: this.licenseService.getPlanLimits(UserPlan.FREE),
      [UserPlan.STARTER]: this.licenseService.getPlanLimits(UserPlan.STARTER),
      [UserPlan.PRO]: this.licenseService.getPlanLimits(UserPlan.PRO),
      [UserPlan.ENTERPRISE]: this.licenseService.getPlanLimits(UserPlan.ENTERPRISE),
    };
  }
}