#!/usr/bin/env bash
# ============================================================================
# CVG-AUTH-FIX-AGENT — Autonomous Orchestrator for Claude Code
# ============================================================================
# Document Code: CVG-AUTH-AGENT-v1.0.0-20260324
# Purpose:       Drives Claude Code CLI through all phases of AUTH-FIX-RUNBOOK.md
#                without human intervention except for status checks.
#
# Usage:
#   ./scripts/auth-fix-agent.sh                  # Run all phases from the beginning
#   ./scripts/auth-fix-agent.sh --resume 2       # Resume from Phase 2
#   ./scripts/auth-fix-agent.sh --phase 1        # Run only Phase 1
#   ./scripts/auth-fix-agent.sh --dry-run        # Print prompts without executing
#
# Prerequisites:
#   - Claude Code CLI installed: npm install -g @anthropic-ai/claude-code
#   - ANTHROPIC_API_KEY set in environment (or via Doppler)
#   - Run from the cavaridge monorepo root
#
# What this does:
#   Phase 0: Orientation — reads the repo, produces a status report (no code changes)
#   Phase 1: Fixes packages/auth/ to match UTM spec
#   Phase 2: Wires shared auth into each app (one session per app, in build order)
#   Phase 3: Workspace-wide build verification and summary table
#
# All output is logged to logs/auth-fix-agent/
# Git commits happen automatically between phases.
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LOG_DIR="${REPO_ROOT}/logs/auth-fix-agent"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
RUNBOOK="${REPO_ROOT}/docs/runbooks/AUTH-FIX-RUNBOOK.md"

# Build order (locked per CLAUDE.md)
APP_BUILD_ORDER=(
  "CVG-AI:spaniel"
  "CVG-RESEARCH:ducky"
  "CVG-CAELUM:caelum"
  "CVG-MER:meridian"
  "CVG-HIPAA:hipaa"
  "CVG-AEGIS:aegis"
  "CVG-MIDAS:midas"
  "CVG-VESPAR:vespar"
  "CVG-CERES:ceres"
  "CVG-ASTRA:astra"
  "CVG-BRAIN:brain"
  "CVG-FORGE:forge"
  "CVG-CAVALIER:cavalier"
  "CVG-CORE:core"
)

# Claude Code settings
MAX_TURNS_PHASE0=15
MAX_TURNS_PHASE1=40
MAX_TURNS_PHASE2=30
MAX_TURNS_PHASE3=25

# Status update interval (seconds) — 300 = 5 minutes
STATUS_INTERVAL=300

# Notification method: "terminal" | "slack" | "email" | "all"
# - terminal: writes to STATUS.md + prints to stdout (always on)
# - slack:    posts to Slack webhook (set SLACK_WEBHOOK_URL)
# - email:    sends via local mail command (set NOTIFY_EMAIL)
# - all:      does everything enabled
NOTIFY_METHOD="${NOTIFY_METHOD:-terminal}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
NOTIFY_EMAIL="${NOTIFY_EMAIL:-}"

# Tools allowed — read, write, edit files, and run bash commands for git, pnpm, tsc
ALLOWED_TOOLS='Read,Write,Edit,Bash(pnpm *),Bash(npx *),Bash(git add *),Bash(git commit *),Bash(git status*),Bash(git diff*),Bash(git log*),Bash(find *),Bash(ls *),Bash(cat *),Bash(grep *),Bash(head *),Bash(tail *),Bash(wc *),Bash(mkdir *),Bash(cp *),Bash(mv *),Bash(rm *),Bash(echo *),Bash(node *),Bash(tsc *),Bash(tree *)'

# Flags
DRY_RUN=false
RESUME_FROM=0
SINGLE_PHASE=-1

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)    DRY_RUN=true; shift ;;
    --resume)     RESUME_FROM="$2"; shift 2 ;;
    --phase)      SINGLE_PHASE="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 [--resume N] [--phase N] [--dry-run]"
      echo ""
      echo "  --resume N   Resume from phase N (0-3)"
      echo "  --phase N    Run only phase N"
      echo "  --dry-run    Print prompts without executing"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

mkdir -p "${LOG_DIR}"

# ---------------------------------------------------------------------------
# Live status tracking (used by heartbeat)
# ---------------------------------------------------------------------------

CURRENT_PHASE="initializing"
CURRENT_APP=""
PHASE_START_TIME=""
AGENT_START_TIME="$(date +%s)"
APPS_COMPLETED=0
APPS_FAILED=0
HEARTBEAT_PID=""

