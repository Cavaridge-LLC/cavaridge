-- Migration 014: Align auth schema with UTM spec
-- 4-tier tenant hierarchy, 6 RBAC roles, tenant_memberships, RLS on all tables

-- ============================================================================
-- 1. Enums
-- ============================================================================

-- Tenant type enum (idempotent — create only if not exists)
DO $$ BEGIN
  CREATE TYPE tenant_type AS ENUM ('platform', 'msp', 'client', 'site', 'prospect');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Role enum (6 UTM standard roles)
DO $$ BEGIN
  CREATE TYPE role AS ENUM (
    'platform_admin',
    'msp_admin',
    'msp_tech',
    'client_admin',
    'client_viewer',
    'prospect'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. Tenants table — add type enum column, parent_id index
-- ============================================================================

-- Add type column as enum if it's still varchar
DO $$ BEGIN
  -- If the column exists as varchar, migrate it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'type'
    AND data_type = 'character varying'
  ) THEN
    ALTER TABLE tenants RENAME COLUMN type TO type_old;
    ALTER TABLE tenants ADD COLUMN type tenant_type NOT NULL DEFAULT 'msp';
    UPDATE tenants SET type = type_old::tenant_type WHERE type_old IS NOT NULL;
    ALTER TABLE tenants DROP COLUMN type_old;
  END IF;
END $$;

-- Ensure parent_id column exists
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES tenants(id);

-- Indexes
CREATE INDEX IF NOT EXISTS tenants_parent_id_idx ON tenants(parent_id);
CREATE INDEX IF NOT EXISTS tenants_type_idx ON tenants(type);

-- ============================================================================
-- 3. Profiles table — add tenant_id, migrate role to enum
-- ============================================================================

-- Add tenant_id column (mirrors organization_id during transition)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Backfill tenant_id from organization_id if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'organization_id'
  ) THEN
    UPDATE profiles SET tenant_id = organization_id WHERE tenant_id IS NULL AND organization_id IS NOT NULL;
  END IF;
END $$;

-- Migrate role column to enum if still varchar
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
    AND data_type = 'character varying'
  ) THEN
    ALTER TABLE profiles RENAME COLUMN role TO role_old;
    ALTER TABLE profiles ADD COLUMN role role NOT NULL DEFAULT 'client_viewer';

    -- Map old roles to new UTM roles
    UPDATE profiles SET role = 'platform_admin' WHERE role_old IN ('platform_owner', 'platform_admin');
    UPDATE profiles SET role = 'msp_admin' WHERE role_old = 'tenant_admin';
    UPDATE profiles SET role = 'client_viewer' WHERE role_old IN ('user', 'viewer');

    ALTER TABLE profiles DROP COLUMN role_old;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS profiles_tenant_id_idx ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);

-- ============================================================================
-- 4. Tenant memberships table
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role role NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_memberships_user_tenant_idx ON tenant_memberships(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS tenant_memberships_tenant_id_idx ON tenant_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS tenant_memberships_user_id_idx ON tenant_memberships(user_id);

-- Backfill tenant_memberships from profiles for existing users
INSERT INTO tenant_memberships (user_id, tenant_id, role, is_active)
SELECT id, COALESCE(tenant_id, organization_id), role, true
FROM profiles
WHERE COALESCE(tenant_id, organization_id) IS NOT NULL
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- ============================================================================
-- 5. Invites — migrate role column to enum
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invites' AND column_name = 'role'
    AND data_type = 'character varying'
  ) THEN
    ALTER TABLE invites RENAME COLUMN role TO role_old;
    ALTER TABLE invites ADD COLUMN role role NOT NULL DEFAULT 'client_viewer';
    UPDATE invites SET role = 'msp_admin' WHERE role_old = 'tenant_admin';
    UPDATE invites SET role = 'client_viewer' WHERE role_old IN ('user', 'viewer');
    UPDATE invites SET role = 'platform_admin' WHERE role_old IN ('platform_owner', 'platform_admin');
    ALTER TABLE invites DROP COLUMN role_old;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS invites_email_idx ON invites(email);
CREATE INDEX IF NOT EXISTS invites_tenant_id_idx ON invites(tenant_id);

-- ============================================================================
-- 6. RLS Policies — every table must have RLS enabled
-- ============================================================================

-- Enable RLS on all auth tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate cleanly
DO $$ BEGIN
  DROP POLICY IF EXISTS tenants_platform_admin ON tenants;
  DROP POLICY IF EXISTS tenants_own_hierarchy ON tenants;
  DROP POLICY IF EXISTS profiles_platform_admin ON profiles;
  DROP POLICY IF EXISTS profiles_own ON profiles;
  DROP POLICY IF EXISTS profiles_same_tenant ON profiles;
  DROP POLICY IF EXISTS memberships_platform_admin ON tenant_memberships;
  DROP POLICY IF EXISTS memberships_own ON tenant_memberships;
  DROP POLICY IF EXISTS memberships_tenant_admin ON tenant_memberships;
  DROP POLICY IF EXISTS invites_platform_admin ON invites;
  DROP POLICY IF EXISTS invites_own_tenant ON invites;
END $$;

-- --- Tenants ---
-- Platform Admin: full access
CREATE POLICY tenants_platform_admin ON tenants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform_admin'
    )
  );

-- Users see their own tenant and its ancestors/descendants
CREATE POLICY tenants_own_hierarchy ON tenants
  FOR SELECT
  USING (
    id IN (
      SELECT tm.tenant_id FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.is_active = true
    )
    OR
    parent_id IN (
      SELECT tm.tenant_id FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.is_active = true
    )
  );

-- --- Profiles ---
-- Platform Admin: full access
CREATE POLICY profiles_platform_admin ON profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'platform_admin'
    )
  );

-- Users can see their own profile
CREATE POLICY profiles_own ON profiles
  FOR SELECT
  USING (id = auth.uid());

-- Users can see profiles in their tenant
CREATE POLICY profiles_same_tenant ON profiles
  FOR SELECT
  USING (
    COALESCE(tenant_id, organization_id) IN (
      SELECT tm.tenant_id FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.is_active = true
    )
  );

-- --- Tenant Memberships ---
-- Platform Admin: full access
CREATE POLICY memberships_platform_admin ON tenant_memberships
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform_admin'
    )
  );

-- Users can see their own memberships
CREATE POLICY memberships_own ON tenant_memberships
  FOR SELECT
  USING (user_id = auth.uid());

-- MSP/Client Admins can manage memberships in their tenant
CREATE POLICY memberships_tenant_admin ON tenant_memberships
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('msp_admin', 'client_admin')
      AND tm.is_active = true
    )
  );

-- --- Invites ---
-- Platform Admin: full access
CREATE POLICY invites_platform_admin ON invites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform_admin'
    )
  );

-- MSP/Client Admins can manage invites for their tenant
CREATE POLICY invites_own_tenant ON invites
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('msp_admin', 'client_admin')
      AND tm.is_active = true
    )
  );

-- ============================================================================
-- 7. Service role bypass (standard Supabase pattern)
-- ============================================================================
-- The service_role key bypasses RLS by default in Supabase.
-- No additional policy needed for server-side admin operations.
