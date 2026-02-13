# Supabase Setup Instructions

## 1. Create a New Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in:
   - **Name**: realestate-mvp (or any name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to you
4. Click "Create new project" and wait for it to initialize (~2 minutes)

## 2. Get Your Project Credentials

1. Once created, go to **Project Settings** (gear icon)
2. Click on **API** in the left sidebar
3. Copy these values:
   - **Project URL** (starts with https://)
   - **anon/public key** (under "Project API keys")

## 3. Update Your `.env.local` File

Replace the values in `/Users/abhi/Desktop/realestate-mvp/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_PROJECT_URL_HERE
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

## 4. Restart Your Dev Server

In your terminal, press `Ctrl+C` to stop the server, then run:

```bash
npm run dev
```

## 5. The app should now connect successfully!

## Troubleshooting

- If login still fails, check that "Email confirmation" is DISABLED:
  - Go to Authentication → Providers → Email
  - Toggle OFF "Confirm email"
  - Save changes
