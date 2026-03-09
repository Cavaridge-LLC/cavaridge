# PROMPT 18: Integration Playbook — AI-Generated from Findings

> **Paste into Replit Agent.** Replaces the hardcoded playbook with one where
> Claude analyzes all findings, tech stack gaps, and baseline misalignments
> to generate a custom phased integration plan with tasks, dependencies,
> cost estimates, and labor requirements.

---

```
Rebuild the Playbook view so the integration plan is fully AI-generated 
from the deal's actual findings, tech stack, and baseline gaps. No more 
hardcoded phases or tasks.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 1 — PLAYBOOK GENERATION ENGINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create POST /api/deals/[dealId]/generate-playbook that:

1. Gathers ALL deal intelligence:
   - All findings (title, description, severity, pillar, impact, status)
   - All pillar scores and weights
   - Tech stack items (if extracted)
   - Baseline comparison gaps (if generated)
   - Deal metadata (industry, facility count, user count, stage)
   - Document summaries (classifications + counts)

2. Sends to Claude with this prompt:

"""
You are a senior IT integration architect creating a post-merger integration 
playbook. Based on the findings, technology stack, and baseline gaps below, 
generate a complete phased integration plan.

DEAL CONTEXT:
- Target: {target_name}
- Industry: {industry}
- Facilities: {facility_count}
- Users: {user_count}
- Composite Risk Score: {composite_score}/100
- Current Stage: {stage}

FINDINGS (sorted by severity):
{findings_json}

TECHNOLOGY STACK:
{tech_stack_json}

BASELINE GAPS:
{baseline_gaps_json}

PILLAR SCORES:
{pillars_json}

Generate a phased integration playbook with these requirements:

1. PHASES: Create 5-7 phases covering the full integration lifecycle:
   - Phase names should be descriptive (not just "Phase 1")
   - Each phase has a time range relative to close date
   - Phases should be sequential but can overlap

2. TASKS: For each phase, generate specific actionable tasks:
   - Every critical and high severity finding MUST have a corresponding 
     remediation task
   - Every critical baseline gap MUST have a remediation task
   - Include standard integration tasks even if no finding exists (e.g., 
     Day 1 DNS cutover, user communication, help desk setup)
   - Each task needs:
     - task_name: specific, actionable (e.g., "Deploy MFA on 37 admin accounts" 
       not "Fix MFA")
     - description: what specifically needs to be done
     - is_critical_path: true if this blocks other tasks or has compliance impact
     - estimated_hours: labor hours estimate
     - estimated_cost: dollar estimate (materials, licensing, vendor costs — 
       NOT labor)
     - labor_rate_tier: "senior_engineer" ($185/hr), "engineer" ($145/hr), 
       "technician" ($95/hr), "project_manager" ($165/hr)
     - dependencies: array of task names this depends on
     - finding_id: the finding this remediates (null if standard task)
     - priority: 1 (must do), 2 (should do), 3 (nice to have)
     - category: one of [Security, Identity, Network, Compliance, 
       Application, Data, Communication, Governance]

3. COST SUMMARY: Calculate totals:
   - Total estimated labor hours
   - Total estimated labor cost (hours × rate for each tier)
   - Total estimated material/licensing cost
   - Grand total range (P10 to P90 — low and high estimates)
   - Monthly burn rate estimate

4. TIMELINE: Estimate overall duration considering:
   - Critical path dependencies
   - Parallel workstreams
   - Industry-specific constraints (e.g., HIPAA for healthcare, SOX for finance)
   - Facility count (more sites = longer rollout)

5. RISK FACTORS: List 3-5 things that could extend timeline or increase cost

Respond as JSON:
{
  "phases": [
    {
      "phase_name": "...",
      "phase_number": 1,
      "time_range": "Day -60 to Close",
      "description": "...",
      "status": "pending",
      "tasks": [
        {
          "task_name": "...",
          "description": "...",
          "is_critical_path": true,
          "estimated_hours": 40,
          "estimated_cost": 5000,
          "labor_rate_tier": "senior_engineer",
          "dependencies": [],
          "finding_id": "uuid-or-null",
          "priority": 1,
          "category": "Security"
        }
      ]
    }
  ],
  "cost_summary": {
    "total_labor_hours": 680,
    "labor_cost_breakdown": {
      "senior_engineer": { "hours": 200, "cost": 37000 },
      "engineer": { "hours": 320, "cost": 46400 },
      "technician": { "hours": 120, "cost": 11400 },
      "project_manager": { "hours": 40, "cost": 6600 }
    },
    "total_labor_cost": 101400,
    "total_material_cost": 85000,
    "grand_total_low": 150000,
    "grand_total_high": 225000,
    "monthly_burn_rate": 45000
  },
  "timeline": {
    "total_months": 6,
    "critical_path_weeks": 18,
    "parallel_workstreams": 3
  },
  "risk_factors": [
    {
      "factor": "...",
      "impact": "Could add 2-4 weeks",
      "mitigation": "..."
    }
  ]
}
"""

3. Parse the response and store in the database

DATABASE UPDATES:
- playbook_phases: add columns — description, time_range (text), 
  phase_number (int), deal_id, status, created_at
- playbook_tasks: add columns — description, estimated_hours, 
  estimated_cost, labor_rate_tier, dependencies (jsonb array), 
  finding_id (FK to findings, nullable), priority, category, 
  phase_id (FK), status, created_at
- Create table "playbook_cost_summary": deal_id, summary_json (jsonb), 
  timeline_json (jsonb), risk_factors_json (jsonb), generated_at, 
  generated_by

4. Return the complete playbook

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 2 — PLAYBOOK VIEW UI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Replace the entire Playbook view with:

HEADER: Deal selector + "Generate Playbook" button (blue) + "Regenerate" 
button (outlined, shows if playbook exists)

KPI STRIP (5 cards, same design as Prompt 6):
  - Total Tasks (count, blue) — from playbook_tasks
  - Critical Path (count, red) — where is_critical_path = true
  - Estimated Cost (range, purple) — grand_total_low to grand_total_high
  - Timeline (months, amber) — from timeline.total_months
  - Labor Hours (total, cyan) — from cost_summary.total_labor_hours

PHASE CARDS (horizontal scroll row):
Same card design as Prompt 6 but now data-driven:
  - 3px colored top border: 
    ready=blue, active=amber, pending=gray, complete=green
  - Phase name (bold)
  - Phase number badge
  - Time range (muted text)
  - Description (2 lines, truncated)
  - Task list with colored dots:
    - Red dot + bold = critical path task
    - Blue dot = priority 1
    - Gray dot = priority 2-3
  - Task count: "8 tasks (3 critical path)"
  - Phase cost subtotal

Clicking a phase card expands it into a detailed task view below the cards:

EXPANDED PHASE DETAIL (below the phase cards):
- Phase name, time range, description
- Task table with columns:
  - Status checkbox (todo/in-progress/done)
  - Priority badge (1=red, 2=amber, 3=gray)
  - Critical path icon (🔴 if true)
  - Task name (bold)
  - Category badge (colored by category)
  - Hours estimate
  - Cost estimate
  - Labor tier
  - Dependencies (linked task names, clickable)
  - Finding link (if task remediates a finding, show finding title — 
    clickable to open in Risk view)
- Sort by: priority, critical path first, then by dependency order

COST BREAKDOWN PANEL (collapsible, below phases):
- Stacked bar chart showing labor cost by tier + material costs
- Pie chart showing cost by category
- Monthly burn rate timeline chart
- Table: labor tier | hours | rate | subtotal
- Material/licensing line items from estimated_cost per task
- Grand total with low/high range

RISK FACTORS PANEL (collapsible):
- Cards for each risk factor showing factor, impact, mitigation
- Yellow left border on each card

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 3 — TASK MANAGEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tasks should be editable after generation:

1. EDIT TASK: Click a task → edit modal with all fields editable
   - Change hours, cost, status, description
   - Mark as critical path or remove
   - Reassign to different phase (drag or dropdown)
   
2. ADD TASK: "Add Task" button at the bottom of each phase
   - Same fields as generated tasks
   - Set a flag: "manually_added = true"
   
3. DELETE TASK: Trash icon on each task row
   - Confirmation: "Remove this task from the playbook?"
   
4. REORDER: Drag-and-drop within a phase to reorder tasks
   (update sort_order in database)

5. STATUS TRACKING:
   - Each task: "todo" → "in_progress" → "complete"
   - Phase status auto-updates based on task statuses:
     - All todo → "pending"
     - Any in_progress → "active"
     - All complete → "complete"
   - KPI strip updates in real-time as tasks are checked off

6. When a finding is remediated in the Risk view, auto-update the 
   corresponding playbook task to "complete"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMPTY STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If no playbook has been generated for this deal:

  "No integration playbook has been generated yet."
  "MERIDIAN will analyze your {X} findings and {Y} baseline gaps to create 
   a custom phased integration plan with cost estimates and timelines."
  [ Generate Integration Playbook ] (blue button)
  
  Requirements: At least 1 finding must exist. If no findings:
  "Upload and analyze documents first to generate findings, then create 
   the playbook."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TESTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ ] Generate Playbook creates phases and tasks from real findings
[ ] Every critical/high finding has a corresponding task
[ ] KPI strip shows correct totals from generated data
[ ] Phase cards display with correct status colors
[ ] Clicking a phase shows detailed task list
[ ] Critical path tasks are visually distinct
[ ] Tasks with finding_id link to the Risk view
[ ] Cost breakdown shows labor by tier and material costs
[ ] Tasks can be edited, added, deleted, reordered
[ ] Status changes propagate (task → phase → KPIs)
[ ] Regenerate replaces the entire playbook with a fresh generation
[ ] Empty state shows when no playbook exists
[ ] No hardcoded data from Prompt 6 remains
```
