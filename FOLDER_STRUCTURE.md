# Posh Push Notification System - Folder Structure & Architecture Guide

**Date:** April 2026  
**Version:** 1.0  
**Purpose:** Complete documentation of project structure, modules, and organization

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Root-Level Structure](#root-level-structure)
3. [Backend Architecture](#backend-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [SDK Structure](#sdk-structure)
6. [WordPress Plugin Structure](#wordpress-plugin-structure)
7. [Key Files & Their Purposes](#key-files--their-purposes)
8. [Module Dependencies](#module-dependencies)
9. [Data Flow](#data-flow)

---

## Project Overview

Posh Push is a **production-ready, full-stack SaaS notification platform** organized as a monorepo with multiple packages:

```
posh-notification-system/
├── backend/          → NestJS API server (port 3000)
├── frontend/         → Next.js admin dashboard (port 3001)
├── sdk/              → JavaScript SDK (bundled for client-side)
├── wordpress-plugin/ → WordPress integration plugin (PHP)
├── nginx/            → Reverse proxy configuration
├── scripts/          → Configuration and utility scripts
└── docker-compose files → Container orchestration
```

---

## Root-Level Structure

### Configuration Files

```
posh-notification-system/
├── package.json              # Root workspace configuration
├── .env                      # Environment variables (created during setup)
├── .env.example              # Example environment template
├── .gitignore                # Git exclusions
└── docker-compose.yaml       # Main Docker Compose file
```

### Docker Compose Variants

```
├── docker-compose.yaml       # Development setup (all services)
├── docker-compose.backend.yml # Backend + database only
├── docker-compose.frontend.yml # Frontend development
├── docker-compose.prod.yml   # Production deployment
└── docker-compose.yml        # Alias for docker-compose.yaml
```

### Documentation Files

```
├── README.md                 # Quick start & overview
├── DOCUMENTATION.md          # Complete technical documentation
├── QUICK_START.md            # 5-minute setup guide
├── DEPLOYMENT.md             # Production deployment guide
├── TESTING_GUIDE.md          # Testing strategies
├── ANALYSIS_REPORT.md        # Code quality report
├── NEXT_STEPS.md             # Future enhancements
├── SYSTEM_STATUS.md          # Current system health
├── WORDPRESS_PLUGIN_SETUP.md # WordPress integration guide
└── COMPETITIVE_ANALYSIS.md   # Market comparison report
```

### SDK Distribution

```
├── posh-push-sw.js           # Service Worker standalone
└── sdk-dist/                 # Pre-built SDK files
    ├── posh-push.js          # Main bundle (UMD)
    ├── posh-push.min.js      # Minified main bundle
    ├── posh-push.esm.js      # ES Module version
    ├── posh-push-amp.js      # AMP-optimized variant
    ├── posh-push-blogger.js  # Blogger-specific variant
    ├── posh-push.d.ts        # TypeScript definitions
    └── *.min.js              # Minified variants
```

### Scripts

```
scripts/
├── configure.js              # Configuration wizard for setup
└── [utility scripts]         # Build and deployment utilities
```

---

## Backend Architecture

### Structure Overview

```
backend/
├── src/
│   ├── main.ts              # Application entry point
│   ├── app.module.ts        # Root module with all imports
│   ├── database/            # Database setup & migrations
│   │   ├── schema.sql       # Database schema definition
│   │   ├── seed.ts          # Test data seeding
│   │   └── entities/        # TypeORM entity definitions
│   │
│   └── modules/             # Feature modules (organized by domain)
│       ├── auth/            # Authentication & authorization
│       ├── users/           # User management
│       ├── sites/           # Site/tenant management
│       ├── subscribers/     # Push subscriber management
│       ├── notifications/   # Notification creation & sending
│       ├── segments/        # Subscriber segmentation & filtering
│       ├── automations/     # Automation workflows
│       ├── analytics/       # Analytics & reporting
│       ├── admin/           # Admin panel features
│       ├── sdk/             # SDK distribution & configuration
│       ├── webhooks/        # Webhook management
│       ├── ab-test/         # A/B testing engine
│       ├── health/          # Health check endpoints
│       ├── license/         # License & plan management
│       ├── migration/       # Data migration tools
│       └── backup/          # Backup & restore functionality
│
├── sdk-dist/                # Compiled SDK files (served at /sdk)
│   ├── posh-push.js
│   ├── posh-push-amp.js
│   └── posh-push-blogger.js
│
├── tsconfig.json            # TypeScript configuration
├── package.json             # Backend dependencies
├── Dockerfile               # Container image definition
└── docker-compose.backend.yml # Backend-specific compose file
```

### Backend Module Structure (Example: Notifications)

Each module follows a consistent pattern:

```
modules/notifications/
├── notifications.controller.ts   # HTTP endpoints (REST API)
├── notifications.service.ts      # Business logic
├── notifications.module.ts       # Module definition & imports
├── notifications.entity.ts       # Database model
├── dto/                         # Data Transfer Objects
│   ├── create-notification.dto.ts
│   ├── update-notification.dto.ts
│   └── send-notification.dto.ts
├── interfaces/                  # TypeScript interfaces
│   └── notification.interface.ts
└── test/                        # Unit tests
    └── notifications.service.spec.ts
```

### Backend Key Modules Explained

#### 1. **Auth Module** (`modules/auth/`)
- JWT token generation and validation
- User login/logout
- Password hashing (bcrypt)
- Role-based access control (RBAC)

#### 2. **Users Module** (`modules/users/`)
- User profile management
- User creation and deletion
- Email verification
- Password reset functionality

#### 3. **Sites Module** (`modules/sites/`)
- Multi-site management per user
- Site settings and configuration
- API key generation for sites
- Site-specific subscriber counts

#### 4. **Subscribers Module** (`modules/subscribers/`)
- Push subscription management
- Service Worker registration
- VAPID key handling
- Subscription lifecycle (subscribe/unsubscribe)

#### 5. **Notifications Module** (`modules/notifications/`)
- Notification creation and scheduling
- Send notifications to subscribers
- Track delivery status
- Integration with web-push library

#### 6. **Segments Module** (`modules/segments/`)
- Create subscriber segments based on rules
- Auto-tagging functionality
- AI-powered segment suggestions
- Dynamic audience filtering

#### 7. **Automations Module** (`modules/automations/`)
- Welcome message workflows
- Drip campaigns
- Scheduled sends
- RSS feed monitoring
- YouTube notification triggers

#### 8. **Analytics Module** (`modules/analytics/`)
- Track notification sends, opens, clicks
- Calculate CTR (Click-Through Rate)
- Generate reports and dashboards
- Time-series analytics

#### 9. **SDK Module** (`modules/sdk/`)
- Serves JavaScript SDK files at `/sdk/*`
- SDK configuration endpoints
- Platform integration detection

#### 10. **Admin Module** (`modules/admin/`)
- Platform-wide admin features
- User management
- License management
- System configuration

#### 11. **License Module** (`modules/license/`)
- Plan tier validation
- Feature availability checking
- Subscriber limit enforcement
- License activation/deactivation

#### 12. **Migration Module** (`modules/migration/`)
- Import data from OneSignal
- Import data from Firebase
- Import data from Webpushr
- Batch operations

#### 13. **Webhooks Module** (`modules/webhooks/`)
- Webhook event triggers
- Event logging
- Webhook retry mechanism
- Event payload formatting

#### 14. **A/B Test Module** (`modules/ab-test/`)
- Test variant creation
- Split audience logic
- Performance comparison
- Statistical significance testing

---

## Frontend Architecture

### Structure Overview

```
frontend/
├── src/
│   ├── app/                  # Next.js app directory
│   │   ├── layout.tsx        # Root layout (header, nav)
│   │   ├── page.tsx          # Home page
│   │   ├── globals.css       # Global styles
│   │   │
│   │   ├── login/            # Login page
│   │   │   └── page.tsx
│   │   │
│   │   ├── register/         # Registration page
│   │   │   └── page.tsx
│   │   │
│   │   ├── dashboard/        # Main dashboard
│   │   │   ├── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── [routes]/     # Nested dashboard routes
│   │   │
│   │   └── super-admin/      # Super admin section
│   │       ├── login/        # Admin login
│   │       ├── dashboard/    # Admin dashboard
│   │       └── users/        # User management
│   │
│   ├── components/           # React components
│   │   ├── DashboardClient.tsx  # Dashboard wrapper
│   │   ├── SuperAdminClient.tsx # Admin wrapper
│   │   └── ui/                  # Reusable UI components
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Modal.tsx
│   │       ├── Table.tsx
│   │       ├── Form.tsx
│   │       └── [more UI components]/
│   │
│   ├── lib/                  # Utility functions
│   │   ├── api.ts           # API client setup
│   │   ├── store.ts         # Zustand state management
│   │   └── utils.ts         # Helper functions
│   │
│   └── hooks/               # Custom React hooks
│       ├── useAuth.ts
│       ├── useSites.ts
│       └── useNotifications.ts
│
├── next.config.js           # Next.js configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
├── package.json             # Frontend dependencies
├── Dockerfile               # Container image definition
└── docker-compose.frontend.yml # Frontend-specific compose file
```

### Frontend Pages Structure

```
Pages/
├── / (root)                 # Landing/home page
├── /login                   # User login
├── /register                # User registration
│
├── /dashboard               # Main authenticated area
│   ├── /sites              # Manage websites/tenants
│   ├── /notifications      # Create & send notifications
│   ├── /subscribers        # View & manage subscribers
│   ├── /segments           # Create & manage segments
│   ├── /automations        # Setup automation workflows
│   ├── /analytics          # View analytics & reports
│   ├── /ab-tests           # A/B testing
│   ├── /webhooks           # Webhook configuration
│   └── /settings           # User settings & API keys
│
└── /super-admin            # Admin-only section
    ├── /login              # Admin login
    ├── /dashboard          # Platform overview
    ├── /users              # User management
    ├── /plans              # Plan management
    ├── /licenses           # License management
    └── /settings           # Platform settings
```

### Frontend Component Architecture

```
components/
├── Layouts/
│   ├── DashboardLayout.tsx
│   ├── AdminLayout.tsx
│   └── AuthLayout.tsx
│
├── Features/
│   ├── NotificationBuilder/  # Drag-and-drop editor
│   ├── SegmentBuilder/       # Audience targeting
│   ├── AnalyticsCharts/      # Chart components
│   ├── AutomationFlow/       # Workflow builder
│   └── ABTestSetup/          # A/B test creation
│
├── Forms/
│   ├── LoginForm.tsx
│   ├── NotificationForm.tsx
│   ├── SegmentForm.tsx
│   └── AutomationForm.tsx
│
├── Tables/
│   ├── SubscribersTable.tsx
│   ├── NotificationsTable.tsx
│   ├── SegmentsTable.tsx
│   └── AnalyticsTable.tsx
│
└── UI/
    ├── Button.tsx
    ├── Card.tsx
    ├── Modal.tsx
    ├── Input.tsx
    ├── Select.tsx
    └── [shadcn/ui components]/
```

---

## SDK Structure

### JavaScript SDK Organization

```
sdk/
├── src/
│   ├── posh-push.ts         # Main SDK file
│   ├── posh-push-amp.ts     # AMP-specific variant
│   ├── posh-push-blogger.ts # Blogger-specific variant
│   │
│   ├── core/
│   │   ├── init.ts          # SDK initialization
│   │   ├── registration.ts  # Service Worker registration
│   │   ├── vapid.ts         # VAPID key handling
│   │   └── push-events.ts   # Push event handlers
│   │
│   ├── utils/
│   │   ├── browser.ts       # Browser detection
│   │   ├── logger.ts        # Debug logging
│   │   ├── fetch.ts         # HTTP utilities
│   │   └── storage.ts       # LocalStorage utils
│   │
│   └── types/
│       ├── config.ts        # Configuration interfaces
│       ├── events.ts        # Event types
│       └── api.ts           # API response types
│
├── __tests__/               # Test files
│   ├── posh-push.spec.ts
│   ├── registration.spec.ts
│   └── events.spec.ts
│
├── rollup.config.js         # Build configuration
├── tsconfig.json            # TypeScript config
├── package.json             # Dependencies
└── dist/                    # Compiled output
    ├── posh-push.js
    ├── posh-push.esm.js
    ├── posh-push.umd.js
    └── posh-push.d.ts
```

### SDK File Descriptions

| File | Purpose |
|------|---------|
| `posh-push.ts` | Main SDK with full feature set |
| `posh-push-amp.ts` | Google AMP-optimized version |
| `posh-push-blogger.ts` | Blogger-specific implementation |
| `core/init.ts` | Initialize SDK with config |
| `core/registration.ts` | Register Service Worker |
| `core/push-events.ts` | Handle push notifications |
| `utils/browser.ts` | Cross-browser compatibility |
| `utils/fetch.ts` | CORS-safe API requests |

---

## WordPress Plugin Structure

### Plugin Organization

```
wordpress-plugin/
└── posh-push/
    ├── posh-push.php              # Main plugin file (activation)
    ├── uninstall.php              # Cleanup on uninstall
    ├── wp-config-snippet.php      # Configuration template
    ├── readme.txt                 # WordPress plugin details
    │
    ├── admin/                     # Admin panel features
    │   ├── settings-page.php      # Settings page UI
    │   ├── admin.js               # Admin scripts
    │   └── admin.css              # Admin styles
    │
    └── includes/                  # Core plugin logic
        ├── class-posh-push-core.php       # Main class
        ├── class-posh-push-admin.php      # Admin functions
        ├── class-posh-push-frontend.php   # Frontend code
        └── class-posh-push-api.php        # API integration
```

### Plugin Features

| File | Function |
|------|----------|
| `posh-push.php` | Plugin header, hooks, activation |
| `class-posh-push-core.php` | SDK injection, initialization |
| `class-posh-push-frontend.php` | Enqueue SDK on site pages |
| `class-posh-push-admin.php` | Settings page management |
| `class-posh-push-api.php` | Connection to backend API |

---

## Key Files & Their Purposes

### Backend Key Files

| File | Purpose | Language |
|------|---------|----------|
| `backend/src/main.ts` | Express/NestJS boot, SDK serving | TypeScript |
| `backend/src/app.module.ts` | Root module with all imports | TypeScript |
| `backend/database/schema.sql` | Database table definitions | SQL |
| `backend/database/seed.ts` | Test user/site data | TypeScript |
| `backend/package.json` | Dependencies (NestJS, TypeORM, web-push) | JSON |
| `backend/Dockerfile` | Container image build steps | Docker |
| `backend/check-db.ts` | Database connection verification | TypeScript |
| `backend/init-db.js` | Database initialization script | JavaScript |

### Frontend Key Files

| File | Purpose | Language |
|------|---------|----------|
| `frontend/src/app/layout.tsx` | Root layout component | TypeScript/React |
| `frontend/src/components/DashboardClient.tsx` | Dashboard wrapper | TypeScript/React |
| `frontend/src/lib/api.ts` | Axios API client setup | TypeScript |
| `frontend/src/lib/store.ts` | Zustand state management | TypeScript |
| `frontend/tailwind.config.js` | Styling configuration | JavaScript |
| `frontend/next.config.js` | Next.js build configuration | JavaScript |

### SDK Key Files

| File | Purpose | Language |
|------|---------|----------|
| `sdk/src/posh-push.ts` | Main SDK implementation | TypeScript |
| `sdk/src/core/registration.ts` | Service Worker registration | TypeScript |
| `sdk/rollup.config.js` | Bundle build configuration | JavaScript |
| `sdk/package.json` | SDK-specific dependencies | JSON |

### Database Files

| File | Purpose | Language |
|------|---------|----------|
| `backend/database/schema.sql` | Complete table definitions | SQL |
| `backend/database/seed.ts` | Test data population | TypeScript |

### Configuration Files

| File | Purpose | Format |
|------|---------|--------|
| `.env` | Environment variables | Shell |
| `docker-compose.yaml` | Multi-service orchestration | YAML |
| `nginx/nginx.conf` | Reverse proxy configuration | NGINX |
| `backend/tsconfig.json` | TypeScript compilation settings | JSON |
| `frontend/tsconfig.json` | Frontend TS settings | JSON |

---

## Module Dependencies

### Dependency Tree

```
app.module.ts (Root)
├── AuthModule
│   └── UsersModule
│
├── SitesModule
│   └── SubscribersModule
│
├── NotificationsModule
│   ├── SegmentsModule
│   ├── SubscribersModule
│   └── AnalyticsModule
│
├── AutomationsModule
│   ├── NotificationsModule
│   └── ScheduleModule (Cron jobs)
│
├── SegmentsModule
│   └── SubscribersModule
│
├── AnalyticsModule
│   └── Database (TypeORM)
│
├── AbTestModule
│   ├── NotificationsModule
│   └── AnalyticsModule
│
├── AdminModule
│   ├── UsersModule
│   ├── SitesModule
│   └── LicenseModule
│
├── LicenseModule
│   └── UsersModule
│
├── WebhooksModule
│   └── All other modules (for event emission)
│
├── SdkModule
│   └── ServeStaticModule (for /sdk files)
│
├── MigrationModule
│   └── SubscribersModule
│
├── BackupModule
│   └── Database (TypeORM)
│
└── HealthModule
    └── Database health check
```

---

## Data Flow

### Push Notification Sending Flow

```
1. User creates notification in Frontend
   ↓
2. Frontend sends POST /api/notifications/send
   ↓
3. Backend validates subscription & permissions (Auth Module)
   ↓
4. NotificationsModule queries SegmentsModule for target subscribers
   ↓
5. NotificationsModule calls web-push library
   ↓
6. Sends push to browser Service Worker
   ↓
7. Browser displays notification
   ↓
8. User interaction tracked in AnalyticsModule
   ↓
9. Analytics dashboard updated with metrics
```

### Subscriber Registration Flow

```
1. Website loads posh-push.js SDK
   ↓
2. SDK registers Service Worker
   ↓
3. User grants notification permission
   ↓
4. SDK calls POST /api/subscribers/subscribe
   ↓
5. Backend stores subscription in SubscribersModule
   ↓
6. Subscriber becomes available for targeting in SegmentsModule
```

### Automation Trigger Flow

```
1. Automation configured in Frontend
   ↓
2. AutomationsModule registers Cron job (via NestJS Schedule)
   ↓
3. Event trigger (time, RSS feed, YouTube) fires
   ↓
4. AutomationsModule creates notification via NotificationsModule
   ↓
5. Notification automatically sent to matching segments
```

### A/B Test Flow

```
1. User creates A/B test in Frontend
   ↓
2. AbTestModule splits audience (50/50 or custom)
   ↓
3. Group A receives variant A, Group B receives variant B
   ↓
4. AnalyticsModule tracks performance metrics
   ↓
5. Dashboard shows winning variant (statistical significance)
   ↓
6. User can promote winning variant to full audience
```

---

## Environment & Configuration

### Key Environment Variables

```
# Database
DB_TYPE=mysql              # or postgres, sqlite
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=password
DB_NAME=posh_notifications

# Redis (optional, for queue jobs)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRY=24h

# Web Push
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# Sendgrid/Email (optional)
SENDGRID_API_KEY=...

# FCM (Firebase Cloud Messaging)
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## Deployment Structure

### Production Docker Setup

```
production/
├── docker-compose.prod.yml
│   ├── nginx (reverse proxy)
│   ├── backend (NestJS API)
│   ├── frontend (Next.js)
│   ├── postgres (database)
│   └── redis (cache/queue)
│
├── volumes/
│   ├── db-data/             # Database persistence
│   ├── redis-data/          # Redis persistence
│   └── uploads/             # File storage
│
└── certificates/
    ├── cert.pem            # SSL certificate
    └── key.pem             # SSL private key
```

---

## Summary

| Layer | Technology | Location |
|-------|-----------|----------|
| **Frontend** | Next.js 14, Tailwind, Zustand | `frontend/` |
| **Backend API** | NestJS 10, TypeORM, PostgreSQL/MySQL | `backend/` |
| **SDK** | Vanilla JavaScript, TypeScript | `sdk/` |
| **WordPress** | PHP Plugin | `wordpress-plugin/` |
| **Proxy** | NGINX | `nginx/` |
| **Orchestration** | Docker Compose | Root level |

This modular, well-organized structure enables:
- ✅ Easy scaling and maintenance
- ✅ Clear separation of concerns
- ✅ Multi-tenant support
- ✅ Flexible deployments
- ✅ Developer-friendly codebase

---

**Document Version:** 1.0  
**Last Updated:** April 2026  
**Status:** COMPLETE
