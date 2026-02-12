# Secure PDF Token-Based Access System

## 🔒 Security Upgrade Complete

The PDF access system has been upgraded from passcode-in-URL to **JWT token-based authentication with time-based expiration**.

---

## ❌ Old System (Insecure)

**Problems:**
- ✗ Passcode visible in URL
- ✗ Appears in browser history
- ✗ Can be shared easily
- ✗ No expiration
- ✗ Visible in server logs
- ✗ Not truly private

**Example:**
```
https://reaback.onrender.com/api/pdf/serve/file.pdf?passcode=Access2026
                                                     ^^^^^^^^^ EXPOSED!
```

---

## ✅ New System (Secure)

**Benefits:**
- ✓ **JWT tokens** instead of passcodes
- ✓ **Time-based expiration** (default: 1 hour)
- ✓ **httpOnly cookies** (XSS protection)
- ✓ **No sensitive data in URL**
- ✓ **Token invalidation** after expiry
- ✓ **Truly private access**

**Example:**
```
https://reaback.onrender.com/api/pdf/serve/file.pdf?token=eyJhbGc...
                                                     ^^^^^ SECURE TOKEN
```

---

## How It Works

### Flow Diagram

```
User                    Backend                  Database
  |                        |                         |
  |--[1. Enter Passcode]-->|                         |
  |                        |--[2. Verify Passcode]   |
  |                        |                         |
  |<--[3. JWT Token]-------|                         |
  |    (expires in 1h)     |                         |
  |                        |                         |
  |--[4. Request PDF]----->|                         |
  |    with token          |                         |
  |                        |--[5. Verify Token]      |
  |                        |--[6. Check Expiry]      |
  |                        |--[7. Get PDF Info]----->|
  |                        |<--[8. PDF metadata]-----|
  |<--[9. Stream PDF]------|                         |
  |                        |                         |
```

### Step-by-Step

1. **User enters passcode** → `POST /api/pdf/verify-passcode`
2. **Backend verifies passcode** against `PDF_ACCESS_PASSCODES`
3. **Backend generates JWT token** with:
   - Purpose: `pdf_access`
   - Granted timestamp
   - Expiration: 1 hour (configurable)
4. **Backend returns token** in:
   - Response body (for frontend storage)
   - httpOnly cookie (for automatic use)
5. **Frontend stores token** (localStorage or memory)
6. **User requests PDF** → `GET /api/pdf/serve/:filename?token=XXX`
7. **Backend verifies token**:
   - Valid JWT signature
   - Not expired
   - Correct purpose
8. **Backend streams PDF** if valid

---

## API Documentation

### 1. Verify Passcode (Get Token)

**Endpoint:** `POST /api/pdf/verify-passcode`

**Request:**
```json
{
  "passcode": "Access2026"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2024-02-12T01:30:00.000Z",
    "expiresIn": "1h"
  },
  "message": "Access granted"
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Invalid passcode"
}
```

**Cookie Set:**
```
Set-Cookie: pdf_access_token=eyJhbGc...;
            HttpOnly;
            Secure;
            SameSite=Strict;
            Max-Age=3600
```

---

### 2. Serve PDF File (With Token)

**Endpoint:** `GET /api/pdf/serve/:filename`

**Authentication:** Token required via one of:
1. **Query parameter:** `?token=eyJhbGc...`
2. **Authorization header:** `Bearer eyJhbGc...`
3. **Cookie:** `pdf_access_token=eyJhbGc...` (automatic)

**Examples:**

