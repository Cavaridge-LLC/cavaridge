#!/bin/bash
# scripts/dev-start.sh — Sources app .env and starts the dev server
# Called by .claude/launch.json via: /bin/bash scripts/dev-start.sh
# CWD is set by launch.json to the app directory (e.g., apps/ducky)

# Source .env if it exists (exports all variables)
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Start the server with tsx
exec /opt/homebrew/Cellar/node/25.8.0/bin/node \
  /Users/benjaminposner/Documents/GitHub/cavaridge/node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs \
  server/index.ts
