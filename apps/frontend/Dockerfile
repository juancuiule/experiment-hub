FROM node:24-alpine AS build
WORKDIR /app
# Manifests first so dependency layers survive source-only rebuilds.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/engine/package.json ./packages/engine/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
RUN corepack enable && pnpm install --frozen-lockfile
COPY packages/engine ./packages/engine
COPY apps/frontend ./apps/frontend
RUN pnpm --filter @experiment-hub/frontend build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build /app/apps/frontend/.next/standalone ./
COPY --from=build /app/apps/frontend/.next/static ./apps/frontend/.next/static
# Next's standalone output doesn't include public/ — copy it separately or
# static assets like the favicon/logo 404 at runtime.
COPY --from=build /app/apps/frontend/public ./apps/frontend/public
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