update_current_status() {
  local phase="$1"
  local app="${2:-}"
  CURRENT_PHASE="${phase}"
  CURRENT_APP="${app}"
  PHASE_START_TIME="$(date +%s)"
}

elapsed_since() {
  local start="$1"
  local now
  now="$(date +%s)"
  local diff=$((now - start))
  printf '%02d:%02d:%02d' $((diff/3600)) $(((diff%3600)/60)) $((diff%60))
}

# ---------------------------------------------------------------------------
# Notification dispatch
# ---------------------------------------------------------------------------

send_notification() {
  local subject="$1"
  local body="$2"

  # Always write to terminal + log
  log "HEARTBEAT" "${subject}: ${body}"

  # Slack webhook
  if [[ "${NOTIFY_METHOD}" == "slack" || "${NOTIFY_METHOD}" == "all" ]] && [[ -n "${SLACK_WEBHOOK_URL}" ]]; then
    curl -s -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"*${subject}*\n${body}\"}" \
      "${SLACK_WEBHOOK_URL}" >/dev/null 2>&1 || true
  fi

  # Email
  if [[ "${NOTIFY_METHOD}" == "email" || "${NOTIFY_METHOD}" == "all" ]] && [[ -n "${NOTIFY_EMAIL}" ]]; then
    echo "${body}" | mail -s "[CVG-AUTH-AGENT] ${subject}" "${NOTIFY_EMAIL}" 2>/dev/null || true
  fi

  # macOS notification (always, if available)
  if command -v osascript &>/dev/null; then
    osascript -e "display notification \"${body}\" with title \"CVG Auth Agent\" subtitle \"${subject}\"" 2>/dev/null || true
  fi
}

# ---------------------------------------------------------------------------
# Heartbeat — runs in background, fires every STATUS_INTERVAL seconds
# ---------------------------------------------------------------------------

heartbeat_loop() {
  while true; do
    sleep "${STATUS_INTERVAL}"

    local total_elapsed
    total_elapsed="$(elapsed_since "${AGENT_START_TIME}")"
    local phase_elapsed=""
    [[ -n "${PHASE_START_TIME}" ]] && phase_elapsed="$(elapsed_since "${PHASE_START_TIME}")"

    local status_line="Phase: ${CURRENT_PHASE}"
    [[ -n "${CURRENT_APP}" ]] && status_line="${status_line} | App: ${CURRENT_APP}"
    status_line="${status_line} | Phase time: ${phase_elapsed} | Total: ${total_elapsed}"
    status_line="${status_line} | Apps done: ${APPS_COMPLETED} | Failed: ${APPS_FAILED}"

    # Write heartbeat to dedicated file (easy to watch/tail)
    local heartbeat_file="${LOG_DIR}/HEARTBEAT.md"
    {
      echo "# Auth Fix Agent — Live Status"
      echo "**Last heartbeat:** $(date '+%Y-%m-%d %H:%M:%S')"
      echo "**Current phase:** ${CURRENT_PHASE}"
      [[ -n "${CURRENT_APP}" ]] && echo "**Current app:** ${CURRENT_APP}"
      echo "**Phase elapsed:** ${phase_elapsed}"
      echo "**Total elapsed:** ${total_elapsed}"
      echo "**Apps completed:** ${APPS_COMPLETED} / ${#APP_BUILD_ORDER[@]}"
      echo "**Apps failed:** ${APPS_FAILED}"
      echo ""
      echo "---"
      echo "*Updated every 5 minutes. Tail the agent log for real-time detail.*"
    } > "${heartbeat_file}"

    # Send notification
    send_notification "Status Update" "${status_line}"
  done
}

start_heartbeat() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    log "DRY-RUN" "Heartbeat would start (every ${STATUS_INTERVAL}s)"
    return 0
  fi

  heartbeat_loop &
  HEARTBEAT_PID=$!
  log "INFO" "Heartbeat started (PID: ${HEARTBEAT_PID}, interval: ${STATUS_INTERVAL}s)"
}

stop_heartbeat() {
  if [[ -n "${HEARTBEAT_PID}" ]]; then
    kill "${HEARTBEAT_PID}" 2>/dev/null || true
    wait "${HEARTBEAT_PID}" 2>/dev/null || true
    HEARTBEAT_PID=""
    log "INFO" "Heartbeat stopped"
  fi
}

