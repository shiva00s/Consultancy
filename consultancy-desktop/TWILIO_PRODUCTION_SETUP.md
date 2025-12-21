# Twilio WhatsApp Integration - Production Setup Guide

## Overview
This guide covers:
1. ✅ **Send via API** - Already implemented
2. ✅ **Receive via Webhook** - Webhook server running on port 3001
3. 📋 **Production Approval** - Steps to move from Sandbox to Production

---

## Current Implementation

### Sending Messages (API)
- Messages are sent via Twilio REST API using your credentials
- Handled by `TwilioWhatsAppService.sendMessage()`
- Messages stored in DB with status tracking

### Receiving Messages (Webhook)
- Webhook server listens on `http://localhost:3001/whatsapp/webhook`
- Twilio sends incoming messages to this endpoint
- Messages validated using X-Twilio-Signature header
- Incoming messages parsed and stored in `whatsapp_messages` table
- UI updated in real-time via Electron IPC

---

## Production Setup Steps

### Phase 1: Test in Sandbox (Current)
You are here ✓

**What you can do:**
- Send/receive messages with your Twilio WhatsApp Sandbox number
- Test conversations, message history
- Verify candidate integration works

**Limitation:** Only pre-approved phone numbers can chat (testing only)

---

### Phase 2: Deploy to Production Server

#### 2.1 Prepare Your Server
```bash
# Ensure Node.js 14+ is installed on your production server
node --version

# Copy your app to the server
# Example: /opt/consultancy-app/

# Install dependencies
cd /opt/consultancy-app
npm install --production

# Start the app in background
npm run build
npm run start &
```

#### 2.2 Open Firewall for Webhook
Twilio must reach your webhook endpoint:
```bash
# Allow port 3001 inbound (adjust to your firewall tool)
# Example for iptables:
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT

# For ufw:
sudo ufw allow 3001/tcp

# For AWS Security Groups:
# Add inbound rule: TCP 3001 from 0.0.0.0/0
```

#### 2.3 Use HTTPS (Required for Production)
Twilio only sends webhooks to HTTPS URLs. Options:

**Option A: Reverse Proxy (Recommended)**
```bash
# Install Nginx
sudo apt install nginx

# Create Nginx config
cat > /etc/nginx/sites-available/consultancy << 'EOF'
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location /whatsapp/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable and reload
sudo ln -s /etc/nginx/sites-available/consultancy /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

**Option B: Built-in SSL (via Let's Encrypt)**
```bash
# Get free SSL certificate
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --standalone -d your-domain.com
```

---

### Phase 3: Update Twilio Sandbox Settings

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate: **Messaging → WhatsApp → Sandbox Settings**
3. Update **Webhook URL** for incoming messages:
   ```
   https://your-domain.com:3001/whatsapp/webhook
   ```
4. Method: **HTTP POST**
5. Save

**Test the webhook:**
```bash
# Send a message to your Twilio WhatsApp sandbox number
# You should see it in the app UI within seconds
```

---

### Phase 4: Request Production Approval (Unlimited Access)

Twilio WhatsApp requires approval to move beyond sandbox (100 pre-approved numbers).

#### 4.1 Prerequisites
- Twilio account with valid payment method
- Business phone number verified
- Detailed use case documentation

#### 4.2 Submission Steps

1. **Log in to Twilio Console**
2. Go to **Messaging → WhatsApp → Request Production Access**
3. Fill out the application:
   - **Business Name:** Your consultancy name
   - **Business Address:** Full business address
   - **Phone Number:** Business contact number
   - **Website:** (if available)
   - **Use Case:** 
     ```
     "Send job placement updates, interview schedules, 
      and visa/document status to consultancy candidates 
      via WhatsApp using Twilio API."
     ```
   - **Message Volume:** Expected messages/day
   - **Message Types:** Notifications, confirmations, updates
   - **Opt-in Mechanism:** How users subscribe (checkbox, form, etc.)
   - **Sample Messages:** 2-3 examples

4. **Provide Webhook Details:**
   - Endpoint: `https://your-domain.com:3001/whatsapp/webhook`
   - Signature validation: Enabled
   - Server uptime: Your guarantee (e.g., 99.9%)

