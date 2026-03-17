-- ============================================================
-- Cavaridge Platform — Tenants Table Bootstrap
-- Run AFTER 000_platform_setup.sql, BEFORE 001_cavalier_partners.sql
--
-- This creates the minimal tenants table needed for FKs.
-- The full Universal Tenant Model from packages/auth/ should
-- be migrated here once all apps point at this database.
--
-- Schema matches packages/auth/ self-referencing 4-tier model:
--   Platform → MSP → Client → Site/Prospect
-- ============================================================

-- Create auth schema if not exists (Supabase convention)
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES tenants(id),           -- Self-referencing hierarchy
  name text NOT NULL,
  slug text UNIQUE NOT NULL,                        -- URL-safe identifier
  tier text NOT NULL CHECK (tier IN ('platform', 'msp', 'client', 'site', 'prospect')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deactivated')),
  settings jsonb DEFAULT '{}',                      -- Theme, branding, feature flags
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_parent ON tenants(parent_id);
CREATE INDEX IF NOT EXISTS idx_tenants_tier ON tenants(tier);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
CREATE TRIGGER set_updated_at_tenants
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- All app roles can read tenants (needed for RLS context and tenant lookups)
GRANT SELECT ON tenants TO cavaridge_app;
-- Only Core can manage tenants
GRANT INSERT, UPDATE, DELETE ON tenants TO role_core;

COMMENT ON TABLE tenants IS 'Universal Tenant Model: 4-tier self-referencing hierarchy (Platform > MSP > Client > Site/Prospect)';

-- ─── USERS TABLE (MINIMAL) ──────────────────────────────────────────
-- Needed for FK references from tickets.assigned_to, time_entries.user_id, etc.
-- Full user management lives in packages/auth/ — this is the bootstrap.

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  email text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN (
    'platform_admin', 'msp_admin', 'msp_tech', 'client_admin', 'client_user', 'viewer',
    'partner_admin', 'partner_tech', 'partner_viewer'
  )),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended', 'deactivated')),
  auth_provider_id text,                            -- Supabase Auth or external IdP user ID
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_tenant ON users(tenant_id, email);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_users ON users
  FOR ALL USING (tenant_id = public.tenant_id());

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

GRANT SELECT ON users TO cavaridge_app;
GRANT INSERT, UPDATE, DELETE ON users TO role_core;

COMMENT ON TABLE users IS 'Platform users with RBAC roles. Bootstrap schema — full user management in packages/auth/.';
