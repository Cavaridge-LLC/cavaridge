-- ============================================================
-- Migration 012: fix_auth_foundation
-- Purpose: Create missing auth tables (profiles, invites, audit_log),
--          fix tenants schema to match Drizzle ORM definitions,
--          seed platform admin, add RLS policies.
-- Applied: 2026-03-24
-- ============================================================

-- -------------------------------------------------------
-- 1. Fix tenants table to match Drizzle schema
-- -------------------------------------------------------
ALTER TABLE public.tenants RENAME COLUMN tier TO type;
ALTER TABLE public.tenants RENAME COLUMN settings TO config;

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS owner_user_id uuid;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS plan_tier varchar(50) DEFAULT 'starter';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS max_users integer DEFAULT 5;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

UPDATE public.tenants SET is_active = (status = 'active');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'tenants_slug_key'
  ) THEN
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_slug_unique UNIQUE (slug);
  END IF;
END $$;

-- -------------------------------------------------------
-- 2. Create profiles table (linked 1:1 to auth.users)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  role varchar(50) NOT NULL DEFAULT 'user',
  organization_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  is_platform_user boolean DEFAULT false,
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
CREATE INDEX IF NOT EXISTS profiles_org_idx ON public.profiles(organization_id);

-- -------------------------------------------------------
-- 3. Create invites table
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  role varchar(50) NOT NULL DEFAULT 'user',
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  status varchar(20) NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invites_email_idx ON public.invites(email);
CREATE INDEX IF NOT EXISTS invites_token_idx ON public.invites(token);
CREATE INDEX IF NOT EXISTS invites_tenant_idx ON public.invites(tenant_id);

-- -------------------------------------------------------
-- 4. Create audit_log table (from @cavaridge/audit schema)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  details_json jsonb DEFAULT '{}',
  ip_address text,
  app_code varchar(50),
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_org_idx ON public.audit_log(organization_id);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS audit_log_correlation_idx ON public.audit_log(correlation_id);

-- -------------------------------------------------------
-- 5. Enable RLS on new tables
-- -------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- 6. RLS policies — profiles
-- -------------------------------------------------------
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_select_same_org" ON public.profiles
  FOR SELECT USING (
    organization_id IS NOT NULL AND
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_platform_admin" ON public.profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_platform_user = true
    )
  );

-- -------------------------------------------------------
-- 7. RLS policies — invites
-- -------------------------------------------------------
CREATE POLICY "invites_select_own" ON public.invites
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "invites_select_tenant" ON public.invites
  FOR SELECT USING (
    tenant_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "invites_insert_admin" ON public.invites
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('platform_admin', 'tenant_admin', 'msp_admin')
    )
  );

-- -------------------------------------------------------
-- 8. RLS policies — audit_log
-- -------------------------------------------------------
CREATE POLICY "audit_log_insert_authenticated" ON public.audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "audit_log_select_org" ON public.audit_log
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- -------------------------------------------------------
-- 9. RLS policy for users table (was missing)
-- -------------------------------------------------------
CREATE POLICY "users_tenant_isolation" ON public.users
  FOR ALL USING (tenant_id = tenant_id());

-- -------------------------------------------------------
-- 10. Fix tenants RLS (replace overly-restrictive policy)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "tenant_isolation_tenants" ON public.tenants;

CREATE POLICY "tenants_select_own" ON public.tenants
  FOR SELECT USING (
    id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    OR parent_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "tenants_platform_admin" ON public.tenants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_platform_user = true
    )
  );

CREATE POLICY "tenants_insert_authenticated" ON public.tenants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- -------------------------------------------------------
-- 11. Seed platform admin
-- -------------------------------------------------------
INSERT INTO public.profiles (id, email, display_name, role, organization_id, is_platform_user, status)
VALUES (
  '35c7b3e6-a921-48bd-b87a-e99f9284eff2',
  'bposner@cavaridge.com',
  'Benjamin Posner',
  'platform_admin',
  '00000000-0000-0000-0000-000000000001',
  true,
  'active'
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.tenants
SET owner_user_id = '35c7b3e6-a921-48bd-b87a-e99f9284eff2'
WHERE id = '00000000-0000-0000-0000-000000000001';
