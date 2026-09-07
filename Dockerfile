# syntax=docker/dockerfile:1
FROM node:18-bullseye-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

FROM base AS build
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY prisma ./prisma
RUN npx prisma generate

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY src ./src
COPY package.json ./

RUN addgroup --system --gid 1001 bridge && adduser --system --uid 1001 --gid 1001 bridge
USER bridge

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
