-- Run this once in your Supabase SQL editor: https://supabase.com/dashboard/project/_/sql/new
-- Creates the portal_leads ingestion log table.

CREATE TABLE IF NOT EXISTS portal_leads (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  source_portal     text        NOT NULL,
  raw_payload       jsonb       NOT NULL DEFAULT '{}',
  parsed_contact    jsonb,
  ingestion_status  text        NOT NULL CHECK (ingestion_status IN ('created', 'duplicate', 'failed')),
  contact_id        text,
  contact_name      text,
  contact_phone     text,
  error_message     text,
  created_at        timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS portal_leads_source_idx  ON portal_leads(source_portal);
CREATE INDEX IF NOT EXISTS portal_leads_status_idx  ON portal_leads(ingestion_status);
CREATE INDEX IF NOT EXISTS portal_leads_created_idx ON portal_leads(created_at DESC);

-- RLS: service role bypasses automatically; authenticated agents can read logs
ALTER TABLE portal_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated agents can read"
  ON portal_leads FOR SELECT TO authenticated USING (true);

CREATE POLICY "service role can insert"
  ON portal_leads FOR INSERT TO service_role WITH CHECK (true);
