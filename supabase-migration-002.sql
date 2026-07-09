-- Migration 002: fix team_members table + add agent_id to lead_activities
-- Run in: Supabase Dashboard → project gbwsgqacpbwwuadvsgkl → SQL Editor

-- 1. Add missing columns to team_members
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_active    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS manager_id   UUID;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS monthly_target INT DEFAULT 5;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS specialty_cities JSONB DEFAULT '[]';
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS specialty_types  JSONB DEFAULT '[]';

-- 2. Add agent_id to lead_activities so we can attribute activities to agents
ALTER TABLE lead_activities ADD COLUMN IF NOT EXISTS agent_id UUID;

-- 3. Backfill agent_id from parent lead
UPDATE lead_activities la
SET    agent_id = l.agent_id
FROM   leads l
WHERE  la.lead_id = l.id
AND    la.agent_id IS NULL;
