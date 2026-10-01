-- Migration 011: add escalated column for admin priority follow-up visibility
ALTER TABLE leads ADD COLUMN IF NOT EXISTS escalated BOOLEAN NOT NULL DEFAULT false;

-- Partial index — only escalated leads, keeps the index small
CREATE INDEX IF NOT EXISTS leads_escalated_idx ON leads (escalated) WHERE escalated = true;

-- Comment for documentation
COMMENT ON COLUMN leads.escalated IS 'When true, this lead is visible in admin Priority Follow Up regardless of agent ownership';
