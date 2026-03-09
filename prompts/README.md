# Cavaridge Prompt Pipeline

These are the versioned, canonical prompts that govern all Cavaridge build and remediation work. Each file is a self-contained prompt with usage instructions in the header.

## New App Build Flow

```
Phase 1 → Phase 2 → Phase 3 → [Replit builds] → Phase 4
```

| Step | File | Where to Run | Output |
|------|------|-------------|--------|
| 1 | `build/phase-1-architecture-lock.md` | App's Claude Project | Architecture document |
| 2 | `build/phase-2-architecture-audit.md` | Same session | Revised architecture |
| 3 | `build/phase-3-build-packet.md` | Same session | Deterministic build spec |
| — | `replit-preamble.md` | Prepend to build spec | — |
| — | *(paste into Replit Agent)* | Replit | Running code |
| 4 | `build/phase-4-quality-gate.md` | Back in Claude Project | Remediation punch list |

## Existing App Remediation

| Step | File | Where to Run |
|------|------|-------------|
| 1 | `remediation/remediation-pipeline.md` | App's Claude Project |
| 2 | Paste Phase 1 tasks into Replit | Replit |
| 3 | Verify Phase 1, then paste Phase 2 | Replit |
| 4 | Verify Phase 2, then paste Phase 3 | Replit |

## Runbook Generation

| Step | File | Where to Run |
|------|------|-------------|
| 1 | `extraction/claude-runbook-prompt.md` | App's Claude Project |
| 2 | `extraction/replit-runbook-prompt.md` | Replit |
| 3 | Merge both outputs in CVG-CORE | CVG-CORE Claude Project |

## Rules

- Never skip phases in the build pipeline
- Never open Replit until Phase 3 output is complete
- Never run all remediation phases at once — complete and verify each phase
- All prompts are versioned — check the header for version and date
- Update this directory when prompts change, and bump version numbers
