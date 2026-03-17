# CVG-FORGE — Architecture Specification

**Version:** 1.0  
**Date:** 2026-03-15  
**Author:** Claude (Architect) / Benjamin Posner (Owner)  
**Status:** DRAFT  
**Owner:** Cavaridge, LLC  
**Registry Code:** CVG-FORGE  
**Monorepo Path:** `apps/forge/`  

---

## 1. System Overview

CVG-FORGE is an autonomous content creation platform that accepts a user brief and produces finished, downloadable assets (DOCX, PDF, PPTX, HTML websites) through coordinated AI agent pipelines. FORGE is a product surface — it assembles existing Cavaridge infrastructure behind a purpose-built creation experience.

### 1.1 Architecture Principle

FORGE follows the **agent-first architecture** approved for all Cavaridge apps:

- **Vercel AI SDK + LangGraph.js** for agent orchestration
- **pgvector** for semantic search and template retrieval
- **BullMQ + Redis** for job queuing and async execution
- **Langfuse** for observability and tracing
- **OpenRouter** for LLM routing (model-per-task selection)

### 1.2 System Context Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CVG-FORGE (apps/forge/)                  │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────┐ │
│  │  FORGE   │  │   Project    │  │   Agent    │  │  Output  │ │
│  │   UI     │→ │  Intake &    │→ │  Pipeline  │→ │ Delivery │ │
│  │ (React)  │  │  Estimation  │  │  Engine    │  │ Service  │ │
│  └──────────┘  └──────────────┘  └────────────┘  └──────────┘ │
│       ↑                               ↑               ↑        │
│       │                               │               │        │
│  ┌────┴────┐  ┌───────────────┐  ┌───┴────────┐  ┌──┴──────┐ │
│  │  Ducky  │  │  CVG-CORE     │  │  Spaniel   │  │ Asset   │ │
│  │ Anims   │  │  Auth/Tenant  │  │  Execution │  │ Render  │ │
│  │ (shared)│  │  RBAC (shared)│  │  (shared)  │  │ Workers │ │
│  └─────────┘  └───────────────┘  └────────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │                │                │               │
    ┌────┴────┐    ┌──────┴──────┐   ┌────┴────┐   ┌─────┴─────┐
    │Supabase │    │  OpenRouter │   │  Redis  │   │ Langfuse  │
    │ (DB/RLS)│    │  (LLM API) │   │(BullMQ) │   │ (Tracing) │
    └─────────┘    └─────────────┘   └─────────┘   └───────────┘
```

---

## 2. Shared Package Dependencies

FORGE consumes the following shared packages from the Cavaridge monorepo (`packages/`):

| Package | Purpose | Status |
|---------|---------|--------|
| `@cavaridge/agent-core` | Agent base classes, tool definitions, state management | Active |
| `@cavaridge/agent-runtime` | LangGraph.js runtime, BullMQ job dispatch, Langfuse integration | Active |
| `@cavaridge/agents` | Reusable agent implementations (research, writer, reviewer) | Active |
| `@cavaridge/auth` | Universal Tenant Model, Supabase RLS, RBAC (6 standard roles) | Active |
| `@cavaridge/ducky-animations` | 9 Lottie animation states for Ducky AI personality | Active |
| `@cavaridge/security` | Input sanitization, rate limiting, secret management | Active |
| `@cavaridge/audit` | Audit logging, compliance trail | Active |
| `@cavaridge/ui` | Shared React components, theme system (light/dark/system) | Active |

FORGE does **not** fork or duplicate shared package logic. All agent orchestration, auth, and UI primitives come from shared packages.

---

## 3. Data Model

### 3.1 Core Tables (Supabase / Drizzle ORM)

All tables enforce RLS via `@cavaridge/auth` tenant context. Tenant hierarchy: Platform → MSP → Client → Site/Prospect.

```
forge_projects
├── id                  UUID PK
├── tenant_id           UUID FK → tenants.id (RLS enforced)
├── created_by          UUID FK → users.id
├── title               TEXT
├── brief               JSONB          -- structured user input
├── estimated_credits   INTEGER        -- pre-execution estimate
├── actual_credits      INTEGER        -- post-execution actual
├── status              ENUM           -- draft | estimating | queued | running | 
│                                         validating | completed | failed | revised
├── output_format       ENUM           -- docx | pdf | pptx | html_site
├── output_url          TEXT           -- signed URL to final asset
├── revision_count      INTEGER DEFAULT 0
├── max_free_revisions  INTEGER DEFAULT 3
├── quality_score       FLOAT          -- Ducky QC score (0-1)
├── metadata            JSONB          -- format-specific config
├── created_at          TIMESTAMPTZ
├── updated_at          TIMESTAMPTZ
└── completed_at        TIMESTAMPTZ

