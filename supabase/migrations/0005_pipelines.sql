-- Seed the new feature flags for the agent and briefcase pipelines
INSERT INTO feature_flags (feature_name, is_enabled, updated_by)
VALUES 
    ('folder_agent_pipeline', false, 'system'),
    ('ai_briefcase_pipeline', false, 'system')
ON CONFLICT (feature_name) DO NOTHING;
