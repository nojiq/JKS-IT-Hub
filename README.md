# IT-Hub

Monorepo for the IT-Hub web SPA (Vite + React) and API (Fastify).

## Requirements

- Node.js >= 20.19.0 (recommended: 24 LTS)
- pnpm
- Docker (for MySQL)

## Getting started

1. Copy environment template: `cp .env.example .env` (Update default credentials in `.env` to match your local setup or use defaults: user `it_hub`, password `secret`)
2. Start MySQL: `docker compose up -d mysql`
3. Install dependencies: `pnpm install`
4. Run web dev server: `pnpm --filter web dev` at `http://localhost:5176`
5. Run API dev server: `pnpm --filter api dev` at `http://localhost:3006`

## PM2 Dev Autostart

- Start IT-Hub dev processes in PM2: `pm2 start ecosystem.config.cjs`
- Save the current PM2 process list for login restore: `pm2 save`
- Check status: `pm2 ls`
- View logs: `pm2 logs jks-it-hub-frontend` or `pm2 logs jks-it-hub-backend`
