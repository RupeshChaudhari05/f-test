# Posh Push Notification System — Documentation

> A full-featured, self-hosted web push notification SaaS platform with a NestJS backend, Next.js frontend, JavaScript SDK, and WordPress plugin.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Prerequisites](#prerequisites)
5. [Installation & Setup](#installation--setup)
6. [Environment Variables](#environment-variables)
7. [Database Schema](#database-schema)
8. [User Roles & Permissions](#user-roles--permissions)
9. [Plan & License System](#plan--license-system)
10. [Backend API Reference](#backend-api-reference)
11. [Frontend Pages](#frontend-pages)
12. [JavaScript SDK](#javascript-sdk)
13. [WordPress Plugin](#wordpress-plugin)
14. [Integration Guide](#integration-guide)
15. [Security](#security)
16. [Deployment](#deployment)
17. [Troubleshooting](#troubleshooting)

---

## 1. Overview

Posh Push is a multi-tenant push notification platform that allows:

- **Super Admin (Owner):** Manages all clients, licenses, plans, and the entire platform.
- **Client Admin (User):** Manages their own sites, subscribers, segments, automations, notifications, and analytics — similar to OneSignal or PushEngage.

Key features:
- Multi-site management per user
- Web push notifications via VAPID/Web Push protocol
- Subscriber segmentation with rule-based targeting
- Automation workflows (welcome, drip, new post, scheduled)
- A/B testing for notifications
- Real-time analytics dashboard with CTR tracking
- Integration code generator (JavaScript snippet + WordPress plugin)
- License/plan enforcement with tiered limits

---

## 2. Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Next.js     │     │  NestJS      │     │  MySQL       │
│  Frontend    │────▶│  Backend     │────▶│  (MariaDB)   │
│  :3001       │     │  :3000       │     │  :3306       │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                    ┌───────┴───────┐
                    │  Web Push     │
                    │  (VAPID)      │
                    └───────────────┘

┌──────────────┐     ┌──────────────┐
│  JS SDK      │     │  WordPress   │
│  (Browser)   │────▶│  Plugin      │
└──────────────┘     └──────────────┘
```

- **Frontend** → Next.js 14 with shadcn/UI components, Tailwind CSS, Zustand state management
- **Backend** → NestJS with TypeORM, JWT auth, Swagger docs at `/docs`
- **Database** → MySQL/MariaDB (configurable: MySQL, PostgreSQL, or SQLite via `DB_TYPE`)
- **SDK** → Vanilla JavaScript UMD/ESM bundle with Service Worker
- **WordPress Plugin** → PHP plugin with auto-notify on publish

---

## 3. Tech Stack

| Layer       | Technology                                                 |
|-------------|-----------------------------------------------------------|
| Backend     | NestJS 10, TypeORM 0.3, bcrypt, JWT, web-push, Swagger    |
| Frontend    | Next.js 14, React 18, Tailwind CSS 3.4, shadcn/UI, Zustand, recharts |
| Database    | MySQL 5.7+ / MariaDB 10.4+ (also supports PostgreSQL, SQLite) |
| SDK         | Vanilla JS, Rollup (UMD + ESM), Service Worker API        |
| WP Plugin   | PHP 7.4+, WordPress 5.0+, WP REST API                     |

---

## 4. Prerequisites

- **Node.js** 18+ and **npm** 9+
- **XAMPP** or standalone **MySQL/MariaDB** server
- **Git** for version control

---

## 5. Installation & Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/RupeshChaudhari05/push_notification_app.git
cd push_notification_app
```

### Step 2: Create the Database

Open XAMPP → Start MySQL, then:

```sql
CREATE DATABASE posh_notifications CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

### Step 3: Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_NAME=posh_notifications
JWT_SECRET=your-secret-key-change-in-production
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Copy the keys into `.env`.

Start the backend:

```bash
npm run start:dev
```

Backend runs at `http://localhost:3000`. Swagger docs at `http://localhost:3000/docs`.

### Step 4: Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Start the frontend:

```bash
npm run dev
```

Frontend runs at `http://localhost:3001`.

### Step 5: First Login

1. Register at `http://localhost:3001/register`
2. To make yourself Super Admin, run in MySQL:

```sql
UPDATE users SET role = 'super_admin' WHERE email = 'your@email.com';
```

3. Log in and create your first site from the dashboard.

---

## 6. Environment Variables

### Backend (`backend/.env`)

| Variable           | Description                      | Default                |
|-------------------|----------------------------------|------------------------|
| `DB_TYPE`         | Database type: mysql, postgres, sqlite | `mysql`           |
| `DB_HOST`         | Database host                    | `localhost`            |
| `DB_PORT`         | Database port                    | `3306`                 |
| `DB_USERNAME`     | Database user                    | `root`                 |
| `DB_PASSWORD`     | Database password                | (empty)                |
| `DB_NAME`         | Database name                    | `posh_notifications`   |
| `JWT_SECRET`      | JWT signing secret               | (required)             |
| `VAPID_PUBLIC_KEY`| VAPID public key for web push    | (required)             |
| `VAPID_PRIVATE_KEY`| VAPID private key               | (required)             |
| `VAPID_SUBJECT`   | VAPID subject (mailto: URI)      | (required)             |

### Frontend (`frontend/.env.local`)

| Variable             | Description        | Default                  |
|---------------------|--------------------|--------------------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL   | `http://localhost:3000`  |

---

## 7. Database Schema

The system uses TypeORM entities with auto-sync. Key tables:

| Entity         | Description                                     |
|----------------|-------------------------------------------------|
| `users`        | User accounts with role (user/admin/super_admin) and plan |
| `sites`        | Websites registered for notifications            |
| `subscribers`  | Push notification subscribers per site           |
| `notifications`| Notification messages (draft/sent/scheduled)     |
| `deliveries`   | Individual delivery records per subscriber       |
| `segments`     | Rule-based subscriber segments                   |
| `automations`  | Automated notification workflows                 |
| `ab_tests`     | A/B test variants for notifications              |

### Key Relationships

- User → has many Sites
- Site → has many Subscribers, Notifications, Segments, Automations
- Notification → has many Deliveries (one per subscriber)
- Notification → may have AbTest with variants

---

## 8. User Roles & Permissions

| Role          | Capabilities                                                    |
|---------------|----------------------------------------------------------------|
| `user`        | Manage own sites, send notifications, view analytics            |
| `admin`       | Same as user (reserved for future multi-tenant admin features)  |
| `super_admin` | Full platform access: manage ALL users, change plans/roles, view global stats, activate/deactivate users |

### Super Admin Panel

Accessible at `/dashboard/admin` (only visible to super_admin users):
- Global statistics (total users, sites, subscribers, notifications)
- User management table with inline role/plan editing
- Activate/deactivate users
- Plan limits reference table

---

## 9. Plan & License System

| Plan       | Sites | Subscribers | Notifications/mo | Features                     |
|------------|-------|-------------|-------------------|------------------------------|
| free       | 1     | 1,000       | 100               | Basic notifications, widget  |
| starter    | 3     | 10,000      | 1,000             | + Segments, automations      |
| pro        | 10    | 100,000     | 10,000            | + A/B testing, analytics     |
| enterprise | ∞     | ∞           | ∞                 | + White label, full API      |

Plan enforcement is handled by the `LicenseService` in the backend. Super admins can change any user's plan from the admin panel.

---

## 10. Backend API Reference

All routes are prefixed with `/api/v1/`. Authentication uses JWT Bearer tokens.

### Auth

| Method | Route                      | Description        |
|--------|----------------------------|--------------------|
| POST   | `/api/v1/auth/register`    | Register new user  |
| POST   | `/api/v1/auth/login`       | Login, returns JWT |

### Users

| Method | Route                  | Description            |
|--------|------------------------|------------------------|
| GET    | `/api/v1/users/me`     | Get current user profile |
| PUT    | `/api/v1/users/me`     | Update name only (self) |

### Sites

| Method | Route                           | Description           |
|--------|---------------------------------|-----------------------|
| GET    | `/api/v1/sites`                 | List user's sites     |
| POST   | `/api/v1/sites`                 | Create a new site     |
| GET    | `/api/v1/sites/:id`             | Get site details      |
| PUT    | `/api/v1/sites/:id`             | Update site settings  |
| DELETE | `/api/v1/sites/:id`             | Delete a site         |

### Subscribers (nested under site)

| Method | Route                                          | Description          |
|--------|-------------------------------------------------|----------------------|
| GET    | `/api/v1/sites/:siteId/subscribers`              | List subscribers     |
| GET    | `/api/v1/sites/:siteId/subscribers/:id`          | Get subscriber       |
| PUT    | `/api/v1/sites/:siteId/subscribers/:id/tags`     | Add tags             |
| DELETE | `/api/v1/sites/:siteId/subscribers/:id/tags`     | Remove tags          |
| POST   | `/api/v1/sites/:siteId/subscribers/:id/unsubscribe` | Unsubscribe       |

### Notifications (nested under site)

| Method | Route                                              | Description              |
|--------|-----------------------------------------------------|--------------------------|
| GET    | `/api/v1/sites/:siteId/notifications`                | List notifications       |
| POST   | `/api/v1/sites/:siteId/notifications`                | Create draft notification|
| POST   | `/api/v1/sites/:siteId/notifications/send`           | Create & send immediately|
| GET    | `/api/v1/sites/:siteId/notifications/:id`            | Get notification details |
| GET    | `/api/v1/sites/:siteId/notifications/:id/stats`      | Get delivery stats       |
| POST   | `/api/v1/sites/:siteId/notifications/:id/cancel`     | Cancel notification      |

### Segments, Automations, AB Tests

| Method | Route                                            | Description         |
|--------|--------------------------------------------------|---------------------|
| GET    | `/api/v1/sites/:siteId/segments`                 | List segments       |
| POST   | `/api/v1/sites/:siteId/segments`                 | Create segment      |
| GET    | `/api/v1/sites/:siteId/automations`              | List automations    |
| POST   | `/api/v1/sites/:siteId/automations`              | Create automation   |
| POST   | `/api/v1/sites/:siteId/automations/:id/toggle`   | Toggle automation   |
| GET    | `/api/v1/sites/:siteId/ab-tests`                 | List A/B tests      |
| POST   | `/api/v1/sites/:siteId/ab-tests`                 | Create A/B test     |

### Analytics

| Method | Route                                                     | Description       |
|--------|-----------------------------------------------------------|-------------------|
| GET    | `/api/v1/sites/:siteId/analytics/dashboard`               | Dashboard stats   |
| GET    | `/api/v1/sites/:siteId/analytics/heatmap/:notificationId` | Click heatmap     |

### License

| Method | Route                               | Description               |
|--------|--------------------------------------|---------------------------|
| GET    | `/api/v1/license/limits`             | Get current user's limits |
| GET    | `/api/v1/license/plans`              | List available plans      |

### Admin (Super Admin Only)

| Method | Route                                    | Description              |
|--------|------------------------------------------|--------------------------|
| GET    | `/api/v1/admin/dashboard`                | Global platform stats    |
| GET    | `/api/v1/admin/users`                    | List all users           |
| GET    | `/api/v1/admin/users/:id`                | Get user details         |
| PUT    | `/api/v1/admin/users/:id/toggle`         | Toggle user active       |
| PUT    | `/api/v1/admin/users/:id/role`           | Change user role         |
| PUT    | `/api/v1/license/users/:id/plan`         | Change user plan         |
| GET    | `/api/v1/admin/sites`                    | List all sites           |

### SDK / Webhook

| Method | Route                               | Description                    |
|--------|--------------------------------------|--------------------------------|
| GET    | `/api/v1/sdk/config`                 | Get SDK config for API key     |
| POST   | `/api/v1/sdk/subscribe`              | Register new subscriber        |
| POST   | `/api/v1/webhooks/wordpress`         | WordPress auto-notify webhook  |

---

## 11. Frontend Pages

| Route                        | Description                        | Access     |
|------------------------------|------------------------------------|------------|
| `/login`                     | Sign in page                       | Public     |
| `/register`                  | Create account page                | Public     |
| `/dashboard`                 | Overview with stats & chart        | Auth       |
| `/dashboard/subscribers`     | Subscriber list with search/filter | Auth       |
| `/dashboard/notifications`   | Notification composer & history    | Auth       |
| `/dashboard/segments`        | Segment builder with rules         | Auth       |
| `/dashboard/automations`     | Automation workflows               | Auth       |
| `/dashboard/ab-tests`        | A/B test results                   | Auth       |
| `/dashboard/settings`        | Site config, API keys, integration code generator | Auth |
| `/dashboard/sites/new`       | Create a new site                  | Auth       |
| `/dashboard/admin`           | Super admin panel                  | Super Admin|

### UI Components (shadcn/UI)

The frontend uses custom shadcn/UI components built for Tailwind CSS v3:
- `Button` — Primary, secondary, outline, ghost, destructive variants
- `Card` — Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- `Badge` — Default, secondary, destructive, outline, success, warning variants
- `Input` — Text input with focus ring
- `Label` — Form labels
- `Textarea` — Multi-line text input
- `Tabs` — Tab navigation (TabsList, TabsTrigger, TabsContent)
- `Separator` — Horizontal/vertical dividers

---

## 12. JavaScript SDK

### Installation (Script Tag)

```html
<script src="http://localhost:3000/sdk/posh-push.js"></script>
<script>
  PoshPush.init({
    apiKey: 'YOUR_API_KEY',
    serverUrl: 'http://localhost:3000'
  });
</script>
```

### Service Worker

Place `posh-push-sw.js` at your site root. Download from:
```
http://localhost:3000/sdk/posh-push-sw.js
```

### How It Works

1. SDK loads and checks browser push notification support
2. Shows a subscription prompt widget to visitors
3. On permission grant, registers the push subscription
4. Sends subscription data to backend via `/api/v1/sdk/subscribe`
5. Service worker receives push events and displays notifications
6. Click tracking is reported back to the backend

---

## 13. WordPress Plugin

### Installation

1. Copy the `wordpress-plugin/` folder to `wp-content/plugins/posh-push/`
2. Activate in WordPress → Plugins
3. Go to Posh Push → Settings
4. Enter your **API Key** and **Server URL** from the dashboard

### Features

- **Auto SDK Injection:** Automatically adds the push notification SDK to all pages
- **Service Worker Proxy:** Serves the service worker from your domain
- **Auto-Notify on Publish:** Sends a push notification when a new post is published
- **Connection Test:** Verify API connectivity from WordPress admin
- **REST API Endpoint:** `/wp-json/posh-push/v1/status` for health checks
- **Configurable Post Types:** Choose which post types trigger auto-notifications

### Settings

| Setting          | Description                                  |
|------------------|----------------------------------------------|
| API Key          | Your site's API key from the Posh dashboard  |
| Server URL       | Backend server URL (default: https://api.poshnotify.com) |
| Auto Push        | Enable/disable auto-notify on new posts      |

### Security

- All admin actions require `manage_options` capability
- AJAX calls use WordPress nonce verification
- Service worker fetched via `wp_remote_get()` (not `readfile()`) to prevent SSRF
- Settings sanitized with `sanitize_text_field()` and `esc_url_raw()`

---

## 14. Integration Guide

### For Static Sites / Custom Websites

1. Go to **Dashboard → Site Settings → Integration Setup → JavaScript / Static Site** tab
2. Copy the script snippet
3. Paste before `</body>` in your HTML
4. Download the service worker file and place at your site root
5. Done — visitors will see the subscription prompt

### For WordPress Sites

1. Download the WordPress plugin from `wordpress-plugin/` folder
2. Upload and activate in WordPress
3. Go to **Posh Push → Settings**
4. Enter API Key and Server URL (from Dashboard → Site Settings → WordPress tab)
5. Enable auto-notify if desired
6. Done — the plugin handles everything automatically

### Custom Script Option

The Settings page provides a code generator for both JavaScript and WordPress integration. Select your platform type and copy the generated code.

---

## 15. Security

### Authentication & Authorization
- JWT-based authentication with Bearer tokens
- Role-based access control (user, admin, super_admin)
- Separate DTOs for self-update vs admin-update to prevent privilege escalation
- Admin routes protected with role guards

### Input Validation
- All DTOs use class-validator decorators
- WordPress plugin sanitizes all inputs
- API key validation on SDK endpoints

### Known Security Measures
- `UpdateUserDto` (self-update) only allows name changes — prevents role/plan self-promotion
- `AdminUpdateUserDto` used by super_admin routes for role/plan changes
- WordPress plugin uses `wp_remote_get()` instead of `readfile()` for service worker proxy (SSRF prevention)
- Nonce verification on all WordPress AJAX actions
- Password hashing with bcrypt

---

## 16. Deployment

### Production Checklist

- [ ] Set strong `JWT_SECRET` in backend `.env`
- [ ] Generate and configure VAPID keys
- [ ] Use a production database (not root with empty password)
- [ ] Set `NEXT_PUBLIC_API_URL` to production backend URL
- [ ] Enable HTTPS on both frontend and backend
- [ ] Set up reverse proxy (nginx) for both services
- [ ] Configure CORS in NestJS for your frontend domain
- [ ] Update WordPress plugin default server URL

### Docker (Optional)

```bash
# Backend
cd backend
npm run build
node dist/main.js

# Frontend
cd frontend
npm run build
npm start
```

---

## 17. Troubleshooting

| Issue                           | Solution                                      |
|---------------------------------|-----------------------------------------------|
| "Cannot connect to database"    | Ensure MySQL/MariaDB is running on port 3306  |
| Login fails                     | Check credentials; default: admin@posh.com / admin123 |
| Notifications not sending       | Ensure VAPID keys are configured in .env      |
| Frontend shows empty dashboard  | Create a site first from Dashboard             |
| WordPress plugin not connecting | Verify API Key and Server URL in WP settings   |
| SDK not loading on site         | Check browser console; ensure server URL is correct |
| Super Admin panel not visible   | Update user role to `super_admin` in database  |
| API returns 401                 | Token expired; log in again                    |

---

## Project Structure

```
push_notification_app/
├── backend/                    # NestJS API server
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/           # JWT authentication
│   │   │   ├── users/          # User management
│   │   │   ├── sites/          # Site CRUD
│   │   │   ├── subscribers/    # Subscriber management
│   │   │   ├── notifications/  # Notification sending
│   │   │   ├── segments/       # Segment rules engine
│   │   │   ├── automations/    # Workflow automations
│   │   │   ├── ab-tests/       # A/B testing
│   │   │   ├── analytics/      # Dashboard analytics
│   │   │   ├── license/        # Plan & limits
│   │   │   ├── admin/          # Super admin routes
│   │   │   ├── push/           # Web push delivery
│   │   │   └── sdk/            # SDK config & subscribe
│   │   ├── app.module.ts       # Root module
│   │   └── main.ts             # Bootstrap
│   └── .env                    # Environment config
│
├── frontend/                   # Next.js dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/      # All dashboard pages
│   │   │   ├── login/          # Login page
│   │   │   └── register/       # Register page
│   │   ├── components/ui/      # shadcn/UI components
│   │   ├── lib/
│   │   │   ├── api.ts          # API client functions
│   │   │   ├── store.ts        # Zustand state
│   │   │   └── utils.ts        # Utility functions
│   │   └── app/globals.css     # Tailwind + shadcn variables
│   └── .env.local              # Frontend env
│
├── sdk/                        # JavaScript SDK
│   ├── src/
│   │   ├── posh-push.js        # Main SDK
│   │   └── posh-push-sw.js     # Service Worker
│   └── rollup.config.js        # Build config
│
├── wordpress-plugin/           # WordPress plugin
│   ├── posh-push.php           # Main plugin file
│   └── readme.txt              # WP.org readme
│
└── DOCUMENTATION.md            # This file
```

---

*Built with ❤️ by Posh Notify — version 1.0.0*
