-- Migration 006: Standardise lead statuses to 5-bucket system
-- Run in Supabase SQL editor BEFORE deploying the new code.

-- Step 1: Migrate existing status values to the new buckets
UPDATE leads SET status = 'New'          WHERE status IN ('Fresh', 'New');
UPDATE leads SET status = 'Cold'         WHERE status IN ('Attempting', 'Connected', 'VM Done', 'Cold');
UPDATE leads SET status = 'Warm'         WHERE status IN ('Virtual Meeting', 'OBM Done', 'Site Visit', 'Warm');
UPDATE leads SET status = 'Hot'          WHERE status IN ('Negotiation', 'EOI', 'Hot');
UPDATE leads SET status = 'Closed'       WHERE status IN ('Won', 'Closed');
UPDATE leads SET status = 'Disqualified' WHERE status IN ('Lost', 'NC', 'Disqualified');

-- Step 2: Catch-all — anything not yet mapped goes to New
UPDATE leads
  SET status = 'New'
  WHERE status NOT IN ('New', 'Cold', 'Warm', 'Hot', 'Closed', 'Disqualified');

-- Step 3: Add the CHECK constraint (drops old one if it exists)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN ('New', 'Cold', 'Warm', 'Hot', 'Closed', 'Disqualified'));

-- Step 4: Add failed_contact_attempts column for NC auto-Lost logic (Phase 2)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS failed_contact_attempts INTEGER NOT NULL DEFAULT 0;
