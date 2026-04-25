# Testing the Posh Notification System - Complete Guide

## Prerequisites Checklist
Before starting tests, verify:

- [ ] Backend running on port 3000 (`npm run start` in `backend/`)
- [ ] Frontend running on port 3001 (`npm run dev` in `frontend/`)
- [ ] Database is seeded (test users created)
- [ ] WordPress site with plugin installed
- [ ] VS Code with both terminals open

## Phase 1: Backend & Frontend Verification

### 1.1 Test Backend Startup
```bash
cd backend
npm run start
```
Expected output:
```
🚀 Posh Notification System running on port 3000
📖 API docs: http://localhost:3000/docs
```

### 1.2 Test Frontend Startup
```bash
cd frontend
npm run dev
```
Expected output:
```
ready - started server on 0.0.0.0:3001
```

### 1.3 Test Super Admin Login
1. Navigate to http://localhost:3001/super-admin/login
2. Enter credentials:
   - Email: `admin@posh.local` or `admin@posh.com`
   - Password: `Admin@123`
3. Expected: Dashboard loads with "Super Admin Panel" visible
4. If fails: Check backend logs and database

## Phase 2: SDK Serving Verification

### 2.1 Verify SDK Files Are Served
Open browser and test these URLs:

1. **Main SDK Bundle:**
   - URL: http://localhost:3000/sdk/posh-push.min.js
   - Expected: JavaScript file downloads (status 200)

2. **Service Worker:**
   - URL: http://localhost:3000/sdk/posh-push-sw.min.js
   - Expected: JavaScript file downloads (status 200)

3. **Type Definitions:**
   - URL: http://localhost:3000/sdk/posh-push.d.ts
   - Expected: TypeScript definitions file downloads

### 2.2 Check SDK Content
1. Open http://localhost:3000/sdk/posh-push.min.js in browser
2. Verify it's not empty (should contain obfuscated JavaScript)
3. Verify it starts with `var PoshPush` or similar

## Phase 3: WordPress Plugin Setup

### 3.1 Install Plugin
1. Copy `wordpress-plugin/posh-push.php` to WordPress plugins folder
2. Activate plugin in WordPress Admin
3. Verify "Posh Push" menu appears in admin sidebar

### 3.2 Get API Key from Posh Dashboard
1. Login to http://localhost:3001 with client credentials:
   - Email: `client@example.com`
   - Password: `Client@123`
2. Navigate to your site settings
3. Find Integration section and copy API Key

### 3.3 Configure Plugin Settings
1. Go to WordPress Admin → Posh Push → Settings
2. Enter:
   - **API Key:** (from step 3.2)
   - **Server URL:** http://localhost:3000
   - **Auto Push on New Post:** Checked
3. Click Save Settings

### 3.4 Test Connection
1. Still in Posh Push Settings
2. Click "Test Connection" button
3. Expected: "✓ Connected! Site ID: [UUID]"
4. If fails: Check console for error messages

## Phase 4: SDK Initialization on WordPress

### 4.1 Check Console Logs
1. Open WordPress site homepage in browser
2. Open DevTools (F12)
3. Go to Console tab
4. Look for messages starting with `[Posh Push]`

Expected console messages:
```
[Posh Push] Initializing SDK...
[Posh Push] SDK initialized successfully
```

### 4.2 Verify SDK Request
1. Still in DevTools
2. Go to Network tab
3. Reload page
4. Look for request to `/sdk/posh-push.min.js`
5. Expected status: 200
6. Expected size: ~15-20 KB

### 4.3 Check for Permission Popup
1. First visit to site (or cleared cache)
2. Look for popup asking for notification permission
3. Click "Allow" to grant permission
4. Verify no console errors

## Phase 5: Subscriber Registration

### 5.1 Register as Subscriber
1. On WordPress site, click "Allow" on notification popup
2. Browser will request permission
3. Grant permission
4. Site should complete registration

### 5.2 Verify Subscriber in Dashboard
1. Login to Posh Dashboard: http://localhost:3001
2. Navigate to your site
3. Go to Subscribers section
4. Verify new subscriber appears (should show browser/OS info)

