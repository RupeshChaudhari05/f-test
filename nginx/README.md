# SSL Certificate Setup for Posh Notification System

## Overview
Your system uses separate subdomains that require SSL certificates:
- **Frontend:** `https://posh.fontgenerator.club`
- **Backend API:** `https://posh-api.fontgenerator.club`

## SSL Certificate Requirements
Since both domains point to the same VPS server, you have two options:

### Option 1: Wildcard Certificate (Recommended)
Get a wildcard certificate for `*.fontgenerator.club` that covers both subdomains.

### Option 2: Multi-Domain Certificate
Get a certificate that explicitly covers both `posh.fontgenerator.club` and `posh-api.fontgenerator.club`.

## Certificate Installation

### 1. Using Certbot (Let's Encrypt - Free)
```bash
# Install certbot
sudo apt update
sudo apt install certbot

# Get wildcard certificate (requires DNS challenge)
sudo certbot certonly --manual --preferred-challenges=dns -d "*.fontgenerator.club"

# Or get multi-domain certificate
sudo certbot certonly --manual --preferred-challenges=dns \
  -d posh.fontgenerator.club \
  -d posh-api.fontgenerator.club
```

### 2. Manual Certificate Installation
If you have certificates from another provider:

1. Place your certificate files in this `ssl/` directory:
   - `fullchain.pem` - Full certificate chain
   - `privkey.pem` - Private key

2. Ensure correct permissions:
   ```bash
   sudo chmod 600 ssl/privkey.pem
   sudo chmod 644 ssl/fullchain.pem
   ```

### 3. DNS Configuration
Ensure both domains point to your VPS server:
- `posh.fontgenerator.club` → Your VPS IP
- `posh-api.fontgenerator.club` → Your VPS IP

## Testing SSL Setup
After installation, test both domains:
```bash
curl -I https://posh.fontgenerator.club
curl -I https://posh-api.fontgenerator.club
```

## Troubleshooting
- **Certificate not found:** Check file paths in nginx.conf
- **Permission denied:** Ensure nginx can read certificate files
- **Mixed content:** Ensure all internal links use HTTPS
- **CORS issues:** Verify CORS_ORIGINS in backend configuration</content>
<parameter name="filePath">d:\Posh notifcation system\nginx\README.md