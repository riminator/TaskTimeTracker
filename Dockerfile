# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies first (cache layer)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY src/ ./src/
COPY web/ ./web/
COPY config/ ./config/

# Uploads directory must exist at runtime
RUN mkdir -p uploads logs

# Fly.io injects PORT at runtime; default to 3000 locally
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "web/server.js"]
