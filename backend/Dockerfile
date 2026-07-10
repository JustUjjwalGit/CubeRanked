FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts
COPY tsconfig.json ./

RUN npx prisma generate

EXPOSE 4000

CMD ["sh", "./scripts/start-dev.sh"]
