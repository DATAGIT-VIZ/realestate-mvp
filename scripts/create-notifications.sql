-- Run this in Supabase SQL editor after create-portal-leads.sql
-- Creates the notifications table for in-app alerts and reminders.

CREATE TABLE IF NOT EXISTS notifications (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  type           text        NOT NULL,  -- follow_up_due | new_lead | hot_lead_inactive | portal_error | morning_digest
  title          text        NOT NULL,
  body           text        NOT NULL,
  lead_id        text,                  -- Twenty person ID (nullable)
  read           boolean     DEFAULT false NOT NULL,
  scheduled_for  timestamptz DEFAULT now() NOT NULL,  -- show only when <= now()
  created_at     timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS notifications_read_idx         ON notifications(read);
CREATE INDEX IF NOT EXISTS notifications_scheduled_idx    ON notifications(scheduled_for DESC);
CREATE INDEX IF NOT EXISTS notifications_created_idx      ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by cron jobs and ingest routes)
CREATE POLICY "service role full access" ON notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated agents can read all notifications
CREATE POLICY "authenticated agents can read" ON notifications
  FOR SELECT TO authenticated USING (true);

-- Authenticated agents can update (mark as read)
CREATE POLICY "authenticated agents can update" ON notifications
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
