# ── Stage 1: build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# VITE_* build-time variables injected from docker-compose build args
ARG VITE_NFT_CONTRACTS
ARG VITE_ACCOUNT_ID
ARG VITE_API_URL=http://localhost:3002

ENV VITE_NFT_CONTRACTS=$VITE_NFT_CONTRACTS
ENV VITE_ACCOUNT_ID=$VITE_ACCOUNT_ID
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: serve with nginx ────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