5. **Wait for Approval**
   - Typically 1-3 business days
   - You'll receive email notification
   - Approval grants unlimited WhatsApp messaging

#### 4.3 After Approval
Once approved:
1. Twilio provides a **Production Phone Number** (e.g., `whatsapp:+1234567890`)
2. Update your credentials in the app:
   - Account SID, Auth Token
   - New WhatsApp number (production)
3. Restart the app
4. Test sending messages (now works to any WhatsApp number, not just sandbox)

---

## Configuration in App UI

After deploying to production, you can configure the webhook via the app:

```javascript
// In renderer console or UI
await window.electronAPI.whatsapp.getWebhookInfo();
// Returns current webhook URL and setup instructions

await window.electronAPI.whatsapp.saveWebhookUrl('https://your-domain.com:3001/whatsapp/webhook');
// Saves the production webhook URL to database
```

---

## Troubleshooting

### Webhook Not Receiving Messages

**Check 1: Firewall**
```bash
curl -I https://your-domain.com:3001/whatsapp/webhook
# Should return 403 or 405 (method not allowed for GET), not "connection refused"
```

**Check 2: App Logs**
```bash
# Check if webhook server started
tail -f /opt/consultancy-app/logs/app.log | grep -i webhook
# Should show: "✅ Webhook server listening on port 3001"
```

**Check 3: Twilio Settings**
- Verify webhook URL is correct (no typos, HTTPS, port correct)
- Verify HTTP POST method is selected
- Test connection from Twilio console

**Check 4: Signature Validation**
- App validates `X-Twilio-Signature` header
- If auth token is wrong, messages are rejected
- Check logs for "Invalid Twilio signature"

### Messages Sent But Not Received

1. Check Twilio **Message Logs** in console for delivery status
2. Verify phone numbers include country code (e.g., `+1` for US)
3. Check candidate contact field format (must be valid phone number)
4. Ensure production approval if sending to non-sandbox numbers

---

## Environment Variables (Optional)

For production, consider using environment variables:

```bash
# .env (created on server, never committed)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
WEBHOOK_URL=https://your-domain.com:3001/whatsapp/webhook
PORT=3001
```

Load in `electron.cjs`:
```javascript
require('dotenv').config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
```

---

## Security Best Practices

1. **HTTPS Only:** Always use HTTPS for webhook endpoints
2. **Signature Validation:** App validates Twilio signature (enabled by default)
3. **Rate Limiting:** Implement rate limits to prevent spam
4. **Input Validation:** Sanitize phone numbers and message content
5. **Database:** Regular backups of message history
6. **Credentials:** Never hardcode secrets; use environment variables or secure vault

---

## Support & Resources

- **Twilio Docs:** https://www.twilio.com/docs/whatsapp/quickstart
- **Webhook Troubleshooting:** https://www.twilio.com/docs/whatsapp/troubleshooting
- **Production Approval:** https://console.twilio.com/ → Messaging → WhatsApp
- **Rate Limits:** https://www.twilio.com/docs/whatsapp/api/messages-resource

---

## Checklist for Go-Live

- [ ] Server deployed with HTTPS + fixed domain
- [ ] Firewall allows port 3001 inbound
- [ ] Webhook endpoint tested (receives messages)
- [ ] Twilio credentials updated to production values
- [ ] Webhook URL updated in Twilio console
- [ ] Production approval submitted and awaiting (or approved)
- [ ] Candidate database populated with phone numbers
- [ ] UI tested end-to-end (send/receive messages)
- [ ] Message history persists in database
- [ ] Backup strategy in place
- [ ] Monitoring/logging configured

---

## Database Schema Reference

Key tables for WhatsApp integration:

```sql
-- Conversations with candidates
SELECT * FROM whatsapp_conversations;

-- Messages sent/received
SELECT * FROM whatsapp_messages;

-- Twilio credentials (system_settings table)
SELECT key, value FROM system_settings WHERE key LIKE 'twilio_%';
```

---

**Last Updated:** December 2025
