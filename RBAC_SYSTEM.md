# Role-Based Access Control (RBAC) System

Complete role-based authentication and user management system for Alvarado backend.

---

## User Roles

Three role levels with hierarchical permissions:

| Role | Description | Access Level |
|------|-------------|--------------|
| **user** | Regular user (default) | Standard dashboard, investments, transactions |
| **admin** | Administrator | All user features + admin panel access |
| **superadmin** | Super Administrator | All admin features + user role management |

---

## Setup Instructions

### 1. Stop Backend & Regenerate Prisma Client

The `role` field was added to the User schema. You must regenerate the Prisma client:

```bash
cd backend

# Stop the backend server (Ctrl+C)

# Regenerate Prisma client with new role field
npx prisma generate

# Push schema changes to database (if needed)
npx prisma db push
```

### 2. Create Your First Admin User

Run the interactive admin creation script:

```bash
npm run db:seed:admin
```

You'll be prompted for:
- Admin Email
- Admin Password
- First Name
- Last Name

The script will create a **superadmin** user with full permissions.

**Example:**
```
🔐 Admin User Setup
==================================================

Admin Email: admin@alvarado.com
Admin Password: Admin1234!
First Name: John
Last Name: Admin

✅ Admin user created successfully!

==================================================
Admin Details:
==================================================
Email:    admin@alvarado.com
Name:     John Admin
Role:     superadmin
ID:       65f1234567890abcdef12345
==================================================

✨ You can now log in with these credentials
   and access all admin endpoints!
```

### 3. Start Backend

```bash
npm run dev
```

---

## Authentication Methods

Admin endpoints now support **TWO authentication methods**:

### Method 1: API Key (Legacy - Still Supported)

```
Authorization: Bearer YOUR_ADMIN_API_KEY
```

Used in Postman for quick testing.

### Method 2: JWT with Admin Role (New - Recommended)

1. **Login** as admin user via `/api/auth/login`
2. Use the returned `accessToken` in Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The middleware checks:
- Valid JWT token
- User exists
- User is active (`isActive: true`)
- User has `admin` or `superadmin` role

---

## Admin User Management API

All endpoints require **admin** or **superadmin** role (or API key).

### Base URL

```
http://localhost:4000/api/admin/users
```

---

### 1. Get All Users

**GET** `/api/admin/users`

**Query Parameters:**
- `role` - Filter by: `user`, `admin`, or `superadmin`
- `kycStatus` - Filter by: `none`, `pending`, `verified`, or `rejected`
- `isActive` - Filter by: `true` or `false`
- `search` - Search in email, firstName, lastName
- `limit` - Max results (default: 50)
- `offset` - Pagination offset (default: 0)

**Example:**
```
GET http://localhost:4000/api/admin/users?role=admin&isActive=true
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "65f...",
        "email": "admin@alvarado.com",
        "firstName": "John",
        "lastName": "Admin",
        "phone": "",
        "role": "superadmin",
        "emailVerified": true,
        "twoFactorEnabled": false,
        "kycStatus": "verified",
        "balance": 0,
        "isActive": true,
        "createdAt": "2026-02-08T...",
        "updatedAt": "2026-02-08T..."
      }
    ],
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```

---

### 2. Get User Stats

**GET** `/api/admin/users/stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 150,
    "activeUsers": 142,
    "inactiveUsers": 8,
    "verifiedUsers": 95,
    "adminCount": 3,
    "superadminCount": 1,
    "regularUsers": 146
  }
}
```

---

### 3. Get Single User

**GET** `/api/admin/users/:id`

Returns full user details including transaction/investment counts.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "65f...",
    "email": "demo@alvarado.com",
    "firstName": "Demo",
    "lastName": "User",
    "phone": "+1 (555) 123-4567",
    "dateOfBirth": "",
    "nationality": "American",
    "address": "123 Main Street",
    "city": "Miami",
    "state": "FL",
    "postalCode": "33101",
    "country": "United States",
    "profilePhoto": null,
    "bio": "Real estate enthusiast",
    "occupation": "Software Engineer",
    "role": "user",
    "emailVerified": true,
    "twoFactorEnabled": false,
    "kycStatus": "verified",
    "balance": 25000,
    "referralCode": "DEMO2024",
    "isActive": true,
    "createdAt": "2026-02-08T...",
    "updatedAt": "2026-02-08T...",
    "_count": {
      "transactions": 15,
      "investments": 3,
      "referrals": 2,
      "sessions": 1
    }
  }
}
```

---

### 4. Update User Role

**PATCH** `/api/admin/users/:id/role`

**Body:**
```json
{
  "role": "admin"
}
```

**Valid Roles:**
- `user` (default)
- `admin`
- `superadmin`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "65f...",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "admin"
  },
  "message": "User role updated to admin"
}
```

---

### 5. Update User Status (Activate/Deactivate)

**PATCH** `/api/admin/users/:id/status`

**Body:**
```json
{
  "isActive": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "65f...",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "isActive": false
  },
  "message": "User deactivated"
}
```

When `isActive: false`:
- User cannot log in
- Existing sessions are invalidated
- API requests return 403 Forbidden

---

### 6. Update KYC Status

**PATCH** `/api/admin/users/:id/kyc`

**Body:**
```json
{
  "kycStatus": "verified"
}
```

**Valid Statuses:**
- `none` - Not submitted
- `pending` - Under review
- `verified` - Approved
- `rejected` - Denied

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "65f...",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "kycStatus": "verified"
  },
  "message": "KYC status updated to verified"
}
```

**Note:** User receives a notification when KYC status changes.

---

## Using Role Middleware in Your Routes

The `requireRole()` middleware can be added to any route that needs role-based access.

### Example: Admin-Only Route

```typescript
import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

