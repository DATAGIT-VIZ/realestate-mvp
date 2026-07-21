-- Migration 004: Lead assignment (distribution to agents)
-- Run this in Supabase SQL editor before using the Distribute feature.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS assigned_to UUID,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- No FK constraint: team_members are scoped per workspace and the admin client
-- handles referential integrity at the application layer.

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_unassigned  ON leads(created_at) WHERE assigned_to IS NULL;
