-- Run in Supabase SQL editor
-- Property inventory table — stores agent's property listings

CREATE TABLE IF NOT EXISTS properties (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title           text        NOT NULL,
  type            text,                          -- Apartment | Villa | Plot | Commercial | Row House
  city            text,
  locality        text,
  area_sqft       numeric,
  price           numeric     NOT NULL,          -- in INR
  bedrooms        int,
  bathrooms       int,
  floor           int,
  total_floors    int,
  possession_date date,
  developer       text,
  rera_number     text,
  description     text,
  amenities       text[]      DEFAULT '{}',
  status          text        DEFAULT 'Available' CHECK (status IN ('Available', 'Under Offer', 'Sold')),
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS properties_city_idx    ON properties(city);
CREATE INDEX IF NOT EXISTS properties_status_idx  ON properties(status);
CREATE INDEX IF NOT EXISTS properties_price_idx   ON properties(price);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Authenticated users can do everything (single-tenant for now)
CREATE POLICY "authenticated full access" ON properties
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service role full access" ON properties
  FOR ALL TO service_role USING (true) WITH CHECK (true);
