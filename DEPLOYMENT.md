# Deployment Strategy — Posh Notification System

> Domain: `posh.fontgenerator.club`
> Architecture: Single VPS → Nginx → Backend (port 3000) + Frontend (port 3001)

---

## Project Structure (what goes where)

```
Posh notifcation system/
├── backend/          ← Deploy this (API + SDK files)
│   ├── Dockerfile    ← Self-contained, no repo root needed
│   └── sdk-dist/     ← Pre-built SDK files served via /sdk route
├── frontend/         ← Deploy this (dashboard UI)
│   └── Dockerfile    ← Uses NEXT_PUBLIC_API_URL build arg
├── nginx/
│   └── nginx.conf    ← HTTPS reverse proxy config
├── docker-compose.yaml         ← Full stack (all services in one)
├── docker-compose.backend.yml   ← Backend only
├── docker-compose.frontend.yml  ← Frontend only
└── .env.production              ← Fill in before deploying
```

---

## Step 1 — Fill in `.env.production`

Open `.env.production` and replace all placeholder values:

```env
DB_HOST=your_mysql_host          # Use 'postgres' if using docker-compose.prod.yml
DB_USERNAME=your_db_user
DB_PASSWORD=your_strong_password
DB_NAME=posh_notifications

JWT_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">

SUPER_ADMIN_PASSWORD=YourStrongAdminPassword!
```

> ⚠️ Never commit `.env.production` to Git — it is in `.gitignore`

---

## Step 2 — Generate service config files

From the project root, run:

```bash
npm run configure:prod
```

This writes:
- `backend/.env` — NestJS environment config
- `frontend/.env.local` — Next.js environment config
- `wordpress-plugin/posh-push/wp-config-snippet.php` — WordPress constant

---

## Option A: Full Stack on One VPS (recommended)

Deploy all services together using Docker Compose:

```bash
# On your VPS, clone the repo
git clone <your-repo-url> /opt/posh
cd /opt/posh

# Fill in .env.production
nano .env.production

# Generate config
npm run configure:prod

# Get SSL certificate (first time only)
certbot certonly --standalone -d posh.fontgenerator.club
mkdir -p nginx/ssl
cp /etc/letsencrypt/live/posh.fontgenerator.club/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/posh.fontgenerator.club/privkey.pem nginx/ssl/

# Deploy
docker compose up -d --build
```

### Verify

```bash
# Check all containers running
docker compose ps

# Check backend health
curl https://posh.fontgenerator.club/health

# Check frontend
curl -I https://posh.fontgenerator.club
```

---

## Option B: Backend and Frontend on Separate Hosts

### Backend host

```bash
git clone <your-repo-url> /opt/posh
cd /opt/posh

# Fill in .env.production (DB_HOST = your remote DB)
nano .env.production
npm run configure:prod

# Deploy backend only
docker compose -f docker-compose.backend.yml up -d --build
```

Backend will be available at `http://<backend-host>:3000`

### Frontend host

```bash
git clone <your-repo-url> /opt/posh
cd /opt/posh

# Fill in .env.production (BACKEND_URL = backend host URL)
nano .env.production
npm run configure:prod

# Deploy frontend only
docker compose -f docker-compose.frontend.yml up -d --build
```

Frontend will be available at `http://<frontend-host>:3001`

---

## Option C: Git Push to Single Repo (Push Full Monorepo)

Your repo should contain these folders (all needed for deployment):

```
backend/     ← API code + sdk-dist (self-contained)
frontend/    ← Dashboard code
nginx/       ← Proxy config
sdk/         ← Source (optional, sdk-dist is pre-built)
scripts/     ← configure.js
.env.production (local only, not in git)
docker-compose.yaml
```

Push everything except secrets:
```bash
git add .
git commit -m "Production deployment setup"
git push origin main
```

Then on VPS:
```bash
git pull origin main
npm run configure:prod
docker compose up -d --build
```

---

## SSL Certificate (Certbot)

```bash
# Install certbot on VPS
apt install certbot

# Stop nginx temporarily if running
docker compose stop nginx

# Get certificate
certbot certonly --standalone -d posh.fontgenerator.club

# Copy certs into repo
mkdir -p nginx/ssl
cp /etc/letsencrypt/live/posh.fontgenerator.club/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/posh.fontgenerator.club/privkey.pem nginx/ssl/

# Restart nginx
docker compose up -d nginx
```

Auto-renew certs:
```bash
# Add to crontab
0 3 * * * certbot renew --deploy-hook "cp /etc/letsencrypt/live/posh.fontgenerator.club/fullchain.pem /opt/posh/nginx/ssl/ && cp /etc/letsencrypt/live/posh.fontgenerator.club/privkey.pem /opt/posh/nginx/ssl/ && docker compose -f /opt/posh/docker-compose.yaml restart nginx"
```

---

## WordPress Plugin Setup

After backend is deployed:

1. Activate the plugin in WP Admin
2. Copy `wordpress-plugin/posh-push/wp-config-snippet.php` contents
3. Add to `wp-config.php` BEFORE `/* That's all, stop editing */`:
   ```php
   define( 'POSH_PUSH_SERVER_URL', 'https://posh.fontgenerator.club' );
   ```
4. Go to **WP Admin → Posh Push → Settings**
5. Enter the API Key from **Dashboard → Sites**
6. Click **Test Connection** — should return "Connection successful!"

---

## Update / Redeploy After Code Changes

```bash
cd /opt/posh
git pull origin main
npm run configure:prod
docker compose up -d --build
```

---

## Troubleshooting

| Problem | Check |
|---|---|
| 502 Bad Gateway | `docker compose ps` — is backend container running? |
| Frontend can't reach API | Check `NEXT_PUBLIC_API_URL` in `frontend/.env.local` |
| Push notifications not working | Check VAPID keys match between .env.production and site |
| SSL cert error | Check certs exist in `nginx/ssl/` |
| DB connection error | Verify `DB_HOST`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` |
| WordPress 401 error | Re-enter API key in WP Admin → Posh Push → Settings |

---

## Service URLs (after deployment)

| Service | URL |
|---|---|
| Dashboard | `https://posh.fontgenerator.club` |
| API | `https://posh.fontgenerator.club/api/v1` |
| SDK | `https://posh.fontgenerator.club/sdk/posh-push.min.js` |
| API Health | `https://posh.fontgenerator.club/health` |
| API Docs | `https://posh.fontgenerator.club/docs` |
