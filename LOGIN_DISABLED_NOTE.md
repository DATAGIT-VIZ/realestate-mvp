# Login Functionality - TEMPORARILY DISABLED

## Current Status
Login and authentication have been temporarily disabled to bypass technical issues. The app now:
- Redirects directly to `/dashboard` from homepage
- Shows a demo user email: `demo@example.com`
- Skips all Supabase authentication checks

## Files Modified
1. **`app/page.tsx`** - Now redirects directly to dashboard without auth check
2. **`app/dashboard/layout.tsx`** - Auth check commented out, using demo user

## To Re-Enable Login Later

### Step 1: Restore Homepage Auth Check
In `app/page.tsx`, uncomment the auth check code and remove the direct redirect

### Step 2: Restore Dashboard Auth Check  
In `app/dashboard/layout.tsx`, uncomment the `checkAuth` function and `onAuthStateChange` listener

### Step 3: Restore Logout Functionality
In `app/dashboard/layout.tsx`, uncomment the `handleLogout` function

### Step 4: Fix the Root Issue
The login was disabled due to:
- **EMFILE error**: "too many open files" preventing Next.js from finding pages
- **Solution**: Run `ulimit -n 65536` before starting dev server
- Or use production build: `npm run build && npm start`

## Quick Test
To test if issues are fixed:
1. Run: `ulimit -n 65536`
2. Start server: `npm run dev`
3. Visit: `http://localhost:3000/login`
4. If login page loads successfully, you can re-enable auth

---
*Created: January 30, 2026*
*Login page still exists at: `app/login/page.tsx`*
