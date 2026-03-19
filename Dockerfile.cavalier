FROM node:20-slim AS build
RUN npm i -g pnpm@9
WORKDIR /app

# Copy workspace scaffolding
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.json ./

# Copy all packages (shared deps)
COPY packages/ packages/

# Copy the app
COPY apps/cavalier/ apps/cavalier/

# Install deps
RUN pnpm install --no-frozen-lockfile --filter @cavaridge/cavalier...

# Build
WORKDIR /app/apps/cavalier
RUN pnpm run build

# ---- Production stage (minimal) ----
FROM node:20-slim
WORKDIR /app

# Copy the bundled server
COPY --from=build /app/apps/cavalier/dist/ ./dist/

ENV NODE_ENV=production

CMD ["node", "--dns-result-order=ipv4first", "dist/index.cjs"]