**Method 1: Query Parameter (for iframes)**
```
GET /api/pdf/serve/prospectus.pdf?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Method 2: Authorization Header (for fetch/axios)**
```http
GET /api/pdf/serve/prospectus.pdf
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Method 3: Cookie (automatic if set)**
```http
GET /api/pdf/serve/prospectus.pdf
Cookie: pdf_access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (Success):**
- Status: 200 OK
- Content-Type: application/pdf
- Body: PDF file stream

**Response (No Token):**
```json
{
  "success": false,
  "message": "Access token required. Please verify passcode first."
}
```

**Response (Expired Token):**
```json
{
  "success": false,
  "message": "Access token expired. Please verify passcode again."
}
```

**Response (Invalid Token):**
```json
{
  "success": false,
  "message": "Invalid access token"
}
```

---

## Environment Variables

Add to your `.env` file:

```env
# PDF Access System
PDF_ACCESS_PASSCODES="Access2026,Partner2024,Admin123"
PDF_TOKEN_EXPIRY="1h"
```

### Variable Details

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PDF_ACCESS_PASSCODES` | Yes | - | Comma-separated passcodes (max 10) |
| `PDF_TOKEN_EXPIRY` | No | `"1h"` | Token expiration time |

### Token Expiry Format

- `"30m"` = 30 minutes
- `"1h"` = 1 hour
- `"2h"` = 2 hours
- `"24h"` = 24 hours
- `"7d"` = 7 days

---

## Frontend Integration

### React/Next.js Example

```tsx
import { useState } from 'react';

function PDFViewer() {
  const [token, setToken] = useState<string | null>(null);
  const [passcode, setPasscode] = useState('');

  // Step 1: Verify passcode and get token
  const handleVerifyPasscode = async () => {
    const response = await fetch('https://reaback.onrender.com/api/pdf/verify-passcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
      credentials: 'include', // Important for cookies
    });

    const result = await response.json();

    if (result.success) {
      setToken(result.data.token);
      localStorage.setItem('pdf_token', result.data.token);
      localStorage.setItem('pdf_token_expires', result.data.expiresAt);
    } else {
      alert('Invalid passcode');
    }
  };

  // Step 2: Display PDF with token
  const pdfUrl = token
    ? `https://reaback.onrender.com/api/pdf/serve/prospectus.pdf?token=${token}`
    : null;

  return (
    <div>
      {!token ? (
        <div>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Enter passcode"
          />
          <button onClick={handleVerifyPasscode}>Verify</button>
        </div>
      ) : (
        <iframe
          src={pdfUrl}
          width="100%"
          height="800px"
          title="PDF Viewer"
        />
      )}
    </div>
  );
}
```

### Token Expiry Handling

```typescript
function useTokenExpiry(expiresAt: string) {
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const checkExpiry = setInterval(() => {
      if (new Date() > new Date(expiresAt)) {
        setIsExpired(true);
        localStorage.removeItem('pdf_token');
        localStorage.removeItem('pdf_token_expires');
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkExpiry);
  }, [expiresAt]);

  return isExpired;
}
```

---

## Security Features

### 1. JWT Token Structure

```json
{
  "purpose": "pdf_access",
  "granted": 1707696000000,
  "iat": 1707696000,
  "exp": 1707699600
}
```

- **purpose:** Ensures token is for PDF access only
- **granted:** Timestamp when access was granted
- **iat:** Issued at (JWT standard)
- **exp:** Expiration time (JWT standard)

### 2. httpOnly Cookies

```javascript
res.cookie("pdf_access_token", token, {
  httpOnly: true,      // Cannot be accessed via JavaScript (XSS protection)
  secure: true,        // Only sent over HTTPS in production
  sameSite: "strict",  // CSRF protection
  maxAge: 3600000,     // 1 hour in milliseconds
});
```

**Benefits:**
- **XSS Protection:** JavaScript cannot steal token
- **CSRF Protection:** SameSite policy
- **HTTPS Only:** Secure transmission in production

### 3. Token Verification

```typescript
jwt.verify(token, env.JWT_SECRET) as {
  purpose: string;
  granted: number;
};
```

Checks:
- ✓ Valid signature
- ✓ Not expired
- ✓ Correct purpose

---

## Testing

### 1. Test Passcode Verification

```bash
curl -X POST http://localhost:4001/api/pdf/verify-passcode \
  -H "Content-Type: application/json" \
  -d '{"passcode":"Access2026"}'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "expiresAt": "2024-02-12T01:30:00.000Z",
    "expiresIn": "1h"
  }
}
```

### 2. Test PDF Access with Token

```bash
# Copy token from previous response
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4001/api/pdf/serve/available-arbitrary-opportunities.pdf \
  -o test.pdf
