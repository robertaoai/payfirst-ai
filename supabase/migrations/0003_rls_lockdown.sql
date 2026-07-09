-- 0003_rls_lockdown.sql
-- Enable RLS and setup policies

-- Enable RLS on all tables
ALTER TABLE page_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- page_visits: Anyone can insert, no one can read (except admin via service role)
CREATE POLICY "Allow public insert on page_visits" 
  ON page_visits FOR INSERT 
  TO public 
  WITH CHECK (true);

-- purchase_intents: Anyone can insert, no one can read
CREATE POLICY "Allow public insert on purchase_intents" 
  ON purchase_intents FOR INSERT 
  TO public 
  WITH CHECK (true);

-- purchases: Users can read their own purchases
CREATE POLICY "Allow users to read own purchases" 
  ON purchases FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- activities: Anyone can insert (since we only pass session_id for now, but we can restrict to authenticated later if we link them)
CREATE POLICY "Allow public insert on activities" 
  ON activities FOR INSERT 
  TO public 
  WITH CHECK (true);

-- Drop any previous "wide open" policies if they exist from v1
-- Not strictly necessary unless we created them explicitly with CREATE POLICY
