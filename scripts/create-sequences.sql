-- Outreach sequences: drip campaigns across WhatsApp + call reminders

CREATE TABLE IF NOT EXISTS sequences (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text    NOT NULL,
  description text,
  active      boolean DEFAULT true NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

-- Individual steps in a sequence
CREATE TABLE IF NOT EXISTS sequence_steps (
  id           uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id  uuid    NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  step_order   int     NOT NULL,                     -- 0-indexed day offset
  delay_days   int     NOT NULL DEFAULT 0,           -- days after previous step (0 = same day)
  channel      text    NOT NULL CHECK (channel IN ('whatsapp', 'call_reminder', 'note')),
  template_name text,                                -- Interakt template name (for whatsapp)
  message_body text,                                 -- for note / call_reminder
  created_at   timestamptz DEFAULT now() NOT NULL
);

-- Per-lead enrollment tracking
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id            uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id   uuid    NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  lead_id       text    NOT NULL,                    -- Twenty person ID
  lead_name     text,
  lead_phone    text,
  current_step  int     DEFAULT 0 NOT NULL,          -- next step index to fire
  status        text    DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'stopped')),
  enrolled_at   timestamptz DEFAULT now() NOT NULL,
  next_fire_at  timestamptz DEFAULT now() NOT NULL,  -- when to fire current_step
  completed_at  timestamptz,
  stopped_reason text                                -- 'replied' | 'manual' | 'finished'
);

CREATE INDEX IF NOT EXISTS seq_enrollments_status_idx   ON sequence_enrollments(status);
CREATE INDEX IF NOT EXISTS seq_enrollments_fire_idx     ON sequence_enrollments(next_fire_at);
CREATE INDEX IF NOT EXISTS seq_enrollments_lead_idx     ON sequence_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS seq_steps_order_idx          ON sequence_steps(sequence_id, step_order);

ALTER TABLE sequences           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_steps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth full access" ON sequences            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth full access" ON sequence_steps       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth full access" ON sequence_enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "svc full access"  ON sequences            FOR ALL TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY "svc full access"  ON sequence_steps       FOR ALL TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY "svc full access"  ON sequence_enrollments FOR ALL TO service_role  USING (true) WITH CHECK (true);