# Ensure heartbeat is cleaned up on exit
trap 'stop_heartbeat' EXIT INT TERM

log() {
  local level="$1"; shift
  local msg="$*"
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[${ts}] [${level}] ${msg}" | tee -a "${LOG_DIR}/agent-${TIMESTAMP}.log"
}

log_separator() {
  echo "" | tee -a "${LOG_DIR}/agent-${TIMESTAMP}.log"
  echo "============================================================================" | tee -a "${LOG_DIR}/agent-${TIMESTAMP}.log"
  echo "$1" | tee -a "${LOG_DIR}/agent-${TIMESTAMP}.log"
  echo "============================================================================" | tee -a "${LOG_DIR}/agent-${TIMESTAMP}.log"
  echo "" | tee -a "${LOG_DIR}/agent-${TIMESTAMP}.log"
}

run_claude() {
  local session_id="$1"
  local max_turns="$2"
  local log_file="$3"
  local prompt="$4"

  if [[ "${DRY_RUN}" == "true" ]]; then
    log "DRY-RUN" "Would execute claude -p with session: ${session_id}"
    echo "--- PROMPT ---"
    echo "${prompt}"
    echo "--- END PROMPT ---"
    return 0
  fi

  log "EXEC" "Starting Claude Code session: ${session_id} (max_turns: ${max_turns})"

  # Run Claude Code in headless mode
  claude -p "${prompt}" \
    --session-id "${session_id}" \
    --max-turns "${max_turns}" \
    --output-format text \
    --allowedTools ${ALLOWED_TOOLS} \
    2>&1 | tee "${log_file}"

  local exit_code=${PIPESTATUS[0]}

  if [[ ${exit_code} -ne 0 ]]; then
    log "ERROR" "Claude Code exited with code ${exit_code} for session ${session_id}"
    log "ERROR" "Check log: ${log_file}"
    return ${exit_code}
  fi

  log "OK" "Session ${session_id} completed successfully"
  return 0
}

resume_claude() {
  local session_id="$1"
  local max_turns="$2"
  local log_file="$3"
  local prompt="$4"

  if [[ "${DRY_RUN}" == "true" ]]; then
    log "DRY-RUN" "Would resume claude session: ${session_id}"
    echo "--- PROMPT ---"
    echo "${prompt}"
    echo "--- END PROMPT ---"
    return 0
  fi

  log "EXEC" "Resuming Claude Code session: ${session_id}"

  claude -p "${prompt}" \
    --resume \
    --session-id "${session_id}" \
    --max-turns "${max_turns}" \
    --output-format text \
    --allowedTools ${ALLOWED_TOOLS} \
    2>&1 | tee -a "${log_file}"

  local exit_code=${PIPESTATUS[0]}

  if [[ ${exit_code} -ne 0 ]]; then
    log "ERROR" "Claude Code resume exited with code ${exit_code} for session ${session_id}"
    return ${exit_code}
  fi

  log "OK" "Resumed session ${session_id} completed successfully"
  return 0
}

git_commit_checkpoint() {
  local message="$1"

  if [[ "${DRY_RUN}" == "true" ]]; then
    log "DRY-RUN" "Would commit: ${message}"
    return 0
  fi

  cd "${REPO_ROOT}"

  if git diff --quiet && git diff --cached --quiet; then
    log "INFO" "No changes to commit after: ${message}"
    return 0
  fi

  git add -A
  git commit -m "${message}" || {
    log "WARN" "Git commit failed (may be no changes): ${message}"
    return 0
  }

  log "OK" "Committed: ${message}"
}

write_status_update() {
  local phase="$1"
  local status="$2"
  local details="$3"
  local status_file="${LOG_DIR}/STATUS.md"

  {
    echo ""
    echo "## Phase ${phase} — ${status}"
    echo "**Time:** $(date '+%Y-%m-%d %H:%M:%S')"
    echo "**Details:** ${details}"
    echo ""
    echo "---"
  } >> "${status_file}"

  log "STATUS" "Phase ${phase}: ${status} — ${details}"
}

should_run_phase() {
  local phase="$1"
  if [[ ${SINGLE_PHASE} -ge 0 ]]; then
    [[ ${SINGLE_PHASE} -eq ${phase} ]]
  else
    [[ ${phase} -ge ${RESUME_FROM} ]]
  fi
}

# ---------------------------------------------------------------------------
# Phase prompts
# ---------------------------------------------------------------------------