forge_agent_runs
├── id                  UUID PK
├── project_id          UUID FK → forge_projects.id
├── run_type            ENUM           -- research | structure | generate | 
│                                         validate | revise | render
├── agent_name          TEXT
├── model_used          TEXT           -- e.g. "claude-sonnet-4-20250514"
├── input_tokens        INTEGER
├── output_tokens       INTEGER
├── cost_usd            DECIMAL(10,6)
├── langfuse_trace_id   TEXT
├── status              ENUM           -- pending | running | completed | failed
├── result              JSONB          -- agent output payload
├── error               JSONB          -- error details if failed
├── started_at          TIMESTAMPTZ
├── completed_at        TIMESTAMPTZ
└── created_at          TIMESTAMPTZ

forge_templates
├── id                  UUID PK
├── tenant_id           UUID FK → tenants.id (NULL = platform-global)
├── name                TEXT
├── description         TEXT
├── output_format       ENUM
├── template_data       JSONB          -- format-specific template config
├── embedding           VECTOR(1536)   -- pgvector for semantic template matching
├── usage_count         INTEGER DEFAULT 0
├── is_active           BOOLEAN DEFAULT TRUE
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ

forge_usage
├── id                  UUID PK
├── tenant_id           UUID FK → tenants.id
├── user_id             UUID FK → users.id
├── project_id          UUID FK → forge_projects.id
├── credits_used        INTEGER
├── credit_type         ENUM           -- production | revision | free_revision
├── billing_period      DATE
├── created_at          TIMESTAMPTZ
```

### 3.2 Supabase RLS Policy Pattern

```sql
-- All forge tables follow this pattern
CREATE POLICY "tenant_isolation" ON forge_projects
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Role-based access within tenant
CREATE POLICY "role_access" ON forge_projects
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND tenant_id = current_setting('app.tenant_id')::uuid
        AND role IN ('platform_admin', 'msp_admin', 'msp_tech', 'client_admin', 'client_viewer')
    )
  );
```

---

## 4. Agent Pipeline Architecture

### 4.1 Pipeline Overview

Every FORGE project flows through a 5-stage agent pipeline implemented as a LangGraph.js state machine:

```
[User Brief] → INTAKE → RESEARCH → STRUCTURE → GENERATE → VALIDATE → [Delivery]
                  │                                            │
                  │         ┌──────────┐                       │
                  └────────→│ ESTIMATE │ (cost preview)        │
                            └──────────┘                       │
                                                               ▼
                                                     ┌──────────────┐
                                                     │ DUCKY QC     │
                                                     │ quality_score│
                                                     │ >= 0.75?     │
                                                     └──────┬───────┘
                                                       YES  │  NO
                                                       ▼    ▼
                                                  [DELIVER] [AUTO-REVISE]
                                                             (max 2 internal)
