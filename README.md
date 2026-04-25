# Posh Notification System

A production-ready, multi-tenant SaaS push notification platform with advanced features like A/B testing, automation, segmentation, and real-time analytics.

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- PostgreSQL 15+ or MySQL 8+
- Redis 7+
- Docker & Docker Compose (for deployment)

### Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd posh-notification-system

# Install dependencies
npm install

# Set up environment
cp backend/.env.example backend/.env
# Edit backend/.env with your database and Redis URLs

# Set up database
npm run db:migrate
npm run db:seed

# Start services
npm run backend:dev    # Backend on http://localhost:3000
npm run frontend:dev   # Frontend on http://localhost:3001
```

### Docker Deployment

```bash
docker-compose up -d
```

## 📋 Features

### Core Features
- ✅ **Multi-tenant SaaS** - Each user manages multiple websites
- ✅ **Web Push + FCM** - Dual delivery for maximum reach
- ✅ **Smart Segmentation** - Auto-tagging, filters, AI suggestions
- ✅ **Customizable UI** - Button styles, prompt types, trigger rules
- ✅ **Automation Engine** - Welcome messages, drip campaigns, scheduled sends
- ✅ **A/B Testing** - Test notification variants for optimization
- ✅ **Real-time Analytics** - Sent, delivered, clicked, CTR dashboards
- ✅ **GDPR Compliant** - Consent management, data deletion
- ✅ **WordPress Plugin** - One-click integration with test notifications
- ✅ **JavaScript SDK** - Simple client-side integration
- ✅ **Super Admin Panel** - Platform management dashboard

### Advanced Features
- ✅ **Migration Tools** - Import from OneSignal, Firebase, Webpushr
- ✅ **Platform Integrations** - Blogger, AMP (Accelerated Mobile Pages)
- ✅ **RSS Feed Monitoring** - Auto-notify on new blog posts
- ✅ **YouTube Integration** - Notify on new video uploads
- ✅ **Enhanced Service Worker** - Robust registration with fallbacks
- ✅ **Production Ready** - Comprehensive error handling, logging, monitoring

## 🏗️ Architecture

```
├── backend/          # NestJS API server with TypeORM
├── frontend/         # Next.js admin dashboard with Radix UI
├── sdk/              # TypeScript SDK with Rollup bundling
│   ├── posh-push.js          # Main SDK
│   ├── posh-push-amp.js      # AMP variant
│   └── posh-push-blogger.js  # Blogger variant
├── wordpress-plugin/ # WordPress integration
├── docker/           # Containerized deployment
└── nginx/            # Reverse proxy configuration
```

## 📖 API Documentation

### Authentication
All API requests require an `x-api-key` header with your site's API key.

### SDK Integration

#### Basic Website Integration
```html
<script src="https://your-domain.com/sdk/posh-push.min.js"></script>
<script>
PoshPush.init({
  apiKey: 'your-api-key',
  serverUrl: 'https://your-domain.com'
});
</script>
```

#### AMP Integration
```html
<script async src="https://your-domain.com/sdk/posh-push-amp.min.js"></script>
<script>
PoshPushAMP.init({
  apiKey: 'your-api-key',
  consentRequired: true
});
</script>
```

#### Blogger Integration
```html
<script src="https://your-domain.com/sdk/posh-push-blogger.min.js"></script>
<script>
PoshPushBlogger.init({
  apiKey: 'your-api-key',
  blogId: 'your-blog-id'
});
</script>
```

### REST API Examples

#### Send Notification
```bash
curl -X POST https://your-domain.com/api/v1/sdk/notify \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Hello World!",
    "message": "This is a test notification",
    "url": "https://example.com"
  }'
```

#### Test Notification (WordPress Plugin)
```bash
curl -X POST https://your-domain.com/api/v1/sdk/test-notification \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "body": "This is a test from WordPress",
    "url": "https://example.com"
  }'
```

#### Import Subscribers
```bash
curl -X POST https://your-domain.com/api/v1/admin/migration/import \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "site-uuid",
    "service": "onesignal",
    "apiKey": "onesignal-api-key",
    "appId": "onesignal-app-id"
  }'
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
NODE_ENV=development
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=posh_push
DB_USER=posh_user
DB_PASS=password

REDIS_URL=redis://localhost:6379

JWT_SECRET=your-jwt-secret
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key

CORS_ORIGINS=http://localhost:3001,https://yourdomain.com
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## 🚀 Deployment

### Docker Compose
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: posh_push
      POSTGRES_USER: posh_user
      POSTGRES_PASSWORD: password

  redis:
    image: redis:7-alpine

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./frontend
    ports:
      - "3001:3001"
```

### Production Checklist
- [ ] HTTPS enabled for push notifications
- [ ] VAPID keys configured
- [ ] Database backups scheduled
- [ ] Redis persistence enabled
- [ ] Monitoring and logging set up
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Service worker cached appropriately

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)

## 🔄 Migration from Other Services

The platform supports importing subscribers from:
- OneSignal
- Firebase Cloud Messaging
- Webpushr
- Generic FCM tokens

Use the admin API endpoints to initiate migrations.
