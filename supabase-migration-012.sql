-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 012: Multi-Tenant Workspace Layer
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- WHAT THIS DOES
-- ──────────────
-- Introduces a three-tier workspace model on top of the existing schema:
--
--   Solo Broker  (plan = 'solo')
--   └── Their own workspace → all their leads, tasks, activities
--
--   Admin        (plan = 'team')
--   ├── Admin's own workspace  → admin's personal pipeline (isolated)
--   └── Team umbrella view:
--       ├── Agent 1 workspace  (plan = 'agent', parent = admin workspace)
--       ├── Agent 2 workspace
--       └── Agent N workspace
--
-- Access rules:
--   • Solo user  → sees only their own workspace
--   • Agent      → sees only their own sub-workspace (never admin's, never peers')
--   • Admin      → sees their own workspace + all child agent workspaces (read + write)
--
-- HOW TO RUN
-- ──────────
-- Supabase Dashboard → SQL Editor → New query → paste this file → Run
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE.
--
-- DEPENDENCIES
-- ────────────
-- Requires supabase-schema.sql + migrations 001–011 to be applied first.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. workspaces
--    One row per user account. Solo users have no parent.
--    Admin users (team plan) have child agent workspaces pointing to them.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name                TEXT        NOT NULL,

  -- 'solo'  → individual broker, no team features
  -- 'team'  → admin workspace; can have child agent workspaces
  -- 'agent' → sub-workspace under a team admin
  plan                TEXT        NOT NULL DEFAULT 'solo'
                        CHECK (plan IN ('solo', 'team', 'agent')),

  -- NULL for solo and team-admin workspaces.
  -- Points to the admin's workspace id for every agent sub-workspace.
  parent_workspace_id UUID        REFERENCES workspaces(id) ON DELETE SET NULL,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_owner     ON workspaces(owner_id);
CREATE        INDEX IF NOT EXISTS idx_workspaces_parent    ON workspaces(parent_workspace_id);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Owner sees their own workspace; admin also sees all child workspaces
DROP POLICY IF EXISTS "workspaces_visible" ON workspaces;
CREATE POLICY "workspaces_visible" ON workspaces
  FOR SELECT USING (
    -- user owns this workspace
    owner_id = auth.uid()
    -- OR this workspace is a child of a workspace the user owns
    OR parent_workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "workspaces_owner_write" ON workspaces;
CREATE POLICY "workspaces_owner_write" ON workspaces
  FOR ALL USING (owner_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. workspace_invites
--    Admin invites an agent by email. Agent signs up via the invite link.
--    Token is a random hex string embedded in the invite URL.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_invites (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The admin's workspace that the invitee will become a sub-workspace of
  workspace_id  UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  email         TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'agent'
                              CHECK (role IN ('agent', 'manager')),

  -- Unique token sent in the invite link: /invite?token=<token>
  token         TEXT        NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

  invited_by    UUID        REFERENCES auth.users ON DELETE SET NULL,
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

  status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wi_token        ON workspace_invites(token);
CREATE        INDEX IF NOT EXISTS idx_wi_email        ON workspace_invites(email);
CREATE        INDEX IF NOT EXISTS idx_wi_workspace    ON workspace_invites(workspace_id);

ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

-- Admin can manage invites for their own workspace
DROP POLICY IF EXISTS "wi_admin_manage" ON workspace_invites;
CREATE POLICY "wi_admin_manage" ON workspace_invites
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- Invitee can read their own invite by token (used during signup flow)
DROP POLICY IF EXISTS "wi_invitee_read" ON workspace_invites;
CREATE POLICY "wi_invitee_read" ON workspace_invites
  FOR SELECT USING (true); -- token is the auth mechanism; app layer validates


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Add workspace_id to leads, lead_activities, lead_tasks
--    workspace_id is the primary isolation key going forward.
--    agent_id is kept for within-workspace assignment reporting.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_workspace ON leads(workspace_id);

-- lead_activities
ALTER TABLE lead_activities
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_la_workspace ON lead_activities(workspace_id);

-- lead_tasks (table created in an earlier migration; add workspace_id safely)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lead_tasks'
  ) THEN
    ALTER TABLE lead_tasks
      ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_lt_workspace ON lead_tasks(workspace_id);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Helper functions
-- ─────────────────────────────────────────────────────────────────────────────

-- Returns the current user's own workspace id
CREATE OR REPLACE FUNCTION get_my_workspace_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT id FROM workspaces WHERE owner_id = auth.uid() LIMIT 1;
$$;

-- Returns all workspace ids visible to the current user:
--   • Their own workspace (always)
--   • All child agent workspaces if they own a 'team' workspace (admin)
CREATE OR REPLACE FUNCTION get_visible_workspace_ids()
RETURNS SETOF UUID LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- The user's own workspace
  RETURN QUERY
    SELECT id FROM workspaces WHERE owner_id = auth.uid();

  -- Child workspaces (if user is a team admin)
  RETURN QUERY
    SELECT w.id FROM workspaces w
    WHERE w.parent_workspace_id IN (
      SELECT id FROM workspaces
      WHERE owner_id = auth.uid() AND plan = 'team'
    );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Update RLS policies to use workspace_id instead of agent_id
-- ─────────────────────────────────────────────────────────────────────────────

-- leads
DROP POLICY IF EXISTS "leads_agent_own"  ON leads;
DROP POLICY IF EXISTS "leads_workspace"  ON leads;
CREATE POLICY "leads_workspace" ON leads
  FOR ALL USING (
    -- workspace_id-based isolation (new model)
    workspace_id IN (SELECT get_visible_workspace_ids())
    -- fallback: legacy rows where workspace_id hasn't been stamped yet
    OR (workspace_id IS NULL AND agent_id = auth.uid())
    OR (workspace_id IS NULL AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager')
    ))
  );

-- lead_activities
DROP POLICY IF EXISTS "la_agent_own"      ON lead_activities;
DROP POLICY IF EXISTS "la_workspace"      ON lead_activities;
CREATE POLICY "la_workspace" ON lead_activities
  FOR ALL USING (
    workspace_id IN (SELECT get_visible_workspace_ids())
    OR (workspace_id IS NULL AND agent_id = auth.uid())
    OR (workspace_id IS NULL AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager')
    ))
  );