```

### 4.2 Agent Definitions

Each agent is implemented in `@cavaridge/agents` and composed via `@cavaridge/agent-runtime`.

#### Stage 1: INTAKE Agent
- **Purpose:** Parse and structure the user's natural language brief into a typed project spec
- **Model:** claude-sonnet-4 (fast, accurate structured extraction)
- **Input:** Raw user brief (text + optional file attachments)
- **Output:** `ProjectSpec` object with title, sections, audience, tone, format requirements, constraints
- **Tools:** None (pure LLM extraction)

#### Stage 2: ESTIMATE Agent
- **Purpose:** Calculate projected credit cost before execution begins
- **Model:** claude-haiku-4-5 (lightweight, cost-efficient)
- **Input:** `ProjectSpec`
- **Output:** `CostEstimate` with itemized breakdown (research tokens, generation tokens, rendering cost)
- **Behavior:** Returns estimate to user for approval before proceeding. No credits consumed.

#### Stage 3: RESEARCH Agent
- **Purpose:** Gather context, data, and source material relevant to the brief
- **Model:** claude-sonnet-4 + web search tool
- **Input:** `ProjectSpec`
- **Output:** `ResearchPayload` with structured findings, sources, data points
- **Tools:** Web search, pgvector template search, tenant document search (if permitted)
- **Guardrails:** Max 10 search queries per project; results cached in Redis for revision cycles

#### Stage 4: STRUCTURE Agent
- **Purpose:** Plan the output structure — sections, page layout, slide order, site architecture
- **Model:** claude-sonnet-4
- **Input:** `ProjectSpec` + `ResearchPayload`
- **Output:** `StructurePlan` — ordered content outline with section briefs, word counts, visual placement
- **Format-specific behavior:**
  - DOCX/PDF: Section outline with heading hierarchy, table placements, page estimates
  - PPTX: Slide-by-slide plan with title, content type, speaker notes outline
  - HTML site: Page tree, component layout, navigation structure, responsive breakpoints

#### Stage 5: GENERATE Agent
- **Purpose:** Produce the actual content for each section/slide/page
- **Model:** claude-sonnet-4 (primary) / claude-opus-4 (complex/long-form, gated by project tier)
- **Input:** `StructurePlan` + `ResearchPayload`
- **Output:** `ContentPayload` — complete content for every section in structured format
- **Behavior:** Generates in parallel where possible (independent sections/slides dispatched concurrently via BullMQ)

#### Stage 6: VALIDATE Agent (Ducky QC)
- **Purpose:** Score output quality against original brief; catch hallucinations, gaps, and formatting issues
- **Model:** claude-sonnet-4
- **Input:** `ProjectSpec` (original brief) + `ContentPayload` (generated output)
- **Output:** `QualityReport` with overall score (0-1), section-level scores, specific issues
- **Behavior:**
  - Score >= 0.75 → proceed to delivery
  - Score < 0.75 → auto-revise (up to 2 internal cycles, no user credit charge)
  - Score < 0.5 after 2 revisions → surface to user with explanation + Ducky apology animation

### 4.3 Render Workers

Content-to-file rendering happens in dedicated BullMQ workers, not in the agent pipeline:

| Worker | Output | Technology |
|--------|--------|------------|
| `docx-render` | .docx files | `docx` npm package (same as CVG-CAELUM) |
| `pdf-render` | .pdf files | Puppeteer HTML→PDF or docx→PDF via LibreOffice |
| `pptx-render` | .pptx files | `pptxgenjs` npm package |
| `html-render` | Static site bundle | Vite build → zip archive |

Render workers are stateless and horizontally scalable on Railway.

### 4.4 LangGraph State Machine

```typescript
// apps/forge/src/agents/pipeline.ts
import { StateGraph, END } from "@langchain/langgraph";

interface ForgeState {
  projectId: string;
  tenantId: string;
  brief: string;
  spec: ProjectSpec | null;
  estimate: CostEstimate | null;
  approved: boolean;
  research: ResearchPayload | null;
  structure: StructurePlan | null;
  content: ContentPayload | null;
  quality: QualityReport | null;
  revisionCount: number;
  output: OutputAsset | null;
}

const forgePipeline = new StateGraph<ForgeState>({
  channels: { /* typed channels for each state field */ }
})
  .addNode("intake", intakeAgent)
  .addNode("estimate", estimateAgent)
  .addNode("research", researchAgent)
  .addNode("structure", structureAgent)
  .addNode("generate", generateAgent)
  .addNode("validate", validateAgent)
  .addNode("render", renderWorkerDispatch)
  .addNode("revise", revisionAgent)
  
  .addEdge("intake", "estimate")
  .addConditionalEdges("estimate", (state) => 
    state.approved ? "research" : END  // Wait for user approval
  )
  .addEdge("research", "structure")
  .addEdge("structure", "generate")
  .addEdge("generate", "validate")
  .addConditionalEdges("validate", (state) => {
    if (state.quality!.score >= 0.75) return "render";
    if (state.revisionCount < 2) return "revise";
    return "render"; // Deliver with warning after max internal revisions
  })
  .addEdge("revise", "validate") // Loop back to QC
  .addEdge("render", END);