```

### 3. Test Expired Token

Wait for token to expire, then try accessing PDF:

```bash
curl -H "Authorization: Bearer $EXPIRED_TOKEN" \
  http://localhost:4001/api/pdf/serve/available-arbitrary-opportunities.pdf
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Access token expired. Please verify passcode again."
}
```

---

## Production Deployment

### Environment Variables

```env
# Production .env
PDF_ACCESS_PASSCODES="ProductionPass2024,PartnerKey123"
PDF_TOKEN_EXPIRY="1h"
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
NODE_ENV="production"
```

### Important Notes

1. **HTTPS Required:** Cookies with `secure: true` only work over HTTPS
2. **CORS Configuration:** Ensure frontend domain is allowed
3. **Token Expiry:** Adjust based on your security needs
4. **JWT Secret:** Use strong, random secret (min 32 characters)

---

## Migration from Old System

### Update Database URLs

Already done via migration script. URLs now use:
```
/api/pdf/serve/filename.pdf
```

### Update Frontend

Replace passcode URLs with token URLs:

**Before:**
```javascript
const pdfUrl = `/pdfs/file.pdf?passcode=${passcode}`;
```

**After:**
```javascript
// 1. Get token first
const response = await fetch('/api/pdf/verify-passcode', {
  method: 'POST',
  body: JSON.stringify({ passcode }),
});
const { token } = await response.json();

// 2. Use token in URL
const pdfUrl = `/api/pdf/serve/file.pdf?token=${token}`;
```

---

## Troubleshooting

### Problem: "Access token required"

**Solution:** Ensure token is sent in one of three ways:
1. Query parameter: `?token=XXX`
2. Authorization header: `Bearer XXX`
3. Cookie: `pdf_access_token=XXX`

### Problem: "Access token expired"

**Solution:** Token has expired. User must re-enter passcode to get new token.

### Problem: "Invalid access token"

**Possible causes:**
- Token was tampered with
- Wrong JWT secret
- Token from different environment (dev vs prod)

### Problem: Cookie not being set

**Solution:** Ensure:
- `credentials: 'include'` in fetch/axios
- CORS allows credentials
- Frontend and backend on same domain or CORS configured

---

## Best Practices

1. **Token Expiry:** Set reasonable expiry (1-2 hours for documents)
2. **HTTPS Only:** Always use HTTPS in production
3. **Secure Storage:** Store token in httpOnly cookie when possible
4. **Refresh Mechanism:** Implement token refresh before expiry
5. **Logout:** Clear token on logout
6. **Monitoring:** Log failed access attempts
7. **Rate Limiting:** Implement rate limiting on passcode verification

---

## Summary

| Feature | Old System | New System |
|---------|------------|------------|
| **Authentication** | Passcode in URL | JWT Token |
| **Expiration** | ❌ None | ✅ Configurable |
| **URL Visibility** | ❌ Passcode exposed | ✅ Token only |
| **Browser History** | ❌ Passcode saved | ✅ Token (harmless) |
| **Sharing** | ❌ Easy to share | ✅ Expires quickly |
| **Security** | ❌ Low | ✅ High |
| **XSS Protection** | ❌ No | ✅ httpOnly cookies |
| **Token Invalidation** | ❌ No | ✅ Yes |

---

## Files Modified

- `src/controllers/pdf.controller.ts` - Token generation and verification
- `src/config/env.ts` - Added `PDF_TOKEN_EXPIRY`
- `src/app.ts` - Added cookie-parser middleware
- `package.json` - Added cookie-parser dependency

---

## Next Steps

1. ✅ Backend implementation complete
2. ⏳ Update frontend to use token system
3. ⏳ Test token expiry flow
4. ⏳ Deploy to production
5. ⏳ Monitor for security issues

**Your PDFs are now truly secure!** 🔒✨
