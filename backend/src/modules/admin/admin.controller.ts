import {
  Controller, Get, Put, Post, Param, Query, Body, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles } from '../auth/decorators/auth.decorators';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole, UserPlan } from '../users/user.entity';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) { }

  @Get('dashboard')
  @ApiOperation({ summary: 'Super admin dashboard' })
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.adminService.listUsers(pageNum, limitNum);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user detail' })
  getUserDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Put('users/:id/toggle')
  @ApiOperation({ summary: 'Toggle user active/inactive' })
  toggleUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.toggleUserActive(id);
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { role: UserRole },
  ) {
    return this.adminService.updateUserRole(id, body.role);
  }

  @Put('users/:id/plan')
  @ApiOperation({ summary: 'Update user plan and optional expiry date' })
  updateUserPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { plan: UserPlan; planExpiresAt?: string | null },
  ) {
    return this.adminService.updateUserPlan(id, body.plan, body.planExpiresAt);
  }

  @Put('users/:id/plan-expiry')
  @ApiOperation({ summary: 'Set plan expiry date for a user' })
  setPlanExpiry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { planExpiresAt: string | null },
  ) {
    return this.adminService.setPlanExpiry(id, body.planExpiresAt);
  }

  @Get('clients')
  @ApiOperation({ summary: 'List all clients with site and subscriber counts' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  listClients(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.adminService.listClients(pageNum, limitNum, search);
  }

  @Get('clients/:id')
  @ApiOperation({ summary: 'Get client detail with sites and subscriber counts' })
  getClientDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getClientDetail(id);
  }

  @Post('clients/:id/suspend')
  @ApiOperation({ summary: 'Suspend a client — deactivates their account and all sites' })
  suspendClient(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.suspendClient(id);
  }

  @Post('clients/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate a suspended client' })
  reactivateClient(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.reactivateClient(id);
  }

  @Get('sites')
  @ApiOperation({ summary: 'List all sites' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listSites(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.adminService.listSites(pageNum, limitNum);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Global platform statistics' })
  getGlobalStats() {
    return this.adminService.getGlobalStats();
  }

  @Get('sites/:id/notifications')
  @ApiOperation({ summary: 'List notifications for a site (super admin view)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getSiteNotifications(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getSiteNotifications(id, page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 20);
  }

  @Get('sites/:id/subscribers')
  @ApiOperation({ summary: 'List subscribers for a site (super admin view)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getSiteSubscribers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getSiteSubscribers(id, page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 20);
  }

  @Post('migration/import')
  @ApiOperation({ summary: 'Import subscribers from another push service' })
  importSubscribers(
    @Body() body: {
      siteId: string;
      service: 'onesignal' | 'firebase' | 'webpushr';
      apiKey?: string;
      appId?: string;
      subscribers?: Array<{
        token: string;
        userId?: string;
        tags?: string[];
      }>;
    },
  ) {
    return this.adminService.importSubscribers(body);
  }

  @Get('migration/status/:jobId')
  @ApiOperation({ summary: 'Check migration job status' })
  getMigrationStatus(@Param('jobId') jobId: string) {
    return this.adminService.getMigrationStatus(jobId);
  }
}
