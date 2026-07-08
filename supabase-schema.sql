
-- ═══════════════════════════════════════════════════════════════════════════════
-- REALEDGE CRM — Complete Supabase Schema
-- Paste the entire file into: Supabase Dashboard → SQL Editor → New query → Run
-- Idempotent: uses IF NOT EXISTS / OR REPLACE throughout. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Extensions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Shared trigger function: auto-update updated_at column
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CS ID — atomic sequence (no race condition vs old COUNT approach)
--    Generates: CS00001, CS00042, CS10000 …
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS cs_id_seq START 1;

CREATE OR REPLACE FUNCTION assign_cs_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.cs_id IS NULL THEN
    NEW.cs_id := 'CS' || LPAD(nextval('cs_id_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Profiles  (auto-created when a user signs up via auth trigger below)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email        TEXT NOT NULL,
  full_name    TEXT,
  company_name TEXT,
  phone        TEXT,
  role         TEXT NOT NULL DEFAULT 'agent'
                 CHECK (role IN ('admin', 'manager', 'agent')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Trigger: create a profile row every time a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_own_row" ON profiles;
CREATE POLICY "profiles_own_row" ON profiles
  FOR ALL USING (auth.uid() = id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Leads  (Supabase-side, CS ID auto-assigned, mirrors Twenty.com contacts)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id           UUID REFERENCES auth.users ON DELETE SET NULL,

  -- Identity
  cs_id              TEXT UNIQUE,           -- auto: CS00001 …
  name               TEXT NOT NULL,
  email              TEXT,
  phone              TEXT,

  -- Qualification
  source             TEXT,                  -- MagicBricks | 99acres | Referral | …
  property_type      TEXT,                  -- 3BHK Apartment | Villa | …
  locations          JSONB    DEFAULT '[]', -- ["Baner","Wakad"]
  budget_min         BIGINT,
  budget_max         BIGINT,
  timeline           TEXT,
  intent_score       INT      DEFAULT 0 CHECK (intent_score BETWEEN 0 AND 100),

  -- Lifecycle
  status             TEXT     NOT NULL DEFAULT 'new',
  client_type        TEXT     CHECK (client_type IN
                       ('Individual','Channel Partner','Agent','Interior Designer')),

  -- Traceability
  portal_lead_id     TEXT,                  -- original portal ID e.g. MB-2024-00123
  twenty_id          TEXT,                  -- Twenty.com person UUID for cross-reference

  -- Timestamps
  first_contact_date TIMESTAMPTZ DEFAULT NOW(),
  last_activity_date TIMESTAMPTZ DEFAULT NOW(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: assign CS ID on every INSERT
DROP TRIGGER IF EXISTS leads_cs_id ON leads;
CREATE TRIGGER leads_cs_id
  BEFORE INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION assign_cs_id();

CREATE OR REPLACE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_cs_id      ON leads(cs_id);
CREATE        INDEX IF NOT EXISTS idx_leads_agent      ON leads(agent_id);
CREATE        INDEX IF NOT EXISTS idx_leads_phone      ON leads(phone);
CREATE        INDEX IF NOT EXISTS idx_leads_status     ON leads(status);
CREATE        INDEX IF NOT EXISTS idx_leads_intent     ON leads(intent_score DESC);
CREATE        INDEX IF NOT EXISTS idx_leads_twenty     ON leads(twenty_id);
CREATE        INDEX IF NOT EXISTS idx_leads_created    ON leads(created_at DESC);
CREATE        INDEX IF NOT EXISTS idx_leads_portal_id  ON leads(portal_lead_id);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_agent_own" ON leads;
CREATE POLICY "leads_agent_own" ON leads
  FOR ALL USING (
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager')
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Lead Activities  (agent-attributed — powers real Activity Score)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID REFERENCES leads(id) ON DELETE CASCADE,
  agent_id      UUID REFERENCES auth.users ON DELETE SET NULL,

  -- What happened
  activity_type TEXT NOT NULL,
  -- Accepted values: call | whatsapp | email | site_visit | property_viewed | note
  -- activity_data carries: { outcome, notes, response_time, questions_asked, duration_sec, next_action_date }
  activity_data JSONB NOT NULL DEFAULT '{}',

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_la_lead    ON lead_activities(lead_id,  created_at DESC);
CREATE INDEX IF NOT EXISTS idx_la_agent   ON lead_activities(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_la_type    ON lead_activities(activity_type);

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "la_agent_own" ON lead_activities;
CREATE POLICY "la_agent_own" ON lead_activities
  FOR ALL USING (
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager')
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Team Members  (agents managed by an admin user)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id       UUID REFERENCES auth.users ON DELETE CASCADE,
  name             TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  role             TEXT NOT NULL DEFAULT 'agent'
                     CHECK (role IN ('admin','manager','agent')),
  specialty_cities TEXT[] DEFAULT '{}',
  specialty_types  TEXT[] DEFAULT '{}',
  monthly_target   INT    DEFAULT 5,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_manager ON team_members(manager_id);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tm_manager_own" ON team_members;
CREATE POLICY "tm_manager_own" ON team_members
  FOR ALL USING (manager_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Deals Pipeline
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users ON DELETE CASCADE,

  -- Lead reference
  lead_name      TEXT NOT NULL,
  lead_phone     TEXT,
  twenty_lead_id TEXT,              -- Twenty.com person ID

  -- Property
  property_name  TEXT,
  property_type  TEXT,
  locality       TEXT,
  city           TEXT,

  -- Deal
  deal_value     NUMERIC,
  stage          TEXT NOT NULL DEFAULT 'new'
                   CHECK (stage IN ('new','site_visit','negotiation','won','lost')),
  assigned_to    TEXT,              -- agent name (denormalized)
  expected_close DATE,
  source_portal  TEXT,
  notes          TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_deals_user  ON deals(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_close ON deals(expected_close);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deals_user_own" ON deals;
CREATE POLICY "deals_user_own" ON deals
  FOR ALL USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Properties / Inventory  (Teams plan only)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS properties (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  type             TEXT,                    -- Apartment | Villa | Plot | Office …
  city             TEXT,
  locality         TEXT,
  area_sqft        NUMERIC,
  price            NUMERIC NOT NULL,
  bedrooms         INT,
  bathrooms        INT,
  floor            INT,
  total_floors     INT,
  possession_date  TEXT,                    -- "Q3 2026" or ISO date string
  developer        TEXT,
  rera_number      TEXT,
  description      TEXT,
  amenities        TEXT[] DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'Available'
                     CHECK (status IN ('Available','Under Offer','Sold')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_properties_city   ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_price  ON properties(price);

-- Accessed via admin client only; no per-user RLS needed


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Notifications  (follow-up reminders, new-lead alerts, morning digest)
--
-- NOTE: createNotification() in lib/notifications.ts must also pass user_id.
-- The column is nullable now so existing calls still work, but add it when ready:
--   await admin.from('notifications').insert({ ..., user_id: agentId })
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users ON DELETE CASCADE, -- nullable for now
  type          TEXT NOT NULL,
  -- Types: follow_up_due | new_lead | hot_lead_inactive | portal_error | morning_digest
  title         TEXT NOT NULL,
  body          TEXT,
  lead_id       TEXT,                        -- Twenty.com person ID (nullable)
  read          BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user      ON notifications(user_id, scheduled_for DESC);
CREATE INDEX IF NOT EXISTS idx_notif_unread    ON notifications(user_id) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notif_scheduled ON notifications(scheduled_for)  WHERE read = FALSE;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_own" ON notifications;
-- Allows: own notifications OR global notifications (user_id IS NULL) for any authed user
CREATE POLICY "notif_own" ON notifications
  FOR ALL USING (user_id IS NULL OR user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Lead Routing Rules
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routing_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users ON DELETE CASCADE,
  rule_type   TEXT NOT NULL,
  -- Types: source | city | property_type | score_above | client_type
  match_value TEXT,                          -- "MagicBricks" | "Pune" | "Villa" | "70"
  agent_id    UUID REFERENCES team_members(id) ON DELETE SET NULL,
  priority    INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rr_user   ON routing_rules(user_id, priority);
CREATE INDEX IF NOT EXISTS idx_rr_active ON routing_rules(user_id) WHERE is_active;

ALTER TABLE routing_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rr_user_own" ON routing_rules;
CREATE POLICY "rr_user_own" ON routing_rules
  FOR ALL USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Sequences  (WhatsApp / call-reminder drip sequences)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sequences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sequence_steps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id  UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  step_order   INT  NOT NULL DEFAULT 0,
  delay_days   INT  NOT NULL DEFAULT 0,
  channel      TEXT NOT NULL,    -- whatsapp | call_reminder | email
  message_body TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sequence_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_seq_steps ON sequence_steps(sequence_id, step_order);

CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id    UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  lead_id        TEXT NOT NULL,              -- Twenty.com person ID
  lead_name      TEXT,
  lead_phone     TEXT,
  current_step   INT  NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','paused','completed','cancelled')),
  next_fire_at   TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  stopped_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sequence_id, lead_id)              -- one active enrollment per lead per sequence
);

CREATE INDEX IF NOT EXISTS idx_se_lead  ON sequence_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_se_due   ON sequence_enrollments(next_fire_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_se_seq   ON sequence_enrollments(sequence_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Shared Calculations  (shareable EMI / ROI calculator links)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shared_calculations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        TEXT,                      -- auth user ID as text; nullable for anon
  lead_id         TEXT,                      -- Twenty.com person ID; nullable
  calculator_type TEXT NOT NULL,             -- emi | roi | affordability | rental_yield
  input_data      JSONB NOT NULL DEFAULT '{}',
  views_count     INT  NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sc_agent ON shared_calculations(agent_id);
CREATE INDEX IF NOT EXISTS idx_sc_type  ON shared_calculations(calculator_type);
-- No RLS: accessed via anon key, publicly readable by design (share link)


-- ─────────────────────────────────────────────────────────────────────────────
-- 13. Portal Leads  (ingestion log — every portal webhook is recorded here)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portal_leads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_portal    TEXT NOT NULL,    -- MagicBricks | 99acres | Housing | Facebook | Manual
  raw_payload      JSONB NOT NULL DEFAULT '{}',
  parsed_contact   JSONB,            -- normalized fields after parsing
  ingestion_status TEXT NOT NULL DEFAULT 'created'
                     CHECK (ingestion_status IN ('created','duplicate','failed')),
  contact_id       TEXT,             -- Twenty.com person ID assigned after create
  contact_name     TEXT,
  contact_phone    TEXT,
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pl_portal  ON portal_leads(source_portal, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pl_status  ON portal_leads(ingestion_status);
CREATE INDEX IF NOT EXISTS idx_pl_phone   ON portal_leads(contact_phone);
-- Accessed via admin (service role) client only; no per-user RLS needed


-- ─────────────────────────────────────────────────────────────────────────────
-- 14. Saved Reports
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_reports (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users ON DELETE CASCADE,
  name       TEXT NOT NULL,
  config     JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sr_user ON saved_reports(user_id);

ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_user_own" ON saved_reports;
CREATE POLICY "sr_user_own" ON saved_reports
  FOR ALL USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 15. Subscriptions  (Razorpay — one row per user, upserted on webhook)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  plan                     TEXT NOT NULL DEFAULT 'pro',
  status                   TEXT NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active','past_due','cancelled','trialing')),
  razorpay_subscription_id TEXT UNIQUE,
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at_period_end     BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subs_user_own" ON subscriptions;
CREATE POLICY "subs_user_own" ON subscriptions
  FOR ALL USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 16. Billing Events  (raw Razorpay webhook log — never delete)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  TEXT,              -- nullable: webhook may arrive before user lookup
  event_type               TEXT NOT NULL,
  razorpay_payment_id      TEXT,
  razorpay_subscription_id TEXT,
  amount                   BIGINT,            -- in paise (₹1 = 100)
  plan                     TEXT,
  payload                  JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_be_user  ON billing_events(user_id);
CREATE INDEX IF NOT EXISTS idx_be_type  ON billing_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_be_rzp   ON billing_events(razorpay_subscription_id);
-- Accessed via admin client only; no per-user RLS


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE. Summary of tables created:
--
--   profiles              — user profile, auto-created on signup
--   leads                 — Supabase-side leads with CS ID (CS00001…)
--   lead_activities       — agent-attributed activities (real Activity Score)
--   team_members          — agents managed by an admin
--   deals                 — deal pipeline (site visit → negotiation → won)
--   properties            — inventory catalogue (Teams plan)
--   notifications         — follow-up reminders & alerts
--   routing_rules         — portal/city/type → agent assignment rules
--   sequences             — WhatsApp/call drip sequence definitions
--   sequence_steps        — individual steps inside a sequence
--   sequence_enrollments  — lead enrollment state in a sequence
--   shared_calculations   — shareable EMI/ROI calculator links
--   portal_leads          — portal webhook ingestion log (admin view only)
--   saved_reports         — user-saved report configurations
--   subscriptions         — Razorpay subscription state per user
--   billing_events        — raw Razorpay webhook log
--
-- CS ID: assigned atomically via cs_id_seq sequence + trigger on leads.
--   Old Twenty.com COUNT-based generation had a race condition risk.
--   This replaces it. Twenty.com person ID stored in leads.twenty_id.
--
-- RLS is ON for: profiles, leads, lead_activities, team_members, deals,
--   notifications, routing_rules, saved_reports, subscriptions
-- RLS NOT needed for: properties, sequences/steps/enrollments, shared_calculations,
--   portal_leads, billing_events — these use the service role (admin) client.
-- ═══════════════════════════════════════════════════════════════════════════════
