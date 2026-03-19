-- ============================================================
-- Cavaridge Platform — Meridian (CVG-MER) Schema
-- Run AFTER 003_spaniel_gateway.sql
--
-- M&A IT Intelligence Platform tables in the `meridian` schema.
-- All tables reference public.tenants(id) for UTM isolation.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Schema
-- ------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS meridian;

-- ============================================================
-- 1. deals
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.deals (
  id              varchar(36)   PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid          NOT NULL REFERENCES public.tenants(id),
  deal_code       text          NOT NULL UNIQUE,
  target_name     text          NOT NULL,
  industry        text          NOT NULL,
  stage           text          NOT NULL,
  status          text          NOT NULL DEFAULT 'on-track',
  facility_count  int           DEFAULT 0,
  user_count      int           DEFAULT 0,
  estimated_integration_cost text,
  composite_score numeric(5,1),
  overall_confidence text       DEFAULT 'insufficient',
  documents_uploaded  int       DEFAULT 0,
  documents_analyzed  int       DEFAULT 0,
  lifecycle_stage varchar(50)   DEFAULT 'assessment',
  created_at      timestamptz   DEFAULT now(),
  updated_at      timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_deals_tenant ON meridian.deals(tenant_id);
ALTER TABLE meridian.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_deals ON meridian.deals
  FOR ALL USING (tenant_id = public.tenant_id());

CREATE TRIGGER set_deals_updated_at
  BEFORE UPDATE ON meridian.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. deal_access
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.deal_access (
  id           varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid         NOT NULL REFERENCES public.tenants(id),
  deal_id      varchar(36)  NOT NULL REFERENCES meridian.deals(id),
  user_id      varchar(36)  NOT NULL,
  access_level text         NOT NULL DEFAULT 'contributor',
  granted_by   varchar(36),
  created_at   timestamptz  DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meridian_deal_access_deal_user
  ON meridian.deal_access(deal_id, user_id);
CREATE INDEX IF NOT EXISTS idx_meridian_deal_access_tenant ON meridian.deal_access(tenant_id);
ALTER TABLE meridian.deal_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_deal_access ON meridian.deal_access
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 3. invitations
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.invitations (
  id          varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid         NOT NULL REFERENCES public.tenants(id),
  email       text         NOT NULL,
  role        text         NOT NULL DEFAULT 'viewer',
  invited_by  varchar(36)  NOT NULL,
  token       text         NOT NULL UNIQUE,
  expires_at  timestamptz  NOT NULL,
  accepted_at timestamptz,
  status      text         NOT NULL DEFAULT 'pending',
  created_at  timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_invitations_tenant ON meridian.invitations(tenant_id);
ALTER TABLE meridian.invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_invitations ON meridian.invitations
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 4. audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.audit_log (
  id            varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid         NOT NULL REFERENCES public.tenants(id),
  user_id       varchar(36)  NOT NULL,
  action        text         NOT NULL,
  resource_type text         NOT NULL,
  resource_id   varchar(36),
  details_json  jsonb        DEFAULT '{}',
  ip_address    text,
  created_at    timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_audit_log_tenant ON meridian.audit_log(tenant_id);
ALTER TABLE meridian.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_audit_log ON meridian.audit_log
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 5. pillars
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.pillars (
  id                  varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid         NOT NULL REFERENCES public.tenants(id),
  deal_id             varchar(36)  REFERENCES meridian.deals(id),
  pillar_name         text         NOT NULL,
  score               numeric(3,1),
  weight              numeric(3,2),
  finding_count       int          DEFAULT 0,
  evidence_confidence numeric(3,2) DEFAULT 0.00,
  confidence_label    text         DEFAULT 'insufficient',
  document_count      int          DEFAULT 0,
  score_cap           numeric(3,1) DEFAULT 3.0,
  updated_at          timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_pillars_tenant ON meridian.pillars(tenant_id);
ALTER TABLE meridian.pillars ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_pillars ON meridian.pillars
  FOR ALL USING (tenant_id = public.tenant_id());

CREATE TRIGGER set_pillars_updated_at
  BEFORE UPDATE ON meridian.pillars
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 6. findings
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.findings (
  id                 varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid         NOT NULL REFERENCES public.tenants(id),
  deal_id            varchar(36)  REFERENCES meridian.deals(id),
  pillar_id          varchar(36)  REFERENCES meridian.pillars(id),
  severity           text         NOT NULL,
  title              text         NOT NULL,
  description        text,
  impact_estimate    text,
  remediation_notes  text,
  source_documents   text[],
  source_count       int          DEFAULT 0,
  source_document_id varchar(36),
  status             text         NOT NULL DEFAULT 'open',
  created_at         timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_findings_tenant ON meridian.findings(tenant_id);
ALTER TABLE meridian.findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_findings ON meridian.findings
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 7. documents
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.documents (
  id                varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid         NOT NULL REFERENCES public.tenants(id),
  deal_id           varchar(36)  REFERENCES meridian.deals(id),
  filename          text         NOT NULL,
  original_filename text,
  file_type         text,
  file_size         int,
  classification    text,
  object_path       text,
  upload_status     text         NOT NULL DEFAULT 'uploaded',
  page_count        int,
  uploaded_by       varchar(36),
  extracted_text    text,
  text_length       int,
  folder_path       text,
  parent_archive_id varchar(36),
  content_hash      text,
  extraction_status text         NOT NULL DEFAULT 'pending',
  extraction_error  text,
  metadata_json     jsonb,
  created_at        timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_documents_tenant ON meridian.documents(tenant_id);
ALTER TABLE meridian.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_documents ON meridian.documents
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 8. document_chunks
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.document_chunks (
  id            varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid         NOT NULL REFERENCES public.tenants(id),
  document_id   varchar(36)  REFERENCES meridian.documents(id),
  deal_id       varchar(36)  REFERENCES meridian.deals(id),
  chunk_index   int          NOT NULL,
  chunk_text    text         NOT NULL,
  chunk_tokens  int,
  search_tokens text,
  metadata_json jsonb,
  created_at    timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_document_chunks_tenant ON meridian.document_chunks(tenant_id);
ALTER TABLE meridian.document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document_chunks ON meridian.document_chunks
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 9. document_classifications
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.document_classifications (
  id                       varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid         NOT NULL REFERENCES public.tenants(id),
  document_id              varchar(36)  NOT NULL REFERENCES meridian.documents(id),
  deal_id                  varchar(36)  NOT NULL REFERENCES meridian.deals(id),
  document_type            text         NOT NULL DEFAULT 'unknown',
  pillar_infrastructure    boolean      DEFAULT false,
  pillar_security          boolean      DEFAULT false,
  pillar_operations        boolean      DEFAULT false,
  pillar_compliance        boolean      DEFAULT false,
  pillar_scalability       boolean      DEFAULT false,
  pillar_strategy          boolean      DEFAULT false,
  confidence               numeric(3,2) DEFAULT 0.00,
  classification_reasoning text,
  created_at               timestamptz  DEFAULT now(),
  updated_at               timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_document_classifications_tenant ON meridian.document_classifications(tenant_id);
ALTER TABLE meridian.document_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document_classifications ON meridian.document_classifications
  FOR ALL USING (tenant_id = public.tenant_id());

CREATE TRIGGER set_document_classifications_updated_at
  BEFORE UPDATE ON meridian.document_classifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 10. baseline_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.baseline_profiles (
  id           varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid         NOT NULL REFERENCES public.tenants(id),
  name         text         NOT NULL,
  profile_data jsonb,
  is_default   boolean      DEFAULT false,
  created_at   timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_baseline_profiles_tenant ON meridian.baseline_profiles(tenant_id);
ALTER TABLE meridian.baseline_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_baseline_profiles ON meridian.baseline_profiles
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 11. baseline_comparisons
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.baseline_comparisons (
  id                 varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid         NOT NULL REFERENCES public.tenants(id),
  deal_id            varchar(36)  REFERENCES meridian.deals(id),
  standard_name      text         NOT NULL,
  current_state      text         NOT NULL,
  gap_severity       text         NOT NULL,
  priority           text         DEFAULT 'recommended',
  remediation_note   text,
  estimated_cost     text,
  source_document_id varchar(36)
);

CREATE INDEX IF NOT EXISTS idx_meridian_baseline_comparisons_tenant ON meridian.baseline_comparisons(tenant_id);
ALTER TABLE meridian.baseline_comparisons ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_baseline_comparisons ON meridian.baseline_comparisons
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 12. tech_stack_items
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.tech_stack_items (
  id                 varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid         NOT NULL REFERENCES public.tenants(id),
  deal_id            varchar(36)  REFERENCES meridian.deals(id),
  category           text         NOT NULL,
  item_name          text         NOT NULL,
  version            text,
  status             text         DEFAULT 'unknown',
  notes              text,
  confidence         text         DEFAULT 'medium',
  source_document_id varchar(36),
  created_at         timestamptz  DEFAULT now(),
  updated_at         timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_tech_stack_items_tenant ON meridian.tech_stack_items(tenant_id);
ALTER TABLE meridian.tech_stack_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tech_stack_items ON meridian.tech_stack_items
  FOR ALL USING (tenant_id = public.tenant_id());

CREATE TRIGGER set_tech_stack_items_updated_at
  BEFORE UPDATE ON meridian.tech_stack_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 13. tech_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.tech_categories (
  id            varchar(36)   PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid          NOT NULL REFERENCES public.tenants(id),
  name          varchar(255)  NOT NULL,
  description   text,
  display_order int           DEFAULT 0,
  is_default    boolean       DEFAULT true,
  created_at    timestamptz   DEFAULT now(),
  updated_at    timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_tech_categories_tenant ON meridian.tech_categories(tenant_id);
ALTER TABLE meridian.tech_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tech_categories ON meridian.tech_categories
  FOR ALL USING (tenant_id = public.tenant_id());

CREATE TRIGGER set_tech_categories_updated_at
  BEFORE UPDATE ON meridian.tech_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 14. topology_nodes
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.topology_nodes (
  id                 varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid         NOT NULL REFERENCES public.tenants(id),
  deal_id            varchar(36)  REFERENCES meridian.deals(id),
  node_type          text         NOT NULL,
  label              text         NOT NULL,
  sublabel           text,
  status             text         DEFAULT 'unknown',
  parent_node_id     varchar(36),
  position_x         int          DEFAULT 0,
  position_y         int          DEFAULT 0,
  metadata_json      jsonb,
  source_document_id varchar(36),
  created_at         timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_topology_nodes_tenant ON meridian.topology_nodes(tenant_id);
ALTER TABLE meridian.topology_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_topology_nodes ON meridian.topology_nodes
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 15. topology_connections
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.topology_connections (
  id              varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid         NOT NULL REFERENCES public.tenants(id),
  deal_id         varchar(36)  REFERENCES meridian.deals(id),
  from_node_id    varchar(36),
  to_node_id      varchar(36),
  connection_type text         NOT NULL,
  label           text,
  bandwidth       text,
  status          text         DEFAULT 'healthy'
);

CREATE INDEX IF NOT EXISTS idx_meridian_topology_connections_tenant ON meridian.topology_connections(tenant_id);
ALTER TABLE meridian.topology_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_topology_connections ON meridian.topology_connections
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 16. playbook_phases
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.playbook_phases (
  id         varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid         NOT NULL REFERENCES public.tenants(id),
  deal_id    varchar(36)  REFERENCES meridian.deals(id),
  phase_name text         NOT NULL,
  time_range text         NOT NULL,
  status     text         NOT NULL DEFAULT 'pending',
  sort_order int          NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_meridian_playbook_phases_tenant ON meridian.playbook_phases(tenant_id);
ALTER TABLE meridian.playbook_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_playbook_phases ON meridian.playbook_phases
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 17. playbook_tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.playbook_tasks (
  id               varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid         NOT NULL REFERENCES public.tenants(id),
  phase_id         varchar(36)  REFERENCES meridian.playbook_phases(id),
  task_name        text         NOT NULL,
  is_critical_path boolean      DEFAULT false,
  status           text         NOT NULL DEFAULT 'pending',
  sort_order       int          NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_meridian_playbook_tasks_tenant ON meridian.playbook_tasks(tenant_id);
ALTER TABLE meridian.playbook_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_playbook_tasks ON meridian.playbook_tasks
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 18. score_snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.score_snapshots (
  id          varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid         NOT NULL REFERENCES public.tenants(id),
  deal_id     varchar(36)  REFERENCES meridian.deals(id),
  score       numeric(5,1) NOT NULL,
  recorded_at timestamptz  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meridian_score_snapshots_tenant ON meridian.score_snapshots(tenant_id);
ALTER TABLE meridian.score_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_score_snapshots ON meridian.score_snapshots
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 19. processing_queue
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.processing_queue (
  id            varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid         NOT NULL REFERENCES public.tenants(id),
  deal_id       varchar(36)  REFERENCES meridian.deals(id),
  document_id   varchar(36)  REFERENCES meridian.documents(id),
  step          text         NOT NULL,
  status        text         NOT NULL DEFAULT 'queued',
  error_message text,
  created_at    timestamptz  DEFAULT now(),
  completed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_meridian_processing_queue_tenant ON meridian.processing_queue(tenant_id);
ALTER TABLE meridian.processing_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_processing_queue ON meridian.processing_queue
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 20. usage_tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.usage_tracking (
  id         varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid         NOT NULL REFERENCES public.tenants(id),
  metric     text         NOT NULL,
  period     text         NOT NULL,
  count      int          NOT NULL DEFAULT 0,
  updated_at timestamptz  DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meridian_usage_tracking_tenant_metric_period
  ON meridian.usage_tracking(tenant_id, metric, period);
CREATE INDEX IF NOT EXISTS idx_meridian_usage_tracking_tenant ON meridian.usage_tracking(tenant_id);
ALTER TABLE meridian.usage_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_usage_tracking ON meridian.usage_tracking
  FOR ALL USING (tenant_id = public.tenant_id());

CREATE TRIGGER set_usage_tracking_updated_at
  BEFORE UPDATE ON meridian.usage_tracking
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 21. platform_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.platform_settings (
  id            varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid         NOT NULL REFERENCES public.tenants(id),
  setting_key   text         NOT NULL UNIQUE,
  setting_value jsonb,
  updated_by    varchar(36),
  updated_at    timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_platform_settings_tenant ON meridian.platform_settings(tenant_id);
ALTER TABLE meridian.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_platform_settings ON meridian.platform_settings
  FOR ALL USING (tenant_id = public.tenant_id());

CREATE TRIGGER set_platform_settings_updated_at
  BEFORE UPDATE ON meridian.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 22. account_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.account_requests (
  id                       varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid         NOT NULL REFERENCES public.tenants(id),
  company_name             text         NOT NULL,
  contact_name             text         NOT NULL,
  contact_email            text         NOT NULL,
  contact_phone            text,
  industry                 text,
  estimated_deals_per_year int,
  estimated_users          int,
  message                  text,
  status                   text         NOT NULL DEFAULT 'pending',
  reviewed_by              varchar(36),
  reviewed_at              timestamptz,
  review_notes             text,
  created_at               timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_account_requests_tenant ON meridian.account_requests(tenant_id);
ALTER TABLE meridian.account_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_account_requests ON meridian.account_requests
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 23. organization_branding
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.organization_branding (
  id                     varchar(36)   PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid          NOT NULL UNIQUE REFERENCES public.tenants(id),
  company_name           varchar(255),
  logo_url               text,
  logo_width_px          int           DEFAULT 200,
  primary_color          varchar(7)    DEFAULT '#1a56db',
  secondary_color        varchar(7)    DEFAULT '#6b7280',
  accent_color           varchar(7)    DEFAULT '#059669',
  report_header_text     varchar(255),
  report_footer_text     varchar(255),
  confidentiality_notice text          DEFAULT 'CONFIDENTIAL — For intended recipients only.',
  contact_name           varchar(255),
  contact_email          varchar(255),
  contact_phone          varchar(50),
  website                varchar(255),
  show_meridian_badge    boolean       DEFAULT true,
  custom_cover_page      boolean       DEFAULT false,
  created_at             timestamptz   DEFAULT now(),
  updated_at             timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_organization_branding_tenant ON meridian.organization_branding(tenant_id);
ALTER TABLE meridian.organization_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_organization_branding ON meridian.organization_branding
  FOR ALL USING (tenant_id = public.tenant_id());

CREATE TRIGGER set_organization_branding_updated_at
  BEFORE UPDATE ON meridian.organization_branding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 24. finding_cross_references
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.finding_cross_references (
  id                 varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid         NOT NULL REFERENCES public.tenants(id),
  finding_id         varchar(36)  NOT NULL REFERENCES meridian.findings(id) ON DELETE CASCADE,
  similar_finding_id varchar(36)  NOT NULL REFERENCES meridian.findings(id) ON DELETE CASCADE,
  similarity_score   numeric(3,2) NOT NULL,
  deal_id            varchar(36)  NOT NULL,
  similar_deal_id    varchar(36)  NOT NULL,
  created_at         timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_finding_cross_references_tenant ON meridian.finding_cross_references(tenant_id);
ALTER TABLE meridian.finding_cross_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_finding_cross_references ON meridian.finding_cross_references
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 25. qa_conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.qa_conversations (
  id         varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid         NOT NULL REFERENCES public.tenants(id),
  deal_id    varchar(36)  NOT NULL REFERENCES meridian.deals(id) ON DELETE CASCADE,
  user_id    varchar(36)  NOT NULL,
  title      varchar(255),
  created_at timestamptz  DEFAULT now(),
  updated_at timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_qa_conversations_tenant ON meridian.qa_conversations(tenant_id);
ALTER TABLE meridian.qa_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_qa_conversations ON meridian.qa_conversations
  FOR ALL USING (tenant_id = public.tenant_id());

CREATE TRIGGER set_qa_conversations_updated_at
  BEFORE UPDATE ON meridian.qa_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 26. qa_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.qa_messages (
  id                  varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid         NOT NULL REFERENCES public.tenants(id),
  conversation_id     varchar(36)  NOT NULL REFERENCES meridian.qa_conversations(id) ON DELETE CASCADE,
  role                varchar(20)  NOT NULL,
  content             text         NOT NULL,
  citations           jsonb        DEFAULT '[]',
  similar_question_ids jsonb       DEFAULT '[]',
  created_at          timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_qa_messages_tenant ON meridian.qa_messages(tenant_id);
ALTER TABLE meridian.qa_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_qa_messages ON meridian.qa_messages
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 27. qa_saved_answers
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.qa_saved_answers (
  id         varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid         NOT NULL REFERENCES public.tenants(id),
  deal_id    varchar(36)  NOT NULL REFERENCES meridian.deals(id) ON DELETE CASCADE,
  question   text         NOT NULL,
  answer     text         NOT NULL,
  citations  jsonb        DEFAULT '[]',
  saved_by   varchar(36)  NOT NULL,
  created_at timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_qa_saved_answers_tenant ON meridian.qa_saved_answers(tenant_id);
ALTER TABLE meridian.qa_saved_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_qa_saved_answers ON meridian.qa_saved_answers
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- 28. pillar_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.pillar_templates (
  id            varchar(36)   PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid          NOT NULL REFERENCES public.tenants(id),
  name          varchar(255)  NOT NULL,
  description   text,
  weight        numeric(4,3)  NOT NULL DEFAULT 0.167,
  is_default    boolean       DEFAULT true,
  display_order int           DEFAULT 0,
  created_at    timestamptz   DEFAULT now(),
  updated_at    timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_pillar_templates_tenant ON meridian.pillar_templates(tenant_id);
ALTER TABLE meridian.pillar_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_pillar_templates ON meridian.pillar_templates
  FOR ALL USING (tenant_id = public.tenant_id());

CREATE TRIGGER set_pillar_templates_updated_at
  BEFORE UPDATE ON meridian.pillar_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 29. password_reset_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS meridian.password_reset_tokens (
  id         varchar(36)   PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid          NOT NULL REFERENCES public.tenants(id),
  user_id    varchar(36)   NOT NULL,
  token      varchar(255)  NOT NULL UNIQUE,
  expires_at timestamptz   NOT NULL,
  used_at    timestamptz,
  created_at timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meridian_password_reset_tokens_tenant ON meridian.password_reset_tokens(tenant_id);
ALTER TABLE meridian.password_reset_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_password_reset_tokens ON meridian.password_reset_tokens
  FOR ALL USING (tenant_id = public.tenant_id());

-- ============================================================
-- Grants
-- ============================================================
GRANT USAGE ON SCHEMA meridian TO cavaridge_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA meridian TO role_core;
GRANT SELECT ON ALL TABLES IN SCHEMA meridian TO cavaridge_app;

COMMIT;
