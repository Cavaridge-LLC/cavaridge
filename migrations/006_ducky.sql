-- ============================================================
-- Cavaridge Platform — Ducky (CVG-RESEARCH) Schema
-- Run AFTER 005_midas.sql
--
-- Intelligence & Research Platform tables in the `ducky` schema.
-- All tables reference public.tenants(id) for UTM isolation.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS ducky;

-- ============================================================
-- 1. conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS ducky.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  title TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ducky_conversations_tenant ON ducky.conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ducky_conversations_user ON ducky.conversations(user_id);

ALTER TABLE ducky.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_conversations ON ducky.conversations
  FOR ALL USING (tenant_id = public.tenant_id());

CREATE TRIGGER set_updated_at_conversations
  BEFORE UPDATE ON ducky.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. threads
-- ============================================================
CREATE TABLE IF NOT EXISTS ducky.threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ducky.conversations(id),
  parent_thread_id UUID,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  title TEXT,
  branch_trigger VARCHAR(32),
  similarity_score NUMERIC(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ducky_threads_tenant ON ducky.threads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ducky_threads_conversation ON ducky.threads(conversation_id);

ALTER TABLE ducky.threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_threads ON ducky.threads
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 3. messages
-- ============================================================
CREATE TABLE IF NOT EXISTS ducky.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ducky.conversations(id),
  thread_id UUID REFERENCES ducky.threads(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  role VARCHAR(16) NOT NULL,
  content TEXT NOT NULL,
  sources_json JSONB DEFAULT '[]',
  model_used VARCHAR(128),
  tokens_used INT,
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ducky_messages_conversation ON ducky.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ducky_messages_tenant ON ducky.messages(tenant_id);

ALTER TABLE ducky.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_messages ON ducky.messages
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 4. knowledge_sources
-- ============================================================
CREATE TABLE IF NOT EXISTS ducky.knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  source_type VARCHAR(32) NOT NULL,
  content_hash VARCHAR(64),
  metadata_json JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ducky_knowledge_sources_tenant ON ducky.knowledge_sources(tenant_id);

ALTER TABLE ducky.knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_knowledge_sources ON ducky.knowledge_sources
  FOR ALL USING (tenant_id = public.tenant_id());

CREATE TRIGGER set_updated_at_knowledge_sources
  BEFORE UPDATE ON ducky.knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. knowledge_chunks
-- ============================================================
CREATE TABLE IF NOT EXISTS ducky.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES ducky.knowledge_sources(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  content TEXT NOT NULL,
  embedding_json JSONB,
  chunk_index INT DEFAULT 0,
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ducky_knowledge_chunks_source ON ducky.knowledge_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_ducky_knowledge_chunks_tenant ON ducky.knowledge_chunks(tenant_id);

ALTER TABLE ducky.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_knowledge_chunks ON ducky.knowledge_chunks
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 6. saved_answers
-- ============================================================
CREATE TABLE IF NOT EXISTS ducky.saved_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources_json JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ducky_saved_answers_tenant ON ducky.saved_answers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ducky_saved_answers_user ON ducky.saved_answers(user_id);

ALTER TABLE ducky.saved_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_saved_answers ON ducky.saved_answers
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 7. usage_tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS ducky.usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  action_type VARCHAR(64) NOT NULL,
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ducky_usage_tracking_tenant ON ducky.usage_tracking(tenant_id);

ALTER TABLE ducky.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_usage_tracking ON ducky.usage_tracking
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 8. agent_plans
-- ============================================================
CREATE TABLE IF NOT EXISTS ducky.agent_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  requesting_app VARCHAR(64),
  query TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  step_count INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ducky_agent_plans_tenant ON ducky.agent_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ducky_agent_plans_user ON ducky.agent_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_ducky_agent_plans_status ON ducky.agent_plans(status);

ALTER TABLE ducky.agent_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_agent_plans ON ducky.agent_plans
  FOR ALL USING (tenant_id = public.tenant_id());

CREATE TRIGGER set_updated_at_agent_plans
  BEFORE UPDATE ON ducky.agent_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 9. agent_plan_steps
-- ============================================================
CREATE TABLE IF NOT EXISTS ducky.agent_plan_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES ducky.agent_plans(id),
  order_index INT NOT NULL,
  type VARCHAR(16) NOT NULL,
  connector VARCHAR(32) NOT NULL,
  description TEXT NOT NULL,
  depends_on JSONB DEFAULT '[]',
  input_data JSONB DEFAULT '{}',
  output_data JSONB,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  confidence NUMERIC(3,2),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ducky_agent_plan_steps_plan ON ducky.agent_plan_steps(plan_id);
CREATE INDEX IF NOT EXISTS idx_ducky_agent_plan_steps_status ON ducky.agent_plan_steps(status);

ALTER TABLE ducky.agent_plan_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_agent_plan_steps ON ducky.agent_plan_steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM ducky.agent_plans ap
      WHERE ap.id = plan_id AND ap.tenant_id = public.tenant_id()
    )
  );

-- ============================================================
-- 10. agent_action_approvals
-- ============================================================
CREATE TABLE IF NOT EXISTS ducky.agent_action_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES ducky.agent_plans(id),
  step_id UUID NOT NULL REFERENCES ducky.agent_plan_steps(id),
  user_id UUID NOT NULL,
  action_type VARCHAR(16) NOT NULL,
  action_preview JSONB NOT NULL,
  approved BOOLEAN NOT NULL,
  response_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ducky_agent_action_approvals_plan ON ducky.agent_action_approvals(plan_id);
CREATE INDEX IF NOT EXISTS idx_ducky_agent_action_approvals_step ON ducky.agent_action_approvals(step_id);

ALTER TABLE ducky.agent_action_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_agent_action_approvals ON ducky.agent_action_approvals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM ducky.agent_plans ap
      WHERE ap.id = plan_id AND ap.tenant_id = public.tenant_id()
    )
  );

-- ============================================================
-- 11. build_plans
-- ============================================================
CREATE TABLE IF NOT EXISTS ducky.build_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  agent_graph JSONB DEFAULT '{}',
  tool_definitions JSONB DEFAULT '[]',
  schema_template JSONB DEFAULT '{}',
  ui_wireframe JSONB DEFAULT '{}',
  rbac_matrix JSONB DEFAULT '{}',
  test_scenarios JSONB DEFAULT '[]',
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ducky_build_plans_tenant ON ducky.build_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ducky_build_plans_status ON ducky.build_plans(status);

ALTER TABLE ducky.build_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_build_plans ON ducky.build_plans
  FOR ALL USING (tenant_id = public.tenant_id());

CREATE TRIGGER set_updated_at_build_plans
  BEFORE UPDATE ON ducky.build_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- GRANTS
-- ============================================================
GRANT USAGE ON SCHEMA ducky TO cavaridge_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ducky TO role_core;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA ducky TO role_ducky;
GRANT SELECT ON ALL TABLES IN SCHEMA ducky TO cavaridge_app;
