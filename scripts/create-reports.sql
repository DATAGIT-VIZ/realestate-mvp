-- Saved custom reports for RealEdge CRM
-- Safe to re-run

CREATE TABLE IF NOT EXISTS saved_reports (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL,
  name       text        NOT NULL,
  config     jsonb       NOT NULL,   -- { source, groupBy, metric, chartType, filters }
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS saved_reports_user_idx ON saved_reports(user_id);

ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own reports" ON saved_reports;
DROP POLICY IF EXISTS "svc reports full access"  ON saved_reports;

CREATE POLICY "users manage own reports" ON saved_reports FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "svc reports full access"  ON saved_reports FOR ALL TO service_role  USING (true) WITH CHECK (true);
