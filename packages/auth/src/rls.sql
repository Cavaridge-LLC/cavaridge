-- @cavaridge/auth — Reference RLS policies
--
-- Apply these in each Supabase project via Dashboard > SQL Editor
-- or via Supabase migrations. Replace <table_name> with actual table names.
--
-- These policies enforce tenant isolation at the database level,
-- complementing the app-level RBAC middleware.

-- ==========================================================================
-- Enable RLS on auth-related tables
-- ==========================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ==========================================================================
-- Profiles
-- ==========================================================================

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (display name, avatar, etc.)
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role can insert profiles (during sign-up)
-- Note: INSERT via service role key bypasses RLS, so no policy needed for inserts
-- if using the admin client. If using anon key, add:
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ==========================================================================
-- Organizations
-- ==========================================================================

-- Users can read their own organization
CREATE POLICY "orgs_select_own" ON organizations
  FOR SELECT
  USING (
    id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Tenant admins can update their own organization
CREATE POLICY "orgs_update_admin" ON organizations
  FOR UPDATE
  USING (
    id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('platform_owner', 'platform_admin', 'tenant_admin')
    )
  );

-- ==========================================================================
-- Audit log
-- ==========================================================================

-- Users can read audit entries for their own organization
CREATE POLICY "audit_select_own_org" ON audit_log
  FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Insert is done via service role key (bypasses RLS) — no anon policy needed

-- ==========================================================================
-- Template: Tenant-scoped data tables
-- ==========================================================================
-- Apply this pattern to EVERY table that stores tenant data.
-- Replace <table_name> with the actual table name.
--
-- ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "tenant_isolation_select" ON <table_name>
--   FOR SELECT
--   USING (
--     tenant_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
--   );
--
-- CREATE POLICY "tenant_isolation_insert" ON <table_name>
--   FOR INSERT
--   WITH CHECK (
--     tenant_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
--   );
--
-- CREATE POLICY "tenant_isolation_update" ON <table_name>
--   FOR UPDATE
--   USING (
--     tenant_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
--   );
--
-- CREATE POLICY "tenant_isolation_delete" ON <table_name>
--   FOR DELETE
--   USING (
--     tenant_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
--   );