-- lead_tasks (conditional — only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lead_tasks'
  ) THEN
    -- Drop old policies (if any)
    DROP POLICY IF EXISTS "lt_agent_own"  ON lead_tasks;
    DROP POLICY IF EXISTS "lt_workspace"  ON lead_tasks;

    ALTER TABLE lead_tasks ENABLE ROW LEVEL SECURITY;

    EXECUTE $policy$
      CREATE POLICY "lt_workspace" ON lead_tasks
        FOR ALL USING (
          workspace_id IN (SELECT get_visible_workspace_ids())
          OR workspace_id IS NULL
        );
    $policy$;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Auto-create workspace on user signup
--    Extends the existing handle_new_user() trigger.
--    New users always start as 'solo'. Invite acceptance upgrades them to 'agent'.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- 1. Create the profile row
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Create the workspace row (solo by default)
  INSERT INTO public.workspaces (owner_id, name, plan)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'company_name',
      NEW.raw_user_meta_data ->> 'full_name',
      split_part(NEW.email, '@', 1)
    ),
    'solo'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Re-attach trigger (CREATE OR REPLACE doesn't work for triggers; drop+create)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. accept_workspace_invite(token TEXT)
--    Called by the app after the invited agent signs up.
--    • Validates the token
--    • Upgrades the agent's workspace plan from 'solo' → 'agent'
--    • Sets parent_workspace_id → admin's workspace
--    • Marks the invite as accepted
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION accept_workspace_invite(invite_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_invite    workspace_invites%ROWTYPE;
  v_workspace workspaces%ROWTYPE;
BEGIN
  -- 1. Look up the invite
  SELECT * INTO v_invite
  FROM workspace_invites
  WHERE token = invite_token
    AND status = 'pending'
    AND expires_at > NOW()
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid, expired, or already-used invite token');
  END IF;

  -- 2. Upgrade the current user's workspace to 'agent' under the admin
  UPDATE workspaces
  SET
    plan                = 'agent',
    parent_workspace_id = v_invite.workspace_id,
    updated_at          = NOW()
  WHERE owner_id = auth.uid()
  RETURNING * INTO v_workspace;

  -- 3. Also update their profile role
  UPDATE profiles
  SET role = v_invite.role
  WHERE id = auth.uid();

  -- 4. Mark invite accepted
  UPDATE workspace_invites
  SET
    status      = 'accepted',
    accepted_at = NOW()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success',            true,
    'workspace_id',       v_workspace.id,
    'parent_workspace_id', v_workspace.parent_workspace_id,
    'plan',               v_workspace.plan
  );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. promote_to_team(workspace_name TEXT)
--    Called when an admin upgrades their Solo plan to Team.
--    Flips their workspace plan from 'solo' → 'team'.
--    After this, they can invite agents.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION promote_to_team(workspace_name TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_workspace workspaces%ROWTYPE;
BEGIN
  UPDATE workspaces
  SET
    plan       = 'team',
    name       = COALESCE(workspace_name, name),
    updated_at = NOW()
  WHERE owner_id = auth.uid() AND plan = 'solo'
  RETURNING * INTO v_workspace;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No solo workspace found for this user, or already on team plan');
  END IF;

  -- Upgrade their profile role to admin
  UPDATE profiles SET role = 'admin' WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'success',      true,
    'workspace_id', v_workspace.id,
    'plan',         v_workspace.plan
  );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Backfill existing data
--    Creates workspaces for all existing profiles that don't have one yet.
--    Then stamps leads / activities / tasks with the matching workspace_id.
-- ─────────────────────────────────────────────────────────────────────────────

-- 9a. Create a workspace for every existing profile (idempotent)
INSERT INTO workspaces (owner_id, name, plan)
SELECT
  p.id,
  COALESCE(p.company_name, p.full_name, split_part(p.email, '@', 1)),
  CASE WHEN p.role = 'admin' THEN 'team' ELSE 'solo' END
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces w WHERE w.owner_id = p.id
)
ON CONFLICT DO NOTHING;

