-- ============================================================
-- Run this ONCE in Supabase SQL editor
-- 1. Creates the properties table
-- 2. Inserts 8 demo listings for the demo workspace
-- ============================================================

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

-- ─── Demo seed data ───────────────────────────────────────────────────────────
INSERT INTO properties (title, type, city, locality, price, area_sqft, bedrooms, bathrooms, floor, total_floors, developer, rera_number, description, amenities, status) VALUES
('Kalpataru Aura — 3BHK Premium',       'Apartment', 'Mumbai',      'Goregaon East', 24500000, 1320, 3, 3, 18, 32, 'Kalpataru Group',      'P51800036799',                               'Spacious 3BHK with panoramic views, modular kitchen, and world-class amenities. 5 min from Oberoi Mall.', ARRAY['Gym','Swimming Pool','Clubhouse','Security','Parking'],         'Available'),
('Lodha Palava — 2BHK Smart Home',      'Apartment', 'Mumbai',      'Dombivali',     7800000,  750,  2, 2, 8,  20, 'Lodha Group',          'P51700025843',                               'Smart home automation, township living with school, hospital, and mall within campus. Ready to move.',    ARRAY['Gym','Jogging Track','Kids Zone','School','Mall'],              'Available'),
('Prestige Lakeside Habitat — 3BHK',    'Apartment', 'Bangalore',   'Whitefield',    11500000, 1420, 3, 2, 12, 24, 'Prestige Group',       'PRM/KA/RERA/1251/446/PR/170819/002230',      'Lakefront gated community, 3BHK with lake views, premium finishes, and tech park proximity.',            ARRAY['Lake View','Gym','Pool','Tennis Court','Clubhouse'],            'Available'),
('Embassy Springs — 4BHK Villa',        'Villa',     'Bangalore',   'Devanahalli',   28000000, 3500, 4, 4, NULL, NULL,'Embassy Group',       'PRM/KA/RERA/1251/310/PR/180522/005678',      'Luxury villa with private garden, home theatre, and driver quarters. 10 min from Kempegowda Airport.',   ARRAY['Private Garden','Swimming Pool','Home Theatre','Golf Course'],  'Available'),
('Godrej Nirvaan — 1BHK',              'Apartment', 'Mumbai',      'Thane West',    5500000,  580,  1, 1, 5,  15, 'Godrej Properties',    'P51700027641',                               'Efficient 1BHK ideal for young professionals. Excellent connectivity to LBS Marg and Ghodbunder Road.',   ARRAY['Gym','Garden','Security','Parking'],                            'Available'),
('Mahindra Eden — 2BHK',               'Apartment', 'Pune',        'Kharadi',       8900000,  920,  2, 2, 9,  18, 'Mahindra Lifespaces',  'P52100027312',                               'Modern 2BHK in Pune''s IT corridor. Vaastu compliant, abundant natural light, green landscaping.',        ARRAY['Pool','Gym','Amphitheatre','Senior Citizen Zone','EV Charging'],'Under Offer'),
('Shapoorji Pallonji — Corner Plot',    'Plot',      'Navi Mumbai', 'Kharghar',      4200000,  1000, NULL,NULL,NULL,NULL,'Shapoorji Pallonji', 'P99000018740',                               'Gated township plot, corner location, fully developed with roads, drainage, and electricity.',            ARRAY['Gated Society','CCTV','Club Access'],                           'Available'),
('Puravankara Atmosphere — 2BHK',      'Apartment', 'Bangalore',   'Hebbal',        12200000, 1180, 2, 2, 22, 38, 'Puravankara',          'PRM/KA/RERA/1251/446/PR/200112/003419',      'High-rise 2BHK with unobstructed Hebbal Lake views. Sky lounge, infinity pool, co-working spaces.',      ARRAY['Infinity Pool','Sky Lounge','Co-working','Concierge','Gym'],   'Sold')
ON CONFLICT DO NOTHING;
