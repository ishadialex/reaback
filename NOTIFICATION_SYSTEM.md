# Notification System Documentation

## Overview

The notification system is now fully functional and respects each user's preferences. Notifications are sent via:
- **Email** (using Nodemailer)
- **In-app notifications** (stored in database)

## Features Implemented

### 1. Login Alerts ✅
- Automatically sends email when user logs in
- Includes device, browser, location, and IP information
- **Respects user's `loginAlerts` setting**

### 2. Email Notifications ✅
- Used for transactional emails (transactions, account updates)
- **Respects user's `emailNotifications` setting**

### 3. Marketing Emails ✅
- Used for promotional content
- **Respects user's `marketingEmails` setting**

### 4. Push Notifications (Framework Ready)
- Database check implemented
- **Respects user's `pushNotifications` setting**
- Note: Actual push sending requires FCM/OneSignal integration

## How It Works

### User Settings Check
Before sending ANY notification, the system checks the user's preferences in the `UserSettings` table:

```typescript
// Example: Before sending a login alert
const canSend = await canSendNotification(userId, NotificationType.LOGIN_ALERT);
if (!canSend) {
  console.log("User has disabled login alerts");
  return;
}
```

### Notification Types

```typescript
enum NotificationType {
  EMAIL = "email",           // General email notifications
  PUSH = "push",            // Push notifications (not yet implemented)
  LOGIN_ALERT = "login_alert", // Security alerts
  MARKETING = "marketing"     // Promotional emails
}
```

## Usage Examples

### Sending Login Alerts (Already Implemented)

```typescript
import { sendLoginAlert } from "../services/notification.service.js";

// In auth.controller.ts login function
await sendLoginAlert(
  user.id,
  user.email,
  device,    // e.g., "Mobile", "Desktop"
  browser,   // e.g., "Chrome", "Firefox"
  location,  // e.g., "New York, USA"
  ipAddress  // e.g., "192.168.1.1"
);
```

### Sending Transaction Notifications

```typescript
import { sendTransactionNotification } from "../services/notification.service.js";

// After creating a transaction
await sendTransactionNotification(
  userId,
  userEmail,
  "deposit",        // transaction type
  1000,            // amount
  "Bank deposit"   // description
);
```

### Sending Custom Email Notifications

```typescript
import { sendEmailNotification, NotificationType } from "../services/notification.service.js";

await sendEmailNotification(
  userId,
  {
    to: userEmail,
    subject: "Welcome to Alvarado",
    html: "<h1>Welcome!</h1><p>Thanks for joining us.</p>",
  },
  NotificationType.EMAIL
);
```

### Creating In-App Notifications

```typescript
import { createInAppNotification } from "../services/notification.service.js";

await createInAppNotification(
  userId,
  "system",  // type: system | transfer | investment | security | support
  "Welcome!",
  "Thanks for joining Alvarado Investment"
);
```

## Testing the System

### 1. Test Login Alerts

1. **Enable Login Alerts** (Default: ON)
   - Go to Settings → Notifications
   - Toggle "Login Alerts" to ON

2. **Login to your account**
   - You should receive an email with:
     - Device information
     - Browser
     - Location (currently shows "Unknown")
     - IP address
     - Timestamp
   - Also check in-app notifications in the dashboard

3. **Disable Login Alerts**
   - Go to Settings → Notifications
   - Toggle "Login Alerts" to OFF
   - Login again
   - You should NOT receive an email

### 2. Test Email Notifications

```typescript
// Add this code to test in any controller
import { sendTransactionNotification } from "../services/notification.service.js";

// Send test transaction notification
await sendTransactionNotification(
  req.userId!,
  userEmail,
  "deposit",
  500,
  "Test transaction notification"
);
```

### 3. Test with Different Users

Each user has independent settings:
- User A enables all notifications → receives all emails
- User B disables Login Alerts → receives emails except login alerts
- User C disables all notifications → receives no emails

## Email Configuration

### Gmail Setup (Recommended for Development)

1. **Enable 2-Factor Authentication** on your Gmail account

2. **Generate App Password**:
   - Go to Google Account → Security → 2-Step Verification
   - Scroll to "App passwords"
   - Generate new app password
   - Copy the 16-character password

3. **Update `.env` file**:
   ```env
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT=587
   SMTP_SECURE="false"
   SMTP_USER="your-email@gmail.com"
   SMTP_PASS="your-16-char-app-password"
   EMAIL_FROM="Your App <noreply@yourapp.com>"
   APP_NAME="Alvarado Investment"
   APP_URL="http://localhost:3000"
   ```

### Other Email Providers

#### SendGrid
```env
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT=587
SMTP_USER="apikey"
SMTP_PASS="your-sendgrid-api-key"
```

#### Mailgun
```env
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT=587
SMTP_USER="your-mailgun-smtp-user"
SMTP_PASS="your-mailgun-smtp-password"
```

## Notification Templates

### Available Email Templates

1. **Login Alert** - Sends when user logs in
   - Professional design
   - Shows device & location info
   - Links to manage sessions
   - Security tips

2. **Transaction Notification** - Sends on transactions
   - Shows amount & type
   - Updates balance
   - Links to transaction history

3. **Custom Notifications** - For any other use case
   - Flexible HTML support
   - Automatic plain text fallback

## Database Schema

### UserSettings (Notification Preferences)
```prisma
model UserSettings {
  emailNotifications Boolean @default(true)
  pushNotifications  Boolean @default(true)
  marketingEmails    Boolean @default(false)
  loginAlerts        Boolean @default(true)
}
```

### Notification (In-App)
```prisma
model Notification {
  userId    String
  type      String  // system | transfer | investment | security | support
  title     String
  message   String
  isRead    Boolean @default(false)
  createdAt DateTime @default(now())
}
```

## Best Practices

1. **Always Check Settings**: Never send notifications without checking user preferences
2. **Async Sending**: Use `.catch()` to handle email failures gracefully
3. **Dual Notifications**: Send both email AND in-app notification for important events
4. **Clear Opt-Out**: Always include unsubscribe/manage preferences link
5. **Rate Limiting**: Consider limiting notification frequency per user

## Troubleshooting

### Email Not Sending

1. **Check SMTP credentials** in `.env`
2. **Check console** for error messages
3. **Verify app password** (for Gmail)
4. **Check firewall** - Port 587 must be open
5. **Test SMTP connection**:
   ```bash
   curl -v smtp://smtp.gmail.com:587
   ```

### User Not Receiving Emails

1. **Check user settings** - Make sure notification type is enabled
2. **Check spam folder**
3. **Verify email address** in database
4. **Check console logs** for "Notification blocked by user settings"

### In-App Notifications Not Showing

1. **Check Notification table** in database
2. **Verify userId** matches logged-in user
3. **Check frontend** notification polling/fetching

## Future Enhancements

- [ ] Add push notifications (FCM/OneSignal)
- [ ] IP geolocation for accurate location
- [ ] Email templates customization
- [ ] SMS notifications
- [ ] Notification scheduling
- [ ] Notification batching (digest emails)
- [ ] A/B testing for notification content
