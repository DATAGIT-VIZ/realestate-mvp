-- Migration 008: Task ownership tracking
-- Adds created_by to lead_tasks so admin-assigned tasks can be
-- distinguished from tasks agents self-log. Run in Supabase SQL editor.

-- 1. Add created_by column (team_members.id of the person who created the task)
ALTER TABLE lead_tasks
  ADD COLUMN IF NOT EXISTS created_by UUID;

-- 2. Add source column to surface origin without joins
ALTER TABLE lead_tasks
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'self'
  CONSTRAINT lead_tasks_source_check CHECK (source IN ('self', 'assigned'));

-- 3. Backfill: existing tasks with assigned_to set were admin-assigned
UPDATE lead_tasks
  SET source = 'assigned'
  WHERE assigned_to IS NOT NULL AND source = 'self';

-- 4. Indexes for common filter patterns
CREATE INDEX IF NOT EXISTS idx_lead_tasks_assigned_to ON lead_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_created_by  ON lead_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_source      ON lead_tasks(source);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_status      ON lead_tasks(status);
