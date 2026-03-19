-- ============================================================
-- Cavaridge Platform — Least-Privilege Role Grants
-- Run AFTER 001_cavalier_partners.sql
--
-- SOC 2 CC6.1, CC6.3: Each app role gets only the table
-- and column access it needs. Nothing more.
-- ============================================================

-- ─── REVOKE DEFAULTS ─────────────────────────────────────────────────
-- Start from zero. The default privileges grant from 000 gives
-- SELECT to cavaridge_app. We'll be more specific below.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM cavaridge_app;
-- Re-grant schema usage
GRANT USAGE ON SCHEMA public TO cavaridge_app;

-- ─── CVG-CORE (role_core) ────────────────────────────────────────────
-- Platform foundation. Broadest access. Manages tickets, dispatch,
-- connectors, tenant administration.

GRANT SELECT, INSERT, UPDATE, DELETE ON tickets TO role_core;
GRANT SELECT, INSERT, UPDATE, DELETE ON ticket_comments TO role_core;
GRANT SELECT, INSERT, UPDATE, DELETE ON ticket_tags TO role_core;
GRANT SELECT, INSERT, UPDATE, DELETE ON sla_policies TO role_core;
GRANT SELECT, INSERT, UPDATE, DELETE ON business_hours TO role_core;
GRANT SELECT, INSERT, UPDATE, DELETE ON dispatch_slots TO role_core;
GRANT SELECT, INSERT, UPDATE, DELETE ON service_catalog_items TO role_core;
GRANT SELECT, INSERT, UPDATE, DELETE ON connector_configs TO role_core;
GRANT SELECT, INSERT ON connector_sync_logs TO role_core;
GRANT SELECT, INSERT, UPDATE ON time_entries TO role_core;
-- Core can read contracts/invoices but Midas owns writes
GRANT SELECT ON contracts TO role_core;
GRANT SELECT ON invoices TO role_core;
GRANT SELECT ON invoice_lines TO role_core;
GRANT SELECT, INSERT ON platform_audit_log TO role_core;

-- ─── CVG-MIDAS (role_midas) ──────────────────────────────────────────
-- Billing engine. Owns contracts, invoices, time entry approval/billing.

GRANT SELECT, INSERT, UPDATE, DELETE ON contracts TO role_midas;
GRANT SELECT, INSERT, UPDATE, DELETE ON invoices TO role_midas;
GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_lines TO role_midas;
GRANT SELECT, UPDATE ON time_entries TO role_midas;        -- Approve + link to invoice
GRANT SELECT ON tickets TO role_midas;                     -- Read ticket context for billing
GRANT SELECT ON sla_policies TO role_midas;                -- Read SLA tier for contract linkage
GRANT SELECT ON business_hours TO role_midas;
GRANT SELECT, INSERT ON platform_audit_log TO role_midas;

-- ─── CVG-ASTRA (role_astra) ──────────────────────────────────────────
-- Client portal. End-users create tickets, view their data.

GRANT SELECT, INSERT ON tickets TO role_astra;             -- Create + view own tickets
GRANT SELECT, INSERT ON ticket_comments TO role_astra;     -- Add comments (non-internal only, enforced by app)
GRANT SELECT ON ticket_tags TO role_astra;
GRANT SELECT ON sla_policies TO role_astra;                -- Display SLA info in portal
GRANT SELECT ON service_catalog_items TO role_astra;       -- Browse service catalog
GRANT SELECT ON contracts TO role_astra;                   -- View own contract summary
GRANT SELECT ON invoices TO role_astra;                    -- View own invoices
GRANT SELECT ON invoice_lines TO role_astra;
GRANT SELECT, INSERT ON platform_audit_log TO role_astra;

-- ─── CVG-AI / Spaniel (role_ai) ──────────────────────────────────────
-- AI enrichment engine. Reads ticket content, writes AI fields only.