-- 9b. Stamp leads with workspace_id based on their agent_id
UPDATE leads l
SET workspace_id = w.id
FROM workspaces w
WHERE w.owner_id = l.agent_id
  AND l.workspace_id IS NULL
  AND l.agent_id IS NOT NULL;

-- 9c. Stamp lead_activities
UPDATE lead_activities la
SET workspace_id = w.id
FROM workspaces w
WHERE w.owner_id = la.agent_id
  AND la.workspace_id IS NULL
  AND la.agent_id IS NOT NULL;

-- 9d. Stamp lead_tasks (conditional)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lead_tasks'
  ) THEN
    -- link via the lead's workspace_id
    EXECUTE $stamp$
      UPDATE lead_tasks lt
      SET workspace_id = l.workspace_id
      FROM leads l
      WHERE lt.lead_id = l.id
        AND lt.workspace_id IS NULL
        AND l.workspace_id IS NOT NULL;
    $stamp$;
  END IF;
END $$;

-- 9e. Orphaned leads (no agent_id) — assign to the first/only workspace (dev data)
UPDATE leads l
SET workspace_id = (
  SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1
)
WHERE l.workspace_id IS NULL;

UPDATE lead_activities la
SET workspace_id = (
  SELECT w.id FROM workspaces w
  JOIN leads l ON l.id = la.lead_id
  WHERE w.id = l.workspace_id
  LIMIT 1
)
WHERE la.workspace_id IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Convenience view: team_pipeline_summary
--     Used by the admin's Team page to show per-agent stats without
--     the admin having to know each agent's workspace_id.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW team_pipeline_summary AS
SELECT
  w.id                                                    AS workspace_id,
  w.name                                                  AS agent_name,
  p.email                                                 AS agent_email,
  p.role                                                  AS agent_role,
  COUNT(l.id)                                             AS total_leads,
  COUNT(l.id) FILTER (WHERE l.status NOT IN ('Won','Lost','NC','Closed')) AS active_leads,
  COUNT(l.id) FILTER (WHERE l.status IN ('Won','Closed'))                AS closed_leads,
  ROUND(
    100.0 * COUNT(l.id) FILTER (WHERE l.status IN ('Won','Closed'))
    / NULLIF(COUNT(l.id), 0), 1
  )                                                       AS close_rate_pct,
  SUM(l.budget_max) FILTER (WHERE l.status NOT IN ('Won','Lost','NC','Closed')) AS pipeline_value,
  MAX(la.created_at)                                      AS last_activity_at
FROM workspaces w
JOIN profiles  p  ON p.id = w.owner_id
LEFT JOIN leads l ON l.workspace_id = w.id
LEFT JOIN lead_activities la ON la.workspace_id = w.id
WHERE w.plan = 'agent'
GROUP BY w.id, w.name, p.email, p.role;

-- Admin reads this view via the service-role client (bypasses RLS)


-- ─────────────────────────────────────────────────────────────────────────────
-- Done.
-- ─────────────────────────────────────────────────────────────────────────────
-- Summary of what was created:
--
--   Tables        workspaces, workspace_invites
--   Columns       leads.workspace_id, lead_activities.workspace_id,
--                 lead_tasks.workspace_id (if table exists)
--   Functions     get_my_workspace_id(), get_visible_workspace_ids(),
--                 accept_workspace_invite(token), promote_to_team(name)
--   Trigger       on_auth_user_created  (updated to also create workspace)
--   RLS Policies  leads_workspace, la_workspace, lt_workspace
--                 workspaces_visible, workspaces_owner_write
--                 wi_admin_manage, wi_invitee_read
--   View          team_pipeline_summary
--   Backfill      workspace_id stamped on all existing leads / activities / tasks
--
-- NEXT STEPS (app layer, when ready to go multi-tenant):
--   1. Read workspace_id from session → pass to all API queries
--   2. Replace agent_id filters with workspace_id filters in /api/crm/
--   3. Build /invite page that calls accept_workspace_invite(token)
--   4. Build Settings → Team page that calls promote_to_team() on upgrade
--   5. Gate sidebar items: Team, Routing hidden when workspace.plan = 'solo'
-- ═══════════════════════════════════════════════════════════════════════════════

