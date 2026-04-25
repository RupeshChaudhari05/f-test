import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import * as express from 'express';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security
  app.use(helmet());
  app.use(compression());

  // Serve SDK bundles as static files
  const sdkPath = path.join(__dirname, '../../sdk-dist');
  app.use('/sdk', express.static(sdkPath, {
    setHeaders: (res, path) => {
      // Add CORS headers for SDK files
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  }));

  // CORS — allow frontend + any client website using the SDK
  const corsOrigins = configService.get<string>('CORS_ORIGINS', '');
  const allowedOrigins = corsOrigins
    ? corsOrigins.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, mobile apps, service workers)
      if (!origin) return callback(null, true);
      // Allow frontend dashboard
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Allow SDK requests from /api/v1/sdk/* endpoints — these come from client sites
      // In development, allow all; in production restrict via CORS_ORIGINS
      if (configService.get('NODE_ENV') === 'development') return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  // Global prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Posh Notification System')
      .setDescription('Multi-tenant SaaS push notification platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`🚀 Posh Notification System running on port ${port}`);
  console.log(`📖 API docs: http://localhost:${port}/docs`);
}

bootstrap();
