# IT-Hub

Monorepo for the IT-Hub web SPA (Vite + React) and API (Fastify).

## Requirements

- Node.js >= 20.19.0 (recommended: 24 LTS)
- pnpm
- Docker (for MySQL)

## Getting started

1. Copy environment template: `cp .env.example .env`
2. Start MySQL: `docker compose up -d mysql`
3. Install dependencies: `pnpm install`
4. Run web dev server: `pnpm --filter web dev`
5. Run API dev server: `pnpm --filter api dev`
