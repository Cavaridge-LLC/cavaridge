# Claude Runbook Extraction Prompt
# Version: 1.0.0
# Date: 2026-03-04
#
# WHERE TO USE: Run in each app's Claude Project when generating or updating a runbook
# OUTPUT: Project state summary in markdown (one half of the runbook merge)
# NEXT STEP: Run Replit extraction prompt, then merge both in CVG-CORE

---

Generate a project state summary in markdown covering:

1. Project name and purpose
2. Legal entity owner
3. Tech stack and key dependencies
4. Core features built or in progress
5. Shared utilities or components that could apply to other apps
6. Hardcoded values or assumptions that need to be made configurable
7. Current RBAC and multitenancy status
8. UI/UX standards in use (theming, component library, etc.)
9. Known gaps or technical debt
10. Any Dedicated IT or client-specific references that need to be abstracted out
