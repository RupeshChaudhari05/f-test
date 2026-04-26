import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
// import { BullModule } from '@nestjs/bullmq'; // Temporarily disabled for testing
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SitesModule } from './modules/sites/sites.module';
import { SubscribersModule } from './modules/subscribers/subscribers.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SegmentsModule } from './modules/segments/segments.module';
import { AutomationsModule } from './modules/automations/automations.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AdminModule } from './modules/admin/admin.module';
import { SdkModule } from './modules/sdk/sdk.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AbTestModule } from './modules/ab-test/ab-test.module';
import { HealthModule } from './modules/health/health.module';
import { LicenseModule } from './modules/license/license.module';
import { MigrationModule } from './modules/migration/migration.module';
import { BackupModule } from './modules/backup/backup.module';

@Module({
  imports: [
    // Serve SDK static files
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'sdk-dist'),
      serveRoot: '/sdk',
    }),

    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env']
    }),

    // Database - supports postgres, mysql, sqlite via DB_TYPE env
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbType = config.get<string>('DB_TYPE', 'mysql') as 'postgres' | 'mysql' | 'sqlite';
        const isDev = config.get<string>('NODE_ENV') === 'development';

        // DB_SYNC=true forces table creation on first deploy (set once, then remove)
        const forceSync = config.get<string>('DB_SYNC') === 'true';
        const baseConfig = {
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: isDev || forceSync,
          logging: isDev,
        };

        if (dbType === 'sqlite') {
          return {
            ...baseConfig,
            type: 'sqlite' as const,
            database: config.get<string>('DB_DATABASE', 'database.sqlite'),
          };
        }

        // MySQL or PostgreSQL
        return {
          ...baseConfig,
          type: dbType as 'mysql' | 'postgres',
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', dbType === 'mysql' ? 3306 : 5432),
          username: config.get<string>('DB_USERNAME', 'root'),
          password: config.get<string>('DB_PASSWORD', ''),
          database: config.get<string>('DB_NAME', 'posh_notifications'),
          charset: dbType === 'mysql' ? 'utf8mb4' : undefined,
        };
      },
    }),

    // Redis + BullMQ (disabled for testing)
    // BullModule.forRootAsync({
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) => ({
    //     connection: {
    //       host: config.get<string>('REDIS_HOST', 'localhost'),
    //       port: config.get<number>('REDIS_PORT', 6379),
    //       password: config.get<string>('REDIS_PASSWORD') || undefined,
    //       lazyConnect: true, // Don't connect immediately
    //       retryDelay: 1000,
    //       maxRetriesPerRequest: 1,
    //     },
    //   }),
    // }),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),

    // Scheduler
    ScheduleModule.forRoot(),

    // Feature Modules
    AuthModule,
    UsersModule,
    SitesModule,
    SubscribersModule,
    NotificationsModule,
    SegmentsModule,
    AutomationsModule,
    AnalyticsModule,
    AdminModule,
    SdkModule,
    WebhooksModule,
    AbTestModule,
    HealthModule,
    LicenseModule,
    MigrationModule,
    BackupModule,
  ],
})
export class AppModule { }
