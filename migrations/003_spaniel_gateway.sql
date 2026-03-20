-- Migration: 003_spaniel_gateway.sql
-- Spaniel LLM Gateway schema — routing matrix, request logging, model catalog
-- All tables live in the `spaniel` schema, isolated from app data.

-- Create the spaniel schema
CREATE SCHEMA IF NOT EXISTS spaniel;

-- ============================================================
-- routing_matrix: task type → primary/secondary/tertiary model
-- ============================================================
CREATE TABLE IF NOT EXISTS spaniel.routing_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL UNIQUE,
  primary_model TEXT NOT NULL,
  secondary_model TEXT NOT NULL,
  tertiary_model TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL DEFAULT 'manual'
);

-- Seed default routing matrix
INSERT INTO spaniel.routing_matrix (task_type, primary_model, secondary_model, tertiary_model, updated_by) VALUES
  ('analysis',        'anthropic/claude-opus-4-6',            'openai/gpt-4o',           'google/gemini-2.5-pro',    'seed'),
  ('generation',      'anthropic/claude-sonnet-4',   'openai/gpt-4o',           'google/gemini-2.5-pro',    'seed'),
  ('summarization',   'anthropic/claude-sonnet-4',   'openai/gpt-4o',           'google/gemini-2.0-flash',  'seed'),
  ('extraction',      'anthropic/claude-haiku-4.5',  'openai/gpt-4o-mini',      'google/gemini-2.0-flash',  'seed'),
  ('chat',            'anthropic/claude-sonnet-4',   'openai/gpt-4o-mini',      'google/gemini-2.0-flash',  'seed'),
  ('code_generation', 'anthropic/claude-sonnet-4',   'openai/gpt-4o',           'google/gemini-2.5-pro',    'seed'),
  ('research',        'anthropic/claude-opus-4-6',            'google/gemini-2.5-pro',   'openai/gpt-4o',            'seed'),
  ('conversation',    'anthropic/claude-sonnet-4',   'openai/gpt-4o-mini',      'google/gemini-2.0-flash',  'seed'),
  ('embeddings',      'openai/text-embedding-3-small',        'openai/text-embedding-3-large', NULL,                 'seed'),
  ('vision',          'anthropic/claude-sonnet-4',   'openai/gpt-4o',           'google/gemini-2.5-pro',    'seed')
ON CONFLICT (task_type) DO NOTHING;

-- ============================================================
-- request_log: audit trail for every LLM call (RLS on tenant_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS spaniel.request_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  app_code TEXT,
  task_type TEXT,
  primary_model TEXT,
  secondary_model TEXT,
  tertiary_model TEXT,
  model_used TEXT NOT NULL,
  fallback_used BOOLEAN DEFAULT FALSE,
  consensus_aligned BOOLEAN,
  confidence_score NUMERIC(4,3),
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd NUMERIC(10,6),
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for usage queries
CREATE INDEX IF NOT EXISTS idx_request_log_tenant_id ON spaniel.request_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_request_log_created_at ON spaniel.request_log (created_at);
CREATE INDEX IF NOT EXISTS idx_request_log_app_code ON spaniel.request_log (app_code);
CREATE INDEX IF NOT EXISTS idx_request_log_task_type ON spaniel.request_log (task_type);

-- Enable RLS on request_log
ALTER TABLE spaniel.request_log ENABLE ROW LEVEL SECURITY;

-- Policy: service role can read/write all rows
CREATE POLICY "service_role_all" ON spaniel.request_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- model_catalog: available models with pricing and performance
-- ============================================================
CREATE TABLE IF NOT EXISTS spaniel.model_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  context_window INTEGER,
  cost_per_m_input NUMERIC(10,6),
  cost_per_m_output NUMERIC(10,6),
  avg_latency_ms INTEGER,
  benchmark_scores JSONB,
  active BOOLEAN DEFAULT TRUE,
  last_evaluated TIMESTAMPTZ
);

-- Seed model catalog with current pricing
INSERT INTO spaniel.model_catalog (model_id, provider, context_window, cost_per_m_input, cost_per_m_output, active) VALUES
  ('anthropic/claude-opus-4-6',            'anthropic', 200000, 15.000000, 75.000000, TRUE),
  ('anthropic/claude-sonnet-4',   'anthropic', 200000,  3.000000, 15.000000, TRUE),
  ('anthropic/claude-haiku-4.5',  'anthropic', 200000,  0.800000,  4.000000, TRUE),
  ('openai/gpt-4o',                        'openai',    128000,  2.500000, 10.000000, TRUE),
  ('openai/gpt-4o-mini',                   'openai',    128000,  0.150000,  0.600000, TRUE),
  ('google/gemini-2.5-pro',                'google',   1000000,  1.250000, 10.000000, TRUE),
  ('google/gemini-2.0-flash',              'google',   1000000,  0.100000,  0.400000, TRUE),
  ('openai/text-embedding-3-small',        'openai',     8191,  0.020000,  0.000000, TRUE),
  ('openai/text-embedding-3-large',        'openai',     8191,  0.130000,  0.000000, TRUE)
ON CONFLICT (model_id) DO NOTHING;
