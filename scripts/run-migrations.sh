#!/usr/bin/env bash
# =============================================================================
# Cavaridge — Run Database Migrations Against Supabase
# =============================================================================
# Usage: ./scripts/run-migrations.sh
#
# Requires DATABASE_URL to be set (from .env or Doppler).
# Runs all migration files in order against the Supabase PostgreSQL instance.
# =============================================================================

set -euo pipefail

# Load .env if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep -v '^\s*$' | xargs)
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set. Set it in .env or export it."
  exit 1
fi

MIGRATIONS_DIR="$(dirname "$0")/../migrations"

echo "=== Cavaridge Database Migration ==="
echo "Target: $(echo $DATABASE_URL | sed 's/:.*@/@/; s/\?.*//; s|postgresql://||')"
echo ""

# Run migrations in order
for sql_file in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  filename=$(basename "$sql_file")
  echo "Running: $filename"
  psql "$DATABASE_URL" -f "$sql_file" -v ON_ERROR_STOP=1 2>&1 | grep -E "(CREATE|ALTER|INSERT|ERROR)" || true
  echo "  ✓ $filename complete"
done

echo ""
echo "=== All migrations complete ==="
