# Replit Runbook Extraction Prompt
# Version: 1.0.0
# Date: 2026-03-04
#
# WHERE TO USE: Run in each Replit project after significant build sessions
# OUTPUT: Technical state summary in markdown (one half of the runbook merge)
# NEXT STEP: Bring both this output and the Claude extraction to CVG-CORE for merge

---

Generate a technical state summary in markdown covering:

1. Project name and primary purpose
2. Current tech stack — framework, language, runtime, key libraries and versions
3. Folder and file structure — full tree with a one-line description of each key file or folder
4. Environment variables currently in use — names only, no values
5. Authentication and authorization implementation — what exists, what is missing
6. Multitenancy status — implemented, partial, or absent
7. UI theming — light/dark/system mode status
8. Database schema or data model summary
9. API endpoints or routes currently defined
10. Third-party integrations — APIs, SDKs, services connected
11. Hardcoded values that should be configurable — flag anything client-specific
12. Known bugs, incomplete features, or technical debt
13. What is production-ready vs. prototype/draft
14. Deployment status — where hosted, what is the deployment process
