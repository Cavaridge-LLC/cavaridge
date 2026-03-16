-- @cavaridge/audit migration
-- Adds new columns (app_code, correlation_id) and immutability triggers.
-- Run this ONCE per Supabase project that uses audit logging.

-- ── Add new columns (safe if they already exist) ───────────────────
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS app_code VARCHAR(50);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS correlation_id UUID;

-- ── Indexes on new columns ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS audit_log_app_code_idx ON audit_log(app_code);
CREATE INDEX IF NOT EXISTS audit_log_correlation_idx ON audit_log(correlation_id);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action);

-- ── Immutability: block UPDATE on audit_log ────────────────────────
CREATE OR REPLACE FUNCTION audit_log_prevent_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log rows are immutable — UPDATE is not permitted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_no_update ON audit_log;
CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_prevent_update();

-- ── Immutability: block DELETE on audit_log ─────────────────────────
CREATE OR REPLACE FUNCTION audit_log_prevent_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log rows are immutable — DELETE is not permitted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON audit_log;
CREATE TRIGGER trg_audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_prevent_delete();

-- ── RLS: tenant isolation ──────────────────────────────────────────
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Service role (server-side) can insert
CREATE POLICY IF NOT EXISTS audit_log_insert_policy ON audit_log
  FOR INSERT
  WITH CHECK (true);

-- Tenant-scoped reads: users can only see their organization's logs
CREATE POLICY IF NOT EXISTS audit_log_select_policy ON audit_log
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
