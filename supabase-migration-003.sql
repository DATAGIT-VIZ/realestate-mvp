-- Migration 003: Drop FK constraint on team_members.manager_id
-- Same fix applied to leads/deals/activities in migration-001.
-- The dev bypass userId (00000000-...-0001) doesn't exist in auth.users,
-- so the FK was rejecting every INSERT on team_members.

ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_manager_id_fkey;
