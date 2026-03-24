# Cavaridge — Operational Playbook
**Document:** CVG-CORE-OPS-v1.0.0-20260304
**Owner:** Cavaridge, LLC
**Purpose:** Simple step-by-step guide for maintaining consistency across all tools, projects, and apps

---

## The Big Picture — What Lives Where

Before anything else, understand the four layers:

| Layer | Tool | What It Does |
|---|---|---|
| **Govern** | Claude — CVG-CORE Project | Holds the rules, standards, runbooks, and portfolio view |
| **Plan** | Claude — App Project | Plans and documents one specific app |
| **Build** | Replit Agent | Writes and runs the actual code |
| **Store** | GitHub | Permanent home for all code and versioned docs |
| **Secrets** | Replit Secrets + Doppler | Keeps API keys and credentials safe |

**The golden rule:** Claude thinks → Replit builds → GitHub stores. Never skip or reverse that order.

---

## Part 1 — Setting Up (Do This Once)

### Step 1 — Create Your Claude Projects

1. Go to claude.ai → Projects → Create Project
2. Create one project for each app:

| Project Name | Purpose |
|---|---|
| CVG-CORE — Cavaridge Governance | Master hub — runbooks, standards, synthesis |
| CVG-ASTRA — Astra | Astra app work only |
| CVG-CAELUM — Caelum | Caelum app work only |
| CVG-MIDAS — Midas | Midas app work only |
| CVG-VESPAR — Vespar | Vespar app work only |
| CVG-MER — Meridian | Meridian app work only |
| CVG-HIPAA — HIPAA Toolkit | HIPAA Toolkit app work only |

3. Paste the Cavaridge Core system prompt into Project Instructions for every project.

### Step 2 — Attach Knowledge Files

**CVG-CORE project — attach all of these:**
- Cavaridge Setup Guide (CVG-CORE-RB-v1.0.0-20260303.md)
- Portfolio Synthesis Report (CVG-CORE-SYNTH-v1.0.0-20260303.md)
- This Operational Playbook (CVG-CORE-OPS-v1.0.0-20260304.md)
- Every runbook from every app (both Claude and Replit versions)

**Each app project — attach only two files:**
- That app's current runbook
- The Cavaridge Setup Guide

### Step 3 — Set Up GitHub

1. Create a GitHub organization or use your personal account under Cavaridge
2. Create one private repository per app:
   - cvg-core, cvg-astra, cvg-caelum, cvg-midas, cvg-vespar, cvg-meridian, cvg-hipaa, cvg-shared
3. In every repo:
   - Add a LICENSE file stating: "Copyright © Cavaridge, LLC. All rights reserved."
   - Add .env to .gitignore before the very first commit
   - Create main and dev branches

### Step 4 — Set Up Doppler

Doppler is your secrets manager for staging and production. Here is how to set it up step by step:

**One-time workspace setup:**
1. Go to doppler.com and sign up with your Cavaridge business email
2. Create a Workplace named: Cavaridge LLC

**Per-app setup (repeat for each app):**
1. Inside your Doppler workspace, click Projects → New Project
2. Name it to match the app code exactly: cvg-astra, cvg-caelum, cvg-midas, etc.
3. Doppler automatically creates three environments: dev, staging, prd
4. Click into each environment and add your secrets:
   - Click Add Secret
   - Enter the variable name (e.g. OPENROUTER_API_KEY) and value
   - Repeat for each secret the app needs

**Connect Doppler to Replit:**
1. In Doppler, open the app project
2. Click Integrations → Replit
3. Follow the connection wizard — Doppler will sync secrets to Replit automatically
4. From this point on, manage all secrets in Doppler, not in Replit's secrets panel

**Connect Doppler to GitHub Actions (do this when you set up CI/CD):**
1. In Doppler, click Integrations → GitHub Actions
2. Follow the wizard to connect

