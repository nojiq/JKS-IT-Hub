---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/analysis/brainstorming-session-2026-01-14.md
workflowType: 'architecture'
project_name: 'IT-Hub'
user_name: 'Haziq afendi'
date: '2026-01-27'
lastStep: 8
status: 'complete'
completedAt: '2026-01-28'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
The system centralizes multiple IT workflows: LDAP sync (manual + scheduled), deterministic credential generation with overrides and history, export management with IMAP exclusion, preventive maintenance scheduling and sign-off, and item request approvals with e-invoice uploads. It also enforces RBAC across roles, supports user disable/enable without deletion, provides audit visibility, notifications (email + in-app), live status updates, and search across users/requests/maintenance.

**Non-Functional Requirements:**
Performance SLAs (most actions <=2s; live updates <=5s; exports <=5s single, <=30s batch), security (TLS + encryption at rest, RBAC, audit logs, IMAP access restriction), reliability (99.5% uptime during business hours, daily backups), and integration reliability (LDAP sync success >=99% with retry + alerting).

**Scale & Complexity:**
Low-to-medium complexity internal SPA with multiple workflow modules, real-time updates, scheduled jobs, and integration to LDAP + email. No multi-tenancy or formal regulatory compliance stated.

- Primary domain: internal web application (SPA)
- Complexity level: low-to-medium
- Estimated architectural components: ~9 (auth/RBAC, user/LDAP sync, credential mgmt, export service, maintenance module, request/approval module, notifications, audit/logging, file storage)

### Technical Constraints & Dependencies

- Read-only LDAP integration; LDAP is source of truth for identity attributes.
- Deterministic credential generation with audit history; template changes trigger regeneration.
- IMAP credentials are IT-only and never exported.
- Users cannot be deleted; disabled users are visible but blocked from export/regeneration.
- Manual approvals only (no auto-approve); mobile-friendly approval flows required.
- Internal-only access; SEO not required; dark mode mandated.

### Cross-Cutting Concerns Identified

RBAC, audit logging, encryption, live updates, notifications, scheduled jobs, export security, file uploads, and data change history.

## Starter Template Evaluation

### Primary Technology Domain

Internal web SPA + Node.js API based on requirements and your JS/React/Node/MySQL/Docker preferences.

### Starter Options Considered

1) Vite + React SPA (frontend) + Node API
- Frontend scaffold: `npm create vite@latest` with the React template; Vite requires recent Node versions (see Language & Runtime below).
- Backend option A (Express): `npx express-generator <api> --no-view`
- Backend option B (Fastify): `npm install --global fastify-cli` then `fastify generate <api>`

2) Next.js (full-stack React)
- `npx create-next-app@latest`
- Requires Node 20.9+ (per official docs).

3) Remix (full-stack React)
- `npx create-remix@latest`
- JS template available via `--template remix-run/remix/templates/remix-javascript`.

Not recommended: Create React App (deprecated).

### Selected Starter: Vite React SPA + Fastify API

**Rationale for Selection:**
- Matches SPA requirement with a clean API boundary for LDAP, exports, scheduling, and audit logging.
- Minimal opinionation and easy Dockerization.
- JS-first scaffolds keep onboarding simple for an intermediate team.

**Initialization Command:**

