-- Razorpay billing tables for RealEdge CRM
-- Safe to re-run: uses IF NOT EXISTS + drops policies before recreating

CREATE TABLE IF NOT EXISTS subscriptions (
  id                        uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                   uuid        NOT NULL,
  plan                      text        NOT NULL DEFAULT 'free',   -- 'free' | 'pro' | 'team'
  status                    text        NOT NULL DEFAULT 'active', -- 'active' | 'cancelled' | 'past_due' | 'halted'
  razorpay_subscription_id  text        UNIQUE,
  razorpay_customer_id      text,
  current_period_start      timestamptz,
  current_period_end        timestamptz,
  trial_end                 timestamptz,
  cancelled_at              timestamptz,
  cancel_at_period_end      boolean     DEFAULT false,
  created_at                timestamptz DEFAULT now() NOT NULL,
  updated_at                timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_events (
  id                        uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                   uuid,
  event_type                text        NOT NULL,
  razorpay_payment_id       text,
  razorpay_subscription_id  text,
  amount                    integer,               -- in paise (divide by 100 for ₹)
  plan                      text,
  payload                   jsonb,
  created_at                timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS subscriptions_user_idx      ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_rzp_sub_idx   ON subscriptions(razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS billing_events_user_idx     ON billing_events(user_id);
CREATE INDEX IF NOT EXISTS billing_events_type_idx     ON billing_events(event_type);

ALTER TABLE subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events  ENABLE ROW LEVEL SECURITY;

-- Drop before recreating so re-runs don't fail
DROP POLICY IF EXISTS "users read own subscription"    ON subscriptions;
DROP POLICY IF EXISTS "users read own events"          ON billing_events;
DROP POLICY IF EXISTS "svc full access subscriptions"  ON subscriptions;
DROP POLICY IF EXISTS "svc full access billing_events" ON billing_events;

CREATE POLICY "users read own subscription"    ON subscriptions  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users read own events"          ON billing_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "svc full access subscriptions"  ON subscriptions  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "svc full access billing_events" ON billing_events FOR ALL TO service_role USING (true) WITH CHECK (true);