**Doppler rules — never break these:**
- Master OpenRouter key lives in Doppler CVG-CORE project, prd environment only
- Each app gets its own scoped OpenRouter sub-key in that app's Doppler project
- Never copy a secret out of Doppler into a file, chat message, or email
- To rotate a compromised key: update it in Doppler only — all connected services update automatically
- Never share the master OpenRouter key with anyone — create scoped sub-keys instead

### Step 5 — Connect Replit to GitHub

For each Replit project:
1. Open the project in Replit
2. Click the Git icon in the left sidebar
3. Connect to the matching GitHub repo (e.g. cvg-astra connects to the cvg-astra repo)
4. After every significant build session, push code to GitHub from Replit

---

## Part 2 — Starting a New App (Every Time, In This Order)

Do not skip ahead to building. Follow every step.

**Step 1 — Register in CVG-CORE**
Open the CVG-CORE Claude project. Say:
"Register a new app — name: [App Name], code: CVG-XXX, purpose: [one sentence description]"
Claude will confirm the registration. Do not proceed until this is done.

**Step 2 — Create the Claude app project**
- New project in claude.ai with the app name
- Paste the Cavaridge Core system prompt into Project Instructions
- Attach the Cavaridge Setup Guide as a knowledge file

**Step 3 — Define the spec in Claude**
In the new app project, describe what you want to build. Ask Claude to produce:
- Architecture overview
- Data model and tables
- RBAC role definitions
- API endpoints list
- Replit build prompt

Do not open Replit until Claude has produced all of these.

**Step 4 — Create the GitHub repo**
- Private repo named to match the app code
- Add LICENSE file (Cavaridge, LLC ownership)
- Add .env to .gitignore immediately — before any code is committed
- Create main and dev branches

**Step 5 — Create the Doppler project**
- New Doppler project named to match app code
- Add secrets to dev, staging, and prd environments
- Connect to Replit via the Doppler integration

**Step 6 — Create the Replit project**
- Name it to match the app code
- Connect to the GitHub repo
- Paste the Claude-generated spec as the first message to Replit Agent

**Step 7 — Generate the initial runbook**
After the first build session:
1. Run the Claude Runbook Prompt in the app's Claude project
2. Run the Replit Runbook Prompt in Replit
3. Bring both outputs to CVG-CORE
4. Ask Claude: "Merge these into the official runbook for [App Name] at v1.0.0"
5. Save as CVG-XXX-RB-v1.0.0-[YYYYMMDD].md
6. Attach to the app's Claude project
7. Commit to GitHub under cvg-core/runbooks/

---

## Part 3 — Day-to-Day Workflow

### When You Have a New Feature or Change

1. Open the app's Claude project
2. Describe the feature — ask Claude for the spec and Replit prompt
3. Paste the prompt into Replit Agent and let it build
4. Copy the result back into Claude and ask: "Does this meet Cavaridge standards? Any gaps?"
5. Fix gaps in Replit using Claude's remediation prompt
6. Push to GitHub from Replit
7. Update the runbook if this was a significant change (see Part 4)

### When You Have a Question or Problem

| Question Type | Go To |
|---|---|
| Architecture or standards | CVG-CORE Claude project |
| Specific app question | That app's Claude project |
| Code bug or implementation | Replit Agent (paste runbook for context) |
| Conflict between apps | CVG-CORE always wins |

### Starting a Work Session

1. Open the relevant Claude project — not a generic chat
2. The knowledge files and system prompt are already loaded — just start talking
3. If a runbook feels outdated, regenerate it before doing significant work

---

## Part 4 — Keeping Runbooks Current

Runbooks are your consistency backbone. Keep them accurate.

### When to Update

| Event | Version Change | Example |
|---|---|---|
| New feature added | Minor bump | v1.0.0 → v1.1.0 |
| New module or standard added | Minor bump | v1.1.0 → v1.2.0 |
| Architecture change (new DB, new auth provider) | Major bump | v1.2.0 → v2.0.0 |
| Bug fix or small correction | Patch bump | v1.0.0 → v1.0.1 |
| Typo or clarification | Patch bump | v1.0.1 → v1.0.2 |

