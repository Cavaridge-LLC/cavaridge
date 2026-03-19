-- ============================================================
-- Cavaridge Platform — Caelum (CVG-CAELUM) Schema
-- Run AFTER 006_ducky.sql
--
-- SoW Builder tables in the `caelum` schema.
-- All tables reference public.tenants(id) for UTM isolation.
-- ============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS caelum;

-- ─── 1. conversations ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caelum.conversations (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  title text NOT NULL,
  sow_json jsonb,
  flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caelum_conversations_tenant ON caelum.conversations(tenant_id);
ALTER TABLE caelum.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_conversations ON caelum.conversations
  FOR ALL USING (tenant_id = public.tenant_id());
CREATE TRIGGER set_updated_at_caelum_conversations
  BEFORE UPDATE ON caelum.conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 2. messages ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caelum.messages (
  id serial PRIMARY KEY,
  conversation_id integer NOT NULL REFERENCES caelum.conversations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caelum_messages_tenant ON caelum.messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_caelum_messages_conversation ON caelum.messages(conversation_id);
ALTER TABLE caelum.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_messages ON caelum.messages
  FOR ALL USING (tenant_id = public.tenant_id());

-- ─── 3. sow_versions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caelum.sow_versions (
  id serial PRIMARY KEY,
  conversation_id integer NOT NULL REFERENCES caelum.conversations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  version integer NOT NULL,
  sow_json jsonb NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caelum_sow_versions_tenant ON caelum.sow_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_caelum_sow_versions_conversation ON caelum.sow_versions(conversation_id);
ALTER TABLE caelum.sow_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_sow_versions ON caelum.sow_versions
  FOR ALL USING (tenant_id = public.tenant_id());

-- ─── GRANTS ───────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA caelum TO cavaridge_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA caelum TO role_core;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA caelum TO role_caelum;
GRANT SELECT ON ALL TABLES IN SCHEMA caelum TO cavaridge_app;

-- Serial sequences need explicit grants
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA caelum TO role_core;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA caelum TO role_caelum;

COMMENT ON SCHEMA caelum IS 'CVG-CAELUM: SoW Builder with conversation-based SoW generation';

COMMIT;
