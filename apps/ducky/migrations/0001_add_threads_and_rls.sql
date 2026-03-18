-- Migration: Add threads table, threadId to messages, build_plans table, and RLS policies
-- CVG-RESEARCH (Ducky) — conversation auto-branching + CVGBuilder v3 Plan Mode

-- ── Threads table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  parent_thread_id UUID REFERENCES threads(id),
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  title TEXT,
  branch_trigger VARCHAR(32),
  similarity_score NUMERIC(3,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS threads_tenant_idx ON threads(tenant_id);
CREATE INDEX IF NOT EXISTS threads_conversation_idx ON threads(conversation_id);

-- ── Add threadId to messages ────────────────────────────────────────────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES threads(id);

-- ── Build plans table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS build_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  agent_graph JSONB DEFAULT '{}',
  tool_definitions JSONB DEFAULT '[]',
  schema_template JSONB DEFAULT '{}',
  ui_wireframe JSONB DEFAULT '{}',
  rbac_matrix JSONB DEFAULT '{}',
  test_scenarios JSONB DEFAULT '[]',
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS build_plans_tenant_idx ON build_plans(tenant_id);
CREATE INDEX IF NOT EXISTS build_plans_status_idx ON build_plans(status);

-- ── Enable RLS on all Ducky tables ──────────────────────────────────────
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_plan_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_action_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_plans ENABLE ROW LEVEL SECURITY;

-- ── RLS policies: tenant-scoped access ──────────────────────────────────
-- Conversations
CREATE POLICY conversations_tenant_isolation ON conversations
  FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- Threads
CREATE POLICY threads_tenant_isolation ON threads
  FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- Messages
CREATE POLICY messages_tenant_isolation ON messages
  FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- Knowledge sources
CREATE POLICY knowledge_sources_tenant_isolation ON knowledge_sources
  FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- Knowledge chunks
CREATE POLICY knowledge_chunks_tenant_isolation ON knowledge_chunks
  FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- Saved answers
CREATE POLICY saved_answers_tenant_isolation ON saved_answers
  FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- Usage tracking
CREATE POLICY usage_tracking_tenant_isolation ON usage_tracking
  FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- Agent plans
CREATE POLICY agent_plans_tenant_isolation ON agent_plans
  FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- Agent plan steps (join through agent_plans for tenant check)
CREATE POLICY agent_plan_steps_tenant_isolation ON agent_plan_steps
  FOR ALL USING (
    plan_id IN (SELECT id FROM agent_plans WHERE tenant_id = (current_setting('app.tenant_id', true))::uuid)
  );

-- Agent action approvals (join through agent_plans for tenant check)
CREATE POLICY agent_action_approvals_tenant_isolation ON agent_action_approvals
  FOR ALL USING (
    plan_id IN (SELECT id FROM agent_plans WHERE tenant_id = (current_setting('app.tenant_id', true))::uuid)
  );

-- Build plans
CREATE POLICY build_plans_tenant_isolation ON build_plans
  FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
