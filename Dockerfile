FROM node:22.16.0-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/companion/package.json apps/companion/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/adapter-codex/package.json packages/adapter-codex/package.json
COPY packages/cli/package.json packages/cli/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
# Preserve the already-built workspace output, then replace the development
# dependency graph with the lockfile-pinned production graph without network I/O.
RUN CI=true pnpm install --prod --frozen-lockfile --offline

FROM node:22.16.0-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=47830 WEB_ROOT=/app/dist/web
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 47830
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:47830/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
