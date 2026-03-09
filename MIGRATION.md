# Migration Guide

Step-by-step instructions for moving your existing repos into the Cavaridge monorepo.

## Prerequisites

- Empty `cavaridge` repo created on GitHub (cavaridge-llc/cavaridge)
- All existing repos cloned locally
- pnpm installed: `npm install -g pnpm`
- Turbo installed: `pnpm add -g turbo` (or it installs as a devDep)

## Step 1: Clone and push the scaffold

```bash
# Clone this scaffold (or download and init)
cd ~/Projects  # or wherever you keep code
git clone https://github.com/cavaridge-llc/cavaridge.git
cd cavaridge

# If starting from the downloaded scaffold instead:
# mkdir cavaridge && cd cavaridge
# cp -r ~/Downloads/cavaridge-scaffold/* .
# cp -r ~/Downloads/cavaridge-scaffold/.* . 2>/dev/null
# git init
# git remote add origin https://github.com/cavaridge-llc/cavaridge.git

git add -A
git commit -m "chore: initial monorepo scaffold"
git push -u origin main
```

## Step 2: Move CVG-CORE governance files

CVG-CORE doesn't become an app — its contents dissolve into root directories.

```bash
# From the monorepo root
cp -r ../cvg-core/standards/* standards/ 2>/dev/null
cp -r ../cvg-core/templates/* templates/ 2>/dev/null
cp -r ../cvg-core/prompts/* prompts/ 2>/dev/null
cp -r ../cvg-core/runbooks/* runbooks/ 2>/dev/null
cp -r ../cvg-core/.github/workflows/compliance-check.yml .github/workflows/compliance-legacy.yml 2>/dev/null
cp -r ../cvg-core/.github/workflows/ci-shared.yml .github/workflows/ci-shared-legacy.yml 2>/dev/null
cp ../cvg-core/scripts/* scripts/ 2>/dev/null

git add -A
git commit -m "chore: migrate cvg-core governance files"
```

## Step 3: Move each app (repeat for all 6)

The pattern is the same for every app. Example with Meridian:

```bash
# Copy everything EXCEPT .git, node_modules, dist
rsync -av --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='.next' \
  ../cvg-meridian/ apps/meridian/

# Verify the package.json landed
cat apps/meridian/package.json

git add -A
git commit -m "chore: migrate meridian into monorepo"
```

Repeat for each app:
```bash
rsync -av --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='.next' \
  ../cvg-caelum/ apps/caelum/
git add -A && git commit -m "chore: migrate caelum into monorepo"

rsync -av --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='.next' \
  ../cvg-midas/ apps/midas/
git add -A && git commit -m "chore: migrate midas into monorepo"

rsync -av --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='.next' \
  ../cvg-vespar/ apps/vespar/
git add -A && git commit -m "chore: migrate vespar into monorepo"

rsync -av --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='.next' \
  ../cvg-astra/ apps/astra/
git add -A && git commit -m "chore: migrate astra into monorepo"

rsync -av --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='.next' \
  ../cvg-hipaa/ apps/hipaa/
git add -A && git commit -m "chore: migrate hipaa into monorepo"
```

## Step 4: Install dependencies

```bash
pnpm install
```

This installs all dependencies for all apps and shared packages. pnpm deduplicates shared dependencies automatically.

## Step 5: Verify it works

```bash
# Run one app
pnpm dev --filter=meridian

# Run compliance check
pnpm compliance

# Build everything
pnpm build
```

## Step 6: Push and verify CI

```bash
git push
```

Check GitHub Actions — the CI workflow should run lint, typecheck, test, and compliance checks.

## Step 7: Archive old repos

Once you've verified everything works in the monorepo:

1. Go to each old repo on GitHub (cvg-core, cvg-meridian, etc.)
2. Settings → scroll to bottom → "Archive this repository"
3. This makes them read-only. Nothing is deleted.

## Step 8: Connect Vercel

For each app that needs deployment:

1. Go to vercel.com → Add New Project
2. Import from GitHub → select `cavaridge-llc/cavaridge`
3. Set **Root Directory** to `apps/meridian` (or whichever app)
4. Vercel auto-detects the framework
5. Add environment variables (Supabase URL, keys, etc.)
6. Deploy

Repeat for each app. Turbo's remote caching with Vercel means builds are fast.

## What Comes Next

After migration, use Claude Code for all future work:

```bash
cd ~/Projects/cavaridge
claude
```

Tell it what you want. It sees the whole monorepo, all standards, all apps, all shared packages. One conversation, full context.

Incremental improvements to make over time (Claude Code can do all of these):
- Extract duplicate UI components from apps into `packages/ui`
- Wire up `@cavaridge/auth` with Supabase Auth for real
- Wire up `@cavaridge/db` as the shared Drizzle config
- Replace per-app theme implementations with `@cavaridge/config/theme`
- Replace per-app LLM clients with `@cavaridge/config/llm`
