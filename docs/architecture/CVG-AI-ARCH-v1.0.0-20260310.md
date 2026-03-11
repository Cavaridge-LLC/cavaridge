# CVG-AI (Project Spaniel) — Architecture Specification

**Document:** `CVG-AI-ARCH-v1.0.0-20260310`
**Codename:** Project Spaniel
**Author:** Benjamin Posner, Cavaridge LLC
**Status:** APPROVED
**Supersedes:** N/A

---

## 1. Overview

Project Spaniel is the internal LLM gateway service for the Cavaridge platform. It is a stateless, multitenant service that handles task-type detection, intelligent model routing via OpenRouter, multi-model consensus for hallucination prevention, fallback cascade logic, cost tracking, and periodic model catalog refresh. Spaniel is not user-facing. It has no frontend. It exposes a REST API consumed exclusively by Project Ducky (CVG-RESEARCH).

---

## 2. Position in Platform Architecture
```
All Cavaridge Apps → Ducky API → Spaniel API → OpenRouter → Models
```

Spaniel is the sole interface to OpenRouter. No other app or service calls OpenRouter directly. Spaniel holds the master Cavaridge OpenRouter key.

---

## 3. Base URL

`https://spaniel.cavaridge.com/api/v1`

---

## 4. Authentication

All requests require a service-to-service bearer token held exclusively by Ducky. Token passed via `Authorization: Bearer <token>` header. Tenant context passed via `X-Tenant-ID` header. Token rotated on a 90-day schedule. Stored in Railway environment variables. No external access permitted.

---

## 5. API Endpoints

### POST /reason

Primary reasoning endpoint. Accepts an optimized context payload from Ducky, performs task detection, model routing, multi-model consensus, and returns a verified result.

**Request:**
```json
{
  "request_id": "uuid",
  "tenant_id": "uuid",
  "user_id": "uuid",
  "task_hint": "summarization | code_generation | analysis | research | conversation | null",
  "context": {
    "primary_query": "string",
    "conversation_history": [
      {
        "role": "user | assistant",
        "content": "string",
        "timestamp": "ISO8601"
      }
    ],
    "connector_data": [
      {
        "source": "github | salesforce | hubspot | ...",
        "data_type": "string",
        "content": "string",
        "relevance_score": 0.95,
        "token_count": 1200
      }
    ],
    "total_token_count": 4500
  },
  "options": {
    "require_consensus": true,
    "max_tokens_response": 4096,
    "temperature": 0.7,
    "fallback_enabled": true
  }
}
```

**Response:**
```json
{
  "request_id": "uuid",
  "status": "success | degraded | error",
  "result": {
    "content": "string",
    "model_used": {
      "primary": "claude-opus-4-6",
      "secondary": "gpt-4o",
      "tertiary": null
    },
    "consensus": {
      "aligned": true,
      "confidence_score": 0.97,
      "divergence_notes": null
    },
    "tokens_consumed": {
      "input": 4500,
      "output": 1200,
      "total": 5700
    },
    "cost": {
      "amount": 0.0342,
      "currency": "USD"
    }
  },
  "reliability_warning": false,
  "fallback_used": false,
  "timestamp": "ISO8601"
}
```

---

### GET /models

Returns current routing matrix with available models and their task assignments.

**Response:**
```json
{
  "last_updated": "ISO8601",
  "routing_matrix": {
    "summarization": {
      "primary": "claude-opus-4-6",
      "secondary": "gpt-4o",
      "tertiary": "gemini-2.5-pro"
    },
    "code_generation": {
      "primary": "claude-sonnet-4-5",
      "secondary": "gpt-4o",
      "tertiary": "gemini-2.5-pro"
    },
    "analysis": {
      "primary": "claude-opus-4-6",
      "secondary": "gemini-2.5-pro",
      "tertiary": "gpt-4o"
    },
    "research": {
      "primary": "claude-opus-4-6",
      "secondary": "gpt-4o",
      "tertiary": "gemini-2.5-pro"
    },
    "conversation": {
      "primary": "claude-sonnet-4-5",
      "secondary": "gpt-4o-mini",
      "tertiary": "gemini-2.0-flash"
    }
  }
}
```

---

### POST /models/refresh

Triggers an on-demand update of the routing matrix by querying OpenRouter's model catalog. Evaluates pricing, latency, context window size, and benchmark scores. Updates routing matrix. All changes logged to audit trail.

---

### GET /health

Returns service health, OpenRouter connectivity status, and current rate-limit headroom.

