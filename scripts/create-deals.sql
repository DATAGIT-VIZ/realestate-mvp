-- Deals pipeline table for RealEdge CRM
-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS deals (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid        NOT NULL,
  lead_name         text        NOT NULL,
  lead_phone        text,
  twenty_lead_id    text,                            -- links to Twenty CRM person
  property_name     text,
  property_type     text,                            -- '1BHK' | '2BHK' | '3BHK' | 'Villa' | 'Plot'
  locality          text,
  city              text,
  deal_value        bigint,                          -- in rupees (₹)
  stage             text        NOT NULL DEFAULT 'new',
  assigned_to       text,
  expected_close    date,
  source_portal     text,
  notes             text,
  lost_reason       text,
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT deals_stage_check CHECK (
    stage IN ('new', 'site_visit', 'negotiation', 'token_paid', 'won', 'lost')
  )
);

CREATE INDEX IF NOT EXISTS deals_user_idx  ON deals(user_id);
CREATE INDEX IF NOT EXISTS deals_stage_idx ON deals(stage);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own deals"
  ON deals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role bypass (for API routes using getAdminClient)
CREATE POLICY "service role full access"
  ON deals FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