// Requires authentication + admin or superadmin role
router.use(authenticate);
router.use(requireRole("admin", "superadmin"));

router.get("/dashboard", getAdminDashboard);
router.post("/settings", updateSettings);

export default router;
```

### Example: Superadmin-Only Route

```typescript
router.delete("/users/:id",
  authenticate,
  requireRole("superadmin"),
  deleteUser
);
```

### Example: Multiple Routes with Different Permissions

```typescript
const router = Router();

// All routes need authentication
router.use(authenticate);

// Anyone can view
router.get("/reports", getReports);

// Admins can create
router.post("/reports", requireRole("admin", "superadmin"), createReport);

// Only superadmins can delete
router.delete("/reports/:id", requireRole("superadmin"), deleteReport);
```

---

## Admin Properties Routes Updated

The properties admin routes now support **both** authentication methods:

```typescript
// backend/src/routes/admin/properties.routes.ts
router.use(adminAuthFlexible); // Accepts API Key OR JWT with admin role
```

This means you can:
1. Use Postman with API Key (quick testing)
2. Build a web admin panel that logs in users with admin role

---

## Workflow Examples

### Example 1: Promote User to Admin

**Scenario:** `user@example.com` should become an admin.

**Steps:**
1. Find user ID:
   ```
   GET /api/admin/users?search=user@example.com
   ```
2. Update role:
   ```
   PATCH /api/admin/users/65f.../role
   Body: { "role": "admin" }
   ```
3. User can now access admin endpoints on next login

---

### Example 2: Deactivate Suspicious Account

**Scenario:** Disable account `suspicious@example.com`.

**Steps:**
1. Find user:
   ```
   GET /api/admin/users?search=suspicious@example.com
   ```
2. Deactivate:
   ```
   PATCH /api/admin/users/65f.../status
   Body: { "isActive": false }
   ```
3. User immediately loses access (active sessions terminated)

---

### Example 3: Approve KYC Verification

**Scenario:** User submitted KYC documents for review.

**Steps:**
1. Get pending KYC users:
   ```
   GET /api/admin/users?kycStatus=pending
   ```
2. Review user details:
   ```
   GET /api/admin/users/65f...
   ```
3. Approve or reject:
   ```
   PATCH /api/admin/users/65f.../kyc
   Body: { "kycStatus": "verified" }
   ```
4. User receives notification and gains full access

---

## Security Best Practices

### 1. Role Assignment

- **Never** assign `superadmin` role unless absolutely necessary
- Use `admin` role for most administrative tasks
- Regularly audit admin user list:
  ```
  GET /api/admin/users?role=admin
  GET /api/admin/users?role=superadmin
  ```

### 2. Account Management

- Deactivate (`isActive: false`) instead of deleting users
- Monitor admin activity via logs
- Use 2FA for all admin accounts (enable in user settings)

### 3. API Key vs JWT

- **API Key**: Use for server-to-server or Postman testing
- **JWT**: Use for web admin panels (better audit trail with userId)
- Rotate API keys periodically (update `.env`)

---

## Database Direct Access

If you need to promote a user to admin directly via database:

```typescript
// Using Prisma Studio (npm run db:studio)
// Or MongoDB Compass
// Or via CLI:

await prisma.user.update({
  where: { email: "admin@example.com" },
  data: { role: "superadmin" }
});
```

---

## Testing with Postman

### Setup

1. **Create Admin User**:
   ```bash
   cd backend && npm run db:seed:admin
   ```

2. **Login as Admin**:
   ```
   POST http://localhost:4000/api/auth/login
   Body: {
     "email": "admin@alvarado.com",
     "password": "Admin1234!"
   }
   ```

3. **Save Access Token**:
   ```json
   {
     "success": true,
     "data": {
       "accessToken": "eyJhbGci...",
       "refreshToken": "eyJhbGci...",
       "user": { "role": "superadmin", ... }
     }
   }
   ```

4. **Use in Subsequent Requests**:
   ```
   Authorization: Bearer eyJhbGci...
   ```

### Test User Management

```
# List all users
GET /api/admin/users

# Get stats
GET /api/admin/users/stats

# Promote user to admin
PATCH /api/admin/users/65f.../role
Body: { "role": "admin" }

# Deactivate user
PATCH /api/admin/users/65f.../status
Body: { "isActive": false }

# Approve KYC
PATCH /api/admin/users/65f.../kyc
Body: { "kycStatus": "verified" }
```

---

## Migration Guide

If you have existing users in your database:

1. **Stop backend**
2. **Run Prisma generate**:
   ```bash
   cd backend && npx prisma generate
   ```
3. **Push schema changes**:
   ```bash
   npx prisma db push
   ```
4. **All existing users automatically get `role: "user"` (default)**
5. **Create admin user**:
   ```bash
   npm run db:seed:admin
   ```
6. **Start backend**

---

## Error Responses

**401 - Not Authenticated:**
```json
{
  "success": false,
  "message": "Authentication required"
}
```

**403 - Insufficient Permissions:**
```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

**403 - Account Deactivated:**
```json
{
  "success": false,
  "message": "Account is deactivated"
}
```

**404 - User Not Found:**
```json
{
  "success": false,
  "message": "User not found"
}
```

---

## Summary

✅ **Added** `role` field to User schema (`user` | `admin` | `superadmin`)
✅ **Created** `requireRole()` middleware for route protection
✅ **Created** `adminAuthFlexible` middleware (supports API Key OR JWT)
✅ **Created** 6 user management endpoints
✅ **Updated** admin properties routes to support role-based auth
✅ **Created** interactive admin user creation script
✅ **Backward compatible** - existing API key authentication still works

You can now manage user roles directly from the database and control admin access programmatically!
