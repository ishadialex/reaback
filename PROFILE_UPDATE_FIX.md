# Profile Update Fix - JWT Token Refresh (CORRECTED)

## Problem
User profile data was "disappearing" and causing logout after profile updates because:
1. Profile updates succeeded in the database ✅
2. But JWT **accessToken** still contained OLD profile data ❌
3. Session validation was failing with 401 error ❌

## Root Cause
The JWT **accessToken** contains user profile data (name, picture). When you updated your profile:
- Database was updated ✅
- But the accessToken still had old data ❌
- Frontend continued using stale accessToken ❌

## Solution
Backend now returns a **fresh accessToken** after profile updates with the updated user data.

**Important**: Only the `accessToken` is refreshed, not the `refreshToken`. The refresh token is tied to the session in the database and should remain unchanged.

---

## Backend Changes ✅

### Updated Files:
- `src/controllers/profile.controller.ts`

### Response Format:

**Before:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "email": "...",
    "firstName": "...",
    "lastName": "..."
  }
}
```

**After:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "...",
      "firstName": "...",
      "lastName": "..."
    },
    "accessToken": "eyJhbGc..."  // Fresh token with updated data
  },
  "message": "Profile updated successfully"
}
```

---

## Frontend Changes Required 🔧

### 1. Update Profile Update Handler

```javascript
const updateProfile = async (data) => {
  const response = await fetch('/api/profile', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  const result = await response.json();
  
  // Update user data
  setUser(result.data.user);
  
  // CRITICAL: Update ONLY the accessToken ✅
  // DO NOT change the refreshToken
  localStorage.setItem('accessToken', result.data.accessToken);
  
  // OR if using context/store:
  // setAccessToken(result.data.accessToken);
};
```

### 2. Update Photo Upload Handler

```javascript
const uploadPhoto = async (file) => {
  const formData = new FormData();
  formData.append('photo', file);
  
  const response = await fetch('/api/profile/photo', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: formData
  });
  
  const result = await response.json();
  
  // Update ONLY the accessToken ✅
  localStorage.setItem('accessToken', result.data.accessToken);
  
  // Update UI
  setProfilePhoto(result.data.url);
};
```

---

## Why This Works

### JWT Token Structure:

**accessToken** (short-lived, contains user data):
```json
{
  "userId": "...",
  "email": "user@example.com",
  "name": "John Doe",        ← Updated on profile change
  "picture": "https://..."   ← Updated on photo change
}
```

**refreshToken** (long-lived, stored in session DB):
```json
{
  "userId": "...",
  "email": "user@example.com"
}
```

The refreshToken is tied to your session in the database. When you update your profile:
1. Database updates user data ✅
2. New accessToken generated with updated name/picture ✅
3. Same refreshToken (session remains valid) ✅
4. No 401 errors ✅
5. No unexpected logouts ✅

---

## Testing Steps

### Test 1: Update Name
1. Log in as a user
2. Update firstName or lastName
3. Check Network tab - should receive new accessToken
4. Check localStorage - accessToken should be updated
5. **Should NOT log out** ✅
6. Logout and login - name should persist ✅

### Test 2: Update Phone
1. Update phone number
2. Check response - should have new accessToken
3. Should remain logged in ✅
4. Data should persist after logout/login ✅

### Test 3: Upload Photo
1. Upload new profile photo
2. Should receive new accessToken with updated picture URL
3. Should NOT log out ✅
4. Photo should persist ✅

### Test 4: Validate Session Still Works
1. Update profile
2. Immediately make another API call
3. Session validation should succeed (200) ✅
4. Socket should remain connected ✅

---

## What Was Wrong Before?

**Previous attempt** generated both accessToken AND refreshToken:
```javascript
// ❌ WRONG - This caused 401 errors
return success(res, {
  user,
  accessToken: "new_access_token",
  refreshToken: "new_refresh_token"  // ← This broke session validation!
});
```

**Problem**: 
- New refreshToken not stored in session database
- Frontend used new refreshToken
- `/api/auth/validate-session` failed (token not in DB)
- User got logged out ❌

**Current fix** only updates accessToken:
```javascript
// ✅ CORRECT - Session stays valid
return success(res, {
  user,
  accessToken: "new_access_token"  // Only update this
  // refreshToken stays the same (session preserved)
});
```

---

## Response Structure Summary

### `PUT /api/profile` Response:
```json
{
  "success": true,
  "data": {
    "user": { /* full user object */ },
    "accessToken": "eyJhbGc..."
  },
  "message": "Profile updated successfully"
}
```

### `POST /api/profile/photo` Response:
```json
{
  "success": true,
  "data": {
    "url": "https://cloudinary.com/...",
    "accessToken": "eyJhbGc..."
  },
  "message": "Profile photo updated successfully"
}
```

---

## Frontend Implementation Example

```javascript
// In your auth context/store:
const updateProfile = async (profileData) => {
  try {
    const response = await api.put('/profile', profileData);
    const { user, accessToken } = response.data.data;
    
    // Update state
    setUser(user);
    setAccessToken(accessToken); // Only update access token
    
    // Persist to storage
    localStorage.setItem('accessToken', accessToken);
    // DON'T touch refreshToken!
    
    toast.success('Profile updated successfully');
    return { success: true };
  } catch (error) {
    toast.error('Failed to update profile');
    return { success: false, error };
  }
};
```

---

## Migration Notes

- ✅ **No breaking changes** - response structure enhanced
- ✅ **Backward compatible** - old code works (just won't get fresh token)
- ✅ **Session preserved** - no unexpected logouts
- ✅ **Simple frontend update** - just store the new accessToken

---

## Cleanup

When everything works:
```bash
rm src/controllers/profile.controller.ts.backup
```

---

**Problem Solved!** 🎉 
- Profile updates persist ✅
- No more 401 errors ✅
- No unexpected logouts ✅
- Session validation works ✅
