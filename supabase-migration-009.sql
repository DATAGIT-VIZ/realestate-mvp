-- Migration 009: Structured call logging — disposition + checklist fields
-- activity_data is JSONB, so no column additions needed for those fields.
-- This migration only adds the NCA-attempt index and the lead-level
-- 'last_disposition' column used by analytics / pipeline views.

-- 1. Store the latest call disposition on the lead for quick filtering
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS last_disposition TEXT,
  ADD COLUMN IF NOT EXISTS last_call_outcome TEXT
    CONSTRAINT leads_last_call_outcome_check
    CHECK (last_call_outcome IN ('connected', 'nca', 'invalid_number', NULL));

-- 2. Index for disposition-based filtering in pipeline views
CREATE INDEX IF NOT EXISTS idx_leads_last_disposition  ON leads(last_disposition);
CREATE INDEX IF NOT EXISTS idx_leads_last_call_outcome ON leads(last_call_outcome);

-- Note: checklist fields (contact_made, requirements, brochure, property_assigned,
-- sv_booked) and disposition details are stored inside activity_data JSONB on
-- the lead_activities table — no column additions required.