GRANT SELECT ON tickets TO role_ai;
GRANT UPDATE (
  category, subcategory,
  ai_category_confidence, ai_priority_score,
  ai_suggested_resolution, ai_similar_ticket_ids,
  updated_at
) ON tickets TO role_ai;
GRANT SELECT ON ticket_comments TO role_ai;                -- Read for context
GRANT SELECT ON ticket_tags TO role_ai;
GRANT INSERT ON ticket_comments TO role_ai;                -- AI can add resolution suggestions as comments
GRANT SELECT ON connector_configs TO role_ai;              -- Read device context from connectors
GRANT SELECT ON connector_sync_logs TO role_ai;
GRANT SELECT, INSERT ON platform_audit_log TO role_ai;

-- ─── CVG-AEGIS (role_aegis) ──────────────────────────────────────────
-- Security posture management. Reads/writes connector data for
-- security platforms (Guardz, SentinelOne, etc.)

GRANT SELECT, UPDATE ON connector_configs TO role_aegis;   -- Manage security connectors
GRANT SELECT, INSERT ON connector_sync_logs TO role_aegis;
GRANT SELECT ON tickets TO role_aegis;                     -- Correlate security events with tickets
GRANT SELECT ON contracts TO role_aegis;                   -- Compliance scope per contract
GRANT SELECT, INSERT ON platform_audit_log TO role_aegis;

-- ─── CVG-RESEARCH / Ducky (role_ducky) ───────────────────────────────
-- User-facing AI. Read access for context, no writes to operational data.

GRANT SELECT ON tickets TO role_ducky;
GRANT SELECT ON ticket_comments TO role_ducky;
GRANT SELECT ON ticket_tags TO role_ducky;
GRANT SELECT ON sla_policies TO role_ducky;
GRANT SELECT ON service_catalog_items TO role_ducky;
GRANT SELECT ON contracts TO role_ducky;
GRANT SELECT ON connector_configs TO role_ducky;           -- Know which connectors are active
GRANT SELECT, INSERT ON platform_audit_log TO role_ducky;

-- ─── CVG-VESPAR (role_vespar) ────────────────────────────────────────
-- Reporting and analytics. Read-only across everything.

GRANT SELECT ON tickets TO role_vespar;
GRANT SELECT ON ticket_comments TO role_vespar;
GRANT SELECT ON ticket_tags TO role_vespar;
GRANT SELECT ON sla_policies TO role_vespar;
GRANT SELECT ON business_hours TO role_vespar;
GRANT SELECT ON contracts TO role_vespar;
GRANT SELECT ON invoices TO role_vespar;
GRANT SELECT ON invoice_lines TO role_vespar;
GRANT SELECT ON time_entries TO role_vespar;
GRANT SELECT ON dispatch_slots TO role_vespar;
GRANT SELECT ON service_catalog_items TO role_vespar;
GRANT SELECT ON connector_configs TO role_vespar;
GRANT SELECT ON connector_sync_logs TO role_vespar;
GRANT SELECT ON platform_audit_log TO role_vespar;

-- ─── CVG-CAELUM (role_caelum) ────────────────────────────────────────
-- SoW generation. Reads client/contract context for proposals.

GRANT SELECT ON contracts TO role_caelum;
GRANT SELECT ON tickets TO role_caelum;                    -- Historical ticket data for SoW scoping
GRANT SELECT ON sla_policies TO role_caelum;
GRANT SELECT, INSERT ON platform_audit_log TO role_caelum;

-- ─── RLS POLICIES ────────────────────────────────────────────────────
-- SOC 2 CC6.3: Tenant isolation enforced at database layer.
-- Every table gets a policy that restricts to current tenant.

-- Tickets
CREATE POLICY tenant_isolation_tickets ON tickets
  FOR ALL USING (tenant_id = public.tenant_id());

-- Ticket Comments
CREATE POLICY tenant_isolation_ticket_comments ON ticket_comments
  FOR ALL USING (tenant_id = public.tenant_id());