### How to Update

1. Run the Claude Runbook Prompt in the app's Claude project
2. Run the Replit Runbook Prompt in Replit
3. Bring both outputs to CVG-CORE
4. Ask Claude: "Merge these into an updated runbook. Previous version was [X.X.X]. Determine the correct new version based on what changed."
5. Save the new file as: CVG-XXX-RB-v[new version]-[DATE].md
6. In the app's Claude project: remove the old runbook file, attach the new one
7. In CVG-CORE: attach the new runbook (keep old versions for history)
8. Commit the new runbook to GitHub under cvg-core/runbooks/

---

## Part 5 — File Management Reference

### CVG-CORE Claude Project — Keep Everything
- Cavaridge Setup Guide
- This Operational Playbook
- Portfolio Synthesis Report
- All runbooks from all apps, all versions
- Any cross-app architecture decisions

### Each App Claude Project — Current Files Only
- That app's latest runbook (remove old version when updating)
- Cavaridge Setup Guide (always current)

### GitHub — Code and Docs
- All source code pushed from Replit
- Current runbook in /runbooks folder
- LICENSE file
- README

### Doppler — Secrets Only
- All API keys and credentials
- Database connection strings
- Environment-specific config values
- Nothing else

### What Never Goes Anywhere Public
- API keys of any kind
- Database credentials
- Session secrets
- The master OpenRouter key

---

## Part 6 — Quick Reference Checklists

### New App Checklist
- [ ] Registered in CVG-CORE app registry
- [ ] Claude project created with system prompt and Setup Guide attached
- [ ] Spec fully defined in Claude before Replit opens
- [ ] GitHub private repo created with LICENSE and .gitignore
- [ ] Doppler project created with dev, staging, prd environments
- [ ] Replit project connected to GitHub and Doppler
- [ ] Multitenancy scaffold built before any features
- [ ] RBAC roles defined before any UI is built
- [ ] Light, dark, and system theme wired on day one
- [ ] llm.config.js created before any AI features are built
- [ ] Initial runbook generated and attached at v1.0.0

### New Feature Checklist
- [ ] Spec defined in Claude app project first
- [ ] Reviewed against Cavaridge standards before building
- [ ] Built in Replit using Claude's prompt
- [ ] Output reviewed in Claude for compliance gaps
- [ ] Pushed to GitHub from Replit
- [ ] Runbook updated if this was a significant change

### Weekly Maintenance — 5 Minutes
- [ ] Any apps with significant changes need a runbook update?
- [ ] Any hardcoded values crept into any codebase?
- [ ] Any secrets stored outside Doppler or Replit Secrets?
- [ ] Any new apps or features to register in CVG-CORE?

---

## Part 7 — Doppler Day-to-Day Reference

### Add a New Secret
1. Doppler → select the app project → select the environment
2. Click Add Secret → enter name and value
3. Replit picks it up automatically on next sync or deploy

### Rotate a Compromised Key
1. Generate the new key in the source system (OpenRouter dashboard, Azure portal, etc.)
2. Update the value in Doppler only
3. All connected services (Replit, Vercel, GitHub Actions) update automatically
4. Verify the app still works
5. Do not touch any .env files or Replit Secrets panels — Doppler handles everything

### Check What Secrets an App Has
1. Doppler → select the project → select the environment
2. All secret names are listed (values are hidden by default)
3. Click a secret name to view or edit the value

### Give a New Team Member or Collaborator Access
1. Doppler → Team → Invite
2. Assign them to specific app projects only — never the master Cavaridge workspace
3. Set their permission level (read-only for most, write for leads)
4. Create scoped OpenRouter sub-keys for them — never share the master key

### Remove Access When Someone Leaves
1. Doppler → Team → find the member → Revoke Access
2. Rotate any keys they had access to immediately via the source system + Doppler update

---

*This is a living document. Update it in CVG-CORE whenever the workflow changes.*
*CVG-CORE-OPS-v1.0.0-20260304 — Cavaridge, LLC — Internal Confidential*