SYSTEM_CONTEXT="You are operating inside the Cavaridge LLC monorepo. CLAUDE.md at the repo root is the governing document — read it first and follow it exactly. Cavaridge LLC is the sole IP owner of all code. DIT is a client/tenant only. No hardcoded client data. All LLM calls route through OpenRouter. Secrets go through Doppler. RLS on every Supabase table. Express 5 + TypeScript 5.6+ + Drizzle ORM."

PHASE0_PROMPT="$(cat <<'PHASE0EOF'
PHASE 0 — ORIENTATION. Do NOT write any code. Do NOT make any changes.

Read these files in this exact order:
1. CLAUDE.md (repo root)
2. Every file in packages/auth/
3. Every .md file in docs/architecture/
4. pnpm-workspace.yaml
5. tsconfig.base.json or root tsconfig.json

Then:
1. Show me a directory tree of apps/ and packages/ (2 levels deep).
2. Summarize the current state of packages/auth/:
   - What tables/schemas are defined (Drizzle)?
   - What RLS policies exist?
   - What RBAC roles are defined?
   - What does it export (types, middleware, helpers)?
3. For each app in apps/, report:
   - Does it import from @cavaridge/auth?
   - Does it have any LOCAL auth logic that should use the shared package?
4. Run: pnpm tsc --noEmit 2>&1 | tail -100
   Report the total error count per package/app.
5. Create a file at logs/auth-fix-agent/phase0-report.md with your full findings.

This is a read-only reconnaissance phase. Do not modify any source files.
PHASE0EOF
)"

PHASE1_PROMPT="$(cat <<'PHASE1EOF'
PHASE 1 — FIX packages/auth/

You already read the repo in Phase 0. Now fix packages/auth/ to match the UTM spec exactly.

REQUIREMENTS:
- 4-tier self-referencing tenant hierarchy: Platform > MSP > Client > Site/Prospect
- Single tenants table with parent_id self-reference and a tier enum column
- 6 RBAC roles: Platform Admin, MSP Admin, MSP Tech, Client Admin, Client Viewer, Prospect
- Supabase RLS on EVERY table — no table without RLS
- Drizzle ORM schema definitions
- No hardcoded client/tenant data

TASKS (do all of them):
1. Audit the Drizzle schema vs UTM spec. List every gap.
2. Fix all schema gaps in the Drizzle definitions.
3. Generate Supabase migration SQL for schema changes. Put in the migrations directory.
4. Verify/create RLS policies for every table enforcing tenant isolation.
5. Export TypeScript types: Tenant, User, Role (enum of 6 roles), Permission.
6. Export Express middleware: requireAuth, requireRole(role), requireTenant(tenantId).
7. Export helpers: getTenantHierarchy(tenantId), getUserRoleForTenant(userId, tenantId).
8. Run: pnpm tsc --noEmit (scoped to packages/auth). Fix ALL errors. Zero errors required.
9. Git add and commit: "fix(auth): align packages/auth with UTM spec"
10. Write a summary of what you changed to logs/auth-fix-agent/phase1-report.md.
PHASE1EOF
)"

generate_phase2_prompt() {
  local app_code="$1"
  local app_dir="$2"

  # Ceres exception
  if [[ "${app_code}" == "CVG-CERES" ]]; then
    cat <<CERESEOF
PHASE 2 — CVG-CERES (EXCEPTION: Free public toolkit — NO auth wiring)

CVG-CERES is a free, public-access nursing toolkit. No login, no tenant gating, no RBAC, no backend.

TASKS:
1. Verify there is NO auth logic in this app. If any exists, REMOVE it.
2. Verify all tools are mobile-responsive (check for responsive CSS/Tailwind).
3. Verify each tool has its own bookmarkable URL route.
4. Verify there is a welcome/landing page listing all available tools.
5. Run: pnpm tsc --noEmit --project apps/${app_dir} — fix all type errors.
6. Run: pnpm build (scoped to this app) — fix any build errors.
7. Git add and commit: "fix(ceres): verify public toolkit, fix types"
8. Append results to logs/auth-fix-agent/phase2-report.md.
CERESEOF
    return
  fi

  cat <<APPEOF
PHASE 2 — Wire auth into ${app_code} (apps/${app_dir})

You already fixed packages/auth/ in Phase 1. Now wire it into this app.

TASKS:
1. Remove ALL local auth logic — authentication, session handling, role checks that don't come from @cavaridge/auth. All auth must flow through the shared package.
2. Add requireAuth middleware to all API routes.
3. Add requireRole() guards appropriate for this app's access model:
   - Platform-level apps: Platform Admin only
   - MSP-level apps: MSP Admin + MSP Tech minimum
   - Client-facing: Client Admin + Client Viewer as appropriate
   - Spaniel (CVG-AI): service-to-service auth only
   - Ducky (CVG-RESEARCH): all authenticated roles
4. Ensure every Supabase/Drizzle query is scoped by tenant_id from auth context. No unscoped queries.
5. If this app has UI, verify light/dark/system theme support. Add if missing.
6. Run: pnpm tsc --noEmit --project apps/${app_dir} — fix ALL errors. Zero required.
7. Verify the app starts or builds without crashing. Document missing env vars.
8. Git add and commit: "fix(${app_dir}): wire shared auth, fix types, verify startup"
9. Append results (build status, error count, missing env vars, notes) to logs/auth-fix-agent/phase2-report.md.
APPEOF
}

