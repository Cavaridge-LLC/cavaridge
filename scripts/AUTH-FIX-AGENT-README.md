# Auth Fix Agent

**Document Code:** CVG-AUTH-AGENT-v1.0.0-20260324

Autonomous orchestrator that drives Claude Code CLI through the complete auth system fix across the Cavaridge monorepo. Runs all four phases of `AUTH-FIX-RUNBOOK.md` without human intervention.

## Prerequisites

1. **Claude Code CLI** installed globally:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **Anthropic API key** in your environment:
   ```bash
   # Option A: Direct export
   export ANTHROPIC_API_KEY="sk-ant-..."

   # Option B: Via Doppler (recommended for Cavaridge)
   eval $(doppler secrets download --no-file --format env)
   ```

3. **Run from the monorepo root** — the script uses `git rev-parse --show-toplevel` to orient itself.

4. **Clean git state** — commit or stash any work in progress before running.

## Setup

```bash
# 1. Place files in the monorepo
cp auth-fix-agent.sh  <monorepo>/scripts/auth-fix-agent.sh
cp AUTH-FIX-RUNBOOK.md <monorepo>/docs/runbooks/AUTH-FIX-RUNBOOK.md

# 2. Make executable
chmod +x scripts/auth-fix-agent.sh

# 3. Create the logs directory
mkdir -p logs/auth-fix-agent

# 4. Add logs to .gitignore (if not already there)
echo "logs/" >> .gitignore
```

## Usage

### Run everything (recommended first time)

```bash
cd /path/to/cavaridge-monorepo
./scripts/auth-fix-agent.sh
```

This runs Phase 0 → 1 → 2 (all 14 apps) → 3 sequentially. Expect it to take 30–90 minutes depending on repo size and API speed.

### Dry run (see what it would do)

```bash
./scripts/auth-fix-agent.sh --dry-run
```

Prints all prompts without executing anything. Good for reviewing before committing to a real run.

### Resume from a phase

```bash
# If Phase 1 completed but Phase 2 failed on app 5 of 14:
./scripts/auth-fix-agent.sh --resume 2
```

Phase 2 will restart from the beginning of the app list, but since earlier apps were already committed, Claude Code will see them as already fixed and move quickly.

### Run a single phase

```bash
./scripts/auth-fix-agent.sh --phase 1    # Only fix packages/auth
./scripts/auth-fix-agent.sh --phase 3    # Only run the smoke test
```

## What It Does

| Phase | Action | Commits | Human Needed |
|-------|--------|---------|--------------|
| 0 | Reads entire repo, produces status report | None | No |
| 1 | Fixes `packages/auth/` to match UTM spec | 1 commit | No |
| 2 | Wires shared auth into each app (14 sessions) | 1 commit per app | No |
| 3 | Workspace-wide `pnpm build` + `tsc --noEmit` | 1 commit | No |

## Output Files

All output lands in `logs/auth-fix-agent/`:

| File | Contents |
|------|----------|
| `STATUS.md` | Running status with timestamps — check this for progress |
| `agent-YYYYMMDD-HHMMSS.log` | Full agent orchestration log |
| `phase0-YYYYMMDD-HHMMSS.log` | Raw Claude Code output for Phase 0 |
| `phase0-report.md` | Structured orientation findings |
| `phase1-YYYYMMDD-HHMMSS.log` | Raw Claude Code output for Phase 1 |
| `phase1-report.md` | What changed in packages/auth |
| `phase2-{app}-YYYYMMDD-HHMMSS.log` | Raw output per app |
| `phase2-report.md` | Per-app auth wiring results |
| `phase3-YYYYMMDD-HHMMSS.log` | Raw output for smoke test |
| `phase3-summary.md` | **Final summary table** — this is what you review |

## Monitoring While It Runs

The agent sends you updates every 5 minutes automatically. Here's what you get:

### Live heartbeat file (always on)

```bash
# Watch the heartbeat — updates every 5 minutes with current phase, app, and timing
watch cat logs/auth-fix-agent/HEARTBEAT.md
```

### macOS notifications (automatic if on Mac)

