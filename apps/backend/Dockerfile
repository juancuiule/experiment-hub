FROM node:24-alpine AS build
WORKDIR /app
# Manifests first so dependency layers survive source-only rebuilds.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json
RUN corepack enable && pnpm install --frozen-lockfile
COPY apps/backend ./apps/backend
RUN pnpm --filter @experiment-hub/backend build
# pnpm deploy relies on packlist semantics: "files": ["dist"] in
# apps/backend/package.json is what keeps dist/ in /app/deploy. Note this
# targets pnpm 9 (packageManager) — v10's deploy needs --legacy or
# injectWorkspacePackages.
RUN pnpm --filter @experiment-hub/backend deploy --prod /app/deploy

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/deploy/dist ./dist
COPY --from=build /app/deploy/node_modules ./node_modules
COPY --from=build /app/deploy/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/server.js"]
