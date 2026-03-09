#!/bin/bash
# Cavaridge Portfolio Compliance Check
# Run: pnpm compliance

set -e

ERRORS=0

echo "=== Cavaridge Compliance Check ==="
echo ""

# Check for hardcoded DIT references
echo "Checking for hardcoded client references..."
if grep -r "Dedicated IT" --include="*.ts" --include="*.tsx" --include="*.js" apps/ packages/ 2>/dev/null; then
  echo "  FAIL: Hardcoded DIT references found"
  ERRORS=$((ERRORS + 1))
else
  echo "  PASS"
fi

# Check for plaintext secrets
echo "Checking for plaintext secrets..."
if grep -rE "(sk-[a-zA-Z0-9]{20,}|eyJhbGciOi)" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" apps/ packages/ 2>/dev/null; then
  echo "  FAIL: Potential plaintext secrets found"
  ERRORS=$((ERRORS + 1))
else
  echo "  PASS"
fi

# Check .env not tracked
echo "Checking .env files not tracked..."
if git ls-files --cached 2>/dev/null | grep -E "\.env$" | grep -v ".env.example"; then
  echo "  FAIL: .env files tracked in git"
  ERRORS=$((ERRORS + 1))
else
  echo "  PASS"
fi

# Check each app has correct structure
echo "Checking app structure..."
for app in apps/*/; do
  if [ -f "$app/package.json" ]; then
    echo "  $app — has package.json"
  else
    echo "  $app — PENDING migration (no package.json yet)"
  fi
done

echo ""
if [ $ERRORS -gt 0 ]; then
  echo "FAILED: $ERRORS compliance issues found"
  exit 1
else
  echo "PASSED: All checks clean"
fi
