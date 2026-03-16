-- ============================================================
-- Cavaridge Cavalier Partners — Database Migration
-- CVG-CAVALIER-MIGRATION-001
-- Date: 2026-03-15
-- Description: Creates all PSA-lite and Connector tables
-- ============================================================

-- ─── ENUMS ───────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('new', 'open', 'pending', 'on_hold', 'resolved', 'closed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_priority AS ENUM ('critical', 'high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_source AS ENUM ('manual', 'email', 'portal', 'phone', 'chat', 'connector', 'alert');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE comment_source AS ENUM ('manual', 'email', 'portal', 'ai', 'connector');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contract_type AS ENUM ('managed', 'block_hours', 'time_and_materials', 'project', 'retainer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contract_status AS ENUM ('draft', 'active', 'expiring', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('draft', 'approved', 'sent', 'paid', 'overdue', 'void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_line_source_type AS ENUM ('contract_recurring', 'time_entry', 'ad_hoc', 'expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE work_type AS ENUM ('reactive', 'proactive', 'project', 'admin', 'travel');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dispatch_slot_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE connector_status AS ENUM ('unconfigured', 'configuring', 'connected', 'active', 'error', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE connector_health_status AS ENUM ('healthy', 'degraded', 'unhealthy', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sync_type AS ENUM ('full', 'incremental', 'webhook');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sync_status AS ENUM ('started', 'completed', 'failed', 'partial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── PSA TABLES ──────────────────────────────────────────────────────

-- Business Hours
CREATE TABLE IF NOT EXISTS business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  timezone text NOT NULL,
  schedule jsonb NOT NULL,
  holidays jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_business_hours_tenant ON business_hours(tenant_id);

-- SLA Policies
CREATE TABLE IF NOT EXISTS sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  description text,
  response_target_critical integer NOT NULL,
  response_target_high integer NOT NULL,
  response_target_medium integer NOT NULL,
  response_target_low integer NOT NULL,
  resolution_target_critical integer NOT NULL,
  resolution_target_high integer NOT NULL,
  resolution_target_medium integer NOT NULL,
  resolution_target_low integer NOT NULL,
  business_hours_id uuid REFERENCES business_hours(id),
  escalation_rules jsonb DEFAULT '[]',
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sla_policies_tenant ON sla_policies(tenant_id);

-- Contracts
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  client_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  contract_number text,
  type contract_type NOT NULL,
  status contract_status NOT NULL DEFAULT 'draft',
  start_date date NOT NULL,
  end_date date,
  monthly_amount numeric(10, 2),
  hourly_rate numeric(10, 2),
  block_hours_total integer,
  block_hours_used integer DEFAULT 0,
  block_hours_rollover boolean DEFAULT false,
  sla_policy_id uuid REFERENCES sla_policies(id),
  auto_renew boolean DEFAULT true,
  renewal_term_months integer DEFAULT 12,
  notice_period_days integer DEFAULT 30,
  scope_description text,
  exclusions text,
  connector_external_id text,
  custom_fields jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant ON contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_contracts_number ON contracts(tenant_id, contract_number) WHERE contract_number IS NOT NULL;

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  client_id uuid NOT NULL REFERENCES tenants(id),
  site_id uuid REFERENCES tenants(id),
  ticket_number text NOT NULL,
  subject text NOT NULL,
  description text,
  status ticket_status NOT NULL DEFAULT 'new',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  category text,
  subcategory text,
  source ticket_source NOT NULL DEFAULT 'manual',
  assigned_to uuid,
  requested_by uuid,
  sla_policy_id uuid REFERENCES sla_policies(id),
  sla_response_due timestamptz,
  sla_resolution_due timestamptz,
  sla_responded_at timestamptz,
  sla_resolved_at timestamptz,
  sla_response_breached boolean DEFAULT false,
  sla_resolution_breached boolean DEFAULT false,
  contract_id uuid REFERENCES contracts(id),
  connector_source text,
  connector_external_id text,
  ai_category_confidence real,
  ai_priority_score real,
  ai_suggested_resolution text,
  ai_similar_ticket_ids uuid[],
  custom_fields jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_client ON tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_response ON tickets(sla_response_due) WHERE sla_response_due IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_sla_resolution ON tickets(sla_resolution_due) WHERE sla_resolution_due IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tickets_number ON tickets(tenant_id, ticket_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tickets_connector ON tickets(tenant_id, connector_source, connector_external_id) WHERE connector_source IS NOT NULL;

-- Ticket Comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  author_id uuid NOT NULL,
  body text NOT NULL,
  is_internal boolean DEFAULT false,
  is_resolution boolean DEFAULT false,
  source comment_source DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_tenant ON ticket_comments(tenant_id);

-- Ticket Tags
CREATE TABLE IF NOT EXISTS ticket_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  tag text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ticket_tags_ticket ON ticket_tags(ticket_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ticket_tags ON ticket_tags(ticket_id, tag);

-- Time Entries
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  ticket_id uuid REFERENCES tickets(id),
  user_id uuid NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  duration_mins integer,
  billable boolean DEFAULT true,
  rate_override numeric(10, 2),
  work_type work_type DEFAULT 'reactive',
  notes text,
  approved boolean DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  invoice_line_id uuid,
  connector_external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_time_entries_tenant ON time_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_ticket ON time_entries(ticket_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_billable_approved ON time_entries(tenant_id, billable, approved) WHERE billable = true AND approved = true;

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  client_id uuid NOT NULL REFERENCES tenants(id),
  invoice_number text,
  status invoice_status NOT NULL DEFAULT 'draft',
  period_start date NOT NULL,
  period_end date NOT NULL,
  due_date date NOT NULL,
  subtotal numeric(10, 2) NOT NULL DEFAULT 0,
  tax_rate numeric(5, 4) DEFAULT 0,
  tax_amount numeric(10, 2) DEFAULT 0,
  total numeric(10, 2) NOT NULL DEFAULT 0,
  paid_amount numeric(10, 2) DEFAULT 0,
  paid_at timestamptz,
  notes text,
  external_id text,
  external_system text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_number ON invoices(tenant_id, invoice_number) WHERE invoice_number IS NOT NULL;

-- Invoice Lines
CREATE TABLE IF NOT EXISTS invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  description text NOT NULL,
  quantity numeric(10, 2) NOT NULL DEFAULT 1,
  unit_price numeric(10, 2) NOT NULL,
  amount numeric(10, 2) NOT NULL,
  source_type invoice_line_source_type NOT NULL,
  source_id uuid,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);

-- Service Catalog Items
CREATE TABLE IF NOT EXISTS service_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  description text,
  category text,
  default_priority text DEFAULT 'medium',
  default_sla_policy_id uuid REFERENCES sla_policies(id),
  estimated_minutes integer,
  requires_approval boolean DEFAULT false,
  visible_in_portal boolean DEFAULT true,
  form_schema jsonb DEFAULT '{}',
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_catalog_tenant ON service_catalog_items(tenant_id);

-- Dispatch Slots
CREATE TABLE IF NOT EXISTS dispatch_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  ticket_id uuid NOT NULL REFERENCES tickets(id),
  user_id uuid NOT NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  actual_start timestamptz,
  actual_end timestamptz,
  status dispatch_slot_status DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dispatch_slots_tenant ON dispatch_slots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_slots_user ON dispatch_slots(user_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_dispatch_slots_ticket ON dispatch_slots(ticket_id);

-- ─── CONNECTOR TABLES ────────────────────────────────────────────────

-- Connector Configurations
CREATE TABLE IF NOT EXISTS connector_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  connector_id text NOT NULL,
  status connector_status NOT NULL DEFAULT 'unconfigured',
  config jsonb DEFAULT '{}',
  credentials_encrypted text,
  last_health_check timestamptz,
  health_status connector_health_status DEFAULT 'unknown',
  health_details jsonb DEFAULT '{}',
  enabled boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_connector_configs_tenant_connector ON connector_configs(tenant_id, connector_id);
CREATE INDEX IF NOT EXISTS idx_connector_configs_tenant ON connector_configs(tenant_id);

-- Connector Sync Logs
CREATE TABLE IF NOT EXISTS connector_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  connector_id text NOT NULL,
  sync_type sync_type NOT NULL,
  entity_type text NOT NULL,
  status sync_status NOT NULL DEFAULT 'started',
  records_processed integer DEFAULT 0,
  records_created integer DEFAULT 0,
  records_updated integer DEFAULT 0,
  records_deleted integer DEFAULT 0,
  errors jsonb DEFAULT '[]',
  cursor_before text,
  cursor_after text,
  duration_ms integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sync_logs_tenant_connector ON connector_sync_logs(tenant_id, connector_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON connector_sync_logs(started_at DESC);

-- ─── RLS POLICIES ────────────────────────────────────────────────────
-- Enable RLS on all new tables. Policies reference the tenants table
-- from packages/auth/ via the auth.tenant_id() function.

ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies will be created per-tenant using the Universal Tenant Model
-- auth.tenant_id() function from packages/auth/. The specific policy
-- definitions depend on the tenant hierarchy implementation.
-- Template:
--
-- CREATE POLICY "tenant_isolation" ON tickets
--   FOR ALL USING (tenant_id = auth.tenant_id());
--
-- These should be generated by the tenant provisioning system, not
-- hardcoded here, to support the 4-tier tenant hierarchy.

-- ─── COMMENTS ────────────────────────────────────────────────────────

COMMENT ON TABLE tickets IS 'Cavalier Partners PSA-lite: Service tickets with SLA tracking and AI enrichment';
COMMENT ON TABLE contracts IS 'Cavalier Partners PSA-lite: Managed services contracts with billing configuration';
COMMENT ON TABLE invoices IS 'Cavalier Partners PSA-lite: Generated invoices from contracts and time entries';
COMMENT ON TABLE connector_configs IS 'Cavalier Partners: External platform connector configurations per tenant';
COMMENT ON TABLE connector_sync_logs IS 'Cavalier Partners: Audit log of all connector sync operations';
