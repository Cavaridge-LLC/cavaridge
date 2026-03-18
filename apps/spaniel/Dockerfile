FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Copy everything (filtered by .dockerignore)
COPY . .

# Install workspace dependencies
RUN pnpm install --frozen-lockfile --prefer-offline

# Build Spaniel only (not turbo build which tries all apps)
RUN cd apps/spaniel && npx esbuild server/index.ts \
  --bundle --platform=node --target=node20 --format=cjs \
  --outfile=dist/index.cjs \
  --external:pino --external:pino-pretty

EXPOSE 5100
ENV NODE_ENV=production
CMD ["node", "apps/spaniel/dist/index.cjs"]
