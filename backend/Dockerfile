# ---- Eventra API: small production image ----
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install only production dependencies (cached unless package files change)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# App source, owned by the built-in non-root "node" user
COPY --chown=node:node src ./src

USER node
EXPOSE 4000

# Docker marks the container unhealthy if the API or database check fails
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/api/health" > /dev/null || exit 1

CMD ["node", "src/server.js"]
