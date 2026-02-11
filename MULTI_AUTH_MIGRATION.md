# Multi-Provider Authentication Migration Guide

This document explains the migration from single-provider to multi-provider authentication system.

## 🎯 What Changed

### Before (Single Provider)
```typescript
User {
  email: string
  passwordHash?: string  // Only one auth method at a time
  authProvider: string   // "local" OR "google"
  googleId?: string
}
```

### After (Multi-Provider)
```typescript
User {
  email: string
  accounts: Account[]    // Multiple auth methods!
}

Account {
  userId: string
  provider: string       // "credentials" | "google"
  providerId?: string    // OAuth provider ID
  passwordHash?: string  // For credentials
}
```

## 📋 Benefits

✅ **Multiple Login Methods**: Users can sign in with email/password AND Google
✅ **Automatic Account Linking**: Same email = same account
✅ **Scalable**: Easy to add Apple, Facebook, etc. later
✅ **No Data Loss**: Each auth method preserved separately

## 🚀 Migration Steps

### Step 1: Schema Updated ✅
The Prisma schema has been updated with the new `Account` model.

### Step 2: Database Synced ✅
Run this command to sync the schema with MongoDB:
```bash
npx prisma db push
```

### Step 3: Regenerate Prisma Client

**IMPORTANT**: Stop your development server first!

```bash
# Stop your server (Ctrl+C)

# Regenerate Prisma client
npx prisma generate

# Restart your server
npm run dev
```

### Step 4: Run Data Migration

Migrate existing users to the new Account system:

```bash
npx tsx scripts/migrateToAccounts.ts
```

This will:
- Find all existing users
- Create `Account` records for their auth methods
- Skip users already migrated
- Show detailed progress

**Output Example:**
```
🚀 Starting migration to Account model...

📊 Found 150 users to process

✅ user1@example.com - Migrated 1 account(s): credentials
✅ user2@example.com - Migrated 1 account(s): google
⏭️  user3@example.com - Already migrated (1 account(s))

============================
📈 Migration Summary:
============================
✅ Successfully migrated: 148 users
⏭️  Skipped (already migrated): 2 users
❌ Errors: 0 users
============================
```

### Step 5: Test the System

1. **Test Email/Password Login**
   - Existing users should still be able to log in
   - New registrations should work

2. **Test Google OAuth**
   - Sign in with Google (existing account)
   - Sign in with Google (new account)
   - Sign in with Google using email that has password (should link accounts)

3. **Test Account Linking**
   - Create account with email/password
   - Sign in with Google using same email
   - Should automatically link accounts (can use both methods)

## 🔄 How Account Linking Works

```
User signs in with Google (user@example.com)
         ↓
Does Account exist with this Google ID?
    ├─ YES → Log them in ✅
    └─ NO  → Does User exist with this email?
                ├─ YES → Create Google Account, link to User 🔗
                └─ NO  → Create new User + Google Account 🆕
```

## 🛠️ Rollback (If Needed)

If something goes wrong, the old fields are still in the User model (marked as DEPRECATED). To rollback:

1. Stop using Account queries in controllers
2. Revert to old auth logic
3. Remove Account model from schema

## 📝 Code Changes Summary

### Updated Files:
- ✅ `prisma/schema.prisma` - Added Account model
- ✅ `src/controllers/auth.controller.ts` - Updated login/register
- ✅ `src/controllers/oauth.controller.ts` - Added account linking logic
- ✅ `scripts/migrateToAccounts.ts` - Data migration script

### Key Changes:

**Login (Email/Password):**
```typescript
// OLD
const user = await prisma.user.findUnique({
  where: { email },
  select: { passwordHash: true }
});

// NEW
const user = await prisma.user.findUnique({
  where: { email },
  include: {
    accounts: { where: { provider: "credentials" } }
  }
});
const passwordHash = user.accounts[0]?.passwordHash;
```

**Google OAuth:**
```typescript
// OLD
user = await prisma.user.create({
  data: { email, googleId, authProvider: "google" }
});

// NEW
user = await prisma.user.create({
  data: {
    email,
    accounts: {
      create: { provider: "google", providerId: googleId }
    }
  }
});
```

## 🔐 Security Notes

- Each Account has unique constraints:
  - `@@unique([userId, provider])` - One provider per user
  - `@@index([provider, providerId])` - Fast OAuth lookups
- Password hashes remain encrypted in Account model
- Email verification status preserved on User model

## 📞 Support

If you encounter any issues during migration:
1. Check the migration script output for errors
2. Verify Prisma client regenerated successfully
3. Check server logs for detailed error messages
4. Review this document for troubleshooting steps

---

**Next Steps**: After successful migration, the old fields (passwordHash, authProvider, googleId) can be removed from the User model in a future update.
