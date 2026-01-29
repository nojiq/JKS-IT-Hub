---
project_name: 'IT-Hub'
user_name: 'Haziq afendi'
date: '2026-01-28'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality_rules', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 37
optimized_for_llm: true
existing_patterns_found: 6
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

_Documented after discovery phase_

## Critical Implementation Rules

_Documented after discovery phase_

## Technology Stack & Versions

- Frontend: React (Vite SPA)
- Router: React Router DOM 7.12.0
- Server state: TanStack Query 5.90.20
- Backend: Node.js + Fastify
- DB: MySQL 8.4.8 LTS
- ORM: Prisma 7.3.0
- Validation: Zod 4.3.0
- Auth: LDAP/AD bind + JWT cookies (jose 6.1.3)
- API docs: OpenAPI 3.0.3 via @fastify/swagger 9.6.1
- Rate limiting: @fastify/rate-limit 10.3.0
- Live updates: SSE via fastify-sse-v2 4.2.1
- Deployment: Docker

### Language-Specific Rules
- Use ESM imports/exports everywhere (`import`/`export`), no CommonJS.
- Prefer async/await; avoid raw Promise chains.
- Use native `fetch` for HTTP in the API unless a strong reason.
- Always validate external input with Zod before use.

### Framework-Specific Rules
- React: feature modules live in `apps/web/src/features/*`; shared UI in `apps/web/src/shared/ui`.
- React Router: use nested routes per feature; no route logic in components.
- TanStack Query: all server data goes through Query; no manual fetch in components.
- Fastify: routes + schema co-located in `apps/api/src/features/*`; use schema-based validation.
- Prisma: DB access only in `repo.js`; services never issue raw queries.
- SSE: emit feature events as `feature.event` with payload `{ id, type, timestamp, data }`.

### Testing Rules
- Place tests under `tests/api`, `tests/web`, and `tests/e2e`.
- Prefer integration tests for API routes and critical workflows.
- Avoid adding a test framework until we decide one; keep test structure ready.

### Code Quality & Style Rules
- Naming: DB snake_case; API JSON camelCase; filenames kebab-case (web) and camelCase (api).
- API responses: `{ data, meta? }` on success; RFC 9457 Problem Details on errors.
- Dates: ISO 8601 UTC strings only.
- Feature code stays inside `features/*`; shared utilities only in `shared/*`.

### Development Workflow Rules
- Keep secrets in `.env` and commit only `.env.example`.
- Use Docker for local MySQL and service orchestration.
- Deploy from main only; no direct prod edits.

### Critical Don't-Miss Rules
- IMAP credentials are NEVER exported; IT-only access.
- Disabled users cannot be exported or regenerated; must be re-enabled first.
- All sensitive actions must write to audit log.
- No user deletion; disable only.
- Use SSE for live status updates; avoid polling unless necessary.
---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-01-28
