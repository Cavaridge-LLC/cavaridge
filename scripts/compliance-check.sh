#!/usr/bin/env bash
# Cavaridge — Portfolio Compliance Checker
# Version: 1.0.0
# Date: 2026-03-04
#
# Validates that all registered apps have the required governance artifacts.
# Run from the cvg-core repo root: ./scripts/compliance-check.sh
#
# Requirements: jq, git (both available on most systems)

set -euo pipefail

REGISTRY="./registry/apps.json"
PASS=0
WARN=0
FAIL=0

# Colors
RED='\033[0;31m'
YEL='\033[0;33m'
GRN='\033[0;32m'
NC='\033[0m'

pass() { PASS=$((PASS + 1)); echo -e "  ${GRN}✅ $1${NC}"; }
warn() { WARN=$((WARN + 1)); echo -e "  ${YEL}⚠️  $1${NC}"; }
fail() { FAIL=$((FAIL + 1)); echo -e "  ${RED}❌ $1${NC}"; }

echo "============================================"
echo " Cavaridge Portfolio Compliance Check"
echo " $(date '+%Y-%m-%d %H:%M')"
echo "============================================"
echo ""

# --- Check 1: Registry file exists and is valid JSON ---
echo "📋 Registry Validation"
if [ ! -f "$REGISTRY" ]; then
  fail "Registry file not found at $REGISTRY"
  exit 1
fi

if ! jq empty "$REGISTRY" 2>/dev/null; then
  fail "Registry file is not valid JSON"
  exit 1
fi
pass "Registry is valid JSON"

APP_COUNT=$(jq '.apps | length' "$REGISTRY")
echo "   Found $APP_COUNT registered apps"
echo ""

# --- Check 2: Per-app governance artifacts ---
echo "📁 Per-App Governance Checks"
echo ""

jq -c '.apps[]' "$REGISTRY" | while read -r app; do
  CODE=$(echo "$app" | jq -r '.code')
  NAME=$(echo "$app" | jq -r '.name')
  STATUS=$(echo "$app" | jq -r '.status')
  REPO=$(echo "$app" | jq -r '.github_repo')
  LATEST_RB=$(echo "$app" | jq -r '.latest_runbook')
  HAS_UI=$(echo "$app" | jq -r '.has_ui')

  echo "--- $CODE ($NAME) [status: $STATUS] ---"

  # Skip governance-only repos
  if [ "$CODE" = "CVG-CORE" ]; then
    pass "Governance repo — skip app-level checks"
    echo ""
    continue
  fi

  # Check: Runbook exists in runbooks directory
  APP_LOWER=$(echo "$CODE" | tr '[:upper:]' '[:lower:]' | sed 's/cvg-/cvg-/')
  RB_DIR="./runbooks/$APP_LOWER"
  if [ -d "$RB_DIR" ]; then
    RB_COUNT=$(find "$RB_DIR" -name "*.md" 2>/dev/null | wc -l)
    if [ "$RB_COUNT" -gt 0 ]; then
      pass "Runbook directory exists with $RB_COUNT file(s)"
    else
      warn "Runbook directory exists but is empty"
    fi
  else
    fail "Runbook directory missing: $RB_DIR"
  fi

  # Check: Latest runbook version is recorded
  if [ "$LATEST_RB" != "null" ] && [ -n "$LATEST_RB" ]; then
    pass "Latest runbook tracked: $LATEST_RB"
  else
    fail "No latest_runbook version recorded in registry"
  fi

  # Check: Doppler project is set
  DOPPLER=$(echo "$app" | jq -r '.doppler_project')
  if [ "$DOPPLER" != "null" ] && [ -n "$DOPPLER" ]; then
    pass "Doppler project defined: $DOPPLER"
  else
    warn "No Doppler project defined"
  fi

  # Check: Claude project is set
  CLAUDE=$(echo "$app" | jq -r '.claude_project')
  if [ "$CLAUDE" != "null" ] && [ -n "$CLAUDE" ]; then
    pass "Claude project defined: $CLAUDE"
  else
    fail "No Claude project defined"
  fi

  echo ""
done

# --- Check 3: Standards files exist ---
echo "📐 Standards Files"
STANDARDS_FILES=(
  "standards/build-standards.yaml"
  "standards/rbac-taxonomy.yaml"
  "standards/system-prompt.md"
  "standards/dit-boundary.yaml"
  "standards/tech-stack.yaml"
)

for f in "${STANDARDS_FILES[@]}"; do
  if [ -f "./$f" ]; then
    pass "$f exists"
  else
    fail "$f missing"
  fi
done
echo ""

# --- Check 4: Template files exist ---
echo "📦 Template Files"
TEMPLATE_FILES=(
  "templates/LICENSE.template"
  "templates/gitignore.template"
  "templates/env.example.template"
  "templates/llm.config.js.template"
  "templates/ci.yml.template"
)

for f in "${TEMPLATE_FILES[@]}"; do
  if [ -f "./$f" ]; then
    pass "$f exists"
  else
    fail "$f missing"
  fi
done
echo ""

# --- Check 5: Prompt pipeline files exist ---
echo "📝 Prompt Pipeline Files"
PROMPT_FILES=(
  "prompts/build/phase-1-architecture-lock.md"
  "prompts/build/phase-2-architecture-audit.md"
  "prompts/build/phase-3-build-packet.md"
  "prompts/build/phase-4-quality-gate.md"
  "prompts/remediation/remediation-pipeline.md"
  "prompts/extraction/claude-runbook-prompt.md"
  "prompts/extraction/replit-runbook-prompt.md"
  "prompts/replit-preamble.md"
)

for f in "${PROMPT_FILES[@]}"; do
  if [ -f "./$f" ]; then
    pass "$f exists"
  else
    fail "$f missing"
  fi
done
echo ""

# --- Summary ---
TOTAL=$((PASS + WARN + FAIL))
echo "============================================"
echo " RESULTS: $TOTAL checks"
echo -e "   ${GRN}✅ Pass: $PASS${NC}"
echo -e "   ${YEL}⚠️  Warn: $WARN${NC}"
echo -e "   ${RED}❌ Fail: $FAIL${NC}"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "❌ Compliance check FAILED — fix failures before merging to main."
  exit 1
else
  echo ""
  echo "✅ Compliance check PASSED."
  exit 0
fi