```bash
# frontend
npm create vite@latest it-hub-web -- --template react

# backend
npm install --global fastify-cli
fastify generate it-hub-api
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- JavaScript across frontend and backend.
- Vite requires Node 20.19+ or 22.12+ (per official docs).

**Styling Solution:**
- Plain CSS by default on the Vite React template.

**Build Tooling:**
- Vite handles dev server and production build for the SPA.
- Fastify CLI provides a minimal Node server scaffold.

**Testing Framework:**
- None by default; we will select testing tools later.

**Code Organization:**
- Frontend: minimal `src/` app structure.
- Backend: Fastify app structure with routes/plugins conventions.

**Development Experience:**
- Fast HMR in Vite; simple Node dev scripts on the API side.

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Data Architecture

- Database: MySQL 8.4 LTS (target 8.4.8 LTS).
- ORM: Prisma ORM 7.3.0.
- Migrations: Prisma Migrate (schema-driven workflow).
- Validation: Zod 4.3.0 for API input validation.
- Caching: None initially; revisit after performance validation. If needed later, use Redis with node-redis (current 5.9.0).

### Authentication & Security

- Authentication source: LDAP/AD bind (no local password storage in the app).
- Session style: JWT access tokens issued by the API and delivered via HttpOnly, Secure, SameSite cookies.
- JWT implementation: jose v6.1.3.
- MFA: not required initially (defer).
- Authorization: RBAC enforced at the API layer; audit logs for sensitive actions.
- LDAP client/library: avoid ldapjs (archived); select a maintained LDAP client or a small LDAP gateway service at implementation time.

### API & Communication Patterns

- API style: REST + JSON.
- API documentation: OpenAPI 3.0.3 generated from route schemas via @fastify/swagger 9.6.1.
- Error format: Problem Details for HTTP APIs (RFC 9457, obsoletes RFC 7807).
- Rate limiting: basic per-IP/per-user using @fastify/rate-limit 10.3.0.
- Live updates: Server-Sent Events (SSE) using fastify-sse-v2 4.2.1 for status streams.

### Frontend Architecture

- Routing: React Router DOM 7.12.0 with nested routes for feature areas.
- State management: local React state + Context for shared UI state; avoid a global store until needed.
- Server data: TanStack Query 5.90.20 for fetching, caching, and invalidation.
- Component strategy: feature-based folders with a shared `ui/` component library; CSS Modules or plain CSS for styling.
- Code organization: vertical slice (feature-based) for both frontend and backend modules.
- Performance: route-level code splitting with React.lazy + Suspense; avoid premature optimization.

### Infrastructure & Deployment

- Hosting: Dockerized services for web, API, and MySQL; deploy to a single VM or container host initially.
- Environments: `.env` per environment with strict separation of dev/stage/prod configuration.
- CI/CD: basic pipeline for lint/test/build; deploy on main branch only.
- Observability: structured JSON logs to stdout; centralize via log collector when deployed.
- Monitoring: basic uptime + API latency dashboards; add alerting for LDAP sync failures and export errors.
- Backups: daily MySQL backups with periodic restore checks.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
6 areas (naming, structure, formats, communication, process, logging)

### Naming Patterns

**Database Naming Conventions:**
- Tables: snake_case plural (e.g., `users`, `item_requests`)
- Columns: snake_case (e.g., `user_id`, `created_at`)
- FKs: `{table}_id` (e.g., `requester_id`)
- Indexes: `idx_{table}_{column}` (e.g., `idx_users_email`)

**API Naming Conventions:**
- REST endpoints: plural nouns (`/users`, `/item-requests`)
- Route params: `:id` style (`/users/:id`)
- Query params: camelCase (e.g., `statusFilter`)
- Headers: `X-Request-Id`, `X-Client-Version`

**Code Naming Conventions:**
- Components: PascalCase (`UserCard`)
- Files: kebab-case for frontend (`user-card.jsx`), camelCase for backend modules (`userRoutes.js`)
- Functions: camelCase (`getUserById`)
- Variables: camelCase (`userId`)

### Structure Patterns

**Project Organization:**
- Vertical slice by feature (both FE and BE).
- Each feature owns routes, services, schema, UI, tests.

**File Structure Patterns:**
- `features/{feature}/` for domain code
- `shared/` for reusable utilities and UI
- `config/` for env + runtime config
- `docs/` for API docs and ADRs

### Format Patterns

**API Response Formats:**
- Success: `{ data, meta? }`
- Error: RFC 9457 Problem Details
- Dates: ISO 8601 strings in UTC
- IDs: use string UUIDs in API payloads

**Data Exchange Formats:**
- JSON fields: camelCase
- Booleans: true/false
- Nulls: explicit null only when meaningful

### Communication Patterns

**Event System Patterns:**
- SSE event names: `feature.event` (e.g., `requests.updated`)
- Payloads: `{ id, type, timestamp, data }`
- Event versioning: optional `v1` in event name if needed

**State Management Patterns:**
- React Query for server state
- Local state for UI state; no global store initially

### Process Patterns

**Error Handling Patterns:**
- Centralized error handler in API
- Zod validation errors map to RFC 9457
- Log errors with requestId and userId

**Loading State Patterns:**
- Always show skeleton/loader on async screens
- Disable primary action buttons during submit
- Use optimistic UI only when reversible

### Enforcement Guidelines

**All AI Agents MUST:**
- Follow naming and response format rules
- Keep feature-based folder layout
- Use RFC 9457 for API errors

**Pattern Enforcement:**
- Add lint rules and PR checklist
- Document violations in `docs/patterns.md`

### Pattern Examples

**Good Examples:**
- `GET /item-requests/:id` -> `{ data: { id, requesterId, status } }`
- Table `item_requests` with column `requester_id`

**Anti-Patterns:**
- Mixing snake_case and camelCase in API payloads
- Creating `controllers/` and `services/` top-level folders outside features

## Project Structure & Boundaries

### Complete Project Directory Structure
```
it-hub/
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── .gitignore
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml
├── docker-compose.yml
├── docs/
│   ├── patterns.md
│   ├── api/
│   │   └── openapi.yaml
│   └── adr/
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── index.html
│   │   ├── vite.config.js
│   │   └── src/
│   │       ├── main.jsx
│   │       ├── app.jsx
│   │       ├── routes/
│   │       ├── features/
│   │       │   ├── users/
│   │       │   ├── credentials/
│   │       │   ├── maintenance/
│   │       │   ├── requests/
│   │       │   └── exports/
│   │       ├── shared/
│   │       │   ├── ui/
│   │       │   ├── hooks/
│   │       │   └── utils/
│   │       └── styles/
│   └── api/
│       ├── package.json
│       ├── src/
│       │   ├── server.js
│       │   ├── config/
│       │   ├── plugins/
│       │   ├── features/
│       │   │   ├── users/
│       │   │   │   ├── routes.js
│       │   │   │   ├── service.js
│       │   │   │   ├── repo.js
│       │   │   │   └── schema.js
│       │   │   ├── ldap/
│       │   │   ├── credentials/
│       │   │   ├── maintenance/
│       │   │   ├── requests/
│       │   │   ├── exports/
│       │   │   ├── notifications/
│       │   │   └── audit/
│       │   └── shared/
│       │       ├── auth/
│       │       ├── errors/
│       │       ├── logging/
│       │       └── utils/
│       └── prisma/
│           ├── schema.prisma
│           └── migrations/
└── tests/
    ├── api/
    ├── web/
    └── e2e/
