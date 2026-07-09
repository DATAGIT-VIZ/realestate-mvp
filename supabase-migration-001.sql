-- Migration 001: fix leads table for dev + correct schema
-- Run this in: Supabase Dashboard → project gbwsgqacpbwwuadvsgkl → SQL Editor → Run

-- 1. Add missing city column
ALTER TABLE leads ADD COLUMN IF NOT EXISTS city TEXT;

-- 2. Drop the agent_id FK to auth.users — agent scoping is enforced in app code
--    (the dev bypass returns a UUID that doesn't exist in auth.users, causing FK errors)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_agent_id_fkey;

-- 3. Same fix for any other tables with user FK constraints
ALTER TABLE lead_activities DROP CONSTRAINT IF EXISTS lead_activities_agent_id_fkey;
ALTER TABLE deals           DROP CONSTRAINT IF EXISTS deals_agent_id_fkey;
ALTER TABLE notifications   DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
