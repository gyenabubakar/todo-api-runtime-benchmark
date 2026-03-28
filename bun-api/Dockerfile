FROM oven/bun:1.3.11-alpine

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY tests ./tests

EXPOSE 8082

CMD ["bun", "run", "src/index.ts"]