## Phase 6: Sending Notifications

### 6.1 Create Test Notification
1. In Posh Dashboard
2. Go to Notifications section
3. Create new notification:
   - Title: "Test Notification"
   - Message: "This is a test message"
   - Recipient: "All Subscribers"
4. Click "Send"

### 6.2 Receive Notification
1. Switch to WordPress site tab (or open new tab to site)
2. Look for push notification (top-right corner of screen)
3. Verify notification displays with correct title and message
4. Click notification to verify it opens site

### 6.3 Verify in Database
1. Open database client
2. Query notification record:
```sql
SELECT * FROM notifications WHERE site_id = '[YOUR_SITE_ID]' ORDER BY created_at DESC LIMIT 1;
```
3. Verify notification is saved with correct data

## Phase 7: Auto-Publishing

### 7.1 Create and Publish New Post
1. In WordPress Admin → Posts → Add New
2. Enter title and content
3. Click "Publish"

### 7.2 Verify Auto-Notification
1. Posh Dashboard should receive webhook
2. Check Notifications section
3. New notification should appear (auto-generated from post)

### 7.3 Check Subscriber Received
1. Open site in new tab
2. Verify notification appears for new post
3. Verify notification contains post title and excerpt

## Troubleshooting Checklist

| Issue | Checks |
|-------|--------|
| SDK not loading | 1. Backend running? 2. Test `/sdk/posh-push.min.js` URL 3. Check console for 404 |
| No permission popup | 1. Check console for errors 2. SDK initialized? 3. First visit/cache cleared? |
| Connection test fails | 1. Correct API Key? 2. Server URL correct? 3. Backend running? |
| Notifications not sending | 1. Subscribers exist? 2. Check backend logs for errors 3. Check database |
| Subscriber not registered | 1. Popup appeared? 2. Permission granted? 3. Check browser console 4. Check backend logs |

## Database Queries for Verification

### Check Sites
```sql
SELECT id, name, domain, api_key FROM sites LIMIT 10;
```

### Check Subscribers  
```sql
SELECT id, site_id, browser, os, is_active, created_at FROM subscribers ORDER BY created_at DESC LIMIT 10;
```

### Check Notifications
```sql
SELECT id, site_id, title, message, status, created_at FROM notifications ORDER BY created_at DESC LIMIT 10;
```

### Check Notification Recipients
```sql
SELECT id, notification_id, subscriber_id, status, delivered_at FROM notification_recipients ORDER BY created_at DESC LIMIT 10;
```

## Performance Testing

### SDK Load Time
1. Open DevTools → Network
2. Reload page
3. Find `/sdk/posh-push.min.js` request
4. Check timing:
   - Should load in < 500ms
   - Size should be ~15-20 KB

### API Response Times
1. Open DevTools → Network
2. Perform actions (publish post, send notification)
3. Check request timing:
   - POST requests should respond in < 200ms
   - GET requests should respond in < 100ms

## SSL Certificate Warnings

If using HTTPS on production:
- Browser might show warnings about self-signed certs
- Backend `/api/v1/` calls work fine with `sslverify: false`
- WordPress plugin handles this automatically

## Next Steps After Successful Testing

1. **Move to Production**
   - Update Server URL in plugin
   - Get real SSL certificate
   - Deploy to production server

2. **Monitor Performance**
   - Check backend logs regularly
   - Monitor database query performance
   - Track notification delivery rates

3. **Optimize Configuration**
   - Enable auto-notifications for key post types
   - Configure retention policies
   - Set up analytics dashboards

## Support & Debugging

### Backend Logs
Watch backend console output for:
- Webhook receives
- Notification creation
- Subscriber registration

### Frontend Console
Check DevTools Console (F12) for:
- `[Posh Push]` messages
- Network request errors
- API response codes

### WordPress Logs
Check `wp-content/debug.log` for:
- Plugin activation/deactivation
- AJAX request errors
- Database query issues

---
**Last Updated:** 2024
**System Version:** 1.0
**Backend Port:** 3000
**Frontend Port:** 3001
