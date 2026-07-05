FROM node:22-alpine AS base
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend ./
RUN npx prisma generate

EXPOSE 4000
CMD ["sh", "./scripts/start-dev.sh"]