```

---

## 5. API Design

### 5.1 REST Endpoints

All endpoints require authentication via `@cavaridge/auth`. Tenant context is derived from JWT.

```
POST   /api/forge/projects              Create new project from brief
GET    /api/forge/projects               List projects (paginated, filtered by tenant)
GET    /api/forge/projects/:id           Get project details + status
POST   /api/forge/projects/:id/approve   Approve cost estimate → start execution
POST   /api/forge/projects/:id/revise    Request revision (free if under limit)
GET    /api/forge/projects/:id/download  Get signed download URL for output
GET    /api/forge/projects/:id/trace     Get Langfuse trace for agent pipeline
DELETE /api/forge/projects/:id           Cancel/delete project

GET    /api/forge/templates              List available templates (tenant + global)
POST   /api/forge/templates              Create tenant-specific template (admin only)

GET    /api/forge/usage                  Get usage summary for current billing period
GET    /api/forge/usage/estimate         Pre-flight cost estimate without creating project
```

### 5.2 WebSocket Events

Real-time progress updates via WebSocket (Socket.IO on Express 5):

```typescript
// Client subscribes to project channel
socket.join(`forge:project:${projectId}`);

// Server emits progress events
io.to(`forge:project:${projectId}`).emit("forge:status", {
  stage: "research",       // current pipeline stage
  progress: 0.6,           // 0-1 progress within stage
  message: "Researching market data...",
  duckyState: "thinking",  // maps to Lottie animation
});

io.to(`forge:project:${projectId}`).emit("forge:complete", {
  projectId,
  qualityScore: 0.87,
  downloadUrl: "...",
  duckyState: "celebrating",
});
```

---

## 6. Frontend Architecture

### 6.1 UI Flow

```
Landing → Brief Intake → Cost Preview → [Approve] → Progress View → Output Preview → Download
              │                                            │
              │                                     Ducky animations
              │                                     (thinking → building
              │                                      → reviewing → celebrating)
              ▼
         Template Gallery
         (optional starting point)
```

### 6.2 Key UI Components

| Component | Purpose |
|-----------|---------|
| `BriefIntake` | Multi-step form: describe project → select format → set audience/tone → attach references |
| `CostPreview` | Shows itemized credit estimate with approve/cancel |
| `ProgressView` | Real-time pipeline progress with Ducky animations per stage |
| `OutputPreview` | In-browser preview of generated asset (embedded DOCX/PDF viewer, PPTX slide carousel, HTML iframe) |
| `RevisionPanel` | Side-by-side diff of original brief vs. output, inline feedback for revision requests |
| `UsageDashboard` | Credit consumption breakdown by project, time period, format type |
| `TemplateGallery` | Browse/search templates with semantic matching, tenant and global libraries |

### 6.3 Ducky Animation States (per pipeline stage)

| Pipeline Stage | Ducky State | Animation |
|---------------|-------------|-----------|
| Intake/Estimate | `idle` | Ducky sitting, ears perked |
| Research | `thinking` | Ducky with magnifying glass |
| Structure | `planning` | Ducky with blueprint |
| Generate | `building` | Ducky typing furiously |
| Validate | `reviewing` | Ducky with checklist |
| Complete (pass) | `celebrating` | Ducky jumping with confetti |
| Complete (warning) | `concerned` | Ducky with cautious expression |
| Failed | `apologetic` | Ducky with sorry expression |
| Revision | `determined` | Ducky rolling up sleeves |

---

## 7. Infrastructure & Deployment

### 7.1 Railway Services

| Service | Type | Scaling |
|---------|------|---------|
| `forge-api` | Express 5 server | Horizontal (2+ replicas) |
| `forge-workers` | BullMQ worker pool | Horizontal (scale by queue depth) |
| `forge-ws` | Socket.IO server | Horizontal with Redis adapter |

### 7.2 External Dependencies

| Service | Purpose | Config |
|---------|---------|--------|
| Supabase | Database, auth, RLS, storage (output files) | Shared Cavaridge project |
| Redis (Railway) | BullMQ queues, cache, Socket.IO adapter | Shared Cavaridge instance |
| OpenRouter | LLM API routing | Cavaridge LLC API key (central) |
| Langfuse | Agent tracing and observability | Shared Cavaridge project |
| Supabase Storage | Output file hosting (signed URLs) | Bucket: `forge-outputs` |

### 7.3 Environment Configuration

Per Cavaridge standards — no hardcoded values. All config in env vars (Doppler for staging/prod).

```env
# forge-specific
FORGE_MAX_FREE_REVISIONS=3
FORGE_QC_THRESHOLD=0.75
FORGE_MAX_RESEARCH_QUERIES=10
FORGE_MAX_CONCURRENT_WORKERS=5
FORGE_OUTPUT_BUCKET=forge-outputs
FORGE_SIGNED_URL_EXPIRY=86400  # 24 hours

