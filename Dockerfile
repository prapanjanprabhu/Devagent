# syntax=docker/dockerfile:1

# ---- base: Node 22 ----
FROM node:22-alpine AS base
WORKDIR /app

# ---- deps: install packages (cached until package files change) ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: build the Next.js app (standalone output) ----
FROM base AS builder
ARG GIT_SHA=dev
ARG BUILD_TIME=unknown
ENV NEXT_TELEMETRY_DISABLED=1 GIT_SHA=${GIT_SHA} BUILD_TIME=${BUILD_TIME}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: small image, non-root user ----
FROM base AS runner
ARG GIT_SHA=dev
ARG BUILD_TIME=unknown
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    GIT_SHA=${GIT_SHA} \
    BUILD_TIME=${BUILD_TIME}

LABEL org.opencontainers.image.title="devagent" \
      org.opencontainers.image.description="AI front desk for appointment businesses" \
      org.opencontainers.image.source="https://github.com/prapanjanprabhu/Devagent" \
      org.opencontainers.image.revision=${GIT_SHA} \
      org.opencontainers.image.created=${BUILD_TIME}

# npm and yarn are only needed to build; removing them from the final image drops known-vulnerable bundled packages
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app app \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
              /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public

# No data volume: this container keeps nothing. All data lives in Postgres (DATABASE_URL),
# so you can run as many copies of this image as you like.
USER 10001
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
