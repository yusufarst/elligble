# syntax=docker/dockerfile:1
# ELLIGBLE web deployment: one Node 24 process serves the API and the built web client
# from a single origin. TLS terminates at the reverse proxy in front of this container
# (the session cookie is Secure and __Host- bound). Configuration: see .env.example.
ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS web
WORKDIR /build/frontend/web
COPY frontend/web/package.json frontend/web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/web/ ./
RUN npm run build

FROM ${NODE_IMAGE} AS runtime-deps
WORKDIR /app/runtime
COPY runtime/identity-access/package.json runtime/identity-access/package-lock.json ./identity-access/
COPY runtime/tenant-access/package.json runtime/tenant-access/package-lock.json ./tenant-access/
COPY runtime/academic-core/package.json runtime/academic-core/package-lock.json ./academic-core/
COPY runtime/secure-assessment/package.json runtime/secure-assessment/package-lock.json ./secure-assessment/
RUN for pkg in identity-access tenant-access academic-core secure-assessment; do \
        (cd "$pkg" && npm ci --omit=dev --no-audit --no-fund) || exit 1; \
    done

FROM ${NODE_IMAGE}
ENV NODE_ENV=production \
    ELLIGBLE_ENV=production \
    SA_HOST=0.0.0.0 \
    SA_PORT=3000 \
    SA_STATIC_DIR=/app/web
WORKDIR /app
COPY --from=runtime-deps /app/runtime /app/runtime
COPY runtime/identity-access/src /app/runtime/identity-access/src
COPY runtime/tenant-access/src /app/runtime/tenant-access/src
COPY runtime/academic-core/src /app/runtime/academic-core/src
COPY runtime/secure-assessment/src /app/runtime/secure-assessment/src
COPY database/migrations /app/database/migrations
COPY --from=web /build/frontend/web/dist /app/web
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=60s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.SA_PORT || 3000) + '/healthz').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "runtime/secure-assessment/src/main.ts"]
