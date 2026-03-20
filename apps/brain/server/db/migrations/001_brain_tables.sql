-- CVG-BRAIN: Initial schema migration
-- Creates knowledge capture tables with tenant isolation (RLS)

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Enums ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE brain_recording_status AS ENUM ('recording', 'transcribing', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE brain_knowledge_type AS ENUM ('fact', 'decision', 'action_item', 'question', 'insight', 'meeting_note', 'reference');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE brain_entity_type AS ENUM ('person', 'organization', 'project', 'technology', 'location', 'date', 'monetary_value', 'document', 'concept');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE brain_relationship_type AS ENUM ('mentioned_in', 'related_to', 'assigned_to', 'decided_by', 'depends_on', 'part_of', 'follows', 'contradicts', 'supersedes');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Source Recordings ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brain_source_recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT,
  transcript TEXT,
  raw_audio_url TEXT,
  duration_seconds INTEGER,
  source_type VARCHAR(50) NOT NULL DEFAULT 'microphone',
  status brain_recording_status NOT NULL DEFAULT 'recording',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brain_recordings_tenant_idx ON brain_source_recordings(tenant_id);
CREATE INDEX IF NOT EXISTS brain_recordings_user_idx ON brain_source_recordings(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS brain_recordings_status_idx ON brain_source_recordings(tenant_id, status);
CREATE INDEX IF NOT EXISTS brain_recordings_created_idx ON brain_source_recordings(tenant_id, created_at);

-- ── Knowledge Objects ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brain_knowledge_objects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  recording_id UUID REFERENCES brain_source_recordings(id) ON DELETE SET NULL,
  type brain_knowledge_type NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  confidence REAL NOT NULL DEFAULT 0.8,
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  due_date TIMESTAMPTZ,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brain_knowledge_tenant_idx ON brain_knowledge_objects(tenant_id);
CREATE INDEX IF NOT EXISTS brain_knowledge_type_idx ON brain_knowledge_objects(tenant_id, type);
CREATE INDEX IF NOT EXISTS brain_knowledge_user_idx ON brain_knowledge_objects(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS brain_knowledge_recording_idx ON brain_knowledge_objects(recording_id);
CREATE INDEX IF NOT EXISTS brain_knowledge_created_idx ON brain_knowledge_objects(tenant_id, created_at);

-- ── Entity Mentions ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brain_entity_mentions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  type brain_entity_type NOT NULL,
  knowledge_object_id UUID NOT NULL REFERENCES brain_knowledge_objects(id) ON DELETE CASCADE,
  recording_id UUID REFERENCES brain_source_recordings(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brain_entities_tenant_idx ON brain_entity_mentions(tenant_id);
CREATE INDEX IF NOT EXISTS brain_entities_name_idx ON brain_entity_mentions(tenant_id, normalized_name);
CREATE INDEX IF NOT EXISTS brain_entities_type_idx ON brain_entity_mentions(tenant_id, type);
CREATE INDEX IF NOT EXISTS brain_entities_knowledge_idx ON brain_entity_mentions(knowledge_object_id);

-- ── Relationships ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brain_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  source_entity_id UUID NOT NULL REFERENCES brain_entity_mentions(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES brain_entity_mentions(id) ON DELETE CASCADE,
  type brain_relationship_type NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  knowledge_object_id UUID REFERENCES brain_knowledge_objects(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brain_rel_tenant_idx ON brain_relationships(tenant_id);
CREATE INDEX IF NOT EXISTS brain_rel_source_idx ON brain_relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS brain_rel_target_idx ON brain_relationships(target_entity_id);
CREATE INDEX IF NOT EXISTS brain_rel_type_idx ON brain_relationships(tenant_id, type);

-- ── Row Level Security ────────────────────────────────────────────────

ALTER TABLE brain_source_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_knowledge_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_entity_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_relationships ENABLE ROW LEVEL SECURITY;

-- Policies: tenant isolation via JWT claim
CREATE POLICY brain_recordings_tenant_isolation ON brain_source_recordings
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY brain_knowledge_tenant_isolation ON brain_knowledge_objects
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY brain_entities_tenant_isolation ON brain_entity_mentions
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY brain_relationships_tenant_isolation ON brain_relationships
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Service role bypass for server-side operations
CREATE POLICY brain_recordings_service ON brain_source_recordings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY brain_knowledge_service ON brain_knowledge_objects
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY brain_entities_service ON brain_entity_mentions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY brain_relationships_service ON brain_relationships
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Updated_at trigger ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION brain_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brain_recordings_updated_at
  BEFORE UPDATE ON brain_source_recordings
  FOR EACH ROW EXECUTE FUNCTION brain_update_updated_at();

CREATE TRIGGER brain_knowledge_updated_at
  BEFORE UPDATE ON brain_knowledge_objects
  FOR EACH ROW EXECUTE FUNCTION brain_update_updated_at();
