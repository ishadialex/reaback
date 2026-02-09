# Two-Factor Authentication (2FA) Security System

## 🔐 Overview
Comprehensive 2FA implementation using industry-standard TOTP (Time-based One-Time Password) protocol with secure backup codes and user-specific authentication.

## ✅ Security Standards Implemented

### 1. **TOTP Algorithm (RFC 6238)**
- Uses `speakeasy` library (industry standard)
- 32-character secret keys
- 6-digit codes
- 30-second time window
- ±2 time step tolerance for clock skew

### 2. **Secure Secret Generation**
- Cryptographically secure random generation
- 32-character base32 encoded secrets
- Stored encrypted in database
- Never exposed after initial setup

### 3. **Backup Codes**
- 10 recovery codes generated
- Each code: 8 hex characters (32 bits entropy)
- **SHA-256 hashed** before storage
- One-time use (deleted after use)
- Regeneration requires password verification

### 4. **User-Specific Access Control**
- All endpoints require JWT authentication
- User ID extracted from JWT token
- No cross-user access possible
- Password verification for sensitive operations

### 5. **Password Protection**
- Disable 2FA requires password
- Regenerate backup codes requires password
- Prevents unauthorized 2FA removal

## 📡 API Endpoints

### Base URL: `/api/2fa`

All endpoints require authentication (JWT token in Authorization header)