# shared (from Cavaridge platform)
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...        # Doppler only, never in repo
OPENROUTER_API_KEY=...          # Doppler only, never in repo
REDIS_URL=...
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...         # Doppler only, never in repo
```

---

## 8. Security & Compliance

### 8.1 Data Isolation
- All project data scoped to tenant via Supabase RLS
- Output files stored in tenant-scoped storage paths
- No cross-tenant data leakage possible at the database layer

### 8.2 Content Safety
- User briefs scanned for prohibited content before agent execution
- Generated content validated against content policy in VALIDATE stage
- Web research results filtered through safety layer in RESEARCH agent

### 8.3 Rate Limiting
- Per-user: 10 concurrent projects max
- Per-tenant: configurable limits based on subscription tier
- API rate limiting via `@cavaridge/security` middleware

### 8.4 Audit Trail
- Every project creation, approval, execution, revision, and download logged via `@cavaridge/audit`
- Langfuse traces retained for 90 days minimum
- Billing events immutable and auditable

---

## 9. Model Routing Strategy

Per Cavaridge standards, all LLM access routes through OpenRouter. FORGE uses task-specific model selection:

| Task | Model | Rationale |
|------|-------|-----------|
| Brief parsing (Intake) | claude-sonnet-4 | Fast structured extraction |
| Cost estimation | claude-haiku-4-5 | Lightweight, cost-efficient |
| Research synthesis | claude-sonnet-4 | Good reasoning + web search support |
| Content structuring | claude-sonnet-4 | Reliable planning |
| Content generation (standard) | claude-sonnet-4 | Quality/cost balance |
| Content generation (premium) | claude-opus-4 | Long-form, complex, gated by tier |
| Quality validation | claude-sonnet-4 | Consistent scoring |
| Revision guidance | claude-sonnet-4 | Targeted improvement suggestions |

Model selection is configurable per tenant (MSP admins can override defaults for their client tenants).

---

## 10. Integration Points

### 10.1 Intra-Cavaridge

| App | Integration |
|-----|------------|
| CVG-CAELUM | Share DOCX rendering logic; FORGE can consume SoW templates |
| CVG-RESEARCH (Ducky) | Ducky personality layer, animation states, conversational intake |
| CVG-AI (Spaniel) | Execution engine for complex multi-step agent tasks |
| CVG-BRAIN | Knowledge base retrieval for tenant-specific context |
| CVG-AEGIS | Security scanning of generated content |

### 10.2 External (Phase 2+)

| Integration | Purpose |
|-------------|---------|
| Google Drive | Export directly to user's Drive |
| Slack | Notify on project completion |
| Zapier/Make | Webhook triggers for workflow automation |
| Custom API | Headless FORGE for programmatic asset generation |

---

*This document is the intellectual property of Cavaridge, LLC. Distribution prohibited without written consent.*
