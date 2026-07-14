-- Migration 005: Lead import wizard — batches, profiles, tags
-- Run in Supabase SQL editor.

-- 1. Import batches (audit trail + undo target)
CREATE TABLE IF NOT EXISTS import_batches (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID,                                          -- NULL in dev-bypass mode
  file_name     TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','processing','done','failed','undone')),
  dedup_strategy TEXT       NOT NULL DEFAULT 'skip'
                            CHECK (dedup_strategy IN ('skip','overwrite','merge')),
  total_rows    INTEGER     NOT NULL DEFAULT 0,
  inserted      INTEGER     NOT NULL DEFAULT 0,
  skipped       INTEGER     NOT NULL DEFAULT 0,
  merged        INTEGER     NOT NULL DEFAULT 0,
  failed        INTEGER     NOT NULL DEFAULT 0,
  mapping       JSONB,                                         -- column→field map used
  defaults      JSONB,                                         -- import-time defaults applied
  error_report  JSONB,                                         -- [{row,column,reason}]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_import_batches_user ON import_batches(user_id, created_at DESC);

-- 2. Mapping profiles (saved per-source column maps)
CREATE TABLE IF NOT EXISTS mapping_profiles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID,
  name       TEXT        NOT NULL,
  mapping    JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mapping_profiles_user ON mapping_profiles(user_id);

-- 3. Add import_batch_id + tags to leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags            TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_leads_batch ON leads(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_leads_tags  ON leads USING gin(tags);
