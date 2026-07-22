FROM mcr.microsoft.com/playwright:v1.50.0-jammy AS base

WORKDIR /usr/src/backend
RUN apt-get update && apt-get install -y \
    curl gnupg2 \
    && curl -sL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm \
    && rm -rf /var/lib/apt/lists/*

RUN npx playwright install --with-deps chromium


FROM base AS builder

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc
RUN npx tsc-alias -p tsconfig.json


FROM base AS runner

WORKDIR /usr/src/backend

# Install production deps only (skip devDeps)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder stage
COPY --from=builder /usr/src/backend/dist ./dist

EXPOSE 5000
CMD ["node", "dist/server.js"]
