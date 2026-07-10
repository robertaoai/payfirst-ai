-- Create feature_flags table
CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name TEXT NOT NULL UNIQUE,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by TEXT -- Could be the admin user's email or ID
);

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Allow public read access (so the client UI can fetch flags)
CREATE POLICY "Allow public read access on feature_flags"
    ON feature_flags
    FOR SELECT
    USING (true);

-- Allow admin-only INSERT/UPDATE/DELETE
CREATE POLICY "Allow admin write access on feature_flags"
    ON feature_flags
    FOR ALL
    USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

-- Seed the initial feature flag
INSERT INTO feature_flags (feature_name, is_enabled, updated_by)
VALUES ('folder_link_file_selector', false, 'system');