-- Ticket Tags
CREATE POLICY tenant_isolation_ticket_tags ON ticket_tags
  FOR ALL USING (tenant_id = public.tenant_id());

-- SLA Policies
CREATE POLICY tenant_isolation_sla_policies ON sla_policies
  FOR ALL USING (tenant_id = public.tenant_id());

-- Business Hours
CREATE POLICY tenant_isolation_business_hours ON business_hours
  FOR ALL USING (tenant_id = public.tenant_id());

-- Contracts
CREATE POLICY tenant_isolation_contracts ON contracts
  FOR ALL USING (tenant_id = public.tenant_id());

-- Invoices
CREATE POLICY tenant_isolation_invoices ON invoices
  FOR ALL USING (tenant_id = public.tenant_id());

-- Invoice Lines
CREATE POLICY tenant_isolation_invoice_lines ON invoice_lines
  FOR ALL USING (tenant_id = public.tenant_id());

-- Time Entries
CREATE POLICY tenant_isolation_time_entries ON time_entries
  FOR ALL USING (tenant_id = public.tenant_id());

-- Service Catalog Items
CREATE POLICY tenant_isolation_service_catalog ON service_catalog_items
  FOR ALL USING (tenant_id = public.tenant_id());

-- Dispatch Slots
CREATE POLICY tenant_isolation_dispatch_slots ON dispatch_slots
  FOR ALL USING (tenant_id = public.tenant_id());

-- Connector Configs
CREATE POLICY tenant_isolation_connector_configs ON connector_configs
  FOR ALL USING (tenant_id = public.tenant_id());

-- Connector Sync Logs
CREATE POLICY tenant_isolation_connector_sync_logs ON connector_sync_logs
  FOR ALL USING (tenant_id = public.tenant_id());

-- Audit Log (tenant-scoped entries visible to own tenant; null tenant_id visible to platform admins)
CREATE POLICY tenant_isolation_audit_log ON platform_audit_log
  FOR ALL USING (tenant_id = public.tenant_id() OR tenant_id IS NULL);

-- ─── UPDATED_AT TRIGGERS ─────────────────────────────────────────────
-- Apply auto-update trigger to all tables with updated_at columns.

CREATE TRIGGER set_updated_at_tickets
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_sla_policies
  BEFORE UPDATE ON sla_policies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_contracts
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_invoices
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_time_entries
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_dispatch_slots
  BEFORE UPDATE ON dispatch_slots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_connector_configs
  BEFORE UPDATE ON connector_configs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── APP SCHEMA GRANTS ─────────────────────────────────────────────────
-- Each app role gets full CRUD on ALL tables in its own schema.
-- role_core gets read access to all app schemas for platform operations.
-- These were added after the database consolidation (004-009 migrations).

-- Shared: all roles need SELECT on public.tenants and public.profiles
GRANT SELECT ON tenants TO role_core, role_midas, role_astra, role_ai, role_aegis, role_ducky, role_vespar, role_caelum;
GRANT SELECT ON profiles TO role_core, role_midas, role_astra, role_ai, role_aegis, role_ducky, role_vespar, role_caelum;
GRANT INSERT, UPDATE ON profiles TO role_core;
GRANT INSERT, UPDATE ON tenants TO role_core;

-- Meridian schema (role_core owns; no dedicated role_meridian yet)
GRANT USAGE ON SCHEMA meridian TO role_core;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA meridian TO role_core;
ALTER DEFAULT PRIVILEGES IN SCHEMA meridian GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_core;

-- Midas schema
GRANT USAGE ON SCHEMA midas TO role_core, role_midas;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA midas TO role_midas;
GRANT SELECT ON ALL TABLES IN SCHEMA midas TO role_core;
ALTER DEFAULT PRIVILEGES IN SCHEMA midas GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_midas;
ALTER DEFAULT PRIVILEGES IN SCHEMA midas GRANT SELECT ON TABLES TO role_core;

