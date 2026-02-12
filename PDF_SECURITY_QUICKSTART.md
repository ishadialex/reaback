# 🔒 PDF Security Upgrade - Quick Start

## ✅ What Changed

Your PDF system has been upgraded from **passcode-in-URL** to **secure JWT token-based access**.

### Before (Insecure):
```
https://reaback.onrender.com/api/pdf/serve/file.pdf?passcode=Access2026
                                                     ^^^^^^^^^ EXPOSED!
```

### After (Secure):
```
https://reaback.onrender.com/api/pdf/serve/file.pdf?token=eyJhbGc...
                                                     ^^^^^ SECURE TOKEN (expires in 1h)
```

---

## 🚀 How to Use (Quick Test)

### Step 1: Get Token

```bash
curl -X POST http://localhost:4001/api/pdf/verify-passcode \
  -H "Content-Type: application/json" \
  -d '{"passcode":"Access2026"}'
```

**Response:**
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

### Step 2: Access PDF with Token

```
http://localhost:4001/api/pdf/serve/available-arbitrary-opportunities.pdf?token=YOUR_TOKEN_HERE
```

**Or using Authorization header:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  http://localhost:4001/api/pdf/serve/available-arbitrary-opportunities.pdf
```

---

## ⏰ Token Expiry

- **Default:** 1 hour
- **Configurable:** Change `PDF_TOKEN_EXPIRY` in `.env`
- **After expiry:** User must re-enter passcode to get new token

---

## 🔐 Security Benefits

| Feature | Old System | New System |
|---------|------------|------------|
| Passcode in URL | ❌ Visible | ✅ Hidden |
| Expiration | ❌ Never | ✅ 1 hour |
| Browser History | ❌ Passcode saved | ✅ Token only |
| Sharing | ❌ Easy forever | ✅ Expires quickly |

---

## 📝 Environment Variables

Updated in `.env`:

```env
PDF_ACCESS_PASSCODES="Access2026,Partner2024"
PDF_TOKEN_EXPIRY="1h"
```

---

## 📚 Full Documentation

See [SECURE_PDF_TOKEN_SYSTEM.md](./SECURE_PDF_TOKEN_SYSTEM.md) for complete details.

**Your PDFs are now truly secure!** 🎉🔒
