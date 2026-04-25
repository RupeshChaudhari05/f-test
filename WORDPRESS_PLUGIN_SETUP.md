# WordPress Plugin Setup Guide

## Prerequisites
- WordPress site running
- Posh Backend running on `http://localhost:3000` (or your server URL)
- Frontend running on `http://localhost:3001`
- At least one site created in Posh with an API Key

## Installation Steps

### 1. Upload Plugin
- Go to WordPress Admin → Plugins → Add New
- Upload a zip archive containing the `posh-push` plugin folder with `posh-push/posh-push.php` at the archive root
- Or manually copy the entire `wordpress-plugin/posh-push` folder to `wp-content/plugins/`
- Activate the plugin

> Note: If you upload a plain `.php` file directly through the plugin installer, WordPress may show “The plugin does not have a valid header.”

### 2. Configure Plugin Settings
- Go to WordPress Admin → Posh Push → Settings
- Fill in the following fields:

#### API Key
- Get this from Posh Dashboard
- Go to http://localhost:3001
- Login with client credentials (client@example.com / Client@123)
- Go to your site settings
- Copy the **API Key** from the Integration section

#### Server URL
- **For Development:** `http://localhost:3000`
- **For Production:** `https://your-posh-server.com`

#### Auto Push on New Post
- Enable if you want automatic notifications when publishing posts
- Uncheck to manually send notifications

### 3. Test Connection
- Still on Settings page
- Click the "Test Connection" button
- You should see: **"✓ Connected! Site ID: [YOUR_SITE_ID]"**
- If connection fails, check:
  - API Key is correct
  - Server URL is correct
  - Backend server is running

## How It Works

### 1. SDK Loading
The plugin loads the Posh Push SDK from your backend:
```
http://localhost:3000/sdk/posh-push.min.js
```

This SDK:
- Shows the notification acceptance popup on first visit
- Handles push notifications from the browser
- Registers service workers
- Tracks subscriber interactions

### 2. Service Worker
The service worker handles:
- Receiving push notifications
- Displaying notifications to users
- Tracking clicks and deliveries
- Managing notification permissions

Location: `http://localhost:3000/sdk/posh-push-sw.min.js`

### 3. Auto Publishing
When you publish a post and "Auto Push" is enabled:
- WordPress sends webhook to: `/api/v1/webhooks/wordpress`
- Posh receives post data (title, excerpt, image, URL)
- Posh can send notifications about the new post

## Troubleshooting

### SDK Not Loading
**Check:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Look for request to `/sdk/posh-push.min.js`
4. Should have status 200

**If fails:**
- Backend might not be serving SDK files
- Check Server URL in settings
- Verify backend is running

### No Permission Popup
**Check:**
1. Open browser console (F12 → Console)
2. Look for messages starting with "[Posh Push]"
3. Should show "SDK initialized successfully"

**If fails:**
- API Key might be wrong
- SDK might not have initialized
- Check console for error messages

### Connection Test Fails
**Check:**
1. API Key is correct (from Posh Dashboard)
2. Server URL is correct
3. Backend is running on that URL
4. No firewall/CORS blocking requests

### Notifications Not Sending
**Check:**
1. Site has active subscribers (check Posh Dashboard)
2. Notification was created from Posh Dashboard or API
3. Check browser console on subscriber device for errors

## Browser Console Messages

You should see these in browser console:
```
[Posh Push] Initializing SDK...
[Posh Push] SDK initialized successfully
```

## Common Error Messages

| Error | Solution |
|-------|----------|
| "SDK library not loaded" | Backend `/sdk/` files not being served |
| "API key not configured" | Add API Key in plugin settings |
| "Connection failed" | Check Server URL and backend status |
| "Invalid server URL" | Server URL must be http:// or https:// |

## Next Steps

### Test Complete Flow
1. **Create Notification in Posh Dashboard**
   - Login: http://localhost:3001
   - Create notification with title and message
   - Send to "All Subscribers"

2. **Visit Your WordPress Site**
   - You should see acceptance popup
   - Grant notification permission
   - Check Posh Dashboard for new subscriber

3. **Send Notification**
   - New subscriber should receive notification
   - Check Posh Dashboard for delivery status

### Advanced Setup
- Configure auto-notifications for specific post types
- Use webhooks for custom integrations
- Track subscriber engagement in Analytics

## Support
- Check backend logs: `npm run start` output
- Check frontend console: F12 → Console
- Check WordPress error log: `wp-content/debug.log`
