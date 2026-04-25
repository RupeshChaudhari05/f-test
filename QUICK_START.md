# Quick Start - Posh Notification System

## ⚡ 5-Minute Setup

### 1. Start Backend (Terminal 1)
```bash
cd backend
npm run start
```
Wait for: `🚀 Posh Notification System running on port 3000`

### 2. Start Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```
Wait for: `ready - started server on 0.0.0.0:3001`

### 3. Login to Dashboard
- Open: http://localhost:3001/super-admin/login
- Email: `admin@posh.local`
- Password: `Admin@123`

### 4. Create/View Your Site
- Navigate to Sites in admin panel
- Click a site to get its **API Key**
- Copy the API Key

### 5. Install WordPress Plugin
- Copy `wordpress-plugin/posh-push.php` to your WordPress plugins folder
- Activate in WordPress Admin
- Go to Posh Push → Settings
- Enter:
  - API Key (from step 4)
  - Server URL: `http://localhost:3000`
- Click "Test Connection"

### 6. Send Test Notification
- Back in Posh Dashboard
- Go to Notifications
- Create new notification
- Send to "All Subscribers"
- Check WordPress site for notification popup

## 📋 What Works

✅ Super Admin login with role validation
✅ Client dashboard for site management  
✅ WordPress plugin with SDK integration
✅ Push notification sending
✅ Subscriber management
✅ Database persistence

## 🛑 If Something Doesn't Work

### Backend not starting?
```bash
cd backend
npm install  # Install dependencies
npm run build  # Build TypeScript
npm run seed  # Seed database
npm run start  # Start server
```

### Frontend won't compile?
```bash
cd frontend
npm install  # Install dependencies
npm run dev  # Start dev server
```

### WordPress plugin not loading SDK?
1. Check browser console (F12)
2. Look for errors starting with `[Posh Push]`
3. Verify Server URL is `http://localhost:3000`
4. Test SDK URL directly: http://localhost:3000/sdk/posh-push.min.js

### Test credentials don't work?
1. Reseed database: `npm run seed` in backend
2. Clear browser cache
3. Try alternate credentials:
   - client@example.com / Client@123
   - jane@example.com / Jane@123

## 📁 Key Files

| File | Purpose |
|------|---------|
| `backend/src/main.ts` | Serves SDK files at `/sdk/*` |
| `wordpress-plugin/posh-push.php` | WordPress plugin (place in wp-content/plugins/) |
| `sdk/dist/posh-push.min.js` | Push notification SDK |
| `backend/src/database/seed.ts` | Create test users/sites |

## 🔗 Important URLs

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Backend API |
| http://localhost:3001 | Frontend Dashboard |
| http://localhost:3001/super-admin/login | Admin Login |
| http://localhost:3000/docs | API Documentation |
| http://localhost:3000/sdk/posh-push.min.js | SDK Bundle |

## 🧪 Test Flow

```
1. Backend & Frontend running
   ↓
2. Login to dashboard at localhost:3001
   ↓
3. Get API Key from site
   ↓
4. Install WordPress plugin
   ↓
5. Configure plugin with API Key
   ↓
6. Test connection (should show green ✓)
   ↓
7. Create notification in dashboard
   ↓
8. Check WordPress site receives notification
```

## 💾 Database

The system uses MySQL by default.

### Test Users Automatically Created:
- **Super Admin:** admin@posh.local / Admin@123
- **Client:** client@example.com / Client@123

### View Database
- Open database client (MySQL Workbench, DataGrip, etc.)
- Connect to localhost:3306
- Database: `posh_notifications`

## 🚀 Deployment Checklist

Before going to production:
- [ ] Backend compiled without errors
- [ ] Frontend built and optimized
- [ ] Database migrations run
- [ ] Test users deleted (change admin password)
- [ ] CORS origins updated
- [ ] SSL certificates installed
- [ ] Environment variables set
- [ ] Database backups configured
- [ ] Logging configured
- [ ] Monitoring alerts set up

## 📞 Support

### Check Logs
- **Backend:** Watch terminal where `npm run start` runs
- **Frontend:** Watch terminal where `npm run dev` runs
- **WordPress:** Check `wp-content/debug.log`
- **Browser:** DevTools Console (F12)

### Common Issues
- SDK not loading → Check /sdk/ URL in backend
- Plugin test fails → Check API Key and Server URL
- No notifications → Check subscribers registered
- Dashboard won't load → Check frontend running

---

**Ready?** Run `npm run start` in backend and you're off! 🎉