PHASE3_PROMPT="$(cat <<'PHASE3EOF'
PHASE 3 — INTEGRATION SMOKE TEST

All apps should now have shared auth wired (except CVG-CERES which is public).

TASKS:
1. Run pnpm build from workspace root (or per-app if needed). Fix ANY build failures.
2. Run pnpm tsc --noEmit across the entire workspace. Zero errors required. Fix anything broken.
3. For every app, grep for process.env references and list all expected environment variables. Check for .env.example files and Doppler config refs. Flag any hardcoded fallback values as violations.
4. Produce a summary table in this EXACT format and save to logs/auth-fix-agent/phase3-summary.md:

| App Code | Build Status | Type Errors | Missing Env Vars | Auth Wired | Theme Support | Notes |
|----------|-------------|-------------|-------------------|------------|---------------|-------|
| CVG-AI   | ✅/❌       | count       | list              | ✅/❌      | ✅/❌/N/A    |       |
(one row per app)

5. Also produce a FINAL STATUS section at the bottom:
   - Total apps: X
   - Fully passing: X
   - Needs attention: X (list which ones and why)
   - Recommended next steps

6. Git add and commit: "chore: workspace-wide build verification"
PHASE3EOF
)"

# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------

main() {
  log_separator "CVG-AUTH-FIX-AGENT — Starting ${TIMESTAMP}"
  log "INFO" "Repo root: ${REPO_ROOT}"
  log "INFO" "Log directory: ${LOG_DIR}"
  log "INFO" "Dry run: ${DRY_RUN}"
  log "INFO" "Resume from: Phase ${RESUME_FROM}"
  log "INFO" "Status updates every: ${STATUS_INTERVAL}s ($(( STATUS_INTERVAL / 60 )) min)"
  log "INFO" "Notification method: ${NOTIFY_METHOD}"
  [[ ${SINGLE_PHASE} -ge 0 ]] && log "INFO" "Single phase: ${SINGLE_PHASE}"

  cd "${REPO_ROOT}"

  # Initialize status file
  local status_file="${LOG_DIR}/STATUS.md"
  if [[ ${RESUME_FROM} -eq 0 && ${SINGLE_PHASE} -lt 0 ]]; then
    cat > "${status_file}" <<STATUSEOF
# Auth Fix Agent — Status Report
**Started:** $(date '+%Y-%m-%d %H:%M:%S')
**Repo:** ${REPO_ROOT}
**Monitor:** \`watch cat logs/auth-fix-agent/HEARTBEAT.md\`

---
STATUSEOF
  fi

  # Start the 5-minute heartbeat
  start_heartbeat
  send_notification "Agent Started" "Auth fix agent launched. Phases to run: ${RESUME_FROM}–3. Monitor: logs/auth-fix-agent/HEARTBEAT.md"

  # =========================================================================
  # PHASE 0 — Orientation
  # =========================================================================
  if should_run_phase 0; then
    log_separator "PHASE 0 — Orientation"
    update_current_status "Phase 0 — Orientation"
    write_status_update 0 "STARTED" "Reading repo, producing status report"
    send_notification "Phase 0 Started" "Orientation — reading repo structure and producing status report"

    run_claude \
      "auth-fix-phase0-${TIMESTAMP}" \
      "${MAX_TURNS_PHASE0}" \
      "${LOG_DIR}/phase0-${TIMESTAMP}.log" \
      "${SYSTEM_CONTEXT}

${PHASE0_PROMPT}" || {
        write_status_update 0 "FAILED" "Claude Code exited with error. Check logs."
        send_notification "PHASE 0 FAILED" "Orientation failed. Check logs/auth-fix-agent/phase0-*.log"
        exit 1
      }

    write_status_update 0 "COMPLETE" "Orientation report generated"
    send_notification "Phase 0 Complete" "Orientation done. Report: logs/auth-fix-agent/phase0-report.md"
    log "OK" "Phase 0 complete. Review: ${LOG_DIR}/phase0-report.md"
  fi

  # =========================================================================
  # PHASE 1 — Fix packages/auth/
  # =========================================================================
  if should_run_phase 1; then
    log_separator "PHASE 1 — Fix packages/auth/"
    update_current_status "Phase 1 — Fix packages/auth"
    write_status_update 1 "STARTED" "Fixing packages/auth/ to match UTM spec"
    send_notification "Phase 1 Started" "Fixing packages/auth/ — UTM schema, RLS, RBAC, middleware, types"

    run_claude \
      "auth-fix-phase1-${TIMESTAMP}" \
      "${MAX_TURNS_PHASE1}" \
      "${LOG_DIR}/phase1-${TIMESTAMP}.log" \
      "${SYSTEM_CONTEXT}

${PHASE1_PROMPT}" || {
        write_status_update 1 "FAILED" "Claude Code exited with error. Check logs."
        send_notification "PHASE 1 FAILED" "Auth package fix failed. Check logs/auth-fix-agent/phase1-*.log"
        exit 1
      }

    # Safety commit in case Claude Code didn't commit
    git_commit_checkpoint "fix(auth): phase 1 — align packages/auth with UTM spec [agent]"
    write_status_update 1 "COMPLETE" "packages/auth/ fixed and committed"
    send_notification "Phase 1 Complete" "packages/auth/ aligned with UTM spec and committed."
  fi

  # =========================================================================
  # PHASE 2 — Wire auth into each app
  # =========================================================================
  if should_run_phase 2; then
    log_separator "PHASE 2 — Wire auth into each app"
    update_current_status "Phase 2 — Wire auth (starting)"

    local total_apps=${#APP_BUILD_ORDER[@]}
    local app_index=0

    for entry in "${APP_BUILD_ORDER[@]}"; do
      local app_code="${entry%%:*}"
      local app_dir="${entry##*:}"
      app_index=$((app_index + 1))

      update_current_status "Phase 2 — App ${app_index}/${total_apps}" "${app_code}"
      log "INFO" "Processing: ${app_code} (apps/${app_dir}) [${app_index}/${total_apps}]"
      write_status_update "2-${app_code}" "STARTED" "Wiring auth into ${app_code}"
      send_notification "Phase 2 — App ${app_index}/${total_apps}" "Starting ${app_code} (apps/${app_dir})"

      # Check if the app directory actually exists
      if [[ ! -d "${REPO_ROOT}/apps/${app_dir}" ]]; then
        log "WARN" "Directory apps/${app_dir} not found for ${app_code} — checking alternatives"

        # Try to find it (macOS-compatible: use -name instead of -printf)
        local found_dir
        found_dir=$(find "${REPO_ROOT}/apps" -maxdepth 1 -type d -iname "*${app_dir}*" | head -1 | xargs basename 2>/dev/null)

        if [[ -n "${found_dir}" ]]; then
          log "INFO" "Found alternative directory: apps/${found_dir}"
          app_dir="${found_dir}"
        else
          log "WARN" "App directory not found for ${app_code}. Skipping."
          write_status_update "2-${app_code}" "SKIPPED" "Directory apps/${app_dir} not found"
          send_notification "Phase 2 — Skipped" "${app_code}: directory not found"
          APPS_FAILED=$((APPS_FAILED + 1))
          continue
        fi
      fi

      local phase2_prompt
      phase2_prompt="$(generate_phase2_prompt "${app_code}" "${app_dir}")"

      run_claude \
        "auth-fix-phase2-${app_dir}-${TIMESTAMP}" \
        "${MAX_TURNS_PHASE2}" \
        "${LOG_DIR}/phase2-${app_dir}-${TIMESTAMP}.log" \
        "${SYSTEM_CONTEXT}

${phase2_prompt}" || {
          write_status_update "2-${app_code}" "FAILED" "Claude Code error on ${app_code}. Continuing to next app."
          send_notification "Phase 2 — FAILED" "${app_code} failed. Continuing to next app."
          log "ERROR" "Phase 2 failed for ${app_code}. Continuing..."
          APPS_FAILED=$((APPS_FAILED + 1))
          continue  # Don't abort the whole run — try the next app
        }

      # Safety commit
      git_commit_checkpoint "fix(${app_dir}): phase 2 — wire shared auth [agent]"
      write_status_update "2-${app_code}" "COMPLETE" "Auth wired into ${app_code}"
      APPS_COMPLETED=$((APPS_COMPLETED + 1))
      send_notification "Phase 2 — App Done" "${app_code} complete (${APPS_COMPLETED}/${total_apps} done, ${APPS_FAILED} failed)"

      log "OK" "${app_code} done."
    done

    write_status_update 2 "COMPLETE" "All apps processed (${APPS_COMPLETED} success, ${APPS_FAILED} failed)"
    send_notification "Phase 2 Complete" "All ${total_apps} apps processed. ${APPS_COMPLETED} success, ${APPS_FAILED} failed."
  fi

  # =========================================================================
  # PHASE 3 — Integration smoke test
  # =========================================================================
  if should_run_phase 3; then
    log_separator "PHASE 3 — Integration smoke test"
    update_current_status "Phase 3 — Smoke test"
    write_status_update 3 "STARTED" "Running workspace-wide build verification"
    send_notification "Phase 3 Started" "Running pnpm build + tsc --noEmit across entire workspace"

    run_claude \
      "auth-fix-phase3-${TIMESTAMP}" \
      "${MAX_TURNS_PHASE3}" \
      "${LOG_DIR}/phase3-${TIMESTAMP}.log" \
      "${SYSTEM_CONTEXT}

${PHASE3_PROMPT}" || {
        write_status_update 3 "FAILED" "Claude Code exited with error. Check logs."
        send_notification "PHASE 3 FAILED" "Smoke test failed. Check logs/auth-fix-agent/phase3-*.log"
        exit 1
      }

    git_commit_checkpoint "chore: workspace-wide build verification [agent]"
    write_status_update 3 "COMPLETE" "Smoke test done. See phase3-summary.md"
    send_notification "Phase 3 Complete" "Build verification done. Review: logs/auth-fix-agent/phase3-summary.md"
  fi

  # =========================================================================
  # DONE
  # =========================================================================
  stop_heartbeat
  log_separator "ALL PHASES COMPLETE"

  local total_elapsed
  total_elapsed="$(elapsed_since "${AGENT_START_TIME}")"

  {
    echo ""
    echo "## Agent Complete"
    echo "**Finished:** $(date '+%Y-%m-%d %H:%M:%S')"
    echo "**Total runtime:** ${total_elapsed}"
    echo "**Apps completed:** ${APPS_COMPLETED}"
    echo "**Apps failed:** ${APPS_FAILED}"
    echo ""
    echo "### Output Files"
    echo "- \`logs/auth-fix-agent/phase0-report.md\` — Orientation findings"
    echo "- \`logs/auth-fix-agent/phase1-report.md\` — Auth package changes"
    echo "- \`logs/auth-fix-agent/phase2-report.md\` — Per-app auth wiring results"
    echo "- \`logs/auth-fix-agent/phase3-summary.md\` — Final build/type/auth status table"
    echo ""
    echo "### Next Steps"
    echo "1. Review phase3-summary.md for any apps needing attention"
    echo "2. Run \`git log --oneline -20\` to see all commits"
    echo "3. Push to GitHub when satisfied"
  } >> "${status_file}"

  send_notification "AGENT COMPLETE" "All phases finished in ${total_elapsed}. ${APPS_COMPLETED} apps wired, ${APPS_FAILED} failed. Review phase3-summary.md."

  log "OK" "Agent complete. Review STATUS.md and phase reports in ${LOG_DIR}/"
  log "OK" "Total runtime: ${total_elapsed}"

  echo ""
  echo "========================================"
  echo "  AUTH FIX AGENT COMPLETE"
  echo "  Runtime: ${total_elapsed}"
  echo "  Apps OK: ${APPS_COMPLETED} | Failed: ${APPS_FAILED}"
  echo "  Status: ${LOG_DIR}/STATUS.md"
  echo "  Summary: ${LOG_DIR}/phase3-summary.md"
  echo "========================================"
}

main "$@"
