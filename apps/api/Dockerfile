FROM node:24-alpine
WORKDIR /app
COPY . .
RUN corepack enable && corepack pnpm install --frozen-lockfile=false && corepack pnpm --filter @groweasy/api build
EXPOSE 4000
CMD ["corepack", "pnpm", "--filter", "@groweasy/api", "start"]