Native macOS notification banners fire on every phase transition and every 5 minutes. No setup needed — if `osascript` is available, you'll see them.

### Slack notifications (optional)

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
export NOTIFY_METHOD="slack"
./scripts/auth-fix-agent.sh
```

### Email notifications (optional)

```bash
export NOTIFY_EMAIL="benjamin@cavaridge.com"
export NOTIFY_METHOD="email"
./scripts/auth-fix-agent.sh
```

### All notification methods at once

```bash
export NOTIFY_METHOD="all"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
export NOTIFY_EMAIL="benjamin@cavaridge.com"
./scripts/auth-fix-agent.sh
```

### Other monitoring commands

```bash
# Tail the live agent log
tail -f logs/auth-fix-agent/agent-*.log

# Watch STATUS.md for phase-level transitions
watch cat logs/auth-fix-agent/STATUS.md

# Check git commits as they happen
watch git log --oneline -10
```

### What triggers a notification

| Event | Example |
|-------|---------|
| Agent start | "Auth fix agent launched..." |
| Phase start | "Phase 1 Started — Fixing packages/auth..." |
| Phase complete | "Phase 1 Complete — packages/auth/ aligned..." |
| Phase failure | "PHASE 1 FAILED — Check logs..." |
| Each app start (Phase 2) | "Starting CVG-AI (apps/spaniel) [1/14]" |
| Each app complete | "CVG-AI complete (1/14 done, 0 failed)" |
| 5-minute heartbeat | "Phase 2 — App 5/14 \| CVG-HIPAA \| 12:34 elapsed" |
| Agent complete | "All phases finished in 01:23:45. 13 wired, 1 failed." |

## After Completion

1. Open `logs/auth-fix-agent/phase3-summary.md` — this has the full status table
2. Check `STATUS.md` for any phases marked FAILED
3. Run `git log --oneline -20` to see all commits
4. If everything looks good: `git push origin main`
5. If something needs manual attention: the logs tell you exactly which app and what failed

## Tuning

Edit the variables at the top of `auth-fix-agent.sh`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `MAX_TURNS_PHASE0` | 15 | Agent iterations for orientation |
| `MAX_TURNS_PHASE1` | 40 | Agent iterations for auth package fix |
| `MAX_TURNS_PHASE2` | 30 | Agent iterations per app |
| `MAX_TURNS_PHASE3` | 25 | Agent iterations for smoke test |
| `STATUS_INTERVAL` | 300 | Heartbeat interval in seconds (300 = 5 min) |
| `NOTIFY_METHOD` | terminal | `terminal`, `slack`, `email`, or `all` |
| `SLACK_WEBHOOK_URL` | (empty) | Slack incoming webhook URL |
| `NOTIFY_EMAIL` | (empty) | Email address for notifications |
| `ALLOWED_TOOLS` | (see script) | Claude Code tool permissions |

If a phase runs out of turns before completing, increase its `MAX_TURNS` and `--resume` from that phase.

## Cost Estimate

Rough estimate based on Claude Sonnet 4.6 pricing:

- Phase 0: ~$0.05–0.15 (read-only)
- Phase 1: ~$0.20–0.80 (schema + middleware + types)
- Phase 2: ~$0.15–0.50 per app × 14 apps = $2.10–7.00
- Phase 3: ~$0.10–0.40 (build + type check)

**Total: ~$2.50–$8.00** for a full run. Actual cost depends on repo size and how many fixes are needed.

## Troubleshooting

**"Claude Code not found"** → Install with `npm install -g @anthropic-ai/claude-code`

**"ANTHROPIC_API_KEY not set"** → Export it or use Doppler: `eval $(doppler secrets download --no-file --format env)`

**Phase fails with max turns exceeded** → Increase `MAX_TURNS_PHASEX` in the script and resume: `./scripts/auth-fix-agent.sh --resume X`

**App directory not found** → The script tries fuzzy matching. If your app directories don't match the names in `APP_BUILD_ORDER`, edit the array at the top of the script.

**Git commit fails** → The script handles this gracefully (continues if nothing to commit). Check that your git user is configured.
