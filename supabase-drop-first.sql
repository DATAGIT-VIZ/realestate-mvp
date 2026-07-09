-- ─────────────────────────────────────────────────────────────────────────────
-- REALEDGE — Pre-flight cleanup
-- Step 1: Run THIS file first in Supabase SQL Editor
-- Step 2: Then run supabase-schema.sql
--
-- Safe to run — only drops tables that the new schema will recreate.
-- Does NOT touch auth.users or any Supabase system tables.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS sequence_enrollments  CASCADE;
DROP TABLE IF EXISTS sequence_steps        CASCADE;
DROP TABLE IF EXISTS sequences             CASCADE;
DROP TABLE IF EXISTS lead_activities       CASCADE;
DROP TABLE IF EXISTS routing_rules         CASCADE;
DROP TABLE IF EXISTS saved_reports         CASCADE;
DROP TABLE IF EXISTS billing_events        CASCADE;
DROP TABLE IF EXISTS subscriptions         CASCADE;
DROP TABLE IF EXISTS shared_calculations   CASCADE;
DROP TABLE IF EXISTS portal_leads          CASCADE;
DROP TABLE IF EXISTS notifications         CASCADE;
DROP TABLE IF EXISTS deals                 CASCADE;
DROP TABLE IF EXISTS properties            CASCADE;
DROP TABLE IF EXISTS team_members          CASCADE;
DROP TABLE IF EXISTS leads                 CASCADE;
DROP TABLE IF EXISTS profiles              CASCADE;

-- Drop triggers that reference auth.users (recreated in schema)
DROP TRIGGER  IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user()    CASCADE;
DROP FUNCTION IF EXISTS assign_cs_id()       CASCADE;
DROP FUNCTION IF EXISTS touch_updated_at()   CASCADE;
DROP SEQUENCE IF EXISTS cs_id_seq;