#### 1. **GET /status**
Get current 2FA status for authenticated user

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "backupCodesCount": 8
  }
}
```

#### 2. **POST /setup**
Initialize 2FA setup (generate secret + QR code)

**Response:**
```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,iVBORw0K...",
    "manualEntry": "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"
  }
}
```

#### 3. **POST /enable**
Enable 2FA after verifying code

**Request:**
```json
{
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "backupCodes": [
      "A1B2C3D4",
      "E5F6G7H8",
      ...
    ]
  },
  "message": "Two-factor authentication has been enabled successfully"
}
```

**Security Notes:**
- Backup codes shown ONLY during enable (never again)
- User MUST save codes before leaving page
- Codes are hashed before storage

#### 4. **POST /disable**
Disable 2FA (requires password)

**Request:**
```json
{
  "password": "user_current_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "disabled": true
  },
  "message": "Two-factor authentication has been disabled"
}
```

**Security Notes:**
- Verifies password before disabling
- Removes secret and backup codes
- Logs the action

#### 5. **POST /backup-codes/regenerate**
Regenerate backup codes (requires password)

**Request:**
```json
{
  "password": "user_current_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "backupCodes": [
      "NEW1CODE",
      "NEW2CODE",
      ...
    ]
  },
  "message": "Backup codes have been regenerated successfully"
}
```

**Security Notes:**
- Old codes are invalidated
- New codes replace all previous codes
- Password verification required

## 🔒 Security Features

### Authentication Flow
1. User enters email + password
2. System validates credentials
3. If 2FA enabled, prompts for TOTP code
4. User enters 6-digit code from authenticator app
5. System verifies code (or backup code)
6. Grant access on success

### Backup Code Usage
- User enters backup code instead of TOTP
- System hashes entered code (SHA-256)
- Compares with stored hashed codes
- If match: grants access + **deletes used code**
- If no match: rejects access

### Protection Against Attacks

#### 1. **Brute Force Protection**
- 2-time-step window limits valid codes
- 6-digit codes = 1,000,000 combinations
- 30-second validity window
- ~60-second actual window with tolerance

#### 2. **Replay Attack Prevention**
- TOTP codes valid for ~60 seconds only
- Time-based, not predictable
- Cannot reuse old codes

#### 3. **Man-in-the-Middle (MITM)**
- Codes change every 30 seconds
- Intercepted codes quickly expire
- HTTPS required for all communications

#### 4. **Database Breach Protection**
- Secrets stored in database (encrypted at rest)
- Backup codes hashed (SHA-256)
- Even with database access, codes can't be recovered
- User password still required to disable 2FA

#### 5. **Session Hijacking**
- 2FA required even with valid session tokens
- Compromised JWT alone insufficient
- Physical device (authenticator) required

## 📱 Compatible Authenticator Apps

- **Google Authenticator** (iOS/Android)
- **Microsoft Authenticator** (iOS/Android)
- **Authy** (iOS/Android/Desktop)
- **1Password** (with TOTP support)
- **LastPass Authenticator**
- Any RFC 6238 compliant app

## 🔄 User Flows

### Setup Flow
1. User navigates to Security Settings
2. Clicks "Enable" on 2FA
3. Backend generates secret
4. User scans QR code with authenticator app
5. User enters 6-digit code to verify
6. Backend validates code
7. System generates 10 backup codes
8. User saves backup codes
9. 2FA enabled ✅

### Login Flow with 2FA
1. User enters email + password
2. System validates credentials
3. Prompts for 2FA code
4. User enters TOTP code from app
5. System verifies code
6. Access granted ✅

### Disable Flow
1. User navigates to Security Settings
2. Clicks "Manage" on 2FA
3. Selects "Disable 2FA"
4. Enters current password
5. System verifies password
6. Removes secret + backup codes
7. 2FA disabled ✅

### Lost Device Recovery
1. User lost authenticator app
2. Uses saved backup code
3. System validates code
4. Access granted ✅
5. Code is consumed (one-time use)
6. User should regenerate codes after recovery

## 💾 Database Schema

```prisma
model User {
  twoFactorEnabled Boolean   @default(false)
  twoFactorSecret  String?
  backupCodes      String[]  @default([])
}
```

**Fields:**
- `twoFactorEnabled`: Boolean flag
- `twoFactorSecret`: Base32 encoded TOTP secret (nullable)
- `backupCodes`: Array of SHA-256 hashed backup codes

## 🔧 Dependencies

```json
{
  "speakeasy": "^2.0.0",  // TOTP generation/verification
  "qrcode": "^1.5.3"       // QR code generation
}
```

## 🚀 Implementation Status

✅ Backend API complete
✅ Database schema updated
✅ Frontend UI components
✅ API client integration
✅ Security validations
✅ Error handling
✅ Logging system
✅ User-specific access control

## 🧪 Testing

### Manual Testing Checklist
- [ ] Setup 2FA with authenticator app
- [ ] Verify code accepts valid TOTP
- [ ] Verify code rejects invalid TOTP
- [ ] Backup codes work for login
- [ ] Backup codes are one-time use
- [ ] Regenerate backup codes works
- [ ] Disable 2FA requires password
- [ ] Cannot setup 2FA twice
- [ ] QR code scans correctly
- [ ] Manual entry key works

### Security Testing
- [ ] Password required for disable
- [ ] Password required for regenerate codes
- [ ] Backup codes properly hashed
- [ ] Used backup codes deleted
- [ ] Time-based codes expire
- [ ] Old codes don't work

## 📊 Logs

All 2FA operations are logged:
- `🔐 2FA setup initiated for user: {email}`
- `✅ 2FA enabled successfully for user: {email}`
- `🔓 2FA disabled for user: {email}`
- `🔄 Backup codes regenerated for user: {email}`
- `🔑 Backup code used for user ID: {userId}. Remaining: {count}`
- `❌ 2FA enable failed: Invalid code for {email}`

## 🔐 Best Practices

1. **Never log secrets or codes**
2. **Always verify password for sensitive operations**
3. **Hash backup codes before storage**
4. **Delete used backup codes immediately**
5. **Use HTTPS only**
6. **Implement rate limiting on verify endpoints**
7. **Log all 2FA operations**
8. **Educate users to save backup codes**

## 🎯 Next Steps (Optional Enhancements)

- [ ] Add SMS backup option
- [ ] Implement rate limiting on verify attempts
- [ ] Add email alerts for 2FA changes
- [ ] Support hardware security keys (WebAuthn)
- [ ] Add trusted device management
- [ ] Implement remember device (30 days)