-- Ducky schema
GRANT USAGE ON SCHEMA ducky TO role_core, role_ducky;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ducky TO role_ducky;
GRANT SELECT ON ALL TABLES IN SCHEMA ducky TO role_core;
ALTER DEFAULT PRIVILEGES IN SCHEMA ducky GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_ducky;
ALTER DEFAULT PRIVILEGES IN SCHEMA ducky GRANT SELECT ON TABLES TO role_core;

-- Caelum schema
GRANT USAGE ON SCHEMA caelum TO role_core, role_caelum;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA caelum TO role_caelum;
GRANT SELECT ON ALL TABLES IN SCHEMA caelum TO role_core;
ALTER DEFAULT PRIVILEGES IN SCHEMA caelum GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_caelum;
ALTER DEFAULT PRIVILEGES IN SCHEMA caelum GRANT SELECT ON TABLES TO role_core;

-- Astra schema
GRANT USAGE ON SCHEMA astra TO role_core, role_astra;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA astra TO role_astra;
GRANT SELECT ON ALL TABLES IN SCHEMA astra TO role_core;
ALTER DEFAULT PRIVILEGES IN SCHEMA astra GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_astra;
ALTER DEFAULT PRIVILEGES IN SCHEMA astra GRANT SELECT ON TABLES TO role_core;

-- Vespar schema
GRANT USAGE ON SCHEMA vespar TO role_core, role_vespar;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA vespar TO role_vespar;
GRANT SELECT ON ALL TABLES IN SCHEMA vespar TO role_core;
ALTER DEFAULT PRIVILEGES IN SCHEMA vespar GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_vespar;
ALTER DEFAULT PRIVILEGES IN SCHEMA vespar GRANT SELECT ON TABLES TO role_core;

-- Sequence grants for schemas with serial PKs (caelum, astra)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA caelum TO role_caelum, role_core;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA astra TO role_astra, role_core;

-- ============================================================
-- ROLE GRANTS COMPLETE
--
-- Access matrix summary:
-- ┌────────────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┐
-- │ Table      │ Core  │ Midas │ Astra │ AI    │ AEGIS │ Ducky │Vespar │Caelum │
-- ├────────────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┤
-- │ tickets    │ CRUD  │ R     │ CR    │ R+Ucol│ R     │ R     │ R     │ R     │
-- │ comments   │ CRUD  │ —     │ CR    │ CR    │ —     │ R     │ R     │ —     │
-- │ tags       │ CRUD  │ —     │ R     │ R     │ —     │ R     │ R     │ —     │
-- │ sla_policy │ CRUD  │ R     │ R     │ —     │ —     │ R     │ R     │ R     │
-- │ biz_hours  │ CRUD  │ R     │ —     │ —     │ —     │ —     │ R     │ —     │
-- │ contracts  │ R     │ CRUD  │ R     │ —     │ R     │ R     │ R     │ R     │
-- │ invoices   │ R     │ CRUD  │ R     │ —     │ —     │ —     │ R     │ —     │
-- │ inv_lines  │ R     │ CRUD  │ R     │ —     │ —     │ —     │ R     │ —     │
-- │ time_entry │ CRU   │ RU    │ —     │ —     │ —     │ —     │ R     │ —     │
-- │ svc_catalog│ CRUD  │ —     │ R     │ —     │ —     │ R     │ R     │ —     │
-- │ dispatch   │ CRUD  │ —     │ —     │ —     │ —     │ —     │ R     │ —     │
-- │ conn_cfg   │ CRUD  │ —     │ —     │ R     │ RU    │ R     │ R     │ —     │
-- │ conn_logs  │ CR    │ —     │ —     │ R     │ CR    │ —     │ R     │ —     │
-- │ audit_log  │ CR    │ CR    │ CR    │ CR    │ CR    │ CR    │ R     │ CR    │
-- └────────────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┘
-- ============================================================
