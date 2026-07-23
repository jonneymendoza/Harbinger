FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json ./

RUN pnpm install

ARG NEXT_PUBLIC_API_URL=http://localhost:8082/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY . .

RUN pnpm build

FROM node:20-alpine AS runner

WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ENV NODE_ENV=production \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    PORT=3000

COPY --from=builder /app/package.json ./package.json
RUN npm install -g pnpm && pnpm install --prod

COPY --from=builder /app/.next ./.next

EXPOSE 3000

CMD ["pnpm", "start"]
