# CVG-MIDAS — Midas Application Runbook
**Document:** CVG-MIDAS-RB-v1.0.0-20260304
**Owner:** Cavaridge, LLC
**Classification:** Internal — Confidential
**Governance Authority:** CVG-CORE-RB-v2.0.0-20260303

---

## 1. Application Identity

| Field | Value |
|---|---|
| **App Code** | CVG-MIDAS |
| **App Name** | Midas |
| **Purpose** | Strategic IT roadmap and QBR (Quarterly Business Review) platform for MSPs — drag-and-drop initiative cards, executive KPI snapshots, meeting lifecycle management, board-level PPTX export |
| **IP Owner** | Cavaridge, LLC |
| **Status** | Live on Replit |
| **Repo** | `cavaridge/cvg-midas` (Private) |

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Language | TypeScript | 5.6.3 |
| Runtime | Node.js (via tsx) | 20.x |
| Frontend | React | 19.2.0 |
| Build | Vite | 7.1.9 |
| CSS | Tailwind CSS v4 | 4.1.14 |
| UI Components | shadcn/ui + Radix UI | Various |
| Routing (client) | Wouter | 3.3.5 |
| Data Fetching | TanStack React Query | 5.60.5 |
| Backend | Express.js | 5.0.1 |
| Database | PostgreSQL | Replit-managed |
| ORM | Drizzle ORM | 0.39.3 |
| Drag & Drop | @dnd-kit | core 6.3.1, sortable 10.0.0 |
| PPTX Generation | pptxgenjs | 4.0.1 |
| File Download | file-saver | 2.0.5 |
| Icons | lucide-react | 0.545.0 |
| Animations | Framer Motion | 12.23.24 |
| Charts | Recharts | 2.15.4 |

---

## 3. Cavaridge Standards Compliance

| Standard | Status | Notes |
|---|---|---|
| Multitenancy | ❌ Absent | No tenant scoping. All data globally visible. |
| RBAC | ❌ Absent | No authentication or authorization whatsoever. Fully open/public. |
| Light/Dark/System theme | ⚠️ Partial | CSS variables exist for theming. No theme toggle surfaced in UI. |
| No hardcoded client data | ⚠️ Partial | Denormalized `client_name` on meetings. Seed data may contain client-specific values. |
| IP hygiene | ✅ Compliant | No DIT references in code. |
| OpenRouter via Cavaridge key | ❌ Absent | No AI features currently — N/A until AI is added. |
| No plaintext secrets | ⚠️ Partial | Database credentials in Replit Secrets. |
| llm.config.js routing | ❌ Absent | N/A until AI features are added. |
| Rate limiting | ❌ Absent | No rate limiting. All routes publicly accessible. |
| CSRF protection | ❌ Absent | No auth means no CSRF concern yet — but must be added with auth. |
| Automated tests | ❌ Absent | Zero tests. |

---

## 4. Core Features — Built

- Client management with CRUD operations
- Drag-and-drop kanban roadmap board with quarterly columns
- Initiative cards with priority, status, budget, and category
- KPI strip with executive snapshot metrics
- Client selector for filtering roadmap views
- QBR meeting workspace with full CRUD and lifecycle (open → closed)
- 6-slide board-level PPTX export via pptxgenjs
- Responsive layout with mobile breakpoint hook

---

## 5. Database Schema

| Table | Key Columns |
|---|---|
| `clients` | id, name, industry, status |
| `initiatives` | id, clientId, title, description, quarter, priority, status, budget, category, sortOrder |
| `meetings` | id, clientId, client_name (denormalized), type, status, date, notes, actionItems |
| `kpi_snapshots` | id, clientId, meetingId, metrics (JSONB) |

**Critical gaps:** No `tenantId` on any table. No users table. No sessions.

---

## 6. Shared Components (Extractable to cvg-shared)

- PPTX generation pipeline (pptxgenjs patterns)
- Drag-and-drop kanban board component (@dnd-kit)
- KPI snapshot card patterns

---

## 7. Known Gaps & Technical Debt

- **No authentication at all** — the application is fully open and public. This is the #1 remediation item.
- **No multitenancy** — all data globally shared.
- **Seed route exists** — may be accessible in production (security risk).
- **Denormalized `client_name` on meetings** — drift risk if client name changes.
- **No snapshot uniqueness at DB level** — potential duplicate KPI snapshots per meeting.
- **No AI features** — roadmap intelligence, initiative scoring, QBR narrative generation are all potential additions.
- **Theme toggle not surfaced** — CSS supports theming but no user-facing control.

---

## 8. Remediation Priorities

| Priority | Task | Effort |
|---|---|---|
| P1 | Add authentication (Replit Auth or equivalent) | Medium |
| P1 | Guard ALL API routes — remove public access | Medium |
| P1 | Remove/guard seed route in production | Low |
| P1 | Add `tenantId` to all tables, scope all queries | High |
| P2 | Implement RBAC (Platform Owner, Tenant Admin, User, Viewer) | High |
| P2 | Wire dark/system theme toggle in UI | Medium |
| P2 | Fix denormalized `client_name` on meetings | Low |
| P2 | Enforce snapshot uniqueness at DB level | Low |
| P2 | Add rate limiting to all API endpoints | Medium |
| P3 | Add AI-powered features (initiative scoring, QBR narratives) with llm.config.js | High |
| P3 | Add automated tests | High |
| P3 | Set up CI/CD pipeline | Medium |

---

## 9. DIT Tenant Boundary

- DIT is a tenant within Midas — never a co-owner
- No DIT names, logos, or references in source code — confirmed compliant
- Once multitenancy is implemented, DIT gets a standard tenant record
- All DIT-specific client data, roadmaps, and QBR content scoped to DIT tenant only

---

## 10. Runbook Maintenance

**Regenerate this runbook on:** any Major or Minor version increment, new module addition, or architecture change.

**Claude Project Runbook Prompt:**
> "Generate a project state summary in markdown covering: (1) Project name and purpose, (2) Legal entity owner, (3) Tech stack and key dependencies, (4) Core features built or in progress, (5) Shared utilities or components that could apply to other apps, (6) Hardcoded values or assumptions that need to be made configurable, (7) Current RBAC and multitenancy status, (8) UI/UX standards in use (theming, component library, etc.), (9) Known gaps or technical debt, (10) Any Dedicated IT or client-specific references that need to be abstracted out."

**Replit Runbook Prompt:**
> "Generate a technical state summary in markdown covering: (1) Project name and primary purpose, (2) Current tech stack — framework, language, runtime, key libraries and versions, (3) Folder and file structure — full tree with a one-line description of each key file or folder, (4) Environment variables currently in use — names only no values, (5) Authentication and authorization implementation — what exists what is missing, (6) Multitenancy status — implemented partial or absent, (7) UI theming — light/dark/system mode status, (8) Database schema or data model summary, (9) API endpoints or routes currently defined, (10) Third-party integrations — APIs SDKs services connected, (11) Hardcoded values that should be configurable — flag anything client-specific, (12) Known bugs incomplete features or technical debt, (13) What is production-ready vs. prototype/draft, (14) Deployment status — where hosted what is the deployment process."

---

*This document is governed by CVG-CORE. Any deviation requires explicit approval documented in the CVG-CORE project before implementation.*
*Classification: Cavaridge LLC — Internal Confidential*