---

### GET /usage

Returns cost and token usage aggregated by tenant, user, app, and time period.

**Request params:** `tenant_id`, `user_id` (optional), `app_code` (optional), `start_date`, `end_date`

**Response:**
```json
{
  "tenant_id": "uuid",
  "period": {
    "start": "ISO8601",
    "end": "ISO8601"
  },
  "usage": {
    "total_requests": 12450,
    "total_tokens": 8234000,
    "total_cost": 124.56,
    "by_model": {
      "claude-opus-4-6": {
        "requests": 6200,
        "tokens": 5100000,
        "cost": 89.20
      }
    },
    "by_task_type": {
      "research": {
        "requests": 4000,
        "tokens": 3200000,
        "cost": 52.10
      }
    }
  }
}
```

---

## 6. Multi-Model Consensus Engine

For every request where `require_consensus: true`:

1. Spaniel sends query to primary model
2. Simultaneously sends to secondary model in parallel
3. Both responses return
4. Spaniel compares: factual claims, numerical data, conclusions, citations
5. Alignment score > 0.90 — return primary with `consensus.aligned: true`
6. Alignment score 0.70–0.90 — return primary with `consensus.aligned: false` and divergence notes
7. Alignment score < 0.70 — escalate to tertiary as tiebreaker, return majority-aligned response with full divergence notes

---

## 7. Fallback Cascade Logic

| Scenario | Action | User Notification |
|----------|--------|-------------------|
| Primary rate-limited | Route to secondary | None |
| Primary timeout (>30s) | Route to secondary | None |
| Primary error (500) | Route to secondary | None |
| Secondary fails | Route to tertiary | None |
| Tertiary fails | Return error to Ducky | "Capacity constraints — try again shortly" |
| Consensus divergence (0.70–0.90) | Return primary with divergence notes | "Results include areas of uncertainty" |
| Consensus divergence (<0.70) | Escalate to tertiary tiebreaker | Divergence flag returned to Ducky |

---

## 8. Periodic Model Refresh

Automated job (default: weekly) queries OpenRouter `/models` endpoint. Evaluates models on pricing per million tokens, average latency, context window size, and published benchmark scores. Updates routing matrix. Manual override via `POST /models/refresh`.

---

## 9. Database Schemas

### spaniel.routing_matrix

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PRIMARY KEY |
| task_type | TEXT NOT NULL | summarization, code_generation, analysis, research, conversation |
| primary_model | TEXT NOT NULL | |
| secondary_model | TEXT NOT NULL | |
| tertiary_model | TEXT NOT NULL | |
| updated_at | TIMESTAMP | |
| updated_by | TEXT | manual or automated |

### spaniel.request_log

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PRIMARY KEY |
| request_id | UUID NOT NULL | |
| tenant_id | UUID NOT NULL | RLS enforced |
| user_id | UUID NOT NULL | |
| app_code | TEXT | |
| task_type | TEXT | |
| primary_model | TEXT | |
| secondary_model | TEXT | |
| tertiary_model | TEXT | |
| model_used | TEXT NOT NULL | |
| fallback_used | BOOLEAN | DEFAULT false |
| consensus_aligned | BOOLEAN | |
| confidence_score | DECIMAL(4,3) | |
| tokens_input | INTEGER | |
| tokens_output | INTEGER | |
| cost_usd | DECIMAL(10,6) | |
| status | TEXT | success, degraded, error |
| created_at | TIMESTAMP | DEFAULT NOW() |

### spaniel.model_catalog

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PRIMARY KEY |
| model_id | TEXT NOT NULL | OpenRouter model string |
| provider | TEXT NOT NULL | |
| context_window | INTEGER | |
| cost_per_m_input | DECIMAL(10,6) | |
| cost_per_m_output | DECIMAL(10,6) | |
| avg_latency_ms | INTEGER | |
| benchmark_scores | JSONB | |
| active | BOOLEAN | DEFAULT true |
| last_evaluated | TIMESTAMP | |

---

## 10. Deployment

| Service | Railway Project | Auto-Deploy Branch |
|---------|-----------------|-------------------|
| Spaniel API | cavaridge-spaniel-api | main |

Secrets managed via Doppler synced to Railway environment variables. No plaintext keys in repo. `.env` gitignored.

---

## 11. Open Items

1. Define specific benchmark weights for automated model evaluation scoring
2. Confirm OpenRouter model string format for all initial routing matrix entries
3. Define service token rotation automation pipeline