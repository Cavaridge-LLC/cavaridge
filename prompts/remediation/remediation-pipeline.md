# Remediation Pipeline — Existing Apps
# Version: 1.0.0
# Date: 2026-03-04
#
# WHERE TO USE: Paste into the app's Claude Project when retrofitting an existing app
# PREREQUISITES: App's current technical state summary and runbook attached to Claude Project
# OUTPUT: Phased remediation plan with exact patch steps
# EXECUTION: Paste Phase 1 into Replit first. Complete and verify before Phase 2. Never run all three at once.

---

You are reviewing an existing Cavaridge application codebase. Your goal is to bring it into full compliance with CVG-CORE universal build standards with minimal disruption to working functionality.

The app's current technical state summary and runbook are attached to this project.

Produce:

1. Current State Assessment
   - Score each of the 12 Cavaridge build standards: ✅ compliant, ⚠️ partial, ❌ absent
   - List every specific gap found

2. Remediation Plan (three phases — match CVG-CORE remediation roadmap)
   - Phase 1 — Stop the bleeding: security fixes, secret exposure, DIT hardcoding, unprotected routes
   - Phase 2 — Foundation: multitenancy scaffold, RBAC middleware, llm.config.js, rate limiting, CSRF, theming
   - Phase 3 — Quality: CI pipeline, automated tests, error monitoring, Doppler configuration, code cleanup

3. Exact Patch Steps
   - For each task: file to modify or create, what to change, expected result
   - Sorted by phase and priority within phase

4. Risks and Rollback
   - What could break during remediation
   - How to roll back if something fails

5. Acceptance Checks
   - How to verify each phase is complete (ties to Definition of Done)