```

### Architectural Boundaries

**API Boundaries:**
- REST endpoints grouped by feature under `apps/api/src/features/*/routes.js`
- Auth handled in `apps/api/src/shared/auth/`
- Prisma access isolated to feature repos

**Component Boundaries:**
- Frontend feature modules in `apps/web/src/features/*`
- Shared UI and hooks in `apps/web/src/shared/`

**Service Boundaries:**
- Feature services encapsulate business logic; shared services only in `shared/`

**Data Boundaries:**
- Prisma schema in `apps/api/prisma/schema.prisma`
- Repos handle DB access; services do not issue raw queries

### Requirements to Structure Mapping

**Feature/Epic Mapping:**
- LDAP Sync -> `apps/api/src/features/ldap/`, `apps/web/src/features/users/`
- Credential Generation -> `apps/api/src/features/credentials/`, `apps/web/src/features/credentials/`
- Export Management -> `apps/api/src/features/exports/`, `apps/web/src/features/exports/`
- Preventive Maintenance -> `apps/api/src/features/maintenance/`, `apps/web/src/features/maintenance/`
- Item Requests -> `apps/api/src/features/requests/`, `apps/web/src/features/requests/`
- Notifications -> `apps/api/src/features/notifications/`, `apps/web/src/shared/hooks/`
- Audit Logs -> `apps/api/src/features/audit/`, `apps/web/src/features/audit/`

**Cross-Cutting Concerns:**
- Auth/RBAC -> `apps/api/src/shared/auth/`
- Error handling -> `apps/api/src/shared/errors/`
- Logging -> `apps/api/src/shared/logging/`

### Integration Points

**Internal Communication:**
- Web <-> API via REST + SSE streams
- Features communicate only through shared utilities

**External Integrations:**
- LDAP via `apps/api/src/features/ldap/`
- Email via `apps/api/src/features/notifications/`

**Data Flow:**
- UI -> API routes -> service -> repo -> Prisma -> MySQL
- SSE events emitted from services for live updates

### File Organization Patterns

**Configuration Files:**
- Root `.env.example`, per-app `.env`

**Source Organization:**
- Vertical slice feature modules
- Shared UI + utilities per app

**Test Organization:**
- `tests/api`, `tests/web`, `tests/e2e` for integration

**Asset Organization:**
- `apps/web/public/` for static assets

### Development Workflow Integration

**Development Server Structure:**
- `apps/web` and `apps/api` run independently via workspace scripts

**Build Process Structure:**
- Web builds to `apps/web/dist`; API builds to `apps/api/dist` if needed

**Deployment Structure:**
- `docker-compose.yml` for local and initial deployment

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All choices are compatible: JS/React/Vite + Fastify + Prisma/MySQL + Docker. JWT-in-cookie auth aligns with SPA + API. SSE fits live status requirements.

**Pattern Consistency:**
Naming conventions, error format (RFC 9457), and response shape `{data, meta}` are consistent across API + UI.

**Structure Alignment:**
Feature-based folders map to vertical slice pattern and API module boundaries. Shared auth/errors/logging match cross-cutting concerns.

### Requirements Coverage Validation ✅

**Feature Coverage:**
All FR categories are mapped to modules: LDAP, credentials, exports, maintenance, requests, notifications, audit, RBAC, search, UI prefs.

**Functional Requirements Coverage:**
LDAP sync, deterministic credentials, export rules, PM scheduling, approvals, notifications, live updates, and audit logging are all supported by design.

**Non-Functional Requirements Coverage:**
Performance, security, reliability, and integration requirements are addressed via caching deferral, RBAC, encryption, backups, and monitoring.

### Implementation Readiness Validation ✅

**Decision Completeness:**
Key tech choices and versions documented. Auth, API format, and frontend patterns are specified.

**Structure Completeness:**
Full tree defined for web + API + tests.

**Pattern Completeness:**
Naming, format, error handling, and loading patterns are explicit with examples.

### Gap Analysis Results

**Critical Gaps:** None.
**Important Gaps:** LDAP client/library choice deferred to implementation.
**Nice-to-Have Gaps:** UI component library choice, testing stack selection.

### Validation Issues Addressed

- Deferred LDAP client to implementation to avoid using archived libraries.
- Caching deferred to performance verification.

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context analyzed
- [x] Scale assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Clear module boundaries per workflow
- Explicit patterns to avoid AI agent conflicts
- Security and audit considerations embedded

**Areas for Future Enhancement:**
- Choose LDAP client library
- Decide testing stack (unit/integration/e2e)

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions

**First Implementation Priority:**
Initialize starter templates for `apps/web` and `apps/api`, then add Prisma schema.

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅
**Total Steps Completed:** 8
**Date Completed:** 2026-01-28
**Document Location:** _bmad-output/planning-artifacts/architecture.md

### Final Architecture Deliverables

**📋 Complete Architecture Document**

- All architectural decisions documented with specific versions
- Implementation patterns ensuring AI agent consistency
- Complete project structure with all files and directories
- Requirements to architecture mapping
- Validation confirming coherence and completeness

**🏗️ Implementation Ready Foundation**

- Core architectural decisions documented
- Implementation patterns defined
- Architectural components specified
- Requirements fully supported

**📚 AI Agent Implementation Guide**

- Technology stack with verified versions
- Consistency rules that prevent implementation conflicts
- Project structure with clear boundaries
- Integration patterns and communication standards

### Implementation Handoff

**For AI Agents:**
This architecture document is the complete guide for implementing IT-Hub. Follow all decisions, patterns, and structures exactly as documented.

**First Implementation Priority:**
Initialize starter templates for `apps/web` and `apps/api`, then add Prisma schema.

**Development Sequence:**

1. Initialize project using documented starter template
2. Set up development environment per architecture
3. Implement core architectural foundations
4. Build features following established patterns
5. Maintain consistency with documented rules

### Quality Assurance Checklist

**✅ Architecture Coherence**

- [x] All decisions work together without conflicts
- [x] Technology choices are compatible
- [x] Patterns support the architectural decisions
- [x] Structure aligns with all choices

**✅ Requirements Coverage**

- [x] All functional requirements are supported
- [x] All non-functional requirements are addressed
- [x] Cross-cutting concerns are handled
- [x] Integration points are defined

**✅ Implementation Readiness**

- [x] Decisions are specific and actionable
- [x] Patterns prevent agent conflicts
- [x] Structure is complete and unambiguous
- [x] Examples are provided for clarity

### Project Success Factors

**🎯 Clear Decision Framework**
Every technology choice was made collaboratively with clear rationale, ensuring stakeholders understand the architectural direction.

**🔧 Consistency Guarantee**
Implementation patterns and rules ensure that multiple AI agents produce compatible, consistent code that works together seamlessly.

**📋 Complete Coverage**
All project requirements are architecturally supported, with clear mapping from business needs to technical implementation.

**🏗️ Solid Foundation**
The chosen starter template and architectural patterns provide a production-ready foundation following current best practices.

---

**Architecture Status:** READY FOR IMPLEMENTATION ✅

**Next Phase:** Begin implementation using the architectural decisions and patterns documented herein.

**Document Maintenance:** Update this architecture when major technical decisions are made during implementation.